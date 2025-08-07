import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Play, Square, Lightbulb, CheckCircle, AlertCircle, Clock } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/hooks/useToast"
import { getCameras } from "@/api/cameras"
import { startAnalysisStream, stopAnalysisStream, sendFrameForAnalysis, getPromptSuggestions } from "@/api/analysis"

interface AnalysisResult {
  timestamp: string
  answer: string
  confidence: number
}

interface Camera {
  _id: string
  name: string
  type: string
  streamUrl: string
  status: string
  analysisInterval: number
}

interface AnalysisPanelProps {
  selectedCameraId?: string
  cameraUpdateTrigger?: number
  onStreamReady?: () => void
}

const syntaxHighlightJson = (json: string): string => {
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'text-gray-600 dark:text-gray-400';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'text-blue-600 dark:text-blue-400';
        } else {
          cls = 'text-green-600 dark:text-green-400';
        }
      } else if (/true|false/.test(match)) {
        cls = 'text-purple-600 dark:text-purple-400';
      } else if (/null/.test(match)) {
        cls = 'text-red-600 dark:text-red-400';
      } else if (/\d/.test(match)) {
        cls = 'text-orange-600 dark:text-orange-400';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
};

const extractJsonFromResponse = (response: string): string | null => {
  try {
    const firstBrace = response.indexOf('{');
    const lastBrace = response.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      return null;
    }

    const jsonPortion = response.substring(firstBrace, lastBrace + 1);
    JSON.parse(jsonPortion);
    return jsonPortion;
  } catch (error) {
    return null;
  }
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
};

export function AnalysisPanel({ selectedCameraId, cameraUpdateTrigger }: AnalysisPanelProps) {
  const [prompt, setPrompt] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null)
  const [cameras, setCameras] = useState<Camera[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)
  const [jsonOutput, setJsonOutput] = useState(false)
  const [isProcessingFrame, setIsProcessingFrame] = useState(false)
  const [consecutiveTimeouts, setConsecutiveTimeouts] = useState(0)
  const [lastAnalysisTime, setLastAnalysisTime] = useState<number>(0)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const frameRetryCount = useRef(0)
  const suggestionsLoadingRef = useRef(false)

  const maxFrameRetries = 3
  const maxConsecutiveTimeouts = 3

  const selectedCamera = cameras.find(c => c._id === selectedCameraId)

  useEffect(() => {
    const loadCameras = async () => {
      try {
        const response = await getCameras()
        setCameras(response.cameras || [])
      } catch (error: any) {
        console.error('Failed to load cameras:', error)
      }
    }
    loadCameras()
  }, [])

  useEffect(() => {
    if (selectedCameraId && cameras.length > 0) {
      const selectedCamera = cameras.find(c => c._id === selectedCameraId)

      setSuggestionsError(null)
      setSuggestions([])

      if (selectedCamera && (selectedCamera.type === 'usb' || selectedCamera.streamUrl?.startsWith('usb:'))) {
        setTimeout(() => {
          loadSuggestionsWithRetry()
        }, 3000)
      } else {
        loadSuggestionsWithRetry()
      }
    } else {
      setSuggestions([])
      setSuggestionsError(null)
    }
  }, [selectedCameraId, cameras])

  const loadSuggestionsWithRetry = async () => {
    if (suggestionsLoadingRef.current) {
      return
    }

    if (!selectedCameraId) {
      setSuggestionsError("No camera selected")
      return
    }

    const currentSelectedCamera = cameras.find(c => c._id === selectedCameraId)
    if (!currentSelectedCamera) {
      setSuggestionsError("Selected camera not found")
      return
    }

    suggestionsLoadingRef.current = true
    setLoadingSuggestions(true)
    setSuggestionsError(null)

    let accumulatedSuggestions: string[] = []

    const retryAttempts = [
      { maxSuggestions: 5, attemptName: 'Initial request' },
      { maxSuggestions: 3, attemptName: 'Retry 1' },
      { maxSuggestions: 2, attemptName: 'Retry 2' }
    ]

    try {
      let frameBase64: string | undefined

      if (currentSelectedCamera.type === 'usb' || currentSelectedCamera.streamUrl?.startsWith('usb:')) {
        try {
          frameBase64 = await captureFrameFromVideo()
        } catch (frameError) {
          setSuggestionsError("Unable to capture frame from camera")
          return
        }
      }

      for (let i = 0; i < retryAttempts.length; i++) {
        try {
          const response = await getPromptSuggestions(selectedCameraId, frameBase64, currentSelectedCamera)

          if (response.data?.suggestions && Array.isArray(response.data.suggestions)) {
            const newSuggestions = response.data.suggestions
            const uniqueNewSuggestions = newSuggestions.filter(s => !accumulatedSuggestions.includes(s))
            accumulatedSuggestions = [...accumulatedSuggestions, ...uniqueNewSuggestions]

            if (accumulatedSuggestions.length >= 3) {
              setSuggestions(accumulatedSuggestions)
              setSuggestionsError(null)
              return
            }

            if (i === retryAttempts.length - 1) {
              if (accumulatedSuggestions.length > 0) {
                setSuggestions(accumulatedSuggestions)
                setSuggestionsError(null)
              } else {
                setSuggestions([])
                setSuggestionsError("Unable to retrieve suggestions")
              }
              return
            }
          }

        } catch (attemptError: any) {
          if (i === retryAttempts.length - 1) {
            if (accumulatedSuggestions.length > 0) {
              setSuggestions(accumulatedSuggestions)
              setSuggestionsError(null)
            } else {
              setSuggestions([])
              setSuggestionsError("Unable to retrieve suggestions")
            }
            return
          }

          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

    } catch (error: any) {
      setSuggestions([])
      setSuggestionsError("Unable to retrieve suggestions")
    } finally {
      suggestionsLoadingRef.current = false
      setLoadingSuggestions(false)
    }
  }

  const captureFrameFromVideo = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        let videoElement: HTMLVideoElement | null = null

        const selectors = [
          'video',
          '[data-testid="video-element"]',
          '.video-player video',
          '#video-player video',
          'video[src]',
          'video[srcObject]'
        ]

        for (const selector of selectors) {
          videoElement = document.querySelector(selector) as HTMLVideoElement
          if (videoElement) {
            break
          }
        }

        if (!videoElement) {
          reject(new Error('Video element not found'))
          return
        }

        if (videoElement.readyState < 2) {
          reject(new Error('Video not ready - readyState: ' + videoElement.readyState))
          return
        }

        if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
          reject(new Error('Video has no dimensions'))
          return
        }

        if (videoElement.paused) {
          videoElement.play()
            .then(() => {
              proceedWithCapture()
            })
            .catch((playError) => {
              proceedWithCapture()
            })
        } else {
          proceedWithCapture()
        }

        function proceedWithCapture() {
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          if (!context) {
            reject(new Error('Canvas context not available'))
            return
          }

          const originalWidth = videoElement!.videoWidth
          const originalHeight = videoElement!.videoHeight

          const maxDimension = 448
          let newWidth = originalWidth
          let newHeight = originalHeight

          if (originalWidth > originalHeight) {
            if (originalWidth > maxDimension) {
              newWidth = maxDimension
              newHeight = Math.round((originalHeight * maxDimension) / originalWidth)
            }
          } else {
            if (originalHeight > maxDimension) {
              newHeight = maxDimension
              newWidth = Math.round((originalWidth * maxDimension) / originalHeight)
            }
          }

          canvas.width = newWidth
          canvas.height = newHeight

          try {
            context.drawImage(videoElement!, 0, 0, newWidth, newHeight)
          } catch (drawError) {
            reject(new Error('Failed to draw video frame to canvas: ' + drawError.message))
            return
          }

          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob from canvas'))
              return
            }

            const reader = new FileReader()
            reader.onload = () => {
              const result = reader.result as string
              const base64 = result.split(',')[1]

              if (!base64 || base64.length < 1000) {
                reject(new Error('Captured frame is too small'))
                return
              }

              resolve(base64)
            }
            reader.onerror = () => {
              reject(new Error('Failed to read blob'))
            }
            reader.readAsDataURL(blob)
          }, 'image/jpeg', 0.7)
        }

      } catch (error) {
        reject(error)
      }
    })
  }

  const startAnalysis = async () => {
    if (!selectedCameraId || !prompt.trim()) {
      toast({
        title: "Error",
        description: "Please select a camera and enter a prompt",
        variant: "destructive"
      })
      return
    }

    if (!selectedCamera) {
      toast({
        title: "Error",
        description: "Selected camera not found",
        variant: "destructive"
      })
      return
    }

    const cameraInterval = selectedCamera.analysisInterval
    if (!cameraInterval || cameraInterval < 6 || cameraInterval > 120) {
      toast({
        title: "Error",
        description: "Invalid camera analysis interval: " + cameraInterval + "s. Please set interval between 6-120 seconds in camera settings.",
        variant: "destructive"
      })
      return
    }

    if (cameraInterval <= 10) {
      toast({
        title: "Performance Warning",
        description: "Short interval (" + cameraInterval + "s) may result in reduced accuracy and dropped frames. Consider using 15+ seconds for better reliability.",
        variant: "default"
      })
    }

    try {
      setIsAnalyzing(true)
      setResults([])
      setIsProcessingFrame(false)
      setConsecutiveTimeouts(0)
      setLastAnalysisTime(0)
      frameRetryCount.current = 0

      const response = await startAnalysisStream({
        cameraId: selectedCameraId,
        prompt: prompt.trim(),
        analysisInterval: cameraInterval,
        jsonOption: jsonOutput
      })

      if (response.data?.streamId) {
        setCurrentStreamId(response.data.streamId)

        toast({
          title: "Analysis Started",
          description: "Analysis stream started" + (jsonOutput ? ' with JSON output' : '') + " (" + cameraInterval + "s intervals)",
        })

        startAnalysisLoop(response.data.streamId, cameraInterval)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start analysis",
        variant: "destructive"
      })
      setIsAnalyzing(false)
    }
  }

  const stopAnalysis = async () => {
    try {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      if (currentStreamId) {
        await stopAnalysisStream(currentStreamId)
        setCurrentStreamId(null)
      }

      setIsAnalyzing(false)
      setIsProcessingFrame(false)
      setConsecutiveTimeouts(0)
      frameRetryCount.current = 0

      toast({
        title: "Analysis Stopped",
        description: "Video analysis has been stopped",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to stop analysis",
        variant: "destructive"
      })
    }
  }

  const startAnalysisLoop = (streamId: string, intervalSeconds: number) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    const performAnalysis = async () => {
      if (isProcessingFrame) {
        return
      }

      const analysisStartTime = Date.now()
      setIsProcessingFrame(true)

      try {
        let frameBase64: string
        try {
          frameBase64 = await captureFrameFromVideo()
          frameRetryCount.current = 0
        } catch (frameError) {
          frameRetryCount.current++
          if (frameRetryCount.current >= maxFrameRetries) {
            toast({
              title: "Analysis Error",
              description: "Failed to capture video frame after multiple attempts. Please check camera connection.",
              variant: "destructive"
            })
            await stopAnalysis()
            return
          }
          return
        }

        try {
          const analysisResponse = await sendFrameForAnalysis({
            streamId,
            frameBase64,
            prompt: jsonOutput ? `${prompt.trim()}\n\nONLY return your response as a raw JSON object enclosed in curly braces { } without any markdown code blocks, backticks, explanatory text, or formatting. Respond with JSON only.` : prompt.trim(),
            jsonOption: jsonOutput
          })

          const processingTime = Date.now() - analysisStartTime
          setLastAnalysisTime(processingTime)
          setConsecutiveTimeouts(0)

          if (analysisResponse.data && analysisResponse.data.success) {
            const responseData = analysisResponse.data

            if (responseData.resultPreview) {
              const modelResult: AnalysisResult = {
                timestamp: new Date().toISOString(),
                answer: responseData.resultPreview,
                confidence: responseData.debugInfo?.accuracyScore || 0.7
              }

              setResults(prev => [modelResult, ...prev.slice(0, 9)])
            }
          }

        } catch (analysisError: any) {
          const processingTime = Date.now() - analysisStartTime
          setLastAnalysisTime(processingTime)

          if (analysisError.message?.includes('timeout') || processingTime > (intervalSeconds * 1000)) {
            setConsecutiveTimeouts(prev => prev + 1)

            if (consecutiveTimeouts + 1 >= maxConsecutiveTimeouts) {
              toast({
                title: "Performance Warning",
                description: "Model is consistently taking longer than " + intervalSeconds + "s interval. Consider increasing the interval for better reliability.",
                variant: "default"
              })
              setConsecutiveTimeouts(0)
            }
          }
        }

      } finally {
        setIsProcessingFrame(false)
      }
    }

    performAnalysis()
    intervalRef.current = setInterval(performAnalysis, intervalSeconds * 1000)
  }

  const renderResult = (result: AnalysisResult, index: number) => {
    const isLatest = index === 0

    if (jsonOutput) {
      const jsonContent = extractJsonFromResponse(result.answer)

      if (jsonContent) {
        try {
          const formatted = JSON.stringify(JSON.parse(jsonContent), null, 2)
          return (
            <div
              key={result.timestamp}
              className={`p-4 rounded-lg border ${
                isLatest
                  ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
                  : 'bg-muted/50 border-muted'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant={isLatest ? 'default' : 'secondary'}>
                    {isLatest ? 'Latest' : 'Previous'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatTimestamp(result.timestamp)}
                  </span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {Math.round(result.confidence * 100)}% confidence
                </Badge>
              </div>
              <pre
                className="text-sm bg-background/50 p-3 rounded border overflow-x-auto"
                dangerouslySetInnerHTML={{
                  __html: syntaxHighlightJson(formatted)
                }}
              />
            </div>
          )
        } catch (error) {
          // Fallback to plain text if JSON parsing fails
        }
      }
    }

    return (
      <div
        key={result.timestamp}
        className={`p-4 rounded-lg border ${
          isLatest
            ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
            : 'bg-muted/50 border-muted'
        }`}
      >
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <Badge variant={isLatest ? 'default' : 'secondary'}>
              {isLatest ? 'Latest' : 'Previous'}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {formatTimestamp(result.timestamp)}
            </span>
          </div>
          <Badge variant="outline" className="text-xs">
            {Math.round(result.confidence * 100)}% confidence
          </Badge>
        </div>
        <p className="text-sm leading-relaxed">{result.answer}</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <Card className="flex-shrink-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            Chat Analysis
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {selectedCameraId && selectedCamera && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant={selectedCamera.status === 'connected' ? 'default' : 'secondary'}>
                {selectedCamera.name}
              </Badge>
              <span className="text-muted-foreground">
                {selectedCamera.analysisInterval}s intervals
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="prompt">Analysis Prompt</Label>
            <div className="relative">
              <Textarea
                id="prompt"
                placeholder="Enter your analysis prompt (e.g., 'Count red cars')"
                value={prompt}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 360) {
                    setPrompt(value);
                  }
                }}
                disabled={isAnalyzing}
                className="min-h-[80px] max-h-[120px] resize-none pr-16"
              />
              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-1 rounded">
                {prompt.length} / 360
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="json-output"
              checked={jsonOutput}
              onCheckedChange={setJsonOutput}
              disabled={isAnalyzing}
            />
            <Label htmlFor="json-output" className="text-sm font-medium">
              JSON Response Format
            </Label>
          </div>

          {!isAnalyzing && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Suggested Prompts</Label>
              {loadingSuggestions ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading suggestions...
                </div>
              ) : suggestionsError ? (
                <p className="text-sm text-muted-foreground">{suggestionsError}</p>
              ) : suggestions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => setPrompt(suggestion)}
                      disabled={isAnalyzing}
                      className="text-xs h-7"
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No suggestions available</p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {!isAnalyzing ? (
              <Button
                onClick={startAnalysis}
                disabled={!selectedCameraId || !prompt.trim()}
                className="flex-1"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Analysis
              </Button>
            ) : (
              <Button
                onClick={stopAnalysis}
                variant="destructive"
                className="flex-1"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop Analysis
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 min-h-0 max-h-[500px] flex flex-col">
        <CardHeader className="flex-shrink-0 pb-3">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Live Results
            {isAnalyzing && (
              <div className="flex items-center gap-2 ml-auto">
                {isProcessingFrame ? (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    Waiting for next frame
                  </div>
                )}
                {lastAnalysisTime > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {(lastAnalysisTime / 1000).toFixed(1)}s
                  </Badge>
                )}
              </div>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 p-0">
          <div className="h-full max-h-[400px]">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {!isAnalyzing && results.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Start analysis to see live results
                    </p>
                  </div>
                )}

                {isAnalyzing && results.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Analysis in progress...
                    </p>
                  </div>
                )}

                {results.map((result, index) => renderResult(result, index))}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}