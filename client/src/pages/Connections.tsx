import { useState, useEffect } from "react"
import { Search, RefreshCw, ExternalLink, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ExportModal } from "@/components/connections/ExportModal"
import { getAnalyticsData } from "@/api/analytics"
import { getCameras } from "@/api/cameras"
import { useToast } from "@/hooks/useToast"
import api from "@/api/api"

type ConnectionStatus = "idle" | "running" | "error"
type StatusFilter = "all" | "running" | "idle" | "error"

interface ConnectionRow {
  id: string
  promptText: string
  cameraId?: string
  options: {
    interval_s: number
    json: boolean
    memory: boolean
  }
  status: ConnectionStatus
  cameraType?: string
}

interface Camera {
  _id: string
  name: string
  type: string
  streamUrl: string
  status: string
  analysisInterval: number
  memory?: boolean
}

export function Connections() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [connections, setConnections] = useState<ConnectionRow[]>([])
  const [selectedConnection, setSelectedConnection] = useState<ConnectionRow | null>(null)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cameras, setCameras] = useState<Camera[]>([])
  const [loadingCameras, setLoadingCameras] = useState(false)
  const [hiddenVideos, setHiddenVideos] = useState<Record<string, HTMLVideoElement>>({})
  const [videoStreams, setVideoStreams] = useState<Record<string, MediaStream>>({})
  const [analysisIntervals, setAnalysisIntervals] = useState<Record<string, NodeJS.Timeout>>({})
  const [activeStreams, setActiveStreams] = useState<Record<string, string>>({})
  const { toast } = useToast()

  useEffect(() => {
    try {
      loadSavedPrompts()
      loadCameras()
    } catch (error: any) {
      setError("Failed to initialize connections page")
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      Object.values(analysisIntervals).forEach(intervalId => {
        clearInterval(intervalId)
      })
      
      Object.keys(hiddenVideos).forEach(connectionId => {
        cleanupVideo(connectionId)
      })
    }
  }, [])

  const loadSavedPrompts = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await getAnalyticsData({ timeRange: '90d' })
      const topQueries = response.data?.topQueries || []
      
      const sortedQueries = topQueries.sort((a: any, b: any) => 
        new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
      );
      
      const connectionRows: ConnectionRow[] = sortedQueries.map((query: any, index: number) => ({
        id: `connection-${index}`,
        promptText: query.query,
        cameraId: undefined,
        options: {
          interval_s: 30,
          json: false,
          memory: false
        },
        status: "idle" as ConnectionStatus,
        cameraType: undefined
      }))
      
      setConnections(connectionRows)
    } catch (error: any) {
      const errorMessage = error.message || "Failed to load saved prompts"
      setError(errorMessage)

      try {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
      } catch (toastError: any) {
        // Silent fallback
      }
    } finally {
      setLoading(false)
    }
  }

  const loadCameras = async () => {
    try {
      setLoadingCameras(true)
      const response = await getCameras()
      const cameraList = response.cameras || []
      setCameras(cameraList)
    } catch (error: any) {
      // Silent fallback
    } finally {
      setLoadingCameras(false)
    }
  }


  const statusFilters: { value: StatusFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: connections.length },
    { value: "running", label: "Running", count: connections.filter(c => c.status === "running").length },
    { value: "idle", label: "Idle", count: connections.filter(c => c.status === "idle").length },
    { value: "error", label: "Error", count: connections.filter(c => c.status === "error").length }
  ]


  const filteredConnections = connections.filter(connection => {
    const matchesSearch = connection.promptText.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || connection.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const updateConnectionCamera = async (connectionId: string, cameraId: string) => {
    if (cameraId === "no-cameras") return
    
    const currentConnection = connections.find(c => c.id === connectionId)
    if (currentConnection?.cameraId && currentConnection.cameraId !== cameraId) {
      cleanupVideo(connectionId)
    }
    
    setConnections(prev => prev.map(conn => 
      conn.id === connectionId ? { ...conn, cameraId } : conn
    ))

    try {
      await setupHiddenVideo(connectionId, cameraId)
    } catch (error: any) {
      toast({
        title: "Camera Setup Failed",
        description: "Failed to setup camera for analysis. Please try selecting the camera again.",
        variant: "destructive"
      })
    }
  }

  const updateConnectionInterval = (connectionId: string, interval: number) => {
    setConnections(prev => prev.map(conn => 
      conn.id === connectionId 
        ? { ...conn, options: { ...conn.options, interval_s: interval } }
        : conn
    ))
  }

  const updateConnectionOption = (connectionId: string, option: 'json' | 'memory', value: boolean) => {
    setConnections(prev => prev.map(conn => 
      conn.id === connectionId 
        ? { ...conn, options: { ...conn.options, [option]: value } }
        : conn
    ))
  }

  const getStatusBadgeVariant = (status: ConnectionStatus) => {
    switch (status) {
      case "running": return "default"
      case "idle": return "secondary"
      case "error": return "destructive"
      default: return "secondary"
    }
  }

  const getStatusTooltip = (status: ConnectionStatus) => {
    switch (status) {
      case "running": return "Analysis is currently active"
      case "idle": return "Analysis is ready to start"
      case "error": return "Analysis encountered an error"
      default: return "Unknown status"
    }
  }

  const handleExport = (connection: ConnectionRow) => {
    setSelectedConnection(connection)
    setExportModalOpen(true)
  }

  const isExportDisabled = (connection: ConnectionRow) => {
    return !connection.cameraId || connection.cameraId === "no-cameras" || connection.status === "error"
  }

  const getCameraName = (cameraId?: string) => {
    if (!cameraId || cameraId === "no-cameras") return "No camera selected"
    const camera = cameras.find(c => c._id === cameraId)
    return camera ? `${camera.name} (${camera.type})` : "Unknown camera"
  }

  const setupHiddenVideo = async (connectionId: string, cameraId: string) => {
    try {
      const camera = cameras.find(c => c._id === cameraId)
      if (!camera) throw new Error("Camera not found")

      const video = document.createElement('video')
      video.id = `hidden-video-${connectionId}`
      video.style.display = 'none'
      video.muted = true
      video.playsInline = true
      video.autoplay = true
      
      document.body.appendChild(video)

      if (camera.type === 'usb' || camera.streamUrl.startsWith('usb:')) {
        const deviceId = camera.streamUrl.replace('usb:', '')
        const constraints = {
          video: deviceId === 'default' ? true : { deviceId: { exact: deviceId } },
          audio: false
        }
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        video.srcObject = stream
        setVideoStreams(prev => ({ ...prev, [connectionId]: stream }))
      } else {
        video.src = camera.streamUrl
      }

      await video.play()
      setHiddenVideos(prev => ({ ...prev, [connectionId]: video }))
      
      return video
    } catch (error: any) {
      throw error
    }
  }

  const captureFrame = (connectionId: string): string | null => {
    try {
      const video = hiddenVideos[connectionId]
      if (!video || video.readyState < 2) {
        return null
      }

      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return null
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const frameBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
      
      return frameBase64
    } catch (error: any) {
      return null
    }
  }

  const cleanupVideo = (connectionId: string) => {
    try {
      const stream = videoStreams[connectionId]
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
        setVideoStreams(prev => {
          const { [connectionId]: _, ...rest } = prev
          return rest
        })
      }

      const video = hiddenVideos[connectionId]
      if (video) {
        video.pause()
        video.src = ''
        video.srcObject = null
        if (video.parentNode) {
          video.parentNode.removeChild(video)
        }
        setHiddenVideos(prev => {
          const { [connectionId]: _, ...rest } = prev
          return rest
        })
      }
    } catch (error: any) {
      // Silent cleanup failure
    }
  }

  const startAnalysisStream = async (connection: ConnectionRow): Promise<string> => {
    try {
      const response = await api.post('/api/video-analysis/stream', {
        cameraId: connection.cameraId,
        prompt: connection.promptText,
        analysisInterval: connection.options.interval_s,
        jsonOption: connection.options.json,
        memory: connection.options.memory
      })

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to create analysis stream')
      }

      return response.data.streamId
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to create analysis stream')
    }
  }


  const analyzeFrame = async (connection: ConnectionRow, streamId: string, frameBase64: string) => {
    try {
      const response = await api.post('/api/video-analysis/frame', {
        streamId,
        frameBase64,
        prompt: connection.promptText,
        jsonOption: connection.options.json,
        memory: connection.options.memory
      })

      if (response.data.success) {

        return response.data
      } else {
        throw new Error(response.data.error || 'Analysis failed')
      }
    } catch (error: any) {

      throw error
    }
  }


  const forwardToWebhook = async (connection: ConnectionRow, analysisResult: any) => {

    const webhookConfigKey = `webhook-config-${connection.id}`
    const webhookConfig = localStorage.getItem(webhookConfigKey)
    
    if (!webhookConfig) {

      return
    }

    try {
      const config = JSON.parse(webhookConfig)
      
      // Format preview based on JSON option
      let formattedPreview = analysisResult.resultPreview?.substring(0, 200) || ""
      
      // If JSON option is enabled, try to parse and format the preview
      if (analysisResult.jsonOption && formattedPreview) {
        try {
          // Extract JSON from markdown code blocks if present
          let jsonToParse = formattedPreview
          
          // Check if wrapped in markdown code blocks
          if (jsonToParse.includes('```json') || jsonToParse.includes('```')) {
            // Extract content between code blocks
            const codeBlockMatch = jsonToParse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
            if (codeBlockMatch) {
              jsonToParse = codeBlockMatch[1].trim()
            }
          }
          
          const parsedJson = JSON.parse(jsonToParse)
          formattedPreview = parsedJson // Send parsed JSON object instead of string
        } catch (error: any) {
          // If parsing fails, keep the original string
          console.warn('[CONNECTIONS] Failed to parse JSON preview:', error)
        }
      }

      // Create analysis payload in the expected format
      const payload = {
        type: "analysis_result",
        timestamp: analysisResult.timestamp,
        promptPreview: connection.promptText.substring(0, 100),
        cameraId: connection.cameraId,
        options: {
          interval_s: connection.options.interval_s,
          json: analysisResult.jsonOption,
          memory: analysisResult.memory
        },
        result: {
          success: true,
          preview: formattedPreview,
          debugInfo: analysisResult.debugInfo
        }
      }

      // Forward to webhook using the same mechanism as the test
      const response = await api.post('/api/webhooks/test', {
        url: config.url,
        secret: config.secret,
        payload: payload
      })

      if (response.data.success) {
        console.log(`[CONNECTIONS] Analysis result forwarded successfully to webhook for connection ${connection.id}`)
      } else {
        console.error(`[CONNECTIONS] Failed to forward to webhook for connection ${connection.id}:`, response.data.message)
      }
    } catch (error: any) {
      console.error(`[CONNECTIONS] Error forwarding to webhook for connection ${connection.id}:`, error)
    }
  }

  // Start recurring analysis
  const startRecurringAnalysis = async (connection: ConnectionRow) => {
    try {
      if (!connection.cameraId || connection.cameraId === "no-cameras") {
        throw new Error("No camera selected")
      }

      console.log(`[CONNECTIONS] Starting recurring analysis for connection ${connection.id}`)

      // Update connection status to running
      setConnections(prev => prev.map(conn => 
        conn.id === connection.id ? { ...conn, status: "running" as ConnectionStatus } : conn
      ))

      // Setup hidden video
      await setupHiddenVideo(connection.id, connection.cameraId)

      // Wait for video to be ready
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Create analysis stream
      const streamId = await startAnalysisStream(connection)
      setActiveStreams(prev => ({ ...prev, [connection.id]: streamId }))

      // Start recurring frame analysis
      const intervalMs = connection.options.interval_s * 1000
      const intervalId = setInterval(async () => {
        try {
          const frameBase64 = captureFrame(connection.id)
          if (frameBase64) {
            const result = await analyzeFrame(connection, streamId, frameBase64)
            await forwardToWebhook(connection, result)
          } else {
            console.warn(`[CONNECTIONS] Skipping analysis cycle - no frame captured for connection ${connection.id}`)
          }
        } catch (error: any) {
          console.error(`[CONNECTIONS] Analysis cycle failed for connection ${connection.id}:`, error)
        }
      }, intervalMs)

      setAnalysisIntervals(prev => ({ ...prev, [connection.id]: intervalId }))

      toast({
        title: "Analysis Started",
        description: `Recurring analysis started for "${connection.promptText.substring(0, 50)}..."`,
      })

    } catch (error: any) {
      console.error(`[CONNECTIONS] Failed to start recurring analysis for connection ${connection.id}:`, error)
      
      // Cleanup on failure
      cleanupVideo(connection.id)
      setConnections(prev => prev.map(conn => 
        conn.id === connection.id ? { ...conn, status: "error" as ConnectionStatus } : conn
      ))

      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to start analysis",
        variant: "destructive"
      })
    }
  }

  // Stop recurring analysis
  const stopRecurringAnalysis = async (connection: ConnectionRow) => {
    try {
      console.log(`[CONNECTIONS] Stopping recurring analysis for connection ${connection.id}`)

      // Clear interval
      const intervalId = analysisIntervals[connection.id]
      if (intervalId) {
        clearInterval(intervalId)
        setAnalysisIntervals(prev => {
          const { [connection.id]: _, ...rest } = prev
          return rest
        })
      }

      // Stop analysis stream
      const streamId = activeStreams[connection.id]
      if (streamId) {
        try {
          await api.delete(`/api/video-analysis/stream/${streamId}`)
          console.log(`[CONNECTIONS] Analysis stream stopped: ${streamId}`)
        } catch (error: any) {
          console.warn(`[CONNECTIONS] Failed to stop analysis stream ${streamId}:`, error)
        }
        setActiveStreams(prev => {
          const { [connection.id]: _, ...rest } = prev
          return rest
        })
      }

      // Cleanup video
      cleanupVideo(connection.id)

      // Update connection status to idle
      setConnections(prev => prev.map(conn => 
        conn.id === connection.id ? { ...conn, status: "idle" as ConnectionStatus } : conn
      ))

      toast({
        title: "Analysis Stopped",
        description: `Analysis stopped for "${connection.promptText.substring(0, 50)}..."`,
      })

    } catch (error: any) {
      console.error(`[CONNECTIONS] Failed to stop recurring analysis for connection ${connection.id}:`, error)
      toast({
        title: "Stop Failed",
        description: error.message || "Failed to stop analysis",
        variant: "destructive"
      })
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 p-4 lg:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              Connections
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Manage your automated analysis connections
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input
              placeholder="Search prompts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Status Filter Chips */}
          <div className="flex gap-2 flex-wrap">
            {statusFilters.map((filter) => (
              <Button
                key={filter.value}
                variant={statusFilter === filter.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(filter.value)}
                className="h-8"
              >
                {filter.label}
                {connections.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1 text-xs">
                    {filter.count}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Saved Prompts</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  Loading saved prompts...
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                  Fetching your analysis history
                </p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  Failed to load prompts
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">
                  {error}
                </p>
                <Button onClick={loadSavedPrompts} variant="outline">
                  Try Again
                </Button>
              </div>
            ) : connections.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-slate-400 mb-4">
                  <ExternalLink className="h-12 w-12 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  No saved prompts yet.
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">
                  Create prompts in the{" "}
                  <a 
                    href="/" 
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                  >
                    Analysis panel
                  </a>
                  {" "}to get started.
                </p>
              </div>
            ) : filteredConnections.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-slate-400 mb-4">
                  <Search className="h-12 w-12 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  No connections match your filters.
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                  Try adjusting your search terms or filter criteria.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left p-4 font-medium text-slate-600 dark:text-slate-300">Prompt</th>
                      <th className="text-left p-4 font-medium text-slate-600 dark:text-slate-300">Camera</th>
                      <th className="text-left p-4 font-medium text-slate-600 dark:text-slate-300">Options</th>
                      <th className="text-left p-4 font-medium text-slate-600 dark:text-slate-300">Status</th>
                      <th className="text-left p-4 font-medium text-slate-600 dark:text-slate-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredConnections.map((connection) => (
                      <tr key={connection.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        {/* Prompt */}
                        <td className="p-4">
                          <div className="max-w-md">
                            <p 
                              className={`font-medium text-slate-900 dark:text-white ${
                                connection.promptText.length > 50 ? 'text-xs leading-tight' : 'text-sm'
                              }`}
                              title={connection.promptText}
                            >
                              {connection.promptText.length > 100 
                                ? `${connection.promptText.substring(0, 100)}...`
                                : connection.promptText
                              }
                            </p>
                          </div>
                        </td>

                        {/* Camera */}
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Select
                              value={connection.cameraId || ""}
                              onValueChange={(value) => {
                                updateConnectionCamera(connection.id, value).catch(error => {
                                  console.error('Failed to update camera:', error)
                                })
                              }}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Select a camera" />
                              </SelectTrigger>
                              <SelectContent>
                                {cameras.length > 0 ? (
                                  cameras.map((camera) => (
                                    <SelectItem key={camera._id} value={camera._id}>
                                      {camera.name} ({camera.type})
                                    </SelectItem>
                                  ))
                                ) : (
                                  <SelectItem value="no-cameras" disabled>
                                    {loadingCameras ? "Loading cameras..." : "No cameras available"}
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  aria-label="Refresh cameras"
                                  onClick={loadCameras}
                                  disabled={loadingCameras}
                                >
                                  <RefreshCw className={`h-4 w-4 ${loadingCameras ? 'animate-spin' : ''}`} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Refresh camera list</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </td>

                        {/* Options */}
                        <td className="p-4">
                          <div className="space-y-3">
                            {/* Interval */}
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-slate-600 dark:text-slate-400 min-w-[50px]">
                                Interval:
                              </Label>
                              <div className={`flex rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden ${
                                connection.status === "running" ? 'opacity-50 pointer-events-none' : ''
                              }`}>
                                {[15, 30, 60, 90, 120].map((interval) => (
                                  <button
                                    key={interval}
                                    onClick={() => updateConnectionInterval(connection.id, interval)}
                                    disabled={connection.status === "running"}
                                    className={`px-2 py-1 text-xs font-medium transition-colors ${
                                      connection.options.interval_s === interval
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                                    } ${connection.status === "running" ? 'cursor-not-allowed' : ''}`}
                                  >
                                    {interval}s
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* JSON and Memory toggles */}
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <Switch
                                  id={`json-${connection.id}`}
                                  checked={connection.options.json}
                                  onCheckedChange={(checked) => updateConnectionOption(connection.id, 'json', checked)}
                                  disabled={connection.status === "running"}
                                  className="scale-75"
                                />
                                <Label 
                                  htmlFor={`json-${connection.id}`} 
                                  className={`text-xs text-slate-600 dark:text-slate-400 ${
                                    connection.status === "running" ? 'opacity-50' : ''
                                  }`}
                                >
                                  JSON
                                </Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  id={`memory-${connection.id}`}
                                  checked={connection.options.memory}
                                  onCheckedChange={(checked) => updateConnectionOption(connection.id, 'memory', checked)}
                                  disabled={connection.status === "running"}
                                  className="scale-75"
                                />
                                <Label 
                                  htmlFor={`memory-${connection.id}`} 
                                  className={`text-xs text-slate-600 dark:text-slate-400 ${
                                    connection.status === "running" ? 'opacity-50' : ''
                                  }`}
                                >
                                  Memory
                                </Label>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="p-4">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant={getStatusBadgeVariant(connection.status)} className="capitalize">
                                {connection.status}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{getStatusTooltip(connection.status)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </td>

                        {/* Actions */}
                        <td className="p-4">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleExport(connection)}
                                disabled={isExportDisabled(connection)}
                                className="text-xs"
                              >
                                Export
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {isExportDisabled(connection)
                                  ? 'Select a camera and ensure status is not Error'
                                  : 'Configure export settings'}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export Modal */}
        {selectedConnection && (
          <ExportModal
            open={exportModalOpen}
            onOpenChange={setExportModalOpen}
            connection={selectedConnection}
            cameraName={getCameraName(selectedConnection.cameraId)}
            onStart={() => startRecurringAnalysis(selectedConnection)}
            onStop={() => stopRecurringAnalysis(selectedConnection)}
          />
        )}
      </div>
    </TooltipProvider>
  )
}
