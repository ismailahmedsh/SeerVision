import { useState } from "react"
import { Camera, Home, Settings, BarChart3, History, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./ui/button"
import { useNavigate, useLocation } from "react-router-dom"

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Cameras', href: '/cameras', icon: Camera },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'History', href: '/history', icon: History },
  { name: 'Settings', href: '/settings', icon: Settings },
]

interface SidebarProps {
  collapsed?: boolean
  onToggle?: (collapsed: boolean) => void
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleToggle = () => {
    onToggle?.(!collapsed)
  }

  return (
    <div className={cn(
      "fixed inset-y-0 left-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-r border-slate-200 dark:border-slate-700 pt-16 transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-end p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggle}
            className="h-8 w-8 p-0"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex-1 flex flex-col pt-2 pb-4 overflow-y-auto">
          <nav className="mt-2 flex-1 px-2 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href
              return (
                <Button
                  key={item.name}
                  variant={isActive ? "default" : "ghost"}
                  onClick={() => navigate(item.href)}
                  className={cn(
                    "w-full justify-start",
                    collapsed ? "px-2" : "px-3",
                    isActive
                      ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  <Icon className={cn("h-5 w-5", collapsed ? "" : "mr-3")} />
                  {!collapsed && item.name}
                </Button>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
  )
}