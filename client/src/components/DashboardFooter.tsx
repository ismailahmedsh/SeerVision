import { Github, Twitter, Linkedin } from "lucide-react"

export function DashboardFooter() {
  return (
    <footer className="lg:relative lg:bottom-auto fixed bottom-0 left-0 right-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t">
      <div className="flex h-10 lg:h-12 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center space-x-4">
          <p className="text-xs lg:text-sm text-muted-foreground">
            © 2024 VisLangStream. Built with AI-powered video analysis.
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github className="h-3 w-3 lg:h-4 lg:w-4" />
            <span className="sr-only">GitHub</span>
          </a>
          <a
            href="https://linkedin.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Linkedin className="h-3 w-3 lg:h-4 lg:w-4" />
            <span className="sr-only">LinkedIn</span>
          </a>
        </div>
      </div>
    </footer>
  )
}