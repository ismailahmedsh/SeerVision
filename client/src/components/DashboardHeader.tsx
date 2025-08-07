import { Bell, Menu, User, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { NotificationsDropdown } from "./NotificationsDropdown"
import { useAuth } from "@/contexts/AuthContext"

interface DashboardHeaderProps {
  onMenuClick?: () => void
  showMenuButton?: boolean
  sidebarOpen?: boolean
}

export function DashboardHeader({ onMenuClick, showMenuButton = false, sidebarOpen = false }: DashboardHeaderProps) {
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-12 lg:h-10 items-center justify-between px-3 lg:px-6 max-w-full">
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Menu button */}
          {showMenuButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="h-8 w-8 lg:h-7 lg:w-7"
            >
              <Menu className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          )}

          <div className="flex items-center">
            <h1 className="text-base lg:text-sm font-semibold truncate">VisLangStream</h1>
          </div>
        </div>

        <div className="flex items-center space-x-2 lg:space-x-3">
          <ThemeToggle />
          <NotificationsDropdown />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-7 w-7 lg:h-6 lg:w-6 rounded-full">
                <Avatar className="h-7 w-7 lg:h-6 lg:w-6">
                  <AvatarImage src="/avatars/01.png" alt="@user" />
                  <AvatarFallback className="text-xs">
                    {user?.name ? user.name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}