import { useState, useEffect } from "react"
import { LiveVideoDisplay } from "@/components/dashboard/LiveVideoDisplay"
import { AnalysisPanel } from "@/components/dashboard/AnalysisPanel"

export function Dashboard() {
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(undefined)
  const [cameraUpdateTrigger, setCameraUpdateTrigger] = useState(0)

  const handleCameraChange = (cameraId: string) => {
    setSelectedCameraId(cameraId)
  }

  const handleCameraUpdated = () => {
    setCameraUpdateTrigger(prev => prev + 1)
  }

  return (
    <div className="flex flex-col h-[calc(90vh-2.5rem)] bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="flex-1 min-h-0 p-2 sm:p-4 pb-12 lg:pb-4">
        {/* Mobile Layout */}
        <div className="block md:hidden h-full">
          <div className="flex flex-col h-full gap-3">
            <div className="h-[45vh] min-h-[500px] max-h-[400px]">
              <LiveVideoDisplay
                selectedCameraId={selectedCameraId}
                onCameraChange={handleCameraChange}
                onCameraUpdated={handleCameraUpdated}
              />
            </div>
            <div className="flex-1 min-h-[750px] pb-2">
              <AnalysisPanel
                selectedCameraId={selectedCameraId}
                cameraUpdateTrigger={cameraUpdateTrigger}
              />
            </div>
          </div>
        </div>

        {/* Tablet Layout */}
        <div className="hidden md:block lg:hidden h-full">
          <div className="flex flex-col h-full gap-4">
            <div className="h-[50vh] min-h-[500px] max-h-[450px]">
              <LiveVideoDisplay
                selectedCameraId={selectedCameraId}
                onCameraChange={handleCameraChange}
                onCameraUpdated={handleCameraUpdated}
              />
            </div>
            <div className="flex-1 min-h-[750px] pb-2">
              <AnalysisPanel
                selectedCameraId={selectedCameraId}
                cameraUpdateTrigger={cameraUpdateTrigger}
              />
            </div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:block h-full">
          <div className="grid grid-cols-3 gap-4 h-full">
            <div className="col-span-2 h-full min-h-0">
              <LiveVideoDisplay
                selectedCameraId={selectedCameraId}
                onCameraChange={handleCameraChange}
                onCameraUpdated={handleCameraUpdated}
              />
            </div>
            <div className="col-span-1 h-full min-h-0">
              <AnalysisPanel
                selectedCameraId={selectedCameraId}
                cameraUpdateTrigger={cameraUpdateTrigger}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}