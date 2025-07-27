import { useState, useEffect } from "react"
import { Send, Brain, History, Pause, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { analyzePrompt, getAnalysisHistory } from "@/api/analysis"
import { useToast } from "@/hooks/useToast"
import { useSettings } from "@/contexts/SettingsContext"

interface AnalysisResult {
  _id: string
  prompt: string
  result: string
  timestamp: string
  confidence?: number
}

const EXAMPLE_PROMPTS = [
  "Count red cars",
  "Are there any people?",
  "How many trucks do you see?",
  "Detect bicycles",
  "Count people wearing masks",
  "Find parking spaces"
]

export function AnalysisPanel() {
  const [prompt, setPrompt] = useState("")
  const [currentPrompt, setCurrentPrompt] = useState("")
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { settings } = useSettings()

  const updateInterval = settings?.analysis?.defaultInterval || 2
  const intervalText = updateInterval === 1 ? "1 second" : `${updateInterval} seconds`

  useEffect(() => {
    loadHistory()
  }, [])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (currentPrompt && !isPaused) {
      // Use settings-based interval for real-time analysis updates
      interval = setInterval(() => {
        simulateAnalysis()
      }, updateInterval * 1000)
    }
    return () => clearInterval(interval)
  }, [currentPrompt, isPaused, updateInterval])

  const loadHistory = async () => {
    try {
      console.log("Loading analysis history...")
      const response = await getAnalysisHistory()
      setResults(response.history)
    } catch (error) {
      console.error("Error loading history:", error)
    }
  }

  const handleSubmit = async () => {
    if (!prompt.trim()) return

    try {
      console.log("Submitting analysis prompt:", prompt)
      setLoading(true)
      setIsAnalyzing(true)
      setCurrentPrompt(prompt)

      const response = await analyzePrompt({ prompt })

      const newResult: AnalysisResult = {
        _id: Date.now().toString(),
        prompt,
        result: response.result,
        timestamp: new Date().toISOString(),
        confidence: response.confidence
      }

      setResults(prev => [newResult, ...prev.slice(0, 9)])

      toast({
        title: "Analysis Started",
        description: "Real-time analysis is now active",
      })
    } catch (error) {
      console.error("Error starting analysis:", error)
      toast({
        title: "Error",
        description: "Failed to start analysis",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const simulateAnalysis = async () => {
    if (!currentPrompt) return

    try {
      const response = await analyzePrompt({ prompt: currentPrompt })

      const newResult: AnalysisResult = {
        _id: Date.now().toString(),
        prompt: currentPrompt,
        result: response.result,
        timestamp: new Date().toISOString(),
        confidence: response.confidence
      }

      setResults(prev => [newResult, ...prev.slice(0, 9)])
    } catch (error) {
      console.error("Error in real-time analysis:", error)
    }
  }

  const handleExampleClick = (examplePrompt: string) => {
    setPrompt(examplePrompt)
  }

  const stopAnalysis = () => {
    setIsAnalyzing(false)
    setCurrentPrompt("")
    setIsPaused(false)
  }

  return (
    <Card className="h-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            AI Analysis
          </CardTitle>
          {isAnalyzing && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPaused(!isPaused)}
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={stopAnalysis}
                className="text-red-600 hover:text-red-700"
              >
                Stop
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-4 min-h-0 overflow-hidden">
        {/* Prompt Input */}
        <div className="space-y-3 flex-shrink-0">
          <Textarea
            placeholder="Ask me anything about what you see in the video... (e.g., 'Count red cars')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[60px] max-h-[80px] resize-none"
            disabled={loading}
          />

          <div className="flex items-center gap-2">
            <Button
              onClick={handleSubmit}
              disabled={!prompt.trim() || loading}
              className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white flex-1"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Analyze
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Example Prompts */}
        <div className="space-y-2 flex-shrink-0">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Try these examples:
          </p>
          <div className="flex flex-wrap gap-1">
            {EXAMPLE_PROMPTS.map((example, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleExampleClick(example)}
                className="text-xs h-6 px-2"
                disabled={loading}
              >
                {example}
              </Button>
            ))}
          </div>
        </div>

        {/* Current Analysis Status */}
        {isAnalyzing && (
          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  Analyzing: "{currentPrompt}"
                </span>
              </div>
              {isPaused && (
                <Badge variant="outline" className="text-xs">
                  Paused
                </Badge>
              )}
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              Updates every {intervalText}
            </p>
          </div>
        )}

        {/* Results History */}
        <div className="flex-1 flex flex-col space-y-2 min-h-0 overflow-hidden">
          <div className="flex items-center gap-2 flex-shrink-0">
            <History className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Live Results
            </span>
          </div>

          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-2 pr-4">
                {results.length === 0 ? (
                  <div className="text-center py-8">
                    <Brain className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No analysis results yet
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Submit a prompt to start analyzing
                    </p>
                  </div>
                ) : (
                  results.map((result, index) => (
                    <div
                      key={result._id}
                      className={`p-3 rounded-lg border transition-all ${
                        index === 0 && isAnalyzing
                          ? 'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20 animate-pulse'
                          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                          "{result.prompt}"
                        </p>
                        <span className="text-xs text-slate-500 dark:text-slate-500">
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {result.result}
                        </p>
                        {result.confidence && (
                          <Badge variant="outline" className="text-xs">
                            {Math.round(result.confidence * 100)}%
                          </Badge>
                        )}
                      </div>

                      {index === 0 && isAnalyzing && (
                        <div className="mt-2 flex items-center gap-1">
                          <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-xs text-green-600 dark:text-green-400">
                            Latest update
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}