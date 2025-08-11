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
import { Switch } from "@/components/ui/switch"
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
    memory?: boolean
  } | null
}

interface Camera {
  _id: string
  name: string
  type: string
  streamUrl: string
  status: string
  memory?: boolean
}

interface CameraSettings {
  name: string
  streamUrl: string
  type: string
  analysisInterval: number
  memory: boolean
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

  useEffect(() => {
    if (open && camera) {
      loadSettings()
    } else if (!open) {
      setOriginalSettings(null)
      setSettings(null)
      setStreamNeedsRestart(false)
    }
  }, [open, camera])

  const loadSettings = async () => {
    if (!camera) {
      return
    }

    try {
      const response = await getCameraSettings(camera._id)
      if (response.success && response.settings) {
        const settingsData = response.settings
        setSettings(settingsData)
        setOriginalSettings(settingsData) // Store original for comparison
      } else {
        const defaultSettings: CameraSettings = {
          name: camera.name,
          streamUrl: camera.streamUrl,
          type: camera.type,
          analysisInterval: 30,
          memory: camera.memory ?? false,
          qualitySettings: {
            resolution: '1920x1080',
            frameRate: 30,
            bitrate: '2000kbps'
          }
        }
        setSettings(defaultSettings)
        setOriginalSettings(defaultSettings) // Store original for comparison
      }
    } catch (error) {
      console.error('Failed to load camera settings:', error)
      const fallbackSettings: CameraSettings = {
        name: camera.name,
        streamUrl: camera.streamUrl,
        type: camera.type,
        analysisInterval: 30,
        memory: camera.memory ?? false,
        qualitySettings: {
          resolution: '1920x1080',
          frameRate: 30,
          bitrate: '2000kbps'
        }
      }
      setSettings(fallbackSettings)
      setOriginalSettings(fallbackSettings) // Store original for comparison
    }
  }

  const handleAnalysisIntervalChange = (value: number) => {
    const enforcedInterval = Math.max(6, value)
    if (settings) {
      setSettings({
        ...settings,
        analysisInterval: enforcedInterval
      })
    }
  }

  const handleSaveSettings = async () => {
    if (!camera || !settings) {
      return
    }

    try {
      setSaving(true)
      const response = await updateCameraSettings(camera._id, settings)
      
      if (response.success) {
        // Update original settings after successful save
        setOriginalSettings(settings)
        
        toast({
          title: "Success",
          description: "Camera settings updated successfully",
        })
        
        if (onCameraUpdated) {
          onCameraUpdated()
        }
        
        onOpenChange(false)
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to update settings",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error('Failed to save camera settings:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const cancelSettings = () => {
    if (originalSettings) {
      setSettings(originalSettings)
    }
    onOpenChange(false)
  }

  const updateSetting = (key: string, value: any) => {
    if (!settings) return
    
    setSettings({
      ...settings,
      [key]: value
    })
  }

  const hasUnsavedChanges = () => {
    if (!originalSettings || !settings) return false
    
    // Deep comparison of relevant fields
    return (
      originalSettings.name !== settings.name ||
      originalSettings.analysisInterval !== settings.analysisInterval ||
      originalSettings.memory !== settings.memory
    )
  }

  if (!camera) {

    return null
  }

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
                    onValueChange={(value) => handleAnalysisIntervalChange(value[0])}
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
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Memory</Label>
                  <Switch
                    checked={settings.memory ?? false}
                    onCheckedChange={(checked: boolean) => updateSetting('memory', checked)}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  When enabled, each frame analysis includes context from recent frames for the same stream, allowing the model to answer based on recent events instead of processing each frame in isolation.
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
            onClick={handleSaveSettings}
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