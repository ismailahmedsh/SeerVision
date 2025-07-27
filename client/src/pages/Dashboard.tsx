import { useState, useEffect } from "react"
import { LiveVideoDisplay } from "@/components/dashboard/LiveVideoDisplay"
import { AnalysisPanel } from "@/components/dashboard/AnalysisPanel"

export function Dashboard() {
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(undefined)
  const [isMobile, setIsMobile] = useState(false)

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

  console.log('[DASHBOARD] Current state:', {
    selectedCameraId,
    isMobile,
    windowWidth: typeof window !== 'undefined' ? window.innerWidth : 'undefined'
  })

  try {
    if (isMobile) {
      console.log('[DASHBOARD] Rendering mobile layout')
      return (
        <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
          <div className="flex-1 p-4 space-y-4 overflow-auto">
            <div className="grid grid-cols-1 gap-4">
              <LiveVideoDisplay
                selectedCameraId={selectedCameraId}
                onCameraChange={handleCameraChange}
              />
              <AnalysisPanel selectedCameraId={selectedCameraId} />
            </div>
          </div>
        </div>
      )
    }

    console.log('[DASHBOARD] Rendering desktop layout')
    return (
      <div className="flex h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <LiveVideoDisplay
              selectedCameraId={selectedCameraId}
              onCameraChange={handleCameraChange}
            />
          </div>
          <div>
            <AnalysisPanel selectedCameraId={selectedCameraId} />
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error('[DASHBOARD] CRITICAL ERROR during render:', error)
    console.error('[DASHBOARD] Error stack:', error.stack)
    console.error('[DASHBOARD] Component state at error:', {
      selectedCameraId,
      isMobile
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