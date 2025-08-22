import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { Camera, Wifi, AlertCircle, CheckCircle, Video } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { addCamera, testCameraConnection } from "@/api/cameras"
import { useToast } from "@/hooks/useToast"
import { useSettings } from "@/contexts/SettingsContext"

interface AddCameraDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCameraAdded: () => void
}

interface CameraFormData {
  name: string
  type: string
  streamUrl: string
  deviceId?: string
}

interface MediaDeviceInfo {
  deviceId: string
  label: string
  kind: string
}

export function AddCameraDialog({ open, onOpenChange, onCameraAdded }: AddCameraDialogProps) {
  const [step, setStep] = useState<'form' | 'testing' | 'success'>('form')
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([])
  const [loadingDevices, setLoadingDevices] = useState(false)
  const { toast } = useToast()
  const { settings } = useSettings()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm<CameraFormData>()

  const watchedType = watch('type')
  const watchedDeviceId = watch('deviceId')

  useEffect(() => {
    if (open && watchedType === 'usb') {
      loadAvailableDevices()
    }
  }, [open, watchedType])

  const loadAvailableDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      setAvailableDevices(videoDevices)
    } catch (error: any) {
      console.error('Failed to load available devices:', error)
    }
  }

  const handleClose = () => {
    setStep('form')
    setTestResult(null)
    setAvailableDevices([])
    reset()
    onOpenChange(false)
  }

  const handleTypeChange = (value: string) => {
    setValue('type', value)
    setTestResult(null)
  }

  const testConnection = async (data: CameraFormData) => {
    try {
      setLoading(true)
      setStep('testing')

      let testData = {
        streamUrl: data.streamUrl,
        type: data.type
      }

      // For USB cameras, we test differently
      if (data.type === 'usb') {
        if (!data.deviceId) {
          setTestResult({
            success: false,
            message: 'Please select a camera device'
          })
          setStep('form')
          return
        }

        // Test USB camera access
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { deviceId: data.deviceId } 
          })
          stream.getTracks().forEach(track => track.stop())
          
          setTestResult({
            success: true,
            message: 'USB camera is accessible and working properly'
          })
          setStep('form')
          toast({
            title: "Connection Successful",
            description: "USB camera is working properly",
          })
          return
        } catch (error: any) {
          console.error('USB camera test failed:', error)
          setTestResult({
            success: false,
            message: 'Failed to access USB camera. Please check permissions and try again.'
          })
          setStep('form')
          toast({
            title: "Connection Failed",
            description: "Failed to access USB camera",
            variant: "destructive",
          })
          return
        }
      }

      // For network cameras, use the existing test
      const response = await testCameraConnection(testData)

      setTestResult({
        success: response.success,
        message: response.message
      })

      if (response.success) {
        setStep('form')
        toast({
          title: "Connection Successful",
          description: "Camera stream is working properly",
        })
      } else {
        setStep('form')
        toast({
          title: "Connection Failed",
          description: response.message,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error('Error testing connection:', error)
      setTestResult({
        success: false,
        message: "Failed to test connection"
      })
      setStep('form')
      toast({
        title: "Error",
        description: "Failed to test camera connection",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: CameraFormData) => {
    if (!testResult?.success) {
      await testConnection(data)
      return
    }

    try {
      setLoading(true)

      // Prepare data for backend
      let cameraData = {
        name: data.name,
        type: data.type,
        streamUrl: data.streamUrl || '',
        defaultInterval: settings?.analysis?.defaultInterval || 10
      }

      // For USB cameras, use device ID as stream URL
      if (data.type === 'usb' && data.deviceId) {
        cameraData.streamUrl = `usb:${data.deviceId}`
      }

      const response = await addCamera(cameraData)

      if (response.success) {
        setStep('success')

        setTimeout(() => {
          handleClose()
          onCameraAdded()
        }, 1500)

        toast({
          title: "Success",
          description: "Camera added successfully",
        })
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to add camera",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error('Error adding camera:', error)
      setStep('form')
      toast({
        title: "Error",
        description: error.message || "Failed to add camera",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const isUsbCamera = watchedType === 'usb'

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-600" />
            Add New Camera
          </DialogTitle>
          <DialogDescription>
            {step === 'form' && "Enter your camera details and test the connection"}
            {step === 'testing' && "Testing camera connection..."}
            {step === 'success' && "Camera added successfully!"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {step === 'form' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Camera Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Front Door Camera"
                  {...register('name', { required: 'Camera name is required' })}
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Camera Type</Label>
                <Select onValueChange={handleTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select camera type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usb">USB Camera</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && (
                  <p className="text-sm text-red-600">{errors.type.message}</p>
                )}
              </div>

              {isUsbCamera ? (
                <div className="space-y-2">
                  <Label htmlFor="deviceId">Select Camera Device</Label>
                  {loadingDevices ? (
                    <div className="flex items-center justify-center p-4 border rounded-lg">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      <span className="text-sm">Loading cameras...</span>
                    </div>
                  ) : availableDevices.length > 0 ? (
                    <Select onValueChange={(value) => setValue('deviceId', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a camera device" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDevices.map((device) => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            <div className="flex items-center gap-2">
                              <Video className="h-4 w-4" />
                              {device.label || `Camera ${device.deviceId.substring(0, 8)}`}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-4 border rounded-lg text-center">
                      <Camera className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">No USB cameras detected</p>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={loadAvailableDevices}
                        className="mt-2"
                      >
                        Refresh
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="streamUrl">Stream URL</Label>
                  <Input
                    id="streamUrl"
                    placeholder="Enter camera stream URL"
                    {...register('streamUrl', { required: 'Stream URL is required' })}
                  />
                  {errors.streamUrl && (
                    <p className="text-sm text-red-600">{errors.streamUrl.message}</p>
                  )}
                  <p className="text-xs text-slate-500">
                    Only USB cameras are currently supported
                  </p>
                </div>
              )}

              {testResult && (
                <div className={`p-3 rounded-lg border ${
                  testResult.success
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                    : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                }`}>
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className={`text-sm font-medium ${
                      testResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                    }`}>
                      {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${
                    testResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {testResult.message}
                  </p>
                </div>
              )}
            </>
          )}

          {step === 'testing' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-lg font-medium">Testing Connection...</p>
              <p className="text-sm text-slate-500 mt-1">
                {isUsbCamera ? 'Checking camera access...' : 'This may take a few seconds'}
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-green-700 dark:text-green-300">
                Camera Added Successfully!
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Redirecting to camera view...
              </p>
            </div>
          )}

          <DialogFooter>
            {step === 'form' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || (isUsbCamera && !watchedDeviceId)}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {testResult?.success ? 'Adding...' : 'Testing...'}
                    </>
                  ) : (
                    <>
                      <Wifi className="h-4 w-4 mr-2" />
                      {testResult?.success ? 'Add Camera' : 'Test Connection'}
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}