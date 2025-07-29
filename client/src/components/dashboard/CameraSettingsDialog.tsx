import { useState, useEffect } from "react"
import { Settings, Save, Loader2 } from "lucide-react"
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

    } catch (error) {
      console.error('[CAMERA_SETTINGS_DIALOG] Error loading settings:', error)

      // If settings loading fails, create default settings from camera data
      console.log('[CAMERA_SETTINGS_DIALOG] Creating default settings from camera data')
      const defaultSettings: CameraSettings = {
        name: camera.name,
        streamUrl: camera.streamUrl,
        type: camera.type,
        analysisInterval: 30,
        qualitySettings: {
          resolution: '1920x1080',
          frameRate: 30,
          bitrate: '2000kbps'
        }
      }
      setOriginalSettings(defaultSettings)
      setSettings(defaultSettings)

      toast({
        title: "Warning",
        description: "Using default settings. Some features may not be available.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const updateAnalysisInterval = (newInterval: number) => {
    if (!settings || !camera) return

    // Enforce minimum 6 seconds
    const enforcedInterval = Math.max(6, newInterval);
    console.log('[CAMERA_SETTINGS_DIALOG] Updating analysis interval to:', enforcedInterval, 'seconds (minimum 6s enforced)')

    // Update settings immediately in UI
    const updatedSettings = {
      ...settings,
      analysisInterval: enforcedInterval
    }
    setSettings(updatedSettings)

    // DO NOT save immediately or show toast - only update UI
    console.log('[CAMERA_SETTINGS_DIALOG] Analysis interval updated in UI only - will save when user clicks Save Settings')
  }

  const saveSettings = async () => {
    if (!camera || !settings) {
      console.log('[CAMERA_SETTINGS_DIALOG] Cannot save - missing camera or settings')
      return
    }

    try {
      console.log('[CAMERA_SETTINGS_DIALOG] ===== SAVE SETTINGS START =====');
      console.log('[CAMERA_SETTINGS_DIALOG] Saving settings for camera:', camera._id);
      console.log('[CAMERA_SETTINGS_DIALOG] Camera name:', camera.name);
      setSaving(true)

      let analysisWasStopped = false;

      // CRITICAL: Try to stop active analysis using direct function call
      console.log('[CAMERA_SETTINGS_DIALOG] ===== CHECKING FOR ACTIVE ANALYSIS =====');
      console.log('[CAMERA_SETTINGS_DIALOG] Looking for global stop function...');
      
      const stopActiveAnalysis = (window as any).stopActiveAnalysis;
      console.log('[CAMERA_SETTINGS_DIALOG] Stop function available:', !!stopActiveAnalysis);
      console.log('[CAMERA_SETTINGS_DIALOG] Stop function type:', typeof stopActiveAnalysis);

      if (stopActiveAnalysis && typeof stopActiveAnalysis === 'function') {
        console.log('[CAMERA_SETTINGS_DIALOG] ===== CALLING DIRECT STOP FUNCTION =====');
        console.log('[CAMERA_SETTINGS_DIALOG] Calling stop function for camera:', camera._id);

        try {
          const stopResult = await stopActiveAnalysis(camera._id);
          console.log('[CAMERA_SETTINGS_DIALOG] Stop function result:', stopResult);

          if (stopResult.success) {
            analysisWasStopped = true;
            console.log('[CAMERA_SETTINGS_DIALOG] Analysis stopped successfully via direct call');
          } else {
            console.log('[CAMERA_SETTINGS_DIALOG] Stop function returned failure:', stopResult.error);
          }
        } catch (stopError) {
          console.error('[CAMERA_SETTINGS_DIALOG] Error calling stop function:', stopError);
          toast({
            title: "Warning",
            description: "Could not stop active analysis. Settings will still be saved.",
            variant: "destructive",
          });
        }
      } else {
        console.log('[CAMERA_SETTINGS_DIALOG] ===== NO ACTIVE ANALYSIS DETECTED =====');
        console.log('[CAMERA_SETTINGS_DIALOG] No stop function available - no active analysis');
      }

      console.log('[CAMERA_SETTINGS_DIALOG] ===== PROCEEDING WITH SETTINGS SAVE =====');
      console.log('[CAMERA_SETTINGS_DIALOG] Analysis was stopped:', analysisWasStopped);

      // Update camera basic info if name changed
      if (settings.name !== camera.name) {
        console.log('[CAMERA_SETTINGS_DIALOG] Camera name changed, updating camera info')
        await updateCamera(camera._id, { name: settings.name })
      }

      // Update camera settings
      console.log('[CAMERA_SETTINGS_DIALOG] Updating camera settings...');
      await updateCameraSettings(camera._id, settings)

      // Update original settings to reflect saved state
      setOriginalSettings({ ...settings })

      // Show appropriate success message
      if (analysisWasStopped) {
        console.log('[CAMERA_SETTINGS_DIALOG] Showing analysis stopped message');
        toast({
          title: "Analysis Stopped",
          description: "Analysis stopped. Changes saved successfully. Please start analysis again.",
          duration: 5000,
        });
      } else {
        toast({
          title: "Success",
          description: "Camera settings updated successfully",
        });
      }

      // Show stream restart notification if needed
      if (streamNeedsRestart) {
        toast({
          title: "Stream Restart Required",
          description: "Quality changes will take effect after stream restart",
        })
        setStreamNeedsRestart(false)
      }

      // Refresh parent component
      if (onCameraUpdated) {
        onCameraUpdated()
      }

      // Trigger global camera refresh notification
      if ((window as any).notifyAllComponentsCameraUpdate) {
        (window as any).notifyAllComponentsCameraUpdate(camera._id, {
          ...settings,
          analysisWasStopped
        });
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
      setStreamNeedsRestart(false)
      toast({
        title: "Changes Reverted",
        description: "All unsaved changes have been discarded",
      })
    }
    onOpenChange(false)
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
            Configure detection and quality settings for this camera
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2">Loading settings...</span>
          </div>
        ) : settings ? (
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="detection">Detection</TabsTrigger>
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
                  readOnly
                  className="bg-slate-50 dark:bg-slate-700"
                  placeholder="Stream URL is read-only"
                />
                <p className="text-xs text-slate-500">
                  Stream URL cannot be modified after camera creation
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Camera Type</Label>
                {camera ? (
                  // For existing cameras, show type as read-only
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-sm">
                      {settings.type === 'rtsp' ? 'RTSP Stream' : 
                       settings.type === 'http' ? 'HTTP Stream' :
                       settings.type === 'ip' ? 'IP Camera' :
                       settings.type === 'usb' ? 'USB Camera' : 
                       settings.type}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                      Locked
                    </div>
                  </div>
                ) : (
                  // For new cameras (shouldn't happen in settings dialog), show dropdown
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
                )}
                <p className="text-xs text-slate-500">
                  {camera ? 
                    "Camera type cannot be modified after successful setup to prevent configuration mismatches" :
                    "Select the type of camera you are connecting"
                  }
                </p>
              </div>
            </TabsContent>

            <TabsContent value="detection" className="space-y-4 mt-4">
              <div className="space-y-3">
                <Label>Analysis Interval</Label>
                <div className="px-3">
                  <Slider
                    value={[settings.analysisInterval]}
                    onValueChange={(value) => updateAnalysisInterval(value[0])}
                    max={120}
                    min={6}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-slate-500 mt-1">
                    <span>6s (Minimum)</span>
                    <span className="font-medium">{settings.analysisInterval}s</span>
                    <span>120s (Maximum)</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Analysis interval will be applied after clicking "Save Settings". Minimum 6 seconds required.
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