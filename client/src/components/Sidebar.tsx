import { useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { 
  Home, 
  Camera, 
  BarChart3, 
  History, 
  Settings,
  ChevronLeft
} from "lucide-react"
import { Button } from "./ui/button"
import { cn } from "@/lib/utils"

interface SidebarProps {
  onClose?: () => void
  onToggle?: (isOpen: boolean) => void
  isOpen?: boolean
}

export function Sidebar({ onClose, onToggle, isOpen = true }: SidebarProps) {
  const location = useLocation()

  const handleClose = () => {
    console.log('[SIDEBAR] Close button clicked')
    if (onClose) {
      onClose()
    } else {
      console.warn('[SIDEBAR] No onClose callback provided')
    }
  }

  const handleToggleCollapse = () => {
    console.log('[SIDEBAR] Toggle collapse - current isOpen:', isOpen, 'toggling to:', !isOpen)
    const newIsOpen = !isOpen
    
    // Always notify parent of the new state
    if (onToggle) {
      onToggle(newIsOpen)
      console.log('[SIDEBAR] Notified parent of new state:', newIsOpen)
    } else {
      console.warn('[SIDEBAR] No onToggle callback provided')
    }
  }

  // Log state changes for debugging
  useEffect(() => {
    console.log('[SIDEBAR] State changed - isOpen:', isOpen)
  }, [isOpen])

  const navigation = [
    {
      name: "Dashboard",
      href: "/",
      icon: Home,
      current: location.pathname === "/"
    },
    {
      name: "Cameras",
      href: "/cameras",
      icon: Camera,
      current: location.pathname === "/cameras"
    },
    {
      name: "Analytics",
      href: "/analytics",
      icon: BarChart3,
      current: location.pathname === "/analytics"
    },
    {
      name: "History",
      href: "/history",
      icon: History,
      current: location.pathname === "/history"
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
      current: location.pathname === "/settings"
    }
  ]

  return (
    <div className={cn(
      "fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-r border-slate-200 dark:border-slate-700 transition-all duration-300 z-40",
      isOpen ? "w-64" : "w-16"
    )}>
      <div className="flex flex-col h-full">
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          {isOpen && (
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Navigation
            </h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleCollapse}
            className="p-1.5 h-auto"
            title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <ChevronLeft className={cn(
              "h-4 w-4 transition-transform",
              !isOpen && "rotate-180"
            )} />
          </Button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  item.current
                    ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
                  !isOpen && "justify-center px-2"
                )}
                title={!isOpen ? item.name : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {isOpen && (
                  <span className="truncate">{item.name}</span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}