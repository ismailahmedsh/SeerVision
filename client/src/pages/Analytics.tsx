import { useState, useEffect } from "react"
import { BarChart3, TrendingUp, Eye, Clock, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getAnalyticsData } from "@/api/analytics"

interface AnalyticsData {
  totalDetections: number
  averageConfidence: number
  mostActiveCamera: string
  topQueries: Array<{ query: string; count: number }>
  dailyStats: Array<{ date: string; detections: number }>
  cameraStats: Array<{ cameraId: string; name: string; detections: number }>
}

export function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState("7d")

  useEffect(() => {
    loadAnalytics()
  }, [timeRange])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      const response = await getAnalyticsData({ timeRange })
      setData(response.data)
    } catch (error) {
      console.error("Error loading analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-4 lg:p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            Analytics Dashboard
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Insights and performance metrics from your AI analysis
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-600" />
              Total Detections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalDetections || 0}</div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              +12% from last period
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-green-600" />
              Avg Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round((data?.averageConfidence || 0) * 100)}%</div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              +3% from last period
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-600" />
              Active Cameras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.cameraStats?.length || 0}</div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Most active: {data?.mostActiveCamera || 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-600" />
              Daily Average
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round((data?.totalDetections || 0) / 7)}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Detections per day
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Queries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Top Queries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.topQueries?.map((query, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <span className="text-sm font-medium">{query.query}</span>
                <Badge variant="outline">{query.count} uses</Badge>
              </div>
            )) || (
              <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                No query data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Camera Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.cameraStats?.map((camera, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <span className="text-sm font-medium">{camera.name}</span>
                <Badge variant="outline">{camera.detections} detections</Badge>
              </div>
            )) || (
              <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                No camera data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}