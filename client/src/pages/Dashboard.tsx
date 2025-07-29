import { useState, useEffect } from "react"
import { LiveVideoDisplay } from "@/components/dashboard/LiveVideoDisplay"
import { AnalysisPanel } from "@/components/dashboard/AnalysisPanel"

export function Dashboard() {
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(undefined)
  const [isMobile, setIsMobile] = useState(false)
  const [cameraUpdateTrigger, setCameraUpdateTrigger] = useState(0)

  console.log('[DASHBOARD] Component render - selectedCameraId:', selectedCameraId)

  useEffect(() => {
    console.log('[DASHBOARD] useEffect - checking mobile viewport')
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024
      console.log('[DASHBOARD] Mobile check result:', mobile, 'window width:', window.innerWidth)
      setIsMobile(mobile)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    console.log('[DASHBOARD] Resize listener added')

    return () => {
      console.log('[DASHBOARD] Cleanup - removing resize listener')
      window.removeEventListener('resize', checkMobile)
    }
  }, [])

  const handleCameraChange = (cameraId: string) => {
    console.log('[DASHBOARD] handleCameraChange called with:', cameraId)
    console.log('[DASHBOARD] Previous selectedCameraId:', selectedCameraId)
    setSelectedCameraId(cameraId)
    console.log('[DASHBOARD] selectedCameraId updated to:', cameraId)
  }

  const handleCameraUpdated = () => {
    console.log('[DASHBOARD] ===== CAMERA UPDATED CALLBACK =====')
    console.log('[DASHBOARD] Camera settings were updated, triggering refresh')
    console.log('[DASHBOARD] Current camera update trigger:', cameraUpdateTrigger)

    setCameraUpdateTrigger(prev => prev + 1)

    console.log('[DASHBOARD] Camera update trigger incremented')
    console.log('[DASHBOARD] This will cause both LiveVideoDisplay and AnalysisPanel to refresh')

    // CRITICAL: Force immediate re-render of both components
    console.log('[DASHBOARD] Forcing immediate component refresh');

    // Trigger a small delay to ensure state updates propagate
    setTimeout(() => {
      console.log('[DASHBOARD] Delayed refresh trigger for component synchronization');
      setCameraUpdateTrigger(prev => prev + 1);
    }, 100);
  }

  console.log('[DASHBOARD] Current state:', {
    selectedCameraId,
    isMobile,
    cameraUpdateTrigger,
    windowWidth: typeof window !== 'undefined' ? window.innerWidth : 'undefined'
  })

  try {
    if (isMobile) {
      console.log('[DASHBOARD] Rendering mobile layout')
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

    console.log('[DASHBOARD] Rendering desktop layout')
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
    console.error('[DASHBOARD] CRITICAL ERROR during render:', error)
    console.error('[DASHBOARD] Error stack:', error.stack)
    console.error('[DASHBOARD] Component state at error:', {
      selectedCameraId,
      isMobile,
      cameraUpdateTrigger
    })

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