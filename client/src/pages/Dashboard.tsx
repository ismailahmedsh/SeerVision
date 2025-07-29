import { useState, useEffect } from "react"
import { LiveVideoDisplay } from "@/components/dashboard/LiveVideoDisplay"
import { AnalysisPanel } from "@/components/dashboard/AnalysisPanel"

export function Dashboard() {
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(undefined)
  const [isMobile, setIsMobile] = useState(false)
  const [cameraUpdateTrigger, setCameraUpdateTrigger] = useState(0)

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024
      setIsMobile(mobile)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => {
      window.removeEventListener('resize', checkMobile)
    }
  }, [])

  const handleCameraChange = (cameraId: string) => {
    setSelectedCameraId(cameraId)
  }

  const handleCameraUpdated = () => {
    setCameraUpdateTrigger(prev => prev + 1)

    setTimeout(() => {
      setCameraUpdateTrigger(prev => prev + 1);
    }, 100);
  }

  try {
    if (isMobile) {
      return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
          <div className="flex-1 space-y-4 overflow-auto min-h-0 p-2">
            <div className="grid grid-cols-1 gap-4">
              <div className="h-[45vh]">
                <LiveVideoDisplay
                  selectedCameraId={selectedCameraId}
                  onCameraChange={handleCameraChange}
                  onCameraUpdated={handleCameraUpdated}
                />
              </div>
              <div className="h-[45vh]">
                <AnalysisPanel
                  selectedCameraId={selectedCameraId}
                  onCameraUpdated={handleCameraUpdated}
                />
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="flex h-[calc(100vh-12rem)] bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 p-4">
          <div className="lg:col-span-2 h-full min-h-0">
            <LiveVideoDisplay
              selectedCameraId={selectedCameraId}
              onCameraChange={handleCameraChange}
              onCameraUpdated={handleCameraUpdated}
            />
          </div>
          <div className="h-full min-h-0">
            <AnalysisPanel
              selectedCameraId={selectedCameraId}
              onCameraUpdated={handleCameraUpdated}
            />
          </div>
        </div>
      </div>
    )
  } catch (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <h2 className="text-xl font-bold text-red-600 mb-4">Dashboard Error</h2>
          <p className="text-gray-600 mb-4">An error occurred while loading the dashboard.</p>
          <p className="text-sm text-gray-500">Check the console for details.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reload Page
          </button>
        </div>
      </div>
    )
  }
}