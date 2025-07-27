import { useState, useEffect } from "react"
import { Settings, Save, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getCameraSettings, updateCameraSettings, updateCamera } from "@/api/cameras"
import { useToast } from "@/hooks/useToast"

interface CameraSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCameraUpdated?: () => void
  camera: {
    _id: string
    name: string
    type: string
    streamUrl: string
    status: string
  } | null
}

interface CameraSettings {
  name: string
  streamUrl: string
  type: string
  recordingEnabled: boolean
  alertsEnabled: boolean
  analysisInterval: number
  qualitySettings: {
    resolution: string
    frameRate: number
    bitrate: string
  }
}

export function CameraSettingsDialog({ open, onOpenChange, onCameraUpdated, camera }: CameraSettingsDialogProps) {
  const [originalSettings, setOriginalSettings] = useState<CameraSettings | null>(null)
  const [settings, setSettings] = useState<CameraSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'starting' | 'stopping' | 'recording'>('idle')
  const [streamNeedsRestart, setStreamNeedsRestart] = useState(false)
  const { toast } = useToast()

  console.log('[CAMERA_SETTINGS_DIALOG] Component render - camera:', camera?.name, 'open:', open)

  useEffect(() => {
    if (open && camera) {
      console.log('[CAMERA_SETTINGS_DIALOG] Dialog opened, loading settings for camera:', camera._id)
      loadSettings()
    } else if (!open) {
      console.log('[CAMERA_SETTINGS_DIALOG] Dialog closed, resetting settings')
      setOriginalSettings(null)
      setSettings(null)
      setRecordingStatus('idle')
      setStreamNeedsRestart(false)
    }
  }, [open, camera])

  const loadSettings = async () => {
    if (!camera) {
      console.log('[CAMERA_SETTINGS_DIALOG] No camera provided')
      return
    }

    try {
      console.log('[CAMERA_SETTINGS_DIALOG] Loading settings for camera:', camera._id)
      setLoading(true)
      const response = await getCameraSettings(camera._id)
      console.log('[CAMERA_SETTINGS_DIALOG] Settings loaded:', response.settings)
      
      // Store both original and current settings
      setOriginalSettings(response.settings)
      setSettings(response.settings)

      // Set initial recording status based on settings
      setRecordingStatus(response.settings.recordingEnabled ? 'recording' : 'idle')
    } catch (error) {
      console.error('[CAMERA_SETTINGS_DIALOG] Error loading settings:', error)

      // If settings loading fails, create default settings from camera data
      console.log('[CAMERA_SETTINGS_DIALOG] Creating default settings from camera data')
      const defaultSettings: CameraSettings = {
        name: camera.name,
        streamUrl: camera.streamUrl,
        type: camera.type,
        recordingEnabled: false,
        alertsEnabled: true,
        analysisInterval: 2,
        qualitySettings: {
          resolution: '1920x1080',
          frameRate: 30,
          bitrate: '2000kbps'
        }
      }
      setOriginalSettings(defaultSettings)
      setSettings(defaultSettings)
      setRecordingStatus('idle')

      toast({
        title: "Warning",
        description: "Using default settings. Some features may not be available.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!camera || !settings) {
      console.log('[CAMERA_SETTINGS_DIALOG] Cannot save - missing camera or settings')
      return
    }

    try {
      console.log('[CAMERA_SETTINGS_DIALOG] Saving settings for camera:', camera._id, 'settings:', settings)
      setSaving(true)

      // Update camera basic info if name changed
      if (settings.name !== camera.name) {
        console.log('[CAMERA_SETTINGS_DIALOG] Camera name changed, updating camera info')
        await updateCamera(camera._id, { name: settings.name })
      }

      // Update camera settings
      await updateCameraSettings(camera._id, settings)
      console.log('[CAMERA_SETTINGS_DIALOG] Settings saved successfully')

      // Update original settings to reflect saved state
      setOriginalSettings({ ...settings })

      toast({
        title: "Success",
        description: "Camera settings updated successfully",
      })

      // Show stream restart notification if needed
      if (streamNeedsRestart) {
        toast({
          title: "Stream Restart Required",
          description: "Quality changes will take effect after stream restart",
        })
        setStreamNeedsRestart(false)
      }

      // Refresh parent component to show updated camera name
      if (onCameraUpdated) {
        console.log('[CAMERA_SETTINGS_DIALOG] Calling onCameraUpdated callback')
        onCameraUpdated()
      }

      onOpenChange(false)
    } catch (error) {
      console.error('[CAMERA_SETTINGS_DIALOG] Error saving settings:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to update camera settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const cancelSettings = () => {
    console.log('[CAMERA_SETTINGS_DIALOG] Canceling settings changes')
    if (originalSettings) {
      setSettings({ ...originalSettings })
      setRecordingStatus(originalSettings.recordingEnabled ? 'recording' : 'idle')
      setStreamNeedsRestart(false)
      toast({
        title: "Changes Reverted",
        description: "All unsaved changes have been discarded",
      })
    }
    onOpenChange(false)
  }

  const toggleRecording = async () => {
    if (!camera || !settings) return

    try {
      console.log('[CAMERA_SETTINGS_DIALOG] Toggling recording for camera:', camera._id)
      const newRecordingState = !settings.recordingEnabled

      setRecordingStatus(newRecordingState ? 'starting' : 'stopping')

      // Update settings immediately
      const updatedSettings = {
        ...settings,
        recordingEnabled: newRecordingState
      }
      setSettings(updatedSettings)

      // Save recording state immediately to backend
      await updateCameraSettings(camera._id, { recordingEnabled: newRecordingState })

      // Simulate recording start/stop delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      setRecordingStatus(newRecordingState ? 'recording' : 'idle')

      toast({
        title: newRecordingState ? "Recording Started" : "Recording Stopped",
        description: `Camera recording has been ${newRecordingState ? 'enabled' : 'disabled'}`,
      })

      console.log('[CAMERA_SETTINGS_DIALOG] Recording toggled successfully:', newRecordingState)
    } catch (error) {
      console.error('[CAMERA_SETTINGS_DIALOG] Error toggling recording:', error)
      // Revert on error
      setSettings(prev => prev ? { ...prev, recordingEnabled: !prev.recordingEnabled } : null)
      setRecordingStatus(settings.recordingEnabled ? 'recording' : 'idle')
      toast({
        title: "Error",
        description: "Failed to toggle recording",
        variant: "destructive",
      })
    }
  }

  const toggleAlerts = async () => {
    if (!camera || !settings) return

    try {
      console.log('[CAMERA_SETTINGS_DIALOG] Toggling alerts for camera:', camera._id)
      const newAlertsState = !settings.alertsEnabled

      // Update settings immediately
      const updatedSettings = {
        ...settings,
        alertsEnabled: newAlertsState
      }
      setSettings(updatedSettings)

      // Save alerts state immediately to backend
      await updateCameraSettings(camera._id, { alertsEnabled: newAlertsState })

      if (newAlertsState) {
        // Request notification permission if not already granted
        if ('Notification' in window) {
          if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission()
            if (permission !== 'granted') {
              toast({
                title: "Notification Permission Required",
                description: "Please enable notifications to receive alerts",
                variant: "destructive",
              })
              return
            }
          }

          // Show test notification
          if (Notification.permission === 'granted') {
            new Notification(`Camera Alerts Enabled`, {
              body: `Alerts are now active for ${camera.name}`,
              icon: '/favicon.ico'
            })
          }
        }

        toast({
          title: "Alerts Enabled",
          description: "You will receive notifications for camera events",
        })
      } else {
        toast({
          title: "Alerts Disabled",
          description: "Camera notifications have been turned off",
        })
      }

      console.log('[CAMERA_SETTINGS_DIALOG] Alerts toggled successfully:', newAlertsState)
    } catch (error) {
      console.error('[CAMERA_SETTINGS_DIALOG] Error toggling alerts:', error)
      // Revert on error
      setSettings(prev => prev ? { ...prev, alertsEnabled: !prev.alertsEnabled } : null)
      toast({
        title: "Error",
        description: "Failed to toggle alerts",
        variant: "destructive",
      })
    }
  }

  const updateAnalysisInterval = async (newInterval: number) => {
    if (!settings || !camera) return

    console.log('[CAMERA_SETTINGS_DIALOG] Updating analysis interval to:', newInterval)
    
    try {
      // Update settings immediately
      const updatedSettings = {
        ...settings,
        analysisInterval: newInterval
      }
      setSettings(updatedSettings)

      // Save interval immediately to backend
      await updateCameraSettings(camera._id, { analysisInterval: newInterval })

      toast({
        title: "Analysis Interval Updated",
        description: `Analysis will now run every ${newInterval} seconds`,
      })
    } catch (error) {
      console.error('[CAMERA_SETTINGS_DIALOG] Error updating analysis interval:', error)
      // Revert on error
      setSettings(prev => prev ? { ...prev, analysisInterval: prev.analysisInterval } : null)
      toast({
        title: "Error",
        description: "Failed to update analysis interval",
        variant: "destructive",
      })
    }
  }

  const updateSetting = (key: string, value: any) => {
    console.log('[CAMERA_SETTINGS_DIALOG] Updating setting:', key, 'to:', value)
    if (!settings) return

    if (key.startsWith('qualitySettings.')) {
      const qualityKey = key.split('.')[1]
      const updatedSettings = {
        ...settings,
        qualitySettings: {
          ...settings.qualitySettings,
          [qualityKey]: value
        }
      }
      setSettings(updatedSettings)

      // Mark that stream needs restart for quality changes
      setStreamNeedsRestart(true)

      toast({
        title: "Quality Setting Updated",
        description: `${qualityKey} changed to ${value}. Save to apply changes.`,
      })
    } else {
      setSettings({
        ...settings,
        [key]: value
      })
    }
  }

  const hasUnsavedChanges = () => {
    if (!originalSettings || !settings) return false
    return JSON.stringify(originalSettings) !== JSON.stringify(settings)
  }

  if (!camera) {
    console.log('[CAMERA_SETTINGS_DIALOG] No camera provided, not rendering')
    return null
  }

  console.log('[CAMERA_SETTINGS_DIALOG] Current state:', {
    loading,
    saving,
    recordingStatus,
    hasSettings: !!settings,
    hasUnsavedChanges: hasUnsavedChanges(),
    streamNeedsRestart
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto bg-white dark:bg-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600" />
            Camera Settings - {camera.name}
            {hasUnsavedChanges() && (
              <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                Unsaved Changes
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Configure recording, detection, and quality settings for this camera
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2">Loading settings...</span>
          </div>
        ) : settings ? (
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="detection">Detection</TabsTrigger>
              <TabsTrigger value="quality">Quality</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Camera Name</Label>
                <Input
                  id="name"
                  value={settings.name}
                  onChange={(e) => updateSetting('name', e.target.value)}
                  placeholder="Enter camera name"
                />
                <p className="text-xs text-slate-500">
                  Changes will be reflected throughout the application after saving
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="streamUrl">Stream URL</Label>
                <Input
                  id="streamUrl"
                  value={settings.streamUrl}
                  onChange={(e) => updateSetting('streamUrl', e.target.value)}
                  placeholder="Enter stream URL"
                  disabled={settings.type === 'usb'}
                />
                {settings.type === 'usb' && (
                  <p className="text-xs text-slate-500">
                    USB camera stream URL is automatically managed
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Camera Type</Label>
                <Select value={settings.type} onValueChange={(value) => updateSetting('type', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rtsp">RTSP Stream</SelectItem>
                    <SelectItem value="http">HTTP Stream</SelectItem>
                    <SelectItem value="ip">IP Camera</SelectItem>
                    <SelectItem value="usb">USB Camera</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label>Recording Status</Label>
                  <p className="text-sm text-slate-500">
                    {recordingStatus === 'recording' && 'Camera is currently recording'}
                    {recordingStatus === 'starting' && 'Starting recording...'}
                    {recordingStatus === 'stopping' && 'Stopping recording...'}
                    {recordingStatus === 'idle' && 'Recording is disabled'}
                  </p>
                </div>
                <Button
                  onClick={toggleRecording}
                  disabled={recordingStatus === 'starting' || recordingStatus === 'stopping'}
                  variant={recordingStatus === 'recording' ? 'destructive' : 'default'}
                >
                  {recordingStatus === 'starting' && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Starting...
                    </>
                  )}
                  {recordingStatus === 'stopping' && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Stopping...
                    </>
                  )}
                  {recordingStatus === 'recording' && 'Stop Recording'}
                  {recordingStatus === 'idle' && 'Start Recording'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="detection" className="space-y-4 mt-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label>Smart Alerts</Label>
                  <p className="text-sm text-slate-500">
                    Receive browser notifications for camera events and detections
                  </p>
                </div>
                <Switch
                  checked={settings.alertsEnabled}
                  onCheckedChange={toggleAlerts}
                />
              </div>

              <div className="space-y-3">
                <Label>Analysis Interval</Label>
                <div className="px-3">
                  <Slider
                    value={[settings.analysisInterval]}
                    onValueChange={(value) => updateAnalysisInterval(value[0])}
                    max={30}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-slate-500 mt-1">
                    <span>1s (Real-time)</span>
                    <span className="font-medium">{settings.analysisInterval}s</span>
                    <span>30s (Battery Saver)</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Changes are applied immediately. Lower intervals provide more responsive analysis but use more resources.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="quality" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Resolution</Label>
                <Select
                  value={settings.qualitySettings.resolution}
                  onValueChange={(value) => updateSetting('qualitySettings.resolution', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="640x480">640x480 (VGA) - Low bandwidth</SelectItem>
                    <SelectItem value="1280x720">1280x720 (HD) - Balanced</SelectItem>
                    <SelectItem value="1920x1080">1920x1080 (Full HD) - High quality</SelectItem>
                    <SelectItem value="2560x1440">2560x1440 (2K) - Very high quality</SelectItem>
                    <SelectItem value="3840x2160">3840x2160 (4K) - Maximum quality</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Frame Rate</Label>
                <div className="px-3">
                  <Slider
                    value={[settings.qualitySettings.frameRate]}
                    onValueChange={(value) => updateSetting('qualitySettings.frameRate', value[0])}
                    max={60}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-slate-500 mt-1">
                    <span>1 FPS (Slideshow)</span>
                    <span className="font-medium">{settings.qualitySettings.frameRate} FPS</span>
                    <span>60 FPS (Smooth)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bitrate</Label>
                <Select
                  value={settings.qualitySettings.bitrate}
                  onValueChange={(value) => updateSetting('qualitySettings.bitrate', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="500kbps">500 kbps (Low) - Mobile friendly</SelectItem>
                    <SelectItem value="1000kbps">1 Mbps (Medium) - Balanced</SelectItem>
                    <SelectItem value="2000kbps">2 Mbps (High) - Good quality</SelectItem>
                    <SelectItem value="5000kbps">5 Mbps (Very High) - Excellent quality</SelectItem>
                    <SelectItem value="10000kbps">10 Mbps (Ultra) - Maximum quality</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {streamNeedsRestart && (
                <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-orange-600" />
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                      <strong>Stream Restart Required:</strong> Quality changes will take effect after saving and restarting the stream.
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Note:</strong> Quality changes require saving and may need a stream restart to take effect.
                  Higher settings require more bandwidth and processing power.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8">
            <p className="text-slate-500">Failed to load camera settings</p>
            <Button variant="outline" onClick={loadSettings} className="mt-2">
              Retry
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={cancelSettings} 
            disabled={saving}
          >
            Cancel
          </Button>
          <Button 
            onClick={saveSettings} 
            disabled={loading || saving || !settings || !hasUnsavedChanges()}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}