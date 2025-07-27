import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { Camera, Wifi, AlertCircle, CheckCircle } from "lucide-react"
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
import { updateCamera, testCameraConnection } from "@/api/cameras"
import { useToast } from "@/hooks/useToast"

interface EditCameraDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCameraUpdated: () => void
  camera: {
    _id: string
    name: string
    type: string
    streamUrl: string
    status: string
  } | null
}

interface CameraFormData {
  name: string
  type: string
  streamUrl: string
}

export function EditCameraDialog({ open, onOpenChange, onCameraUpdated, camera }: EditCameraDialogProps) {
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm<CameraFormData>()

  const watchedType = watch('type')

  useEffect(() => {
    if (camera && open) {
      setValue('name', camera.name)
      setValue('type', camera.type)
      setValue('streamUrl', camera.streamUrl)
      setTestResult(null)
    }
  }, [camera, open, setValue])

  const handleClose = () => {
    setTestResult(null)
    reset()
    onOpenChange(false)
  }

  const testConnection = async (data: CameraFormData) => {
    try {
      console.log("Testing camera connection:", data)
      setLoading(true)

      const response = await testCameraConnection({
        streamUrl: data.streamUrl,
        type: data.type
      })

      setTestResult({
        success: response.success,
        message: response.message
      })

      if (response.success) {
        toast({
          title: "Connection Successful",
          description: "Camera stream is working properly",
        })
      } else {
        toast({
          title: "Connection Failed",
          description: response.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error testing connection:", error)
      setTestResult({
        success: false,
        message: "Failed to test connection"
      })
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
    if (!camera) return

    try {
      console.log("Updating camera:", data)
      setLoading(true)

      await updateCamera(camera._id, data)

      handleClose()
      onCameraUpdated()

      toast({
        title: "Success",
        description: "Camera updated successfully",
      })
    } catch (error) {
      console.error("Error updating camera:", error)
      toast({
        title: "Error",
        description: "Failed to update camera",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getStreamUrlPlaceholder = () => {
    switch (watchedType) {
      case 'RTSP Stream':
        return 'rtsp://username:password@192.168.1.100:554/stream'
      case 'HTTP Stream':
        return 'http://192.168.1.100:8080/video'
      case 'IP Camera':
        return 'http://192.168.1.100/mjpg/video.mjpg'
      default:
        return 'Enter camera stream URL'
    }
  }

  if (!camera) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-600" />
            Edit Camera
          </DialogTitle>
          <DialogDescription>
            Update camera details and test the connection
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            <Select onValueChange={(value) => setValue('type', value)} value={watchedType}>
              <SelectTrigger>
                <SelectValue placeholder="Select camera type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RTSP Stream">RTSP Stream</SelectItem>
                <SelectItem value="HTTP Stream">HTTP Stream</SelectItem>
                <SelectItem value="IP Camera">IP Camera</SelectItem>
                <SelectItem value="USB Camera">USB Camera</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-sm text-red-600">{errors.type.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="streamUrl">Stream URL</Label>
            <Input
              id="streamUrl"
              placeholder={getStreamUrlPlaceholder()}
              {...register('streamUrl', { required: 'Stream URL is required' })}
            />
            {errors.streamUrl && (
              <p className="text-sm text-red-600">{errors.streamUrl.message}</p>
            )}
            <p className="text-xs text-slate-500">
              Include username and password if required (e.g., rtsp://user:pass@ip:port/stream)
            </p>
          </div>

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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => testConnection(watch())}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600 mr-2"></div>
                  Testing...
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                'Update Camera'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}