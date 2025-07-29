import { useState, useEffect, useRef } from "react"
import { Play, Pause, Settings, Camera, Wifi, WifiOff, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getCameras } from "@/api/cameras"
import { CameraSettingsDialog } from "./CameraSettingsDialog"
import { useToast } from "@/hooks/useToast"

interface Camera {
  _id: string
  name: string
  type: string
  streamUrl: string
  status: 'connected' | 'disconnected'
  lastSeen?: string
}

interface LiveVideoDisplayProps {
  selectedCameraId?: string
  onCameraChange?: (cameraId: string) => void
  onFrameCapture?: (frameBase64: string) => void
  onCameraUpdated?: () => void
}

export function LiveVideoDisplay({ selectedCameraId, onCameraChange, onFrameCapture, onCameraUpdated }: LiveVideoDisplayProps) {
  const [cameras, setCameras] = useState<Camera[]>([])
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(true)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [streamType, setStreamType] = useState<'video' | 'mjpeg' | 'usb' | 'unsupported' | 'unknown'>('unknown')
  const videoRef = useRef<HTMLVideoElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const usbVideoRef = useRef<HTMLVideoElement>(null)
  const usbStreamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadCameras()
  }, [])

  useEffect(() => {
    if (selectedCameraId && cameras.length > 0) {
      const camera = cameras.find(c => c._id === selectedCameraId)
      setSelectedCamera(camera || null)
    } else if (cameras.length > 0 && !selectedCamera) {
      setSelectedCamera(cameras[0])
      onCameraChange?.(cameras[0]._id)
    }
  }, [selectedCameraId, cameras, selectedCamera, onCameraChange])

  useEffect(() => {
    if (selectedCamera) {
      initializeStream()
    } else {
      cleanupUsbStream()
    }
    return () => {
      cleanupUsbStream()
    }
  }, [selectedCamera])

  const loadCameras = async () => {
    try {
      console.log('[LIVE_VIDEO_DISPLAY] ===== LOAD CAMERAS START =====')
      console.log('[LIVE_VIDEO_DISPLAY] Loading cameras...')
      console.log('[LIVE_VIDEO_DISPLAY] Current timestamp:', new Date().toISOString())
      console.log('[LIVE_VIDEO_DISPLAY] Current loading state:', loading)
      console.log('[LIVE_VIDEO_DISPLAY] Current cameras count:', cameras.length)
      setLoading(true)

      const response = await getCameras()
      console.log('[LIVE_VIDEO_DISPLAY] getCameras response received')
      console.log('[LIVE_VIDEO_DISPLAY] Response status:', response?.status || 'unknown')
      console.log('[LIVE_VIDEO_DISPLAY] Response data type:', typeof response)
      console.log('[LIVE_VIDEO_DISPLAY] Response keys:', Object.keys(response || {}))
      console.log('[LIVE_VIDEO_DISPLAY] Full response:', JSON.stringify(response, null, 2))
      console.log('[LIVE_VIDEO_DISPLAY] Cameras received:', response.cameras?.length || 0)

      if (response.cameras) {
        console.log('[LIVE_VIDEO_DISPLAY] Processing cameras array...')
        console.log('[LIVE_VIDEO_DISPLAY] Cameras array type:', Array.isArray(response.cameras))
        console.log('[LIVE_VIDEO_DISPLAY] Raw cameras data:', JSON.stringify(response.cameras, null, 2))

        response.cameras.forEach((camera, index) => {
          console.log(`[LIVE_VIDEO_DISPLAY] Camera ${index}:`, {
            id: camera._id,
            name: camera.name,
            type: camera.type,
            streamUrl: camera.streamUrl,
            status: camera.status,
            analysisInterval: camera.analysisInterval
          })
        })

        console.log('[LIVE_VIDEO_DISPLAY] Setting cameras to state...')
        setCameras(response.cameras)
        console.log('[LIVE_VIDEO_DISPLAY] Cameras set to state successfully')

        if (selectedCamera && response.cameras.length > 0) {
          const updatedCamera = response.cameras.find(c => c._id === selectedCamera._id);
          if (updatedCamera) {
            console.log('[LIVE_VIDEO_DISPLAY] ===== UPDATING SELECTED CAMERA =====');
            console.log('[LIVE_VIDEO_DISPLAY] Previous selected camera interval:', selectedCamera.analysisInterval);
            console.log('[LIVE_VIDEO_DISPLAY] New selected camera interval:', updatedCamera.analysisInterval);
            setSelectedCamera(updatedCamera);
            console.log('[LIVE_VIDEO_DISPLAY] Selected camera updated with new settings');
          }
        }

        if (response.cameras.length > 0 && !selectedCamera) {
          console.log('[LIVE_VIDEO_DISPLAY] No selected camera, setting first camera as selected')
          console.log('[LIVE_VIDEO_DISPLAY] First camera details:', response.cameras[0])
          setSelectedCamera(response.cameras[0])
          console.log('[LIVE_VIDEO_DISPLAY] Calling onCameraChange with camera ID:', response.cameras[0]._id)
          onCameraChange?.(response.cameras[0]._id)
          console.log('[LIVE_VIDEO_DISPLAY] onCameraChange called successfully')
        } else {
          console.log('[LIVE_VIDEO_DISPLAY] Not setting default camera - cameras:', response.cameras.length, 'selectedCamera:', !!selectedCamera)
        }
      } else {
        console.warn('[LIVE_VIDEO_DISPLAY] No cameras property in response')
        console.warn('[LIVE_VIDEO_DISPLAY] Response structure:', response)
        setCameras([])
      }

      console.log('[LIVE_VIDEO_DISPLAY] ===== LOAD CAMERAS SUCCESS =====')
    } catch (error) {
      console.error('[LIVE_VIDEO_DISPLAY] ===== LOAD CAMERAS ERROR =====')
      console.error('[LIVE_VIDEO_DISPLAY] Error type:', error.constructor.name)
      console.error('[LIVE_VIDEO_DISPLAY] Error message:', error.message)
      console.error('[LIVE_VIDEO_DISPLAY] Error stack:', error.stack)
      console.error('[LIVE_VIDEO_DISPLAY] Error response:', error?.response)
      console.error('[LIVE_VIDEO_DISPLAY] Error response data:', error?.response?.data)
      console.error('[LIVE_VIDEO_DISPLAY] Error response status:', error?.response?.status)
      console.error('[LIVE_VIDEO_DISPLAY] Error response headers:', error?.response?.headers)

      setCameras([])
      toast({
        title: "Error",
        description: "Failed to load cameras: " + error.message,
        variant: "destructive",
      })
    } finally {
      console.log('[LIVE_VIDEO_DISPLAY] Setting loading to false')
      setLoading(false)
      console.log('[LIVE_VIDEO_DISPLAY] Loading state updated to false')
    }
  }

  const detectStreamType = (streamUrl: string): 'video' | 'mjpeg' | 'usb' | 'unsupported' | 'unknown' => {
    if (!streamUrl) return 'unknown'
    const url = streamUrl.toLowerCase()
    if (url.startsWith('usb:')) return 'usb'
    if (url.startsWith('rtsp://')) return 'unsupported'
    if (url.includes('mjpg') || url.includes('mjpeg')) return 'mjpeg'
    if (url.startsWith('http://') || url.startsWith('https://')) return 'video'
    return 'unknown'
  }

  const cleanupUsbStream = () => {
    if (usbStreamRef.current) {
      usbStreamRef.current.getTracks().forEach(track => track.stop())
      usbStreamRef.current = null
    }
    if (usbVideoRef.current) {
      usbVideoRef.current.srcObject = null
    }
  }

  const captureFrameFromUSB = (): string | null => {
    console.log('[LIVE_VIDEO_DISPLAY] ===== CAPTURE FRAME FROM USB START =====')

    if (!usbVideoRef.current || !canvasRef.current) {
      console.error('[LIVE_VIDEO_DISPLAY] Missing video or canvas ref')
      return null
    }

    const video = usbVideoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      console.error('[LIVE_VIDEO_DISPLAY] Could not get canvas context')
      return null
    }

    // Check if video is ready
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('[LIVE_VIDEO_DISPLAY] Video not ready - dimensions:', video.videoWidth, 'x', video.videoHeight)
      return null
    }

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480

    try {
      console.log('[LIVE_VIDEO_DISPLAY] Drawing video frame to canvas, dimensions:', canvas.width, 'x', canvas.height)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const base64Frame = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
      console.log('[LIVE_VIDEO_DISPLAY] Frame captured successfully, base64 length:', base64Frame.length)
      console.log('[LIVE_VIDEO_DISPLAY] ===== CAPTURE FRAME FROM USB SUCCESS =====')

      return base64Frame
    } catch (error) {
      console.error('[LIVE_VIDEO_DISPLAY] ===== CAPTURE FRAME FROM USB ERROR =====')
      console.error('[LIVE_VIDEO_DISPLAY] Error capturing frame:', error)
      return null
    }
  }

  // Expose frame capture function to parent components
  useEffect(() => {
    if (streamType === 'usb' && onFrameCapture) {
      // Set up periodic frame capture for USB cameras
      const interval = setInterval(() => {
        const frameBase64 = captureFrameFromUSB()
        if (frameBase64) {
          onFrameCapture(frameBase64)
        }
      }, 1000) // Capture every second

      return () => clearInterval(interval)
    }
  }, [streamType, onFrameCapture])

  // Add method to manually capture frame (for prompt suggestions)
  const captureCurrentFrame = (): string | null => {
    console.log('[LIVE_VIDEO_DISPLAY] Manual frame capture requested for camera type:', streamType)

    if (streamType === 'usb') {
      return captureFrameFromUSB()
    }

    console.log('[LIVE_VIDEO_DISPLAY] Manual frame capture not supported for camera type:', streamType)
    return null
  }

  // Expose capture function to parent
  useEffect(() => {
    if (selectedCamera && streamType === 'usb') {
      // Store capture function on window for access by other components
      (window as any).captureCurrentFrame = captureCurrentFrame;

      return () => {
        delete (window as any).captureCurrentFrame;
      }
    }
  }, [selectedCamera, streamType])

  const initializeStream = async () => {
    console.log('[LIVE_VIDEO_DISPLAY] ===== INITIALIZE STREAM START =====')
    console.log('[LIVE_VIDEO_DISPLAY] Selected camera:', selectedCamera)
    console.log('[LIVE_VIDEO_DISPLAY] Initialize stream timestamp:', new Date().toISOString());

    if (!selectedCamera) {
      console.log('[LIVE_VIDEO_DISPLAY] No selected camera, exiting initialize stream')
      return
    }

    console.log('[LIVE_VIDEO_DISPLAY] Resetting stream error and cleaning up USB stream')
    setStreamError(null)
    cleanupUsbStream()

    try {
      console.log('[LIVE_VIDEO_DISPLAY] Detecting stream type for URL:', selectedCamera.streamUrl)
      const detectedType = detectStreamType(selectedCamera.streamUrl)
      console.log('[LIVE_VIDEO_DISPLAY] Detected stream type:', detectedType)
      setStreamType(detectedType)

      if (detectedType === 'unsupported') {
        console.log('[LIVE_VIDEO_DISPLAY] Stream type is unsupported')
        setStreamError('This stream type is not supported for browser playback.')
        return
      }

      if (detectedType === 'usb') {
        console.log('[LIVE_VIDEO_DISPLAY] ===== USB STREAM INITIALIZATION =====');
        console.log('[LIVE_VIDEO_DISPLAY] Initializing USB stream...')
        try {
          await initializeUsbStream()
          console.log('[LIVE_VIDEO_DISPLAY] USB stream initialized successfully')

          // Notify that stream is ready for suggestions
          setTimeout(() => {
            console.log('[LIVE_VIDEO_DISPLAY] ===== USB STREAM READY NOTIFICATION =====');
            console.log('[LIVE_VIDEO_DISPLAY] Setting isStreamReady flag to true');
            (window as any).isStreamReady = true;
            
            const onStreamReady = (window as any).onStreamReady;
            console.log('[LIVE_VIDEO_DISPLAY] onStreamReady callback exists:', !!onStreamReady);
            
            if (onStreamReady) {
              console.log('[LIVE_VIDEO_DISPLAY] Calling onStreamReady callback for USB stream');
              console.log('[LIVE_VIDEO_DISPLAY] Callback timestamp:', new Date().toISOString());
              onStreamReady();
              console.log('[LIVE_VIDEO_DISPLAY] onStreamReady callback completed');
            } else {
              console.log('[LIVE_VIDEO_DISPLAY] No onStreamReady callback found');
            }
          }, 2000); // Wait 2 seconds for USB stream to stabilize

        } catch (usbError) {
          console.error('[LIVE_VIDEO_DISPLAY] USB stream initialization failed:', usbError)
          setStreamError(`USB camera initialization failed: ${usbError.message}`)
        }
        return
      }

      console.log('[LIVE_VIDEO_DISPLAY] ===== NON-USB STREAM INITIALIZATION =====');
      console.log('[LIVE_VIDEO_DISPLAY] Setting up proxy URL for non-USB camera')
      const proxyUrl = `/api/cameras/${selectedCamera._id}/stream`
      console.log('[LIVE_VIDEO_DISPLAY] Proxy URL:', proxyUrl)

      if (detectedType === 'mjpeg') {
        console.log('[LIVE_VIDEO_DISPLAY] ===== MJPEG STREAM SETUP =====');
        console.log('[LIVE_VIDEO_DISPLAY] Initializing MJPEG stream with delay...')
        setTimeout(() => {
          console.log('[LIVE_VIDEO_DISPLAY] Calling initializeMjpegStream')
          initializeMjpegStream(proxyUrl)

          // Notify stream ready after MJPEG loads
          setTimeout(() => {
            console.log('[LIVE_VIDEO_DISPLAY] ===== MJPEG STREAM READY NOTIFICATION =====');
            console.log('[LIVE_VIDEO_DISPLAY] Setting isStreamReady flag to true');
            (window as any).isStreamReady = true;
            
            const onStreamReady = (window as any).onStreamReady;
            console.log('[LIVE_VIDEO_DISPLAY] onStreamReady callback exists:', !!onStreamReady);
            
            if (onStreamReady) {
              console.log('[LIVE_VIDEO_DISPLAY] Calling onStreamReady callback for MJPEG stream');
              console.log('[LIVE_VIDEO_DISPLAY] Callback timestamp:', new Date().toISOString());
              onStreamReady();
              console.log('[LIVE_VIDEO_DISPLAY] onStreamReady callback completed');
            } else {
              console.log('[LIVE_VIDEO_DISPLAY] No onStreamReady callback found');
            }
          }, 1000);
        }, 100)
      } else {
        console.log('[LIVE_VIDEO_DISPLAY] ===== VIDEO STREAM SETUP =====');
        console.log('[LIVE_VIDEO_DISPLAY] Initializing video stream...')
        initializeVideoStream(proxyUrl)

        // Notify stream ready after video loads
        setTimeout(() => {
          console.log('[LIVE_VIDEO_DISPLAY] ===== VIDEO STREAM READY NOTIFICATION =====');
          console.log('[LIVE_VIDEO_DISPLAY] Setting isStreamReady flag to true');
          (window as any).isStreamReady = true;
          
          const onStreamReady = (window as any).onStreamReady;
          console.log('[LIVE_VIDEO_DISPLAY] onStreamReady callback exists:', !!onStreamReady);
          
          if (onStreamReady) {
            console.log('[LIVE_VIDEO_DISPLAY] Calling onStreamReady callback for video stream');
            console.log('[LIVE_VIDEO_DISPLAY] Callback timestamp:', new Date().toISOString());
            onStreamReady();
            console.log('[LIVE_VIDEO_DISPLAY] onStreamReady callback completed');
          } else {
            console.log('[LIVE_VIDEO_DISPLAY] No onStreamReady callback found');
          }
        }, 1000);
      }
    } catch (error) {
      console.error('[LIVE_VIDEO_DISPLAY] ===== INITIALIZE STREAM ERROR =====')
      console.error('[LIVE_VIDEO_DISPLAY] Error in initializeStream:', error)
      setStreamError(`Failed to initialize stream: ${error.message}`)
    }

    console.log('[LIVE_VIDEO_DISPLAY] ===== INITIALIZE STREAM END =====')
  }

  const initializeUsbStream = async () => {
    if (!selectedCamera || !selectedCamera.streamUrl.startsWith('usb:')) {
      setStreamError('Invalid USB camera configuration')
      return
    }

    if (!usbVideoRef.current) {
      setTimeout(() => initializeUsbStream(), 200)
      return
    }

    try {
      const deviceId = selectedCamera.streamUrl.substring(4)
      if (!deviceId) {
        setStreamError('Invalid USB device ID')
        return
      }

      console.log('[LIVE_VIDEO_DISPLAY] Requesting USB camera access for device:', deviceId)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } }
      })

      usbStreamRef.current = stream
      usbVideoRef.current.srcObject = stream

      usbVideoRef.current.onloadedmetadata = () => {
        console.log('[LIVE_VIDEO_DISPLAY] USB video metadata loaded')
        setStreamError(null)
        if (isPlaying && usbVideoRef.current) {
          usbVideoRef.current.play().catch(err => {
            console.error('Error playing USB video:', err)
            setStreamError('Failed to play USB camera stream')
          })
        }
      }

      usbVideoRef.current.onerror = () => {
        setStreamError('USB camera stream error')
      }
    } catch (error) {
      console.error('Error accessing USB camera:', error)
      let errorMessage = 'Failed to access USB camera'
      if (error.name === 'NotFoundError') {
        errorMessage = 'USB camera not found. Please check if the camera is connected.'
      } else if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera access denied. Please grant camera permissions.'
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is already in use by another application.'
      }
      setStreamError(errorMessage)
    }
  }

  const initializeMjpegStream = (proxyUrl: string) => {
    if (!imageRef.current) {
      setTimeout(() => initializeMjpegStream(proxyUrl), 200)
      return
    }

    const image = imageRef.current
    image.onload = () => setStreamError(null)
    image.onerror = () => setStreamError('Failed to load MJPEG stream.')
    image.src = `${proxyUrl}?t=${Date.now()}`
  }

  const initializeVideoStream = (proxyUrl: string) => {
    if (!videoRef.current) return
    const video = videoRef.current
    video.src = ''
    video.load()
    video.onloadeddata = () => setStreamError(null)
    video.oncanplay = () => {
      if (isPlaying) {
        video.play().catch(err => {
          console.error('Error playing video:', err)
          setStreamError('Failed to play video stream')
        })
      }
    }
    video.onerror = () => setStreamError('Video stream error')
    video.src = proxyUrl
    video.load()
  }

  const handleCameraChange = (cameraId: string) => {
    const camera = cameras.find(c => c._id === cameraId)
    if (camera) {
      setSelectedCamera(camera)
      onCameraChange?.(cameraId)
    }
  }

  const togglePlayPause = () => {
    if (streamType === 'usb') {
      setIsPlaying(!isPlaying)
      if (usbVideoRef.current) {
        if (isPlaying) {
          usbVideoRef.current.pause()
        } else {
          usbVideoRef.current.play().catch(err => {
            console.error('Error playing USB video:', err)
            setStreamError('Failed to play USB camera stream')
          })
        }
      }
      return
    }

    if (streamType === 'mjpeg') {
      setIsPlaying(!isPlaying)
      if (!isPlaying && selectedCamera) {
        const proxyUrl = `/api/cameras/${selectedCamera._id}/stream`
        setTimeout(() => initializeMjpegStream(proxyUrl), 100)
      }
      return
    }

    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play().catch(err => {
        console.error('Error playing video:', err)
        setStreamError('Failed to play video stream')
      })
    }
    setIsPlaying(!isPlaying)
  }

  const refreshStream = () => {
    if (selectedCamera) {
      initializeStream()
    }
  }

  if (loading) {
    return (
      <Card className="h-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-600" />
            Live Video Feed
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </CardContent>
      </Card>
    )
  }

  if (cameras.length === 0) {
    return (
      <Card className="h-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-600" />
            Live Video Feed
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-64 text-center">
          <Camera className="h-12 w-12 text-slate-400 mb-4" />
          <p className="text-slate-500 dark:text-slate-400">No cameras available</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">Add a camera to start streaming</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-600" />
            Live Video Feed
            {streamType !== 'unknown' && (
              <Badge variant="outline" className="ml-2 text-xs">
                {streamType.toUpperCase()}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {selectedCamera?.status === 'connected' ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <Badge variant={selectedCamera?.status === 'connected' ? 'default' : 'destructive'}>
              {selectedCamera?.status || 'unknown'}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Select value={selectedCamera?._id || ''} onValueChange={handleCameraChange}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select camera" />
            </SelectTrigger>
            <SelectContent>
              {cameras.map((camera) => (
                <SelectItem key={camera._id} value={camera._id}>
                  {camera.name} ({camera.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(true)}
            disabled={!selectedCamera}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative bg-black rounded-lg overflow-hidden min-h-[400px] max-h-[500px] w-full">
          {streamError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/80">
              <Camera className="h-12 w-12 mb-4 text-red-400" />
              <p className="text-lg font-medium mb-2">Stream Error</p>
              <p className="text-sm text-center px-4 mb-4">{streamError}</p>
              <Button variant="outline" size="sm" onClick={refreshStream}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : selectedCamera ? (
            <>
              <video
                ref={usbVideoRef}
                className="w-full h-full max-h-[500px] object-cover"
                autoPlay
                muted
                playsInline
                style={{ display: streamType === 'usb' ? 'block' : 'none' }}
              />
              <img
                ref={imageRef}
                className="w-full h-full max-h-[500px] object-cover"
                alt="Live camera feed"
                style={{ display: streamType === 'mjpeg' && isPlaying ? 'block' : 'none' }}
              />
              <video
                ref={videoRef}
                className="w-full h-full max-h-[500px] object-cover"
                controls={false}
                autoPlay
                muted
                playsInline
                style={{ display: streamType === 'video' ? 'block' : 'none' }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              {streamType === 'unsupported' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/80">
                  <Camera className="h-12 w-12 mb-4 text-yellow-400" />
                  <p className="text-lg font-medium mb-2">Unsupported Stream</p>
                  <p className="text-sm text-center px-4">This stream type cannot be played in browsers</p>
                </div>
              )}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={togglePlayPause}
                    className="bg-black/50 hover:bg-black/70 text-white"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="text-xs text-white bg-black/50 px-2 py-1 rounded">
                  {selectedCamera.name}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </CardContent>

      <CameraSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        camera={selectedCamera}
        onCameraUpdated={() => {
          console.log('[LIVE_VIDEO_DISPLAY] Camera updated, calling loadCameras and parent callback')
          loadCameras()
          onCameraUpdated?.()
          
          // CRITICAL: Notify other components about camera update
          console.log('[LIVE_VIDEO_DISPLAY] Notifying other components about camera update');
          if ((window as any).notifyAllComponentsCameraUpdate) {
            (window as any).notifyAllComponentsCameraUpdate();
          }
        }}
      />
    </Card>
  )
}