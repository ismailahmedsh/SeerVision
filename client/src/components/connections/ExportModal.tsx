import { useState, useEffect } from "react"
import { Eye, EyeOff, Plus, Trash2, TestTube, Play, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import api from "@/api/api"

interface ConnectionRow {
  id: string
  promptText: string
  cameraId?: string
  options: {
    interval_s: number
    json: boolean
    memory: boolean
  }
  status: "idle" | "running" | "error"
  cameraType?: string
}

interface Webhook {
  id: string
  url: string
  secret?: string
}

interface ExportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connection: ConnectionRow
  cameraName?: string
  onStart?: () => void
  onStop?: () => void
}

export function ExportModal({ open, onOpenChange, connection, cameraName, onStart, onStop }: ExportModalProps) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [newWebhookUrl, setNewWebhookUrl] = useState("")
  const [newWebhookSecret, setNewWebhookSecret] = useState("")
  const [showSecret, setShowSecret] = useState(false)
  const [urlError, setUrlError] = useState("")
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})

  // Load existing webhook configuration when modal opens
  useEffect(() => {
    if (open) {
      const webhookConfigKey = `webhook-config-${connection.id}`
      const webhookConfig = localStorage.getItem(webhookConfigKey)
      
      if (webhookConfig) {
        try {
          const config = JSON.parse(webhookConfig)
          const existingWebhook: Webhook = {
            id: `webhook-${Date.now()}`,
            url: config.url,
            secret: config.secret
          }
          setWebhooks([existingWebhook])
        } catch (error: any) {
          console.error('Failed to load webhook config:', error)
        }
      }
    } else {
      // Clear state when modal closes
      setWebhooks([])
      setNewWebhookUrl("")
      setNewWebhookSecret("")
      setUrlError("")
      setTestResults({})
    }
  }, [open, connection.id])

  // Basic URL validation
  const validateUrl = (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const handleAddWebhook = () => {
    // Only allow one webhook
    if (webhooks.length >= 1) {
      setUrlError("Only one webhook allowed")
      return
    }

    if (!newWebhookUrl.trim()) {
      setUrlError("URL is required")
      return
    }

    if (!validateUrl(newWebhookUrl)) {
      setUrlError("Please enter a valid URL")
      return
    }

    const newWebhook: Webhook = {
      id: `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url: newWebhookUrl.trim(),
      secret: newWebhookSecret.trim() || undefined
    }

    setWebhooks([newWebhook]) // Replace array with single webhook
    setNewWebhookUrl("")
    setNewWebhookSecret("")
    setUrlError("")
  }

  const handleDeleteWebhook = (webhookId: string) => {
    setWebhooks(prev => prev.filter(w => w.id !== webhookId))
    // Clear test results for the deleted webhook
    setTestResults(prev => {
      const { [webhookId]: _, ...rest } = prev
      return rest
    })
  }

  const maskUrl = (url: string): string => {
    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname
      const path = urlObj.pathname
      const maskedPath = path.length > 10 ? path.substring(0, 10) + "..." : path
      return `${domain}${maskedPath}`
    } catch {
      return url.length > 30 ? url.substring(0, 30) + "..." : url
    }
  }

  const handleStart = () => {
    if (onStart && webhooks.length > 0) {
      // Save webhook configuration to localStorage for the connection
      const webhookConfigKey = `webhook-config-${connection.id}`
      const webhookConfig = {
        url: webhooks[0].url,
        secret: webhooks[0].secret
      }
      localStorage.setItem(webhookConfigKey, JSON.stringify(webhookConfig))
      
      onStart()
      // Close modal after starting
      onOpenChange(false)
    }
  }

  const handleStop = () => {
    if (onStop) {
      onStop()
      // Close modal after stopping
      onOpenChange(false)
    }
  }

  const handleTestWebhook = async (webhook: Webhook) => {
    setTestingWebhook(webhook.id)
    setTestResults(prev => ({ ...prev, [webhook.id]: { success: false, message: "Testing..." } }))

    try {
      // Create test payload
      const testPayload = {
        type: "test_event",
        timestamp: new Date().toISOString(),
        promptPreview: connection.promptText.substring(0, 100),
        cameraId: connection.cameraId,
        options: {
          interval_s: connection.options.interval_s,
          json: connection.options.json,
          memory: connection.options.memory
        }
      }

      // Call backend test endpoint
      const response = await api.post('/api/webhooks/test', {
        url: webhook.url,
        secret: webhook.secret,
        payload: testPayload
      })

      if (response.status >= 200 && response.status < 300) {
        setTestResults(prev => ({
          ...prev,
          [webhook.id]: { success: true, message: "Test succeeded." }
        }))
      } else {
        setTestResults(prev => ({
          ...prev,
          [webhook.id]: { success: false, message: `Test failed: ${response.status} ${response.statusText}` }
        }))
      }
    } catch (error: any) {
      let errorMessage = "Test failed: Unknown error"
      
      if (error.response) {
        // Server responded with error status
        errorMessage = `Test failed: ${error.response.status} ${error.response.data?.error || error.response.statusText}`
      } else if (error.request) {
        // Network error
        errorMessage = "Test failed: Network error"
      } else {
        // Other error
        errorMessage = `Test failed: ${error.message}`
      }

      setTestResults(prev => ({
        ...prev,
        [webhook.id]: { success: false, message: errorMessage }
      }))
    } finally {
      setTestingWebhook(null)
    }
  }

  const canStart = webhooks.length > 0 && connection.status !== "running"
  const isRunning = connection.status === "running"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Connection</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Connection Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Connection Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Prompt
                </Label>
                <p className="text-sm mt-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-md border">
                  {connection.promptText}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Camera
                  </Label>
                  <p className="text-sm mt-1">
                    {cameraName || "No camera selected"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Status
                  </Label>
                  <div className="mt-1">
                    <Badge 
                      variant={
                        connection.status === "running" ? "default" :
                        connection.status === "idle" ? "secondary" : "destructive"
                      }
                      className="capitalize"
                    >
                      {connection.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Options
                </Label>
                <div className="flex gap-4 mt-2">
                  <span className="text-sm bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                    Interval: {connection.options.interval_s}s
                  </span>
                  {connection.options.json && (
                    <span className="text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                      JSON
                    </span>
                  )}
                  {connection.options.memory && (
                    <span className="text-sm bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-1 rounded">
                      Memory
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Webhooks Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Webhooks</CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Configure webhook endpoints to receive analysis results
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* One webhook limitation notice */}
              {webhooks.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Only one webhook allowed. Delete the existing webhook to add a new one.
                  </p>
                </div>
              )}

              {/* Add Webhook Form - Only show if no webhooks exist */}
              {webhooks.length === 0 && (
                <div className="space-y-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <h4 className="font-medium flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Webhook
                  </h4>
                
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="webhook-url">URL *</Label>
                    <Input
                      id="webhook-url"
                      type="url"
                      placeholder="https://example.com/webhook"
                      value={newWebhookUrl}
                      onChange={(e) => {
                        setNewWebhookUrl(e.target.value)
                        if (urlError) setUrlError("")
                      }}
                      className={urlError ? "border-red-500" : ""}
                    />
                    {urlError && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        {urlError}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="webhook-secret">Secret (optional)</Label>
                    <div className="relative">
                      <Input
                        id="webhook-secret"
                        type={showSecret ? "text" : "password"}
                        placeholder="Optional webhook secret"
                        value={newWebhookSecret}
                        onChange={(e) => setNewWebhookSecret(e.target.value)}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowSecret(!showSecret)}
                      >
                        {showSecret ? (
                          <EyeOff className="h-4 w-4 text-slate-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-slate-400" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <Button 
                    onClick={handleAddWebhook}
                    className="w-full"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Webhook
                  </Button>
                </div>
              </div>
              )}

              {/* Webhook List */}
              {webhooks.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Configured Webhooks</h4>
                  {webhooks.map((webhook) => (
                    <div
                      key={webhook.id}
                      className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {maskUrl(webhook.url)}
                        </p>
                        {webhook.secret && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Secret configured
                          </p>
                        )}
                        {/* Test Result */}
                        {testResults[webhook.id] && (
                          <p className={`text-xs mt-1 flex items-center gap-1 ${
                            testResults[webhook.id].success 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {testResults[webhook.id].success ? '✅' : '❌'}
                            {testResults[webhook.id].message}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTestWebhook(webhook)}
                              disabled={testingWebhook === webhook.id}
                              className="h-8"
                            >
                              {testingWebhook === webhook.id ? (
                                <div className="animate-spin h-3 w-3 border-2 border-slate-600 border-t-transparent rounded-full" />
                              ) : (
                                <TestTube className="h-3 w-3" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{testingWebhook === webhook.id ? "Testing webhook..." : "Test webhook"}</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteWebhook(webhook.id)}
                              className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete webhook</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Controls */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {webhooks.length === 0 ? (
                "Add at least one webhook to start analysis"
              ) : (
                `${webhooks.length} webhook${webhooks.length === 1 ? '' : 's'} configured`
              )}
            </div>

            <div className="flex gap-3">
              {isRunning && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={handleStop}
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Stop
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Stop analysis</p>
                  </TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleStart}
                    disabled={!canStart}
                    className={!canStart ? "opacity-50" : ""}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {!canStart
                      ? webhooks.length === 0
                        ? "Add at least one webhook to start"
                        : "Analysis is already running"
                      : "Start analysis with configured webhooks"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
