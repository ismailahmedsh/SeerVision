import { useState } from "react"
import { DashboardHeader } from "./DashboardHeader"
import { DashboardFooter } from "./DashboardFooter"
import { Sidebar } from "./Sidebar"
import { useMobile } from "@/hooks/useMobile"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true) // Default to open on desktop
  const isMobile = useMobile()

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - different behavior for mobile vs desktop */}
      <div className={`
        ${isMobile 
          ? `fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
          : `fixed inset-y-0 left-0 z-30 transition-all duration-300 ease-in-out ${sidebarOpen ? 'w-64' : 'w-0'} overflow-hidden`
        }
      `}>
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          isMobile={isMobile}
        />
      </div>

      {/* Main content - adjusts based on sidebar state */}
      <div className={`flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
        isMobile 
          ? '' 
          : sidebarOpen 
            ? 'ml-64' 
            : 'ml-0'
      }`}>
        <DashboardHeader
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          showMenuButton={true}
          sidebarOpen={sidebarOpen}
        />

        <main className="flex-1">
          {children}
        </main>

        <DashboardFooter />
      </div>
    </div>
  )
}