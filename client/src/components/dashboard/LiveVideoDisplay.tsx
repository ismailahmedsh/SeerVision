import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Settings, Play, Square, Camera as CameraIcon } from "lucide-react"
import { toast } from "@/hooks/useToast"
import { getCameras } from "@/api/cameras"
import { CameraSettingsDialog } from "./CameraSettingsDialog"

interface Camera {
  _id: string
  name: string
  type: string
  streamUrl: string
  status: string
  analysisInterval: number
  memory?: boolean
}

interface LiveVideoDisplayProps {
  selectedCameraId?: string
  onCameraChange?: (cameraId: string) => void
  onCameraUpdated?: () => void
}

export function LiveVideoDisplay({ selectedCameraId, onCameraChange, onCameraUpdated }: LiveVideoDisplayProps) {
  const [cameras, setCameras] = useState<Camera[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    loadCameras()
  }, [])

  // Listen for global camera updates
  useEffect(() => {
    const handleGlobalCameraUpdate = (cameraId: string, updatedCamera: any) => {
      
      // Update the cameras array
      setCameras(prevCameras => {
        const updatedCameras = prevCameras.map(camera => 
          camera._id === cameraId ? { ...camera, ...updatedCamera } : camera
        )
        return updatedCameras
      })

      // Update selectedCamera if it's the one being updated
      if (selectedCamera && selectedCamera._id === cameraId) {
        setSelectedCamera(prevSelected => prevSelected ? { ...prevSelected, ...updatedCamera } : null)
      }
    }

    if (!(window as any).cameraUpdateListeners) {
      (window as any).cameraUpdateListeners = new Set()
    }

    ;(window as any).cameraUpdateListeners.add(handleGlobalCameraUpdate)

    ;(window as any).notifyAllComponentsCameraUpdate = (cameraId: string, updatedCamera: any) => {
      ;(window as any).cameraUpdateListeners.forEach((listener: Function) => {
        try {
          listener(cameraId, updatedCamera)
        } catch (error: any) {
          console.error('Error in camera update listener:', error)
        }
      })
    }

    // Cleanup function
    return () => {
      if ((window as any).cameraUpdateListeners) {
        ;(window as any).cameraUpdateListeners.delete(handleGlobalCameraUpdate)
      }
    }
  }, [selectedCamera])

  useEffect(() => {
    if (selectedCameraId && cameras.length > 0) {
      const camera = cameras.find(c => c._id === selectedCameraId)
      setSelectedCamera(camera || null)
    }
  }, [selectedCameraId, cameras])

  useEffect(() => {
    if (selectedCamera) {
      startStream()
    } else {
      stopStream()
    }

    return () => {
      stopStream()
    }
  }, [selectedCamera])

  const loadCameras = async () => {
    try {
      setLoading(true)
      
      const response = await getCameras()
      
      const updatedCameras = response.cameras || []
      
      setCameras(updatedCameras)

      // Update selectedCamera if it exists in the updated cameras
      if (selectedCameraId) {
        const updatedSelectedCamera = updatedCameras.find((c: any) => c._id === selectedCameraId)
        
        if (updatedSelectedCamera) {
          setSelectedCamera(updatedSelectedCamera)
        }
      }
      
    } catch (error: any) {
      console.error('Failed to load cameras:', error)
      toast({
        title: "Error",
        description: "Failed to load cameras",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCameraSelect = (cameraId: string) => {
    const camera = cameras.find(c => c._id === cameraId)
    setSelectedCamera(camera || null)
    onCameraChange?.(cameraId)
  }

  const startStream = async () => {
    if (!selectedCamera || !videoRef.current) return

    try {
      setIsStreaming(true)

      if (selectedCamera.type === 'usb' || selectedCamera.streamUrl.startsWith('usb:')) {
        const deviceId = selectedCamera.streamUrl.replace('usb:', '')

        const constraints = {
          video: deviceId === 'default' ? true : { deviceId: { exact: deviceId } },
          audio: false
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        streamRef.current = stream
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      } else {
        videoRef.current.src = selectedCamera.streamUrl
        await videoRef.current.play()
      }

      toast({
        title: "Stream Started",
        description: `Connected to ${selectedCamera.name}`,
      })
    } catch (error: any) {
      console.error('Stream error:', error)
      setIsStreaming(false)
      toast({
        title: "Stream Error",
        description: error.message || "Failed to start video stream",
        variant: "destructive"
      })
    }
  }

  const stopStream = () => {
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.src = ''
      videoRef.current.srcObject = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    setIsStreaming(false)
  }

  const handleSettingsSaved = async () => {
    try {
      await loadCameras()
      
      if (onCameraUpdated) {
        onCameraUpdated()
      }
    } catch (error: any) {
      console.error('Failed to refresh camera data after settings save:', error)
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <CardTitle className="flex items-center gap-2">
          <CameraIcon className="w-5 h-5" />
          Live Video Feed
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 p-4 pt-0">
        {/* Camera Selection Row */}
        <div className="flex items-center gap-3 mb-4">
          {/* Camera Dropdown */}
          <div className="flex-1">
            <Select
              value={selectedCamera?._id || ""}
              onValueChange={handleCameraSelect}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder={loading ? "Loading cameras..." : "Select a camera"} />
              </SelectTrigger>
              <SelectContent>
                {cameras.map((camera) => (
                  <SelectItem key={camera._id} value={camera._id}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        camera.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      {camera.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Settings Button - Only show when camera is selected */}
          {selectedCamera && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="h-9 w-9 p-0"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}

          {/* Camera Status Badge - Only show when camera is selected */}
          {selectedCamera && (
            <Badge variant={selectedCamera.status === 'connected' ? 'default' : 'secondary'}>
              {selectedCamera.status}
            </Badge>
          )}
        </div>

        {/* Video Container */}
        <div className="flex-1 min-h-0 bg-black rounded-lg overflow-hidden relative">
          {selectedCamera ? (
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              controls={false}
              muted
              playsInline
              data-testid="video-element"
              style={{
                backgroundColor: '#000000'
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white">
              <div className="text-center">
                <CameraIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No Camera Selected</p>
                <p className="text-sm opacity-75">Choose a camera from the dropdown above</p>
              </div>
            </div>
          )}

          {/* Stream Status Overlay */}
          {selectedCamera && (
            <div className="absolute top-4 left-4">
              <Badge variant={isStreaming ? 'default' : 'secondary'}>
                {isStreaming ? (
                  <>
                    <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse" />
                    LIVE
                  </>
                ) : (
                  <>
                    <Square className="w-3 h-3 mr-2" />
                    OFFLINE
                  </>
                )}
              </Badge>
            </div>
          )}
        </div>

        {/* Stream Info */}
        {selectedCamera && (
          <div className="flex-shrink-0 mt-4 text-sm text-muted-foreground">
            <div className="flex justify-between items-center">
              <span>Camera: {selectedCamera.name}</span>
              <span>Type: {selectedCamera.type.toUpperCase()}</span>
            </div>
            {isStreaming && (
              <div className="mt-1">
                <span>Analysis Interval: {selectedCamera.analysisInterval}s</span>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Camera Settings Dialog */}
      {selectedCamera && (
        <CameraSettingsDialog
          camera={selectedCamera}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onCameraUpdated={handleSettingsSaved}
        />
      )}
    </Card>
  )
}