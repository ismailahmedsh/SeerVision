import { ReactNode, useState } from "react"
import { DashboardHeader } from "./DashboardHeader"
import { Sidebar } from "./Sidebar"

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      <DashboardHeader />
      <div className="flex h-[calc(100vh-4rem)] pt-16">
        {/* Sidebar - Hidden on mobile, visible on desktop */}
        <div className="hidden lg:block">
          <Sidebar collapsed={sidebarCollapsed} onToggle={setSidebarCollapsed} />
        </div>
        
        {/* Main content - Full width on mobile, with left margin on desktop */}
        <main className={`flex-1 overflow-y-auto transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        }`}>
          <div className="w-full max-w-none">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}