import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Clock, CheckCircle, AlertCircle } from "lucide-react"

interface AnalysisResult {
  timestamp: string
  answer: string
  confidence: number
}

interface AnalysisResultsProps {
  results: AnalysisResult[]
  isAnalyzing: boolean
  isProcessingFrame: boolean
  jsonOutput: boolean
  lastAnalysisTime: number
}

// Syntax highlighting for JSON
const syntaxHighlightJson = (json: string): string => {
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'text-gray-600 dark:text-gray-400';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'text-blue-600 dark:text-blue-400'; // property names
        } else {
          cls = 'text-green-600 dark:text-green-400'; // string values
        }
      } else if (/true|false/.test(match)) {
        cls = 'text-purple-600 dark:text-purple-400'; // booleans
      } else if (/null/.test(match)) {
        cls = 'text-red-600 dark:text-red-400'; // null
      } else if (/\d/.test(match)) {
        cls = 'text-orange-600 dark:text-orange-400'; // numbers
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
};

const extractJsonFromResponse = (response: string): string | null => {
  try {
    // Find the first opening brace and last closing brace
    const firstBrace = response.indexOf('{');
    const lastBrace = response.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      return null;
    }

    // Extract the JSON portion including the braces
    const jsonPortion = response.substring(firstBrace, lastBrace + 1);

    // Validate that it's actually valid JSON
    JSON.parse(jsonPortion);

    return jsonPortion;
  } catch (error) {
    return null;
  }
}

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

export function AnalysisResults({ 
  results, 
  isAnalyzing, 
  isProcessingFrame, 
  jsonOutput, 
  lastAnalysisTime 
}: AnalysisResultsProps) {
  console.log('[ANALYSIS_RESULTS] Component render:', {
    resultsCount: results.length,
    isAnalyzing,
    isProcessingFrame,
    jsonOutput,
    lastAnalysisTime
  })

  const renderResult = (result: AnalysisResult, index: number) => {
    const isLatest = index === 0

    if (jsonOutput) {
      const jsonContent = extractJsonFromResponse(result.answer)

      if (jsonContent) {
        try {
          const formatted = JSON.stringify(JSON.parse(jsonContent), null, 2)
          return (
            <div
              key={result.timestamp}
              className={`p-4 rounded-lg border ${
                isLatest
                  ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
                  : 'bg-muted/50 border-muted'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant={isLatest ? 'default' : 'secondary'}>
                    {isLatest ? 'Latest' : 'Previous'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatTimestamp(result.timestamp)}
                  </span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {Math.round(result.confidence * 100)}% confidence
                </Badge>
              </div>
              <pre
                className="text-sm bg-background/50 p-3 rounded border overflow-x-auto"
                dangerouslySetInnerHTML={{
                  __html: syntaxHighlightJson(formatted)
                }}
              />
            </div>
          )
        } catch (error) {
          console.error('[ANALYSIS_RESULTS] JSON parsing error:', error)
          // Fallback to plain text if JSON parsing fails
        }
      }
    }

    // Regular text rendering
    return (
      <div
        key={result.timestamp}
        className={`p-4 rounded-lg border ${
          isLatest
            ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
            : 'bg-muted/50 border-muted'
        }`}
      >
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <Badge variant={isLatest ? 'default' : 'secondary'}>
              {isLatest ? 'Latest' : 'Previous'}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {formatTimestamp(result.timestamp)}
            </span>
          </div>
          <Badge variant="outline" className="text-xs">
            {Math.round(result.confidence * 100)}% confidence
          </Badge>
        </div>
        <p className="text-sm leading-relaxed">{result.answer}</p>
      </div>
    )
  }

  return (
    <Card className="flex-1 min-h-0">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          Live Results
          {isAnalyzing && (
            <div className="flex items-center gap-2 ml-auto">
              {isProcessingFrame ? (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </div>
              ) : (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  Waiting for next frame
                </div>
              )}
              {lastAnalysisTime > 0 && (
                <Badge variant="outline" className="text-xs">
                  {(lastAnalysisTime / 1000).toFixed(1)}s
                </Badge>
              )}
            </div>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full p-6">
          {!isAnalyzing && results.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Start analysis to see live results
              </p>
            </div>
          )}

          {isAnalyzing && results.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Analysis in progress...
              </p>
            </div>
          )}

          <div className="space-y-4">
            {results.map((result, index) => renderResult(result, index))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}