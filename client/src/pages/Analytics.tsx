import { useState, useEffect } from "react"
import { BarChart3, TrendingUp, Eye, Clock, Calendar, AlertCircle, ChevronDown, LineChart } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getAnalyticsData, getDetectionsTimeseries, getConfidenceTimeseries } from "@/api/analytics"
import { useToast } from "@/hooks/useToast"
import { Area, AreaChart, Line, LineChart as RechartsLineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts"

interface AnalyticsData {
  totalDetections: number
  averageConfidence: number
  mostActiveCamera: string
  topQueries: Array<{ query: string; count: number; confidence: number }>
  dailyStats: Array<{ date: string; detections: number }>
  cameraStats: Array<{ cameraId: string; name: string; detections: number; confidence: number }>
}

interface TimeseriesPoint {
  t: string
  detections?: number
  avgConfidence?: number
}

interface TimeseriesData {
  points: TimeseriesPoint[]
}

export function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [detectionsTimeseries, setDetectionsTimeseries] = useState<TimeseriesData | null>(null)
  const [confidenceTimeseries, setConfidenceTimeseries] = useState<TimeseriesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState("7d")
  const [querySortBy, setQuerySortBy] = useState("topCount")
  const [querySearchTerm, setQuerySearchTerm] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    loadAnalytics()
  }, [timeRange])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)
      

      const [analyticsResponse, detectionsResponse, confidenceResponse] = await Promise.all([
        getAnalyticsData({ timeRange }),
        getDetectionsTimeseries({ timeRange }),
        getConfidenceTimeseries({ timeRange })
      ])
      
      setData(analyticsResponse.data)
      setDetectionsTimeseries(detectionsResponse.data)
      setConfidenceTimeseries(confidenceResponse.data)
    } catch (error: any) {
      const errorMessage = error.message || "Failed to load analytics data"
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getSortedQueries = () => {
    if (!data?.topQueries) return []
    
    let queries = [...data.topQueries]
    

    if (querySearchTerm.trim()) {
      queries = queries.filter(query => 
        query.query.toLowerCase().includes(querySearchTerm.toLowerCase())
      )
    }
    

    switch (querySortBy) {
      case "recent":
        return queries.sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
      case "topCount":
        return queries.sort((a, b) => b.count - a.count)
      case "topDetections":
        return queries.sort((a, b) => b.count - a.count)
      default:
        return queries
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

  if (error) {
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
        
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            Failed to Load Analytics
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            {error}
          </p>
          <button
            onClick={loadAnalytics}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
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
            <SelectItem value="1h">Last 1h</SelectItem>
            <SelectItem value="6h">Last 6h</SelectItem>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>


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
              AI analysis results
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
              Model accuracy
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-600" />
              Top Camera
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.cameraStats && data.cameraStats.length > 0 ? data.cameraStats[0].name : 'N/A'}</div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {data?.cameraStats && data.cameraStats.length > 0 ? `${data.cameraStats[0].detections} detections` : 'No data'}
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
              {data?.cameraStats && data.cameraStats.length > 0 ? Math.round((data.totalDetections || 0) / 7) : 0}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Detections per day
            </p>
          </CardContent>
        </Card>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">Prompts</CardTitle>
            <Select value={querySortBy} onValueChange={setQuerySortBy}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="topCount">Top Count</SelectItem>
                <SelectItem value="topDetections">Top Detections</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <div className="px-6 pb-4">
            <Input
              placeholder="Search prompts..."
              value={querySearchTerm}
              onChange={(e) => setQuerySearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <CardContent>
            <div className="max-h-64 overflow-y-auto space-y-3 pr-2">
              {getSortedQueries().length > 0 ? (
                getSortedQueries().map((query, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium block truncate">{query.query}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700">
                        {query.confidence ? Math.round(query.confidence * 100) : 'N/A'}%
                      </Badge>
                      <Badge variant="outline">{query.count} uses</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                  {querySearchTerm.trim() ? 'No prompts match your search' : 'No prompt data available for this time range'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Camera Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto space-y-3 pr-2">
              {data?.cameraStats && data.cameraStats.length > 0 ? (
                data.cameraStats.map((camera, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium block truncate">{camera.name}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-700">
                        {camera.confidence ? Math.round(camera.confidence * 100) : 'N/A'}%
                      </Badge>
                      <Badge variant="outline">{camera.detections} detections</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                  No camera data available for this time range
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <LineChart className="h-5 w-5 text-blue-600" />
              Detections over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-pulse text-slate-500">Loading...</div>
              </div>
            ) : detectionsTimeseries?.points && detectionsTimeseries.points.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={detectionsTimeseries.points} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="detectionsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis
                      dataKey="t"
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        if (timeRange === '1h' || timeRange === '6h') {
                          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        } else if (timeRange === '24h') {
                          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        } else if (timeRange === '7d') {
                          return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
                        } else {
                          return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                        }
                      }}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip
                      content={({ active, payload, label }: any) => {
                        if (active && payload && payload.length) {
                          const date = new Date(label);
                          return (
                            <div className="rounded-lg border bg-background p-3 shadow-lg">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col">
                                  <span className="text-xs uppercase text-muted-foreground font-medium">
                                    Time
                                  </span>
                                  <span className="text-sm font-semibold text-foreground">
                                    {date.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs uppercase text-muted-foreground font-medium">
                                    Detections
                                  </span>
                                  <span className="text-sm font-bold text-foreground">
                                    {payload[0].value}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="detections"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2.5}
                      fill="url(#detectionsGradient)"
                      dot={{ fill: 'hsl(var(--chart-1))', strokeWidth: 2, r: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400">
                No detection data available for this time range
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <LineChart className="h-5 w-5 text-green-600" />
              Confidence over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-pulse text-slate-500">Loading...</div>
              </div>
            ) : confidenceTimeseries?.points && confidenceTimeseries.points.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={confidenceTimeseries.points} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis
                      dataKey="t"
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        if (timeRange === '1h' || timeRange === '6h') {
                          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        } else if (timeRange === '24h') {
                          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        } else if (timeRange === '7d') {
                          return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
                        } else {
                          return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                        }
                      }}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                      tickFormatter={(value) => `${Math.round((value || 0) * 100)}%`}
                    />
                    <Tooltip
                      content={({ active, payload, label }: any) => {
                        if (active && payload && payload.length) {
                          const date = new Date(label);
                          return (
                            <div className="rounded-lg border bg-background p-3 shadow-lg">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col">
                                  <span className="text-xs uppercase text-muted-foreground font-medium">
                                    Time
                                  </span>
                                  <span className="text-sm font-semibold text-foreground">
                                    {date.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs uppercase text-muted-foreground font-medium">
                                    Confidence
                                  </span>
                                  <span className="text-sm font-bold text-foreground">
                                    {Math.round((payload[0].value || 0) * 100)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgConfidence"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2.5}
                      dot={{ fill: "hsl(var(--chart-2))", strokeWidth: 2, r: 4 }}
                      connectNulls={false}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400">
                No confidence data available for this time range
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}