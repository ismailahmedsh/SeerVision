import { ReactNode, useState } from "react"
import { DashboardHeader } from "./DashboardHeader"
import { Sidebar } from "./Sidebar"
import { DashboardFooter } from "./DashboardFooter"
import { useMobile } from "@/hooks/useMobile"

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const isMobile = useMobile()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const toggleSidebar = () => {
    console.log('[DASHBOARD_LAYOUT] Toggling sidebar from:', sidebarOpen, 'to:', !sidebarOpen)
    setSidebarOpen(!sidebarOpen)
  }

  const closeSidebar = () => {
    console.log('[DASHBOARD_LAYOUT] Closing sidebar')
    setSidebarOpen(false)
  }

  const handleSidebarToggle = (isOpen: boolean) => {
    console.log('[DASHBOARD_LAYOUT] Sidebar toggle from child - setting to:', isOpen)
    setSidebarOpen(isOpen)
  }

  console.log('[DASHBOARD_LAYOUT] Render state:', {
    isMobile,
    sidebarOpen,
    shouldShowSidebar: !isMobile
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex flex-col">
      <DashboardHeader />

      <div className="flex flex-1 pt-16">
        {!isMobile && (
          <Sidebar
            onClose={closeSidebar}
            onToggle={handleSidebarToggle}
            isOpen={sidebarOpen}
          />
        )}

        <main className={`flex-1 ${!isMobile && sidebarOpen ? 'ml-64' : !isMobile ? 'ml-16' : ''} flex flex-col transition-all duration-300`}>
          <div className="flex-1 p-6">
            {children}
          </div>
          <DashboardFooter />
        </main>
      </div>
    </div>
  )
}