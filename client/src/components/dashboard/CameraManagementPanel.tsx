import { useState, useEffect, useCallback } from "react"
import { Plus, Camera, Wifi, WifiOff, Edit, Trash2, Eye, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AddCameraDialog } from "./AddCameraDialog"
import { getCameras, deleteCamera } from "@/api/cameras"
import { useToast } from "@/hooks/useToast"

interface Camera {
  _id: string
  name: string
  type: string
  streamUrl: string
  status: 'connected' | 'disconnected'
  lastSeen?: string
}

interface CameraManagementPanelProps {
  collapsed?: boolean
  onToggle?: (collapsed: boolean) => void
}

export function CameraManagementPanel({ collapsed = false, onToggle }: CameraManagementPanelProps) {
  const [cameras, setCameras] = useState<Camera[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const { toast } = useToast()

  const loadCameras = useCallback(async () => {
    if (hasLoaded && !loading) return
    
    try {
      console.log("Loading cameras...")
      setLoading(true)
      const response = await getCameras()
      setCameras(response.cameras)
      if (response.cameras.length > 0 && !selectedCamera) {
        setSelectedCamera(response.cameras[0]._id)
      }
      setHasLoaded(true)
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
  }, [hasLoaded, loading, selectedCamera, toast])

  useEffect(() => {
    if (!hasLoaded) {
      loadCameras()
    }
  }, [loadCameras, hasLoaded])

  const handleCameraAdded = () => {
    setHasLoaded(false)
    loadCameras()
    setShowAddDialog(false)
    toast({
      title: "Success",
      description: "Camera added successfully",
    })
  }

  const handleDeleteCamera = async (cameraId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      await deleteCamera(cameraId)
      setCameras(prev => prev.filter(camera => camera._id !== cameraId))
      if (selectedCamera === cameraId) {
        const remainingCameras = cameras.filter(camera => camera._id !== cameraId)
        setSelectedCamera(remainingCameras.length > 0 ? remainingCameras[0]._id : null)
      }
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

  const handleToggle = () => {
    onToggle?.(!collapsed)
  }

  return (
    <Card className="h-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-600" />
            {!collapsed && "Cameras"}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              onClick={() => setShowAddDialog(true)}
              size="sm"
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1" />
              {!collapsed && "Add"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggle}
              className="h-8 w-8 p-0 lg:hidden"
            >
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {!collapsed && (
        <CardContent className="space-y-3 flex-1 overflow-hidden">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                </div>
              ))}
            </div>
          ) : cameras.length === 0 ? (
            <div className="text-center py-8">
              <Camera className="h-12 w-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                No cameras added yet
              </p>
              <Button
                onClick={() => setShowAddDialog(true)}
                variant="outline"
                size="sm"
                className="mt-3"
              >
                Add your first camera
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-full max-h-[calc(100vh-200px)]">
              <div className="space-y-3 pr-4">
                {cameras.map((camera) => (
                  <div
                    key={camera._id}
                    className={`p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                      selectedCamera === camera._id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                    onClick={() => setSelectedCamera(camera._id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-sm truncate">{camera.name}</h3>
                      <div className="flex items-center gap-1">
                        {camera.status === 'connected' ? (
                          <Wifi className="h-4 w-4 text-green-500" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge
                        variant={camera.status === 'connected' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {camera.status}
                      </Badge>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedCamera(camera._id)
                          }}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          onClick={(e) => handleDeleteCamera(camera._id, e)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                      {camera.type} • {camera.streamUrl}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      )}

      <AddCameraDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onCameraAdded={handleCameraAdded}
      />
    </Card>
  )
}