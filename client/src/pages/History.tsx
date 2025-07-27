import { useState, useEffect } from "react"
import { History as HistoryIcon, Search, Filter, Download, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getAnalysisHistory } from "@/api/analysis"

interface HistoryItem {
  _id: string
  prompt: string
  result: string
  timestamp: string
  confidence?: number
  cameraName?: string
}

export function History() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCamera, setFilterCamera] = useState("all")
  const [dateRange, setDateRange] = useState("7d")

  useEffect(() => {
    loadHistory()
  }, [dateRange])

  const loadHistory = async () => {
    try {
      setLoading(true)
      const response = await getAnalysisHistory({ limit: 100 })
      // Add mock camera names for demo
      const historyWithCameras = response.history.map((item: any) => ({
        ...item,
        cameraName: ['Front Door Camera', 'Parking Lot Camera', 'Back Entrance'][Math.floor(Math.random() * 3)]
      }))
      setHistory(historyWithCameras)
    } catch (error) {
      console.error("Error loading history:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredHistory = history.filter(item => {
    const matchesSearch = item.prompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.result.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCamera = filterCamera === "all" || item.cameraName === filterCamera
    return matchesSearch && matchesCamera
  })

  const uniqueCameras = Array.from(new Set(history.map(item => item.cameraName).filter(Boolean)))

  const exportHistory = () => {
    const csvContent = [
      ['Timestamp', 'Camera', 'Prompt', 'Result', 'Confidence'],
      ...filteredHistory.map(item => [
        new Date(item.timestamp).toLocaleString(),
        item.cameraName || 'Unknown',
        item.prompt,
        item.result,
        item.confidence ? `${Math.round(item.confidence * 100)}%` : 'N/A'
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analysis-history-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            Analysis History
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            View and search through your past AI analysis results
          </p>
        </div>
        <Button
          onClick={exportHistory}
          variant="outline"
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search prompts and results..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterCamera} onValueChange={setFilterCamera}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by camera" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cameras</SelectItem>
                {uniqueCameras.map(camera => (
                  <SelectItem key={camera} value={camera!}>{camera}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <HistoryIcon className="h-5 w-5 text-blue-600" />
              Analysis Results
            </CardTitle>
            <Badge variant="outline">
              {filteredHistory.length} results
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                  </div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2"></div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12">
              <HistoryIcon className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                {searchTerm || filterCamera !== "all" ? 'No results found' : 'No analysis history yet'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                {searchTerm || filterCamera !== "all" 
                  ? 'Try adjusting your search or filter criteria' 
                  : 'Start analyzing video feeds to see results here'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-4 pr-4">
                {filteredHistory.map((item) => (
                  <div
                    key={item._id}
                    className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {item.cameraName}
                        </Badge>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {item.confidence && (
                        <Badge variant="outline" className="text-xs">
                          {Math.round(item.confidence * 100)}% confidence
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                          Prompt
                        </span>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          "{item.prompt}"
                        </p>
                      </div>
                      
                      <div>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                          Result
                        </span>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {item.result}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}