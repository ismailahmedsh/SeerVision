import { useState, useEffect } from "react"
import { Camera, Plus, Wifi, WifiOff, Trash2, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { getCameras, deleteCamera } from "@/api/cameras"
import { AddCameraDialog } from "@/components/dashboard/AddCameraDialog"
import { CameraSettingsDialog } from "@/components/dashboard/CameraSettingsDialog"
import { useToast } from "@/hooks/useToast"

interface Camera {
  _id: string
  name: string
  type: string
  streamUrl: string
  status: 'connected' | 'disconnected'
  lastSeen?: string
  analysisInterval?: number
  memory?: boolean
}

export function Cameras() {
  const [cameras, setCameras] = useState<Camera[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadCameras()
  }, [])

  const loadCameras = async () => {
    try {
      setLoading(true)
      const response = await getCameras()
      setCameras(response.cameras)
    } catch (error) {
      console.error("Error loading cameras:", error)
      toast({
        title: "Error",
        description: "Failed to load cameras",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCamera = async (cameraId: string) => {
    try {
      await deleteCamera(cameraId)
      setCameras(prev => prev.filter(camera => camera._id !== cameraId))
      toast({
        title: "Success",
        description: "Camera deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting camera:", error)
      toast({
        title: "Error",
        description: "Failed to delete camera",
        variant: "destructive",
      })
    }
  }

  const handleCameraSettings = (camera: Camera) => {
    setSelectedCamera(camera)
    setShowSettingsDialog(true)
  }

  const filteredCameras = cameras.filter(camera =>
    camera.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            Camera Management
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Manage your connected cameras and streams
          </p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Camera
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Search cameras..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Badge variant="outline">
          {filteredCameras.length} cameras
        </Badge>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded"></div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCameras.map((camera) => (
            <Card key={camera._id} className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Camera className="h-5 w-5 text-blue-600" />
                    {camera.name}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    {camera.status === 'connected' ? (
                      <Wifi className="h-4 w-4 text-green-500" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Status</span>
                    <Badge variant={camera.status === 'connected' ? 'default' : 'destructive'}>
                      {camera.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Type</span>
                    <span className="text-sm font-medium">{camera.type}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Stream URL</span>
                    <p className="text-xs font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded break-all">
                      {camera.streamUrl}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-900/20"
                    onClick={() => handleCameraSettings(camera)}
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Settings
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteCamera(camera._id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && filteredCameras.length === 0 && (
        <div className="text-center py-12">
          <Camera className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            {searchTerm ? 'No cameras found' : 'No cameras added yet'}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            {searchTerm ? 'Try adjusting your search terms' : 'Add your first camera to get started'}
          </p>
          {!searchTerm && (
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Camera
            </Button>
          )}
        </div>
      )}

      <AddCameraDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onCameraAdded={loadCameras}
      />

      <CameraSettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        camera={selectedCamera}
      />
    </div>
  )
}