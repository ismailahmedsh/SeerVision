import { useState, useEffect, useRef } from "react"
import { Play, Pause, Settings, Camera, Wifi, WifiOff, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
}

export function LiveVideoDisplay({ selectedCameraId, onCameraChange }: LiveVideoDisplayProps) {
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
  const { toast } = useToast()

  console.log('[LIVE_VIDEO_DISPLAY] Component render - selectedCameraId:', selectedCameraId)

  useEffect(() => {
    console.log('[LIVE_VIDEO_DISPLAY] Loading cameras...')
    loadCameras()
  }, [])

  useEffect(() => {
    console.log('[LIVE_VIDEO_DISPLAY] selectedCameraId changed:', selectedCameraId)
    if (selectedCameraId && cameras.length > 0) {
      const camera = cameras.find(c => c._id === selectedCameraId)
      console.log('[LIVE_VIDEO_DISPLAY] Found camera for selectedCameraId:', camera)
      setSelectedCamera(camera || null)
    } else if (cameras.length > 0 && !selectedCamera) {
      console.log('[LIVE_VIDEO_DISPLAY] No selectedCameraId, using first camera:', cameras[0])
      setSelectedCamera(cameras[0])
      onCameraChange?.(cameras[0]._id)
    }
  }, [selectedCameraId, cameras, selectedCamera, onCameraChange])

  useEffect(() => {
    console.log('[LIVE_VIDEO_DISPLAY] selectedCamera changed:', selectedCamera)
    if (selectedCamera) {
      console.log('[LIVE_VIDEO_DISPLAY] Initializing stream for camera:', selectedCamera.name, selectedCamera.streamUrl)
      initializeStream()
    } else {
      // Clean up USB stream when no camera is selected
      cleanupUsbStream()
    }

    // Cleanup on unmount
    return () => {
      cleanupUsbStream()
    }
  }, [selectedCamera])

  const loadCameras = async () => {
    try {
      console.log('[LIVE_VIDEO_DISPLAY] Fetching cameras from API...')
      setLoading(true)
      const response = await getCameras()
      console.log('[LIVE_VIDEO_DISPLAY] Cameras loaded:', response.cameras)
      setCameras(response.cameras)

      if (response.cameras.length > 0 && !selectedCamera) {
        console.log('[LIVE_VIDEO_DISPLAY] Setting first camera as selected:', response.cameras[0])
        setSelectedCamera(response.cameras[0])
        onCameraChange?.(response.cameras[0]._id)
      }
    } catch (error) {
      console.error('[LIVE_VIDEO_DISPLAY] Error loading cameras:', error)
      toast({
        title: "Error",
        description: "Failed to load cameras",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const detectStreamType = (streamUrl: string): 'video' | 'mjpeg' | 'usb' | 'unsupported' | 'unknown' => {
    console.log('[LIVE_VIDEO_DISPLAY] ===== DETECT STREAM TYPE START =====')
    console.log('[LIVE_VIDEO_DISPLAY] Input streamUrl:', streamUrl)
    console.log('[LIVE_VIDEO_DISPLAY] streamUrl type:', typeof streamUrl)
    console.log('[LIVE_VIDEO_DISPLAY] streamUrl length:', streamUrl?.length)

    if (!streamUrl) {
      console.error('[LIVE_VIDEO_DISPLAY] CRITICAL: streamUrl is null/undefined/empty')
      return 'unknown'
    }

    const url = streamUrl.toLowerCase()
    console.log('[LIVE_VIDEO_DISPLAY] Lowercase URL:', url)

    // Check for USB cameras first
    if (url.startsWith('usb:')) {
      console.log('[LIVE_VIDEO_DISPLAY] Detected USB camera (starts with usb:)')
      return 'usb'
    }

    // Check for unsupported protocols
    if (url.startsWith('rtsp://')) {
      console.log('[LIVE_VIDEO_DISPLAY] Detected unsupported RTSP stream')
      return 'unsupported'
    }

    // Check for MJPEG streams
    if (url.includes('mjpg') || url.includes('mjpeg') || url.includes('axis-cgi') || url.includes('/video.cgi')) {
      console.log('[LIVE_VIDEO_DISPLAY] Detected MJPEG stream from URL pattern')
      return 'mjpeg'
    }

    // Check for video streams (including HLS)
    if (url.includes('.mp4') || url.includes('.webm') || url.includes('.ogg') ||
        url.includes('.m3u8') || url.includes('.flv') || url.includes('chunklist') ||
        url.includes('playlist') || url.includes('stream')) {
      console.log('[LIVE_VIDEO_DISPLAY] Detected video stream from URL pattern')
      return 'video'
    }

    // Default to video for HTTP/HTTPS URLs
    if (url.startsWith('http://') || url.startsWith('https://')) {
      console.log('[LIVE_VIDEO_DISPLAY] Defaulting to video stream for HTTP URL')
      return 'video'
    }

    console.log('[LIVE_VIDEO_DISPLAY] Could not determine stream type, returning unknown')
    console.log('[LIVE_VIDEO_DISPLAY] ===== DETECT STREAM TYPE END =====')
    return 'unknown'
  }

  const cleanupUsbStream = () => {
    console.log('[LIVE_VIDEO_DISPLAY] Cleaning up USB stream')
    if (usbStreamRef.current) {
      usbStreamRef.current.getTracks().forEach(track => {
        console.log('[LIVE_VIDEO_DISPLAY] Stopping USB track:', track.kind)
        track.stop()
      })
      usbStreamRef.current = null
    }
    if (usbVideoRef.current) {
      usbVideoRef.current.srcObject = null
    }
  }

  const initializeStream = async () => {
    console.log('[LIVE_VIDEO_DISPLAY] ===== INITIALIZE STREAM START =====')
    console.log('[LIVE_VIDEO_DISPLAY] selectedCamera:', selectedCamera)
    
    if (!selectedCamera) {
      console.error('[LIVE_VIDEO_DISPLAY] CRITICAL: Cannot initialize stream - selectedCamera is null/undefined')
      return
    }

    console.log('[LIVE_VIDEO_DISPLAY] Camera details:', {
      id: selectedCamera._id,
      name: selectedCamera.name,
      type: selectedCamera.type,
      streamUrl: selectedCamera.streamUrl,
      status: selectedCamera.status
    })

    setStreamError(null)
    console.log('[LIVE_VIDEO_DISPLAY] Stream error cleared')

    // Clean up any existing USB stream
    try {
      cleanupUsbStream()
      console.log('[LIVE_VIDEO_DISPLAY] USB stream cleanup completed')
    } catch (cleanupError) {
      console.error('[LIVE_VIDEO_DISPLAY] Error during USB stream cleanup:', cleanupError)
    }

    try {
      // Detect stream type
      const detectedType = detectStreamType(selectedCamera.streamUrl)
      console.log('[LIVE_VIDEO_DISPLAY] Stream type detection result:', detectedType)
      setStreamType(detectedType)
      console.log('[LIVE_VIDEO_DISPLAY] Stream type state updated to:', detectedType)

      if (detectedType === 'unsupported') {
        console.log('[LIVE_VIDEO_DISPLAY] Stream type is unsupported, setting error message')
        setStreamError('This stream type is not supported for browser playback. RTSP streams require special software.')
        return
      }

      if (detectedType === 'usb') {
        console.log('[LIVE_VIDEO_DISPLAY] USB camera detected, initializing USB stream')
        try {
          await initializeUsbStream()
          console.log('[LIVE_VIDEO_DISPLAY] USB stream initialization completed')
        } catch (usbError) {
          console.error('[LIVE_VIDEO_DISPLAY] USB stream initialization failed:', usbError)
          setStreamError(`USB camera initialization failed: ${usbError.message}`)
        }
        return
      }

      // Use the backend proxy endpoint for network streams
      const proxyUrl = `/api/cameras/${selectedCamera._id}/stream`
      console.log('[LIVE_VIDEO_DISPLAY] Network stream detected, using proxy URL:', proxyUrl)

      if (detectedType === 'mjpeg') {
        console.log('[LIVE_VIDEO_DISPLAY] Setting up MJPEG stream with delay')
        setTimeout(() => {
          console.log('[LIVE_VIDEO_DISPLAY] Executing delayed MJPEG initialization')
          initializeMjpegStream(proxyUrl)
        }, 100)
      } else {
        console.log('[LIVE_VIDEO_DISPLAY] Setting up video stream')
        initializeVideoStream(proxyUrl)
      }

    } catch (error) {
      console.error('[LIVE_VIDEO_DISPLAY] CRITICAL ERROR in initializeStream:', error)
      console.error('[LIVE_VIDEO_DISPLAY] Error stack:', error.stack)
      setStreamError(`Failed to initialize stream: ${error.message}`)
    }
    
    console.log('[LIVE_VIDEO_DISPLAY] ===== INITIALIZE STREAM END =====')
  }

  const initializeUsbStream = async () => {
    console.log('[LIVE_VIDEO_DISPLAY] ===== INITIALIZE USB STREAM START =====')
    console.log('[LIVE_VIDEO_DISPLAY] selectedCamera:', selectedCamera)
    console.log('[LIVE_VIDEO_DISPLAY] selectedCamera.streamUrl:', selectedCamera?.streamUrl)

    if (!selectedCamera || !selectedCamera.streamUrl.startsWith('usb:')) {
      console.error('[LIVE_VIDEO_DISPLAY] CRITICAL: Invalid USB camera data')
      console.error('[LIVE_VIDEO_DISPLAY] selectedCamera exists:', !!selectedCamera)
      console.error('[LIVE_VIDEO_DISPLAY] streamUrl starts with usb:', selectedCamera?.streamUrl?.startsWith('usb:'))
      setStreamError('Invalid USB camera configuration')
      return
    }

    console.log('[LIVE_VIDEO_DISPLAY] Checking usbVideoRef.current:', !!usbVideoRef.current)
    if (!usbVideoRef.current) {
      console.log('[LIVE_VIDEO_DISPLAY] USB video ref not available, scheduling retry')
      setTimeout(() => {
        console.log('[LIVE_VIDEO_DISPLAY] Retrying USB stream initialization')
        initializeUsbStream()
      }, 200)
      return
    }

    try {
      // Extract device ID from streamUrl (format: usb:deviceId)
      const deviceId = selectedCamera.streamUrl.substring(4) // Remove 'usb:' prefix
      console.log('[LIVE_VIDEO_DISPLAY] Extracted USB device ID:', deviceId)
      console.log('[LIVE_VIDEO_DISPLAY] Device ID length:', deviceId.length)

      if (!deviceId || deviceId.length === 0) {
        console.error('[LIVE_VIDEO_DISPLAY] CRITICAL: Empty device ID extracted')
        setStreamError('Invalid USB device ID')
        return
      }

      console.log('[LIVE_VIDEO_DISPLAY] Requesting getUserMedia with constraints:', {
        video: { deviceId: { exact: deviceId } }
      })

      // Request access to the USB camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } }
      })

      console.log('[LIVE_VIDEO_DISPLAY] getUserMedia successful, stream:', stream)
      console.log('[LIVE_VIDEO_DISPLAY] Stream tracks:', stream.getTracks().map(track => ({
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        readyState: track.readyState
      })))

      usbStreamRef.current = stream
      console.log('[LIVE_VIDEO_DISPLAY] Stream assigned to usbStreamRef')

      usbVideoRef.current.srcObject = stream
      console.log('[LIVE_VIDEO_DISPLAY] Stream assigned to video element srcObject')

      // Set up event handlers
      usbVideoRef.current.onloadedmetadata = () => {
        console.log('[LIVE_VIDEO_DISPLAY] USB video metadata loaded successfully')
        setStreamError(null)
        if (isPlaying && usbVideoRef.current) {
          console.log('[LIVE_VIDEO_DISPLAY] Auto-playing USB video')
          usbVideoRef.current.play().catch(err => {
            console.error('[LIVE_VIDEO_DISPLAY] Error auto-playing USB video:', err)
            setStreamError('Failed to play USB camera stream')
          })
        }
      }

      usbVideoRef.current.onerror = (error) => {
        console.error('[LIVE_VIDEO_DISPLAY] USB video element error:', error)
        console.error('[LIVE_VIDEO_DISPLAY] USB video element error details:', usbVideoRef.current?.error)
        setStreamError('USB camera stream error')
      }

      console.log('[LIVE_VIDEO_DISPLAY] USB stream event handlers set up')

    } catch (error) {
      console.error('[LIVE_VIDEO_DISPLAY] CRITICAL ERROR accessing USB camera:', error)
      console.error('[LIVE_VIDEO_DISPLAY] Error name:', error.name)
      console.error('[LIVE_VIDEO_DISPLAY] Error message:', error.message)
      console.error('[LIVE_VIDEO_DISPLAY] Error stack:', error.stack)
      
      let errorMessage = 'Failed to access USB camera'

      if (error.name === 'NotFoundError') {
        errorMessage = 'USB camera not found. Please check if the camera is connected.'
      } else if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera access denied. Please grant camera permissions.'
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is already in use by another application.'
      }

      console.log('[LIVE_VIDEO_DISPLAY] Setting error message:', errorMessage)
      setStreamError(errorMessage)
    }
    
    console.log('[LIVE_VIDEO_DISPLAY] ===== INITIALIZE USB STREAM END =====')
  }

  const initializeMjpegStream = (proxyUrl: string) => {
    console.log('[LIVE_VIDEO_DISPLAY] Initializing MJPEG stream')

    if (!imageRef.current) {
      console.log('[LIVE_VIDEO_DISPLAY] No image ref available, retrying...')
      setTimeout(() => initializeMjpegStream(proxyUrl), 200)
      return
    }

    const image = imageRef.current

    image.onload = () => {
      console.log('[LIVE_VIDEO_DISPLAY] MJPEG image loaded successfully')
      setStreamError(null)
    }

    image.onerror = (error) => {
      console.error('[LIVE_VIDEO_DISPLAY] MJPEG image error:', error)
      setStreamError('Failed to load MJPEG stream. The camera may be offline or require authentication.')
    }

    image.src = `${proxyUrl}?t=${Date.now()}`
  }

  const initializeVideoStream = (proxyUrl: string) => {
    console.log('[LIVE_VIDEO_DISPLAY] Initializing video stream')

    if (!videoRef.current) {
      console.log('[LIVE_VIDEO_DISPLAY] No video ref available')
      return
    }

    const video = videoRef.current

    video.src = ''
    video.load()

    video.onloadstart = () => {
      console.log('[LIVE_VIDEO_DISPLAY] Video load started')
    }

    video.onloadeddata = () => {
      console.log('[LIVE_VIDEO_DISPLAY] Video data loaded')
      setStreamError(null)
    }

    video.oncanplay = () => {
      console.log('[LIVE_VIDEO_DISPLAY] Video can start playing')
      if (isPlaying) {
        video.play().catch(err => {
          console.error('[LIVE_VIDEO_DISPLAY] Error playing video:', err)
          setStreamError('Failed to play video stream')
        })
      }
    }

    video.onerror = (error) => {
      console.error('[LIVE_VIDEO_DISPLAY] Video error event:', error)
      console.error('[LIVE_VIDEO_DISPLAY] Video error object:', video.error)
      console.error('[LIVE_VIDEO_DISPLAY] Video current src:', video.currentSrc)
      console.error('[LIVE_VIDEO_DISPLAY] Video network state:', video.networkState)
      console.error('[LIVE_VIDEO_DISPLAY] Video ready state:', video.readyState)

      let errorMessage = 'Video stream error'

      if (video.error) {
        console.error('[LIVE_VIDEO_DISPLAY] Video error code:', video.error.code)
        console.error('[LIVE_VIDEO_DISPLAY] Video error message:', video.error.message)

        switch (video.error.code) {
          case video.error.MEDIA_ERR_ABORTED:
            errorMessage = 'Video playback was aborted. The stream may have been interrupted.'
            break
          case video.error.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error while loading video. The stream may be offline, require authentication, or be blocked by CORS policy.'
            break
          case video.error.MEDIA_ERR_DECODE:
            errorMessage = 'Video decoding error. The stream format may not be supported by your browser.'
            break
          case video.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Video format not supported by browser. The stream may be in an unsupported format or require authentication.'
            break
          default:
            errorMessage = video.error.message || 'Unknown video error. The stream may be offline or require authentication.'
        }
      } else {
        switch (video.networkState) {
          case video.NETWORK_NO_SOURCE:
            errorMessage = 'No video source available. The stream URL may be invalid.'
            break
          case video.NETWORK_LOADING:
            errorMessage = 'Video is loading but encountered an error.'
            break
          case video.NETWORK_IDLE:
            errorMessage = 'Video network is idle. The stream may have stopped.'
            break
          default:
            errorMessage = 'Video stream error. The stream may be offline, require authentication, or be in an unsupported format.'
        }
      }

      console.error('[LIVE_VIDEO_DISPLAY] Final error message:', errorMessage)
      setStreamError(errorMessage)
    }

    video.onabort = () => {
      console.log('[LIVE_VIDEO_DISPLAY] Video loading was aborted')
      setStreamError('Video loading was aborted. The stream may be unavailable or require authentication.')
    }

    console.log('[LIVE_VIDEO_DISPLAY] Setting video source to:', proxyUrl)
    video.src = proxyUrl
    video.load()
  }

  const handleCameraChange = (cameraId: string) => {
    console.log('[LIVE_VIDEO_DISPLAY] Camera selection changed to:', cameraId)
    const camera = cameras.find(c => c._id === cameraId)
    if (camera) {
      console.log('[LIVE_VIDEO_DISPLAY] Setting selected camera:', camera)
      setSelectedCamera(camera)
      onCameraChange?.(cameraId)
    }
  }

  const togglePlayPause = () => {
    console.log('[LIVE_VIDEO_DISPLAY] Toggle play/pause - current state:', isPlaying)

    if (streamType === 'usb') {
      setIsPlaying(!isPlaying)
      if (usbVideoRef.current) {
        if (isPlaying) {
          console.log('[LIVE_VIDEO_DISPLAY] Pausing USB video')
          usbVideoRef.current.pause()
        } else {
          console.log('[LIVE_VIDEO_DISPLAY] Playing USB video')
          usbVideoRef.current.play().catch(err => {
            console.error('[LIVE_VIDEO_DISPLAY] Error playing USB video:', err)
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

    if (!videoRef.current) {
      console.log('[LIVE_VIDEO_DISPLAY] No video ref available')
      return
    }

    if (isPlaying) {
      console.log('[LIVE_VIDEO_DISPLAY] Pausing video')
      videoRef.current.pause()
    } else {
      console.log('[LIVE_VIDEO_DISPLAY] Playing video')
      videoRef.current.play().catch(err => {
        console.error('[LIVE_VIDEO_DISPLAY] Error playing video:', err)
        setStreamError('Failed to play video stream')
      })
    }
    setIsPlaying(!isPlaying)
  }

  const refreshStream = () => {
    console.log('[LIVE_VIDEO_DISPLAY] Refreshing stream')
    if (selectedCamera) {
      initializeStream()
    }
  }

  console.log('[LIVE_VIDEO_DISPLAY] Current state:', {
    loading,
    camerasCount: cameras.length,
    selectedCamera: selectedCamera?.name,
    streamError,
    isPlaying,
    streamType
  })

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

        <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
          {streamError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/80">
              <Camera className="h-12 w-12 mb-4 text-red-400" />
              <p className="text-lg font-medium mb-2">Stream Error</p>
              <p className="text-sm text-center px-4 mb-4">{streamError}</p>
              <div className="bg-blue-600/20 border border-blue-400 rounded-lg p-4 max-w-md mb-4">
                <p className="text-sm text-blue-200 mb-2">Stream URL:</p>
                <p className="text-xs font-mono text-blue-100 break-all">{selectedCamera?.streamUrl}</p>
                <p className="text-sm text-blue-200 mt-2">Stream Type: {streamType}</p>
              </div>
              <Button variant="outline" size="sm" onClick={refreshStream}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : selectedCamera ? (
            <>
              {/* USB Camera Display */}
              <video
                ref={usbVideoRef}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
                style={{ display: streamType === 'usb' ? 'block' : 'none' }}
              />

              {/* MJPEG Stream Display */}
              <img
                ref={imageRef}
                className="w-full h-full object-cover"
                alt="Live camera feed"
                style={{ display: streamType === 'mjpeg' && isPlaying ? 'block' : 'none' }}
              />

              {/* Video Stream Display */}
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                controls={false}
                autoPlay
                muted
                playsInline
                style={{ display: streamType === 'video' ? 'block' : 'none' }}
              />

              {/* Unsupported Stream Message */}
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
                    className="bg-black/50 hover:bg-black/70 text-white border-white/20"
                    disabled={streamType === 'unsupported'}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={refreshStream}
                    className="bg-black/50 hover:bg-black/70 text-white border-white/20"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-white text-sm bg-black/50 px-2 py-1 rounded">
                  {selectedCamera.name}
                </div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <div className="text-center">
                <Camera className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                <p className="text-lg font-medium">No Camera Selected</p>
                <p className="text-sm text-slate-400">Select a camera to view the stream</p>
              </div>
            </div>
          )}
        </div>

        {selectedCamera && (
          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <p><strong>Type:</strong> {selectedCamera.type} ({streamType})</p>
            <p><strong>URL:</strong> {selectedCamera.streamUrl}</p>
            <p><strong>Status:</strong> {selectedCamera.status}</p>
            {selectedCamera.lastSeen && (
              <p><strong>Last Seen:</strong> {new Date(selectedCamera.lastSeen).toLocaleString()}</p>
            )}
          </div>
        )}
      </CardContent>

      {selectedCamera && (
        <CameraSettingsDialog
          open={showSettings}
          onOpenChange={setShowSettings}
          camera={selectedCamera}
        />
      )}
    </Card>
  )
}