import { useState, useEffect } from "react"
import { Send, Brain, History, Pause, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { startAnalysisStream, stopAnalysisStream, queryAnalysisResults, getPromptSuggestions, sendFrameForAnalysis } from "@/api/analysis"
import { getCameras } from "@/api/cameras"
import { useToast } from "@/hooks/useToast"
import { useSettings } from "@/contexts/SettingsContext"

interface AnalysisResult {
  _id: string
  answer: string
  accuracyScore: number
  timestamp: string
  createdAt: string
}

interface AnalysisPanelProps {
  selectedCameraId?: string
  onCameraUpdated?: () => void // Add this prop to listen for camera updates
}

export function AnalysisPanel({ selectedCameraId, onCameraUpdated }: AnalysisPanelProps) {
  const [prompt, setPrompt] = useState("")
  const [currentPrompt, setCurrentPrompt] = useState("")
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [selectedCamera, setSelectedCamera] = useState<any>(null)
  const [cameraUpdateTrigger, setCameraUpdateTrigger] = useState(0) // Add trigger for camera updates
  const [suggestionRetryCount, setSuggestionRetryCount] = useState(0)
  const [showManualRetry, setShowManualRetry] = useState(false)
  const { toast } = useToast()
  const { settings } = useSettings()

  const updateInterval = settings?.analysis?.defaultInterval || 2;

  // Character limit constants
  const MAX_PROMPT_LENGTH = 280;
  const isPromptTooLong = prompt.length > MAX_PROMPT_LENGTH;
  const promptCharacterCount = prompt.length;

  // Function to filter out system errors from user-facing results
  const isSystemError = (answer: string): boolean => {
    const systemErrorPatterns = [
      /failed: Analysis timeout after \d+ms - frame dropped/i,
      /Analysis failed:/i,
      /Pipeline error:/i,
      /Internal error:/i,
      /System error:/i,
      /Connection error:/i,
      /Processing error:/i,
      /Frame dropped:/i,
      /Request timeout:/i,
      /Service unavailable:/i
    ];

    return systemErrorPatterns.some(pattern => pattern.test(answer));
  };

  // Filter results to exclude system errors
  const userFacingResults = results.filter(result => !isSystemError(result.answer));

  // Load camera details when selectedCameraId changes OR when camera is updated
  useEffect(() => {
    if (selectedCameraId) {
      console.log('[ANALYSIS_PANEL] ===== CAMERA DETAILS RELOAD TRIGGERED =====');
      console.log('[ANALYSIS_PANEL] Trigger: selectedCameraId changed or camera updated');
      console.log('[ANALYSIS_PANEL] Selected camera ID:', selectedCameraId);
      console.log('[ANALYSIS_PANEL] Camera update trigger:', cameraUpdateTrigger);
      loadCameraDetails()
    }
  }, [selectedCameraId, cameraUpdateTrigger]) // Add cameraUpdateTrigger as dependency

  // Listen for camera updates from parent components
  useEffect(() => {
    console.log('[ANALYSIS_PANEL] Setting up camera update listener');

    const handleCameraUpdate = (cameraId?: string, updatedSettings?: any) => {
      console.log('[ANALYSIS_PANEL] ===== CAMERA UPDATE RECEIVED =====');
      console.log('[ANALYSIS_PANEL] Camera update signal received');
      console.log('[ANALYSIS_PANEL] Updated camera ID:', cameraId);
      console.log('[ANALYSIS_PANEL] Updated settings:', updatedSettings);
      console.log('[ANALYSIS_PANEL] Current selected camera ID:', selectedCameraId);
      
      // Only refresh if this is our selected camera or if no specific camera ID provided
      if (!cameraId || cameraId === selectedCameraId) {
        console.log('[ANALYSIS_PANEL] Triggering camera details reload...');
        setCameraUpdateTrigger(prev => prev + 1); // Trigger camera reload
      } else {
        console.log('[ANALYSIS_PANEL] Update not for our camera, ignoring');
      }
    };

    // Store the handler for cleanup
    (window as any).notifyAllComponentsCameraUpdate = handleCameraUpdate;

    return () => {
      console.log('[ANALYSIS_PANEL] Cleaning up camera update listener');
      delete (window as any).notifyAllComponentsCameraUpdate;
    };
  }, [selectedCameraId]);

  const loadCameraDetails = async () => {
    try {
      console.log('[ANALYSIS_PANEL] ===== LOADING CAMERA DETAILS =====');
      console.log('[ANALYSIS_PANEL] Loading camera details for ID:', selectedCameraId);
      console.log('[ANALYSIS_PANEL] Current selected camera interval:', selectedCamera?.analysisInterval);

      const response = await getCameras()
      const camera = response.cameras?.find(c => c._id === selectedCameraId)

      console.log('[ANALYSIS_PANEL] ===== CAMERA DETAILS LOADED =====');
      console.log('[ANALYSIS_PANEL] Camera found:', !!camera);
      console.log('[ANALYSIS_PANEL] Camera details:', {
        id: camera?._id,
        name: camera?.name,
        type: camera?.type,
        analysisInterval: camera?.analysisInterval,
        streamUrl: camera?.streamUrl?.substring(0, 20) + '...'
      });

      // Check if interval changed
      if (selectedCamera && camera && selectedCamera.analysisInterval !== camera.analysisInterval) {
        console.log('[ANALYSIS_PANEL] ===== INTERVAL CHANGED DETECTED =====');
        console.log('[ANALYSIS_PANEL] Previous interval:', selectedCamera.analysisInterval);
        console.log('[ANALYSIS_PANEL] New interval:', camera.analysisInterval);
        console.log('[ANALYSIS_PANEL] Analysis active:', isAnalyzing);

        if (isAnalyzing) {
          console.log('[ANALYSIS_PANEL] Analysis is active - frame capture loop will restart with new interval');
        }
      }

      setSelectedCamera(camera || null)
      console.log('[ANALYSIS_PANEL] Selected camera updated in state');

      // Load suggestions after camera details are loaded
      if (camera) {
        console.log('[ANALYSIS_PANEL] Camera loaded, triggering suggestions');
        loadSuggestions(camera);
      }
    } catch (error) {
      console.error('[ANALYSIS_PANEL] Error loading camera details:', error)
    }
  }

  // Load suggestions when camera changes OR when stream becomes ready
  useEffect(() => {
    if (selectedCameraId && selectedCamera) {
      console.log('[ANALYSIS_PANEL] ===== SUGGESTION LOADING TRIGGER =====');
      console.log('[ANALYSIS_PANEL] Camera ID:', selectedCameraId);
      console.log('[ANALYSIS_PANEL] Camera object available:', !!selectedCamera);
      console.log('[ANALYSIS_PANEL] Loading suggestions with camera object');
      loadSuggestions(selectedCamera)
    }
  }, [selectedCamera]) // Trigger when selectedCamera object is available

  // Add new useEffect to listen for stream readiness
  useEffect(() => {
    console.log('[ANALYSIS_PANEL] ===== SETTING UP STREAM READY LISTENER =====');
    console.log('[ANALYSIS_PANEL] Selected camera ID:', selectedCameraId);

    const handleStreamReady = () => {
      console.log('[ANALYSIS_PANEL] ===== STREAM READY EVENT RECEIVED =====');
      console.log('[ANALYSIS_PANEL] Stream became ready, triggering suggestions');
      console.log('[ANALYSIS_PANEL] Current selected camera ID:', selectedCameraId);
      console.log('[ANALYSIS_PANEL] Current selected camera object:', selectedCamera);
      console.log('[ANALYSIS_PANEL] Current timestamp:', new Date().toISOString());

      if (selectedCameraId && selectedCamera) {
        console.log('[ANALYSIS_PANEL] Calling loadSuggestions from stream ready event');
        loadSuggestions(selectedCamera)
      } else {
        console.log('[ANALYSIS_PANEL] Missing camera ID or object, skipping suggestion load');
      }
    };

    // Listen for stream ready events from LiveVideoDisplay
    (window as any).onStreamReady = handleStreamReady;
    console.log('[ANALYSIS_PANEL] Stream ready listener registered on window');

    return () => {
      console.log('[ANALYSIS_PANEL] Cleaning up stream ready listener');
      delete (window as any).onStreamReady;
    };
  }, [selectedCameraId, selectedCamera]);

  const loadSuggestions = async (camera = selectedCamera) => {
    console.log('[ANALYSIS_PANEL] ===== LOAD SUGGESTIONS CALLED =====');
    console.log('[ANALYSIS_PANEL] Function entry timestamp:', new Date().toISOString());
    console.log('[ANALYSIS_PANEL] Selected camera ID:', selectedCameraId);
    console.log('[ANALYSIS_PANEL] Camera parameter:', camera);
    console.log('[ANALYSIS_PANEL] Suggestion retry count:', suggestionRetryCount);

    if (!selectedCameraId || !camera) {
      console.log('[ANALYSIS_PANEL] Missing camera ID or camera object, exiting loadSuggestions');
      return
    }

    // Prevent multiple simultaneous suggestion requests
    if (loadingSuggestions) {
      console.log('[ANALYSIS_PANEL] Suggestions already loading, skipping duplicate request');
      return
    }

    try {
      console.log('[ANALYSIS_PANEL] ===== STARTING STRICT SUGGESTION LOADING =====');
      console.log('[ANALYSIS_PANEL] Camera ID:', selectedCameraId);
      console.log('[ANALYSIS_PANEL] Camera type:', camera.type);
      console.log('[ANALYSIS_PANEL] STRICT VALIDATION: 2-5 words, minimum 3 suggestions, retry logic');

      setLoadingSuggestions(true)
      setSuggestions([]) // Clear existing suggestions
      setShowManualRetry(false) // Hide manual retry button
      console.log('[ANALYSIS_PANEL] Set loadingSuggestions to true and cleared suggestions');

      let frameBase64: string | undefined

      // USB Camera Frame Capture Logic - SAME AS ANALYSIS
      if (camera && camera.streamUrl && camera.streamUrl.startsWith('usb:')) {
        console.log('[ANALYSIS_PANEL] ===== USB CAMERA FRAME CAPTURE START =====');
        console.log('[ANALYSIS_PANEL] USB camera detected, using client-side capture (same as analysis)');

        let attempts = 0
        const maxAttempts = 10

        while (attempts < maxAttempts) {
          console.log('[ANALYSIS_PANEL] Frame capture attempt:', attempts + 1, 'of', maxAttempts);

          const captureFunction = (window as any).captureCurrentFrame
          console.log('[ANALYSIS_PANEL] Capture function available:', !!captureFunction);

          if (captureFunction) {
            try {
              console.log('[ANALYSIS_PANEL] Calling captureCurrentFrame (same as analysis)...');
              frameBase64 = captureFunction()
              console.log('[ANALYSIS_PANEL] Frame capture result:', {
                hasFrame: !!frameBase64,
                frameSize: frameBase64?.length || 0,
                isValidSize: frameBase64 && frameBase64.length > 1000
              });

              if (frameBase64 && frameBase64.length > 1000) {
                console.log('[ANALYSIS_PANEL] USB frame captured successfully, size:', frameBase64.length);
                break
              } else {
                console.log('[ANALYSIS_PANEL] Frame too small or empty, retrying...');
              }
            } catch (error) {
              console.log('[ANALYSIS_PANEL] USB frame capture attempt failed:', error.message);
            }
          } else {
            console.log('[ANALYSIS_PANEL] Capture function not available, waiting...');
          }

          await new Promise(resolve => setTimeout(resolve, 500))
          attempts++
        }

        if (!frameBase64 || frameBase64.length <= 1000) {
          console.log('[ANALYSIS_PANEL] ===== USB FRAME CAPTURE FAILED =====');
          console.log('[ANALYSIS_PANEL] Could not capture frame from USB camera');
          setSuggestions([])
          setShowManualRetry(true)
          throw new Error('Unable to capture frame from USB camera. Please ensure the camera is active.')
        }

        console.log('[ANALYSIS_PANEL] ===== USB FRAME CAPTURE SUCCESS =====');
        console.log('[ANALYSIS_PANEL] Final frame size:', frameBase64.length);

      } else {
        console.log('[ANALYSIS_PANEL] ===== NON-USB CAMERA STREAM CHECK =====');
        console.log('[ANALYSIS_PANEL] Non-USB camera, checking for stream readiness');

        // For non-USB cameras, check if stream is ready
        const streamReady = (window as any).isStreamReady;
        console.log('[ANALYSIS_PANEL] Stream ready flag:', streamReady);

        if (!streamReady) {
          console.log('[ANALYSIS_PANEL] ===== STREAM NOT READY =====');
          console.log('[ANALYSIS_PANEL] Stream not ready, cannot generate suggestions');
          setSuggestions([])
          setShowManualRetry(true)
          throw new Error('Camera stream is not ready. Please wait for the stream to load.')
        }

        console.log('[ANALYSIS_PANEL] ===== STREAM IS READY =====');
        console.log('[ANALYSIS_PANEL] Stream is ready, proceeding with API call');
      }

      console.log('[ANALYSIS_PANEL] ===== CALLING STRICT SUGGESTION API =====');
      console.log('[ANALYSIS_PANEL] About to call getPromptSuggestions with strict validation');
      console.log('[ANALYSIS_PANEL] API call parameters:', {
        cameraId: selectedCameraId,
        hasFrameData: !!frameBase64,
        frameSize: frameBase64?.length || 0,
        usingClientSideCapture: camera?.streamUrl?.startsWith('usb:'),
        cameraType: camera?.type
      });

      // Pass camera object to API function for proper USB detection
      const response = await getPromptSuggestions(selectedCameraId, frameBase64, camera)

      console.log('[ANALYSIS_PANEL] ===== STRICT SUGGESTION API RESPONSE =====');
      console.log('[ANALYSIS_PANEL] Raw API response:', response);
      console.log('[ANALYSIS_PANEL] Response data:', response.data);
      console.log('[ANALYSIS_PANEL] Response suggestions:', response.data?.suggestions || response.suggestions);

      const rawSuggestions = response.data?.suggestions || response.suggestions || []
      console.log('[ANALYSIS_PANEL] Extracted suggestions array:', rawSuggestions);
      console.log('[ANALYSIS_PANEL] Suggestions array length:', rawSuggestions.length);

      // Check if this is an error response
      if (!response.data?.success) {
        console.log('[ANALYSIS_PANEL] ===== API ERROR RESPONSE =====');
        console.log('[ANALYSIS_PANEL] API returned error:', response.data?.error);
        setSuggestions([])
        setShowManualRetry(true)
        throw new Error(`API error: ${response.data?.error || 'Unknown error'}`)
      }

      // Check source to ensure it's from model
      if (response.data?.source !== 'llava-model') {
        console.log('[ANALYSIS_PANEL] ===== NON-MODEL RESPONSE REJECTED =====');
        console.log('[ANALYSIS_PANEL] Response source:', response.data?.source);
        setSuggestions([])
        setShowManualRetry(true)
        throw new Error(`Expected model-generated suggestions, got source: ${response.data?.source}`)
      }

      // STRICT VALIDATION: Check minimum count
      if (rawSuggestions.length < 3) {
        console.log('[ANALYSIS_PANEL] ===== INSUFFICIENT SUGGESTIONS =====');
        console.log('[ANALYSIS_PANEL] Only', rawSuggestions.length, 'suggestions received (minimum 3 required)');
        setSuggestions([])
        setShowManualRetry(true)
        throw new Error(`Insufficient suggestions: only ${rawSuggestions.length} valid suggestions received (minimum 3 required)`)
      }

      // Additional client-side validation
      const validatedSuggestions = rawSuggestions.filter((suggestion, index) => {
        const words = suggestion.trim().split(' ');
        const isValidLength = words.length >= 2 && words.length <= 5;
        const isActionable = ['count', 'detect', 'find', 'check', 'analyze', 'identify', 'examine', 'describe'].includes(words[0].toLowerCase());
        
        console.log('[ANALYSIS_PANEL] Validating suggestion', index + ':', {
          text: suggestion,
          wordCount: words.length,
          isValidLength,
          isActionable,
          valid: isValidLength && isActionable
        });

        return isValidLength && isActionable;
      });

      if (validatedSuggestions.length < 3) {
        console.log('[ANALYSIS_PANEL] ===== CLIENT VALIDATION FAILED =====');
        console.log('[ANALYSIS_PANEL] Only', validatedSuggestions.length, 'suggestions passed client validation');
        setSuggestions([])
        setShowManualRetry(true)
        throw new Error(`Client validation failed: only ${validatedSuggestions.length} suggestions passed validation`)
      }

      console.log('[ANALYSIS_PANEL] ===== STRICT SUGGESTION SUCCESS =====');
      console.log('[ANALYSIS_PANEL] Final validated suggestions:', validatedSuggestions);
      console.log('[ANALYSIS_PANEL] Final count:', validatedSuggestions.length);
      console.log('[ANALYSIS_PANEL] Source confirmed as:', response.data?.source);

      setSuggestions(validatedSuggestions)
      setSuggestionRetryCount(0) // Reset retry count on success
      console.log('[ANALYSIS_PANEL] Strict suggestions set successfully');

    } catch (error) {
      console.error('[ANALYSIS_PANEL] ===== STRICT SUGGESTION LOADING ERROR =====');
      console.error('[ANALYSIS_PANEL] Error loading suggestions:', error);
      console.error('[ANALYSIS_PANEL] Error type:', error.constructor.name);
      console.error('[ANALYSIS_PANEL] Error message:', error.message);

      // Set empty suggestions array and show manual retry
      setSuggestions([])
      setShowManualRetry(true)
      console.log('[ANALYSIS_PANEL] Set empty suggestions and enabled manual retry');

    } finally {
      setLoadingSuggestions(false)
      console.log('[ANALYSIS_PANEL] Set loadingSuggestions to false');
      console.log('[ANALYSIS_PANEL] ===== STRICT SUGGESTION LOADING COMPLETE =====');
    }
  }

  const handleManualRetry = () => {
    console.log('[ANALYSIS_PANEL] Manual retry triggered by user');
    setSuggestionRetryCount(prev => prev + 1);
    setShowManualRetry(false);
    if (selectedCamera) {
      loadSuggestions(selectedCamera);
    }
  }

  // USB camera frame capture loop - CRITICAL: This must restart when selectedCamera changes
  useEffect(() => {
    let frameInterval: NodeJS.Timeout
    let isRequestInProgress = false
    let requestTimeoutId: NodeJS.Timeout | null = null

    // Cleanup function to ensure proper interval cleanup
    const cleanupInterval = () => {
      if (frameInterval) {
        console.log('[ANALYSIS_PANEL] Cleaning up existing frame capture interval');
        clearInterval(frameInterval);
        frameInterval = null;
      }
      if (requestTimeoutId) {
        clearTimeout(requestTimeoutId);
        requestTimeoutId = null;
      }
      isRequestInProgress = false;
    };

    if (selectedCamera &&
        selectedCamera.streamUrl &&
        selectedCamera.streamUrl.startsWith('usb:') &&
        isAnalyzing &&
        !isPaused &&
        currentStreamId &&
        currentPrompt) {

      const effectiveInterval = Math.max(6, selectedCamera.analysisInterval || 30);
      const captureIntervalMs = effectiveInterval * 1000

      console.log('[ANALYSIS_PANEL] ===== USB FRAME CAPTURE LOOP SETUP =====');
      console.log('[ANALYSIS_PANEL] Selected camera analysis interval:', selectedCamera.analysisInterval);
      console.log('[ANALYSIS_PANEL] Effective interval (seconds):', effectiveInterval);
      console.log('[ANALYSIS_PANEL] Capture interval (ms):', captureIntervalMs);
      console.log('[ANALYSIS_PANEL] Current timestamp:', new Date().toISOString());
      console.log('[ANALYSIS_PANEL] Camera settings object:', {
        id: selectedCamera._id,
        name: selectedCamera.name,
        analysisInterval: selectedCamera.analysisInterval,
        streamUrl: selectedCamera.streamUrl
      });

      // Ensure any existing interval is cleaned up first
      cleanupInterval();

      const performFrameAnalysisCycle = async () => {
        if (isRequestInProgress) {
          console.log('[ANALYSIS_PANEL] ===== ANALYSIS CYCLE SKIPPED =====');
          console.log('[ANALYSIS_PANEL] Previous analysis cycle still in progress, skipping this interval tick');
          console.log('[ANALYSIS_PANEL] This prevents queue buildup and respects the configured interval');
          return;
        }

        try {
          console.log('[ANALYSIS_PANEL] ===== ANALYSIS CYCLE START =====');
          console.log('[ANALYSIS_PANEL] Analysis cycle started at:', new Date().toISOString());
          console.log('[ANALYSIS_PANEL] Expected interval:', effectiveInterval, 'seconds');
          console.log('[ANALYSIS_PANEL] Stream ID:', currentStreamId);

          const captureFunction = (window as any).captureCurrentFrame
          if (!captureFunction) {
            console.log('[ANALYSIS_PANEL] Capture function not available, skipping this cycle');
            return;
          }

          const frameBase64 = captureFunction()
          if (!frameBase64) {
            console.log('[ANALYSIS_PANEL] No frame captured, skipping this cycle');
            return;
          }

          isRequestInProgress = true
          console.log('[ANALYSIS_PANEL] Marked analysis cycle as in progress');

          requestTimeoutId = setTimeout(() => {
            console.log('[ANALYSIS_PANEL] Analysis cycle timeout reached, marking as not in progress');
            isRequestInProgress = false
            requestTimeoutId = null
          }, 60000) // 60 second timeout

          // STEP 1: Send frame for analysis
          const frameData = {
            streamId: currentStreamId,
            frameBase64: frameBase64,
            prompt: currentPrompt
          }

          console.log('[ANALYSIS_PANEL] ===== STEP 1: SENDING FRAME FOR ANALYSIS =====');
          console.log('[ANALYSIS_PANEL] Sending frame for analysis at:', new Date().toISOString());
          console.log('[ANALYSIS_PANEL] Frame size:', frameBase64.length);

          await sendFrameForAnalysis(frameData)

          console.log('[ANALYSIS_PANEL] ===== STEP 1 COMPLETED: FRAME ANALYSIS SENT =====');
          console.log('[ANALYSIS_PANEL] Frame analysis request completed at:', new Date().toISOString());

          // STEP 2: Wait a moment for processing, then query results
          console.log('[ANALYSIS_PANEL] ===== STEP 2: WAITING BEFORE QUERY =====');
          console.log('[ANALYSIS_PANEL] Waiting 2 seconds for frame processing before querying results');
          
          await new Promise(resolve => setTimeout(resolve, 2000))

          console.log('[ANALYSIS_PANEL] ===== STEP 2: QUERYING RESULTS =====');
          console.log('[ANALYSIS_PANEL] Querying results at:', new Date().toISOString());

          await pollResults()

          console.log('[ANALYSIS_PANEL] ===== ANALYSIS CYCLE COMPLETED =====');
          console.log('[ANALYSIS_PANEL] Full analysis cycle completed at:', new Date().toISOString());
          console.log('[ANALYSIS_PANEL] Next cycle will start in', effectiveInterval, 'seconds');

          if (requestTimeoutId) {
            clearTimeout(requestTimeoutId)
            requestTimeoutId = null
          }

        } catch (error) {
          if (requestTimeoutId) {
            clearTimeout(requestTimeoutId)
            requestTimeoutId = null
          }

          // Log system errors silently instead of showing toast
          console.error('[ANALYSIS_PANEL] Analysis cycle error (logged silently):', error.message)

          // Only show toast for non-system errors
          if (!error.message.includes('429') &&
              !error.message.includes('already in progress') &&
              !error.message.includes('timeout') &&
              !error.message.includes('frame dropped')) {
            toast({
              title: "Analysis Error",
              description: "Analysis cycle failed: " + error.message,
              variant: "destructive",
            })
          }
        } finally {
          isRequestInProgress = false
          if (requestTimeoutId) {
            clearTimeout(requestTimeoutId)
            requestTimeoutId = null
          }
          console.log('[ANALYSIS_PANEL] Analysis cycle marked as completed, ready for next interval tick');
        }
      }

      console.log('[ANALYSIS_PANEL] ===== STARTING SYNCHRONIZED ANALYSIS LOOP =====');
      console.log('[ANALYSIS_PANEL] Setting initial 2-second delay before first analysis cycle');

      // Initial analysis cycle after 2 seconds
      setTimeout(performFrameAnalysisCycle, 2000)

      console.log('[ANALYSIS_PANEL] ===== SETTING UP SYNCHRONIZED INTERVAL TIMER =====');
      console.log('[ANALYSIS_PANEL] Setting up interval with', captureIntervalMs, 'ms delay');
      console.log('[ANALYSIS_PANEL] This will run complete analysis cycles exactly every', effectiveInterval, 'seconds');

      frameInterval = setInterval(() => {
        console.log('[ANALYSIS_PANEL] ===== SYNCHRONIZED INTERVAL TICK =====');
        console.log('[ANALYSIS_PANEL] Interval tick at:', new Date().toISOString());
        console.log('[ANALYSIS_PANEL] Expected interval:', effectiveInterval, 'seconds');
        console.log('[ANALYSIS_PANEL] This tick will run a complete frame+query cycle');
        performFrameAnalysisCycle();
      }, captureIntervalMs)

      console.log('[ANALYSIS_PANEL] ===== SYNCHRONIZED ANALYSIS LOOP STARTED =====');
      console.log('[ANALYSIS_PANEL] Loop configured for', effectiveInterval, 'second intervals');
      console.log('[ANALYSIS_PANEL] Both frame and query APIs will run at this exact frequency');
    } else {
      console.log('[ANALYSIS_PANEL] ===== ANALYSIS LOOP CONDITIONS NOT MET =====');
      console.log('[ANALYSIS_PANEL] Not starting analysis loop due to missing conditions:');
      console.log('[ANALYSIS_PANEL] - selectedCamera:', !!selectedCamera);
      console.log('[ANALYSIS_PANEL] - USB camera:', selectedCamera?.streamUrl?.startsWith('usb:'));
      console.log('[ANALYSIS_PANEL] - isAnalyzing:', isAnalyzing);
      console.log('[ANALYSIS_PANEL] - isPaused:', !isPaused);
      console.log('[ANALYSIS_PANEL] - currentStreamId:', !!currentStreamId);
      console.log('[ANALYSIS_PANEL] - currentPrompt:', !!currentPrompt);

      // Clean up any existing interval
      cleanupInterval();
    }

    return () => {
      console.log('[ANALYSIS_PANEL] ===== CLEANING UP SYNCHRONIZED ANALYSIS LOOP =====');
      console.log('[ANALYSIS_PANEL] useEffect cleanup triggered');
      console.log('[ANALYSIS_PANEL] This prevents overlapping intervals when dependencies change');
      cleanupInterval();
    }
  }, [selectedCamera?.analysisInterval, selectedCamera?._id, isAnalyzing, isPaused, currentStreamId, currentPrompt])

  const pollResults = async () => {
    if (!currentStreamId) return

    try {
      const queryData = {
        streamId: currentStreamId,
        query: currentPrompt,
        limit: 20 // Get more results to account for filtering
      }

      const response = await queryAnalysisResults(queryData)
      const matchedElements = response.data?.matchedElements || response.matchedElements || []

      if (matchedElements.length > 0) {
        const sortedElements = matchedElements.sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )

        const formattedResults = sortedElements.map(element => ({
          _id: `${currentStreamId}-${element.timestamp}`,
          answer: element.answer,
          accuracyScore: element.confidenceScore || 0.75,
          timestamp: element.timestamp,
          createdAt: element.createdAt || element.timestamp
        }))

        setResults(formattedResults)
      }
    } catch (error) {
      console.error('[ANALYSIS_PANEL] Error polling results (logged silently):', error)
    }
  }

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    // Allow typing but enforce limit
    if (newValue.length <= MAX_PROMPT_LENGTH) {
      setPrompt(newValue);
    }
    // If user tries to paste or type beyond limit, truncate
    else {
      setPrompt(newValue.substring(0, MAX_PROMPT_LENGTH));
    }
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) return

    // Frontend validation - check character limit
    if (prompt.length > MAX_PROMPT_LENGTH) {
      toast({
        title: "Error",
        description: `Prompt is too long. Maximum ${MAX_PROMPT_LENGTH} characters allowed.`,
        variant: "destructive",
      })
      return
    }

    if (!selectedCameraId) {
      toast({
        title: "Error",
        description: "Please select a camera first",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      setIsAnalyzing(true)
      setCurrentPrompt(prompt)
      setResults([])

      // CRITICAL: Set global analysis state for camera settings to check
      console.log('[ANALYSIS_PANEL] ===== SETTING GLOBAL ANALYSIS STATE =====');
      console.log('[ANALYSIS_PANEL] Setting global analysis tracking for camera:', selectedCameraId);
      console.log('[ANALYSIS_PANEL] Camera ID type:', typeof selectedCameraId);
      console.log('[ANALYSIS_PANEL] About to set window.isAnalysisActive = true');
      (window as any).isAnalysisActive = true;
      console.log('[ANALYSIS_PANEL] About to set window.activeCameraId =', selectedCameraId);
      (window as any).activeCameraId = selectedCameraId;
      console.log('[ANALYSIS_PANEL] Global state set (before stream ID)');
      console.log('[ANALYSIS_PANEL] Verification - window.isAnalysisActive:', (window as any).isAnalysisActive);
      console.log('[ANALYSIS_PANEL] Verification - window.activeCameraId:', (window as any).activeCameraId);

      const requestData = {
        cameraId: selectedCameraId,
        prompt: prompt.trim(),
        analysisInterval: updateInterval
      }

      if (selectedCamera && selectedCamera.streamUrl && selectedCamera.streamUrl.startsWith('usb:')) {
        const captureFunction = (window as any).captureCurrentFrame
        if (captureFunction) {
          try {
            const frameBase64 = captureFunction()
            if (frameBase64) {
              requestData.frameBase64 = frameBase64
            }
          } catch (error) {
            console.error('[ANALYSIS_PANEL] Error capturing frame for initial analysis:', error)
          }
        }
      }

      console.log('[ANALYSIS_PANEL] Making startAnalysisStream API call...');
      const response = await startAnalysisStream(requestData)
      const streamId = response.data?.streamId || response.streamId
      setCurrentStreamId(streamId)

      // CRITICAL: Store stream ID globally for camera settings to access
      console.log('[ANALYSIS_PANEL] ===== STORING STREAM ID GLOBALLY =====');
      console.log('[ANALYSIS_PANEL] Stream ID for global access:', streamId);
      console.log('[ANALYSIS_PANEL] Stream ID type:', typeof streamId);
      console.log('[ANALYSIS_PANEL] About to set window.activeStreamId =', streamId);
      (window as any).activeStreamId = streamId;
      console.log('[ANALYSIS_PANEL] Stream ID set globally');
      
      // Final verification of all global state
      console.log('[ANALYSIS_PANEL] ===== FINAL GLOBAL STATE VERIFICATION =====');
      console.log('[ANALYSIS_PANEL] window.isAnalysisActive:', (window as any).isAnalysisActive);
      console.log('[ANALYSIS_PANEL] window.activeCameraId:', (window as any).activeCameraId);
      console.log('[ANALYSIS_PANEL] window.activeStreamId:', (window as any).activeStreamId);
      console.log('[ANALYSIS_PANEL] All global state should now be accessible to camera settings');

      const cameraName = response.data?.cameraName || response.cameraName || 'Unknown Camera'

      toast({
        title: "Analysis Started",
        description: `Real-time analysis is now active for ${cameraName}`,
      })

      setTimeout(() => {
        pollResults()
      }, 2000)

    } catch (error) {
      console.log('[ANALYSIS_PANEL] ===== ANALYSIS START FAILED =====');
      console.log('[ANALYSIS_PANEL] Clearing analysis state due to error');
      setIsAnalyzing(false)
      setCurrentPrompt("")
      setCurrentStreamId(null)

      // CRITICAL: Clear global analysis state on error
      console.log('[ANALYSIS_PANEL] ===== CLEARING GLOBAL ANALYSIS STATE ON ERROR =====');
      (window as any).isAnalysisActive = false;
      (window as any).activeStreamId = null;
      (window as any).activeCameraId = null;
      console.log('[ANALYSIS_PANEL] Global state cleared due to error');

      toast({
        title: "Error",
        description: error.message || "Failed to start analysis",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExampleClick = (examplePrompt: string) => {
    // Ensure example prompts also respect character limit
    if (examplePrompt.length <= MAX_PROMPT_LENGTH) {
      setPrompt(examplePrompt)
    } else {
      setPrompt(examplePrompt.substring(0, MAX_PROMPT_LENGTH))
    }
  }

  const stopAnalysis = async () => {
    if (!currentStreamId) return

    try {
      await stopAnalysisStream(currentStreamId)
      setIsAnalyzing(false)
      setCurrentStreamId(null)
      setIsPaused(false)

      // CRITICAL: Clear global analysis state
      console.log('[ANALYSIS_PANEL] ===== CLEARING GLOBAL ANALYSIS STATE ON STOP =====');
      (window as any).isAnalysisActive = false;
      (window as any).activeStreamId = null;
      (window as any).activeCameraId = null;

      toast({
        title: "Analysis Stopped",
        description: "Real-time analysis has been stopped",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to stop analysis",
        variant: "destructive",
      })
    }
  }

  const togglePause = () => {
    setIsPaused(!isPaused)
    toast({
      title: isPaused ? "Analysis Resumed" : "Analysis Paused",
      description: isPaused ? "Real-time updates resumed" : "Real-time updates paused",
    })
  }

  // Get the actual analysis interval from camera settings (with minimum 6 seconds)
  const getActualAnalysisInterval = () => {
    if (selectedCamera && selectedCamera.analysisInterval) {
      return Math.max(6, selectedCamera.analysisInterval);
    }
    return Math.max(6, updateInterval);
  };

  // Format interval text
  const getIntervalText = () => {
    const interval = getActualAnalysisInterval();
    return interval === 1 ? "1 second" : `${interval} seconds`;
  };

  // Add effect to register stop function globally for camera settings to call
  useEffect(() => {
    console.log('[ANALYSIS_PANEL] ===== REGISTERING STOP FUNCTION GLOBALLY =====');
    console.log('[ANALYSIS_PANEL] Registering stop function for camera:', selectedCameraId);
    console.log('[ANALYSIS_PANEL] Analysis active:', isAnalyzing);
    console.log('[ANALYSIS_PANEL] Current stream ID:', currentStreamId);

    // Register the stop function globally so camera settings can call it directly
    if (isAnalyzing && currentStreamId && selectedCameraId) {
      console.log('[ANALYSIS_PANEL] Registering active analysis stop function');
      (window as any).stopActiveAnalysis = async (cameraId: string) => {
        console.log('[ANALYSIS_PANEL] ===== STOP FUNCTION CALLED FROM CAMERA SETTINGS =====');
        console.log('[ANALYSIS_PANEL] Requested to stop analysis for camera:', cameraId);
        console.log('[ANALYSIS_PANEL] Current analyzing camera:', selectedCameraId);
        console.log('[ANALYSIS_PANEL] Current stream ID:', currentStreamId);
        console.log('[ANALYSIS_PANEL] Current analysis state:', isAnalyzing);

        // Only stop if this is the correct camera
        if (cameraId === selectedCameraId && isAnalyzing && currentStreamId) {
          console.log('[ANALYSIS_PANEL] Stopping analysis from camera settings request');
          try {
            await stopAnalysisStream(currentStreamId);
            
            // Update local state
            setIsAnalyzing(false);
            setCurrentStreamId(null);
            setIsPaused(false);
            setCurrentPrompt("");
            setResults([]);

            console.log('[ANALYSIS_PANEL] Analysis stopped successfully from camera settings');
            return { success: true, message: 'Analysis stopped successfully' };
          } catch (error) {
            console.error('[ANALYSIS_PANEL] Error stopping analysis from camera settings:', error);
            return { success: false, error: error.message };
          }
        } else {
          console.log('[ANALYSIS_PANEL] Stop request ignored - not active for this camera');
          return { success: false, error: 'No active analysis for this camera' };
        }
      };

      console.log('[ANALYSIS_PANEL] Stop function registered globally');
    } else {
      console.log('[ANALYSIS_PANEL] Clearing global stop function - no active analysis');
      delete (window as any).stopActiveAnalysis;
    }

    // Cleanup function
    return () => {
      if (!isAnalyzing) {
        console.log('[ANALYSIS_PANEL] Cleaning up global stop function');
        delete (window as any).stopActiveAnalysis;
      }
    };
  }, [isAnalyzing, currentStreamId, selectedCameraId]);

  return (
    <Card className="h-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            Chat Analysis
          </CardTitle>
          {isAnalyzing && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={togglePause}
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={stopAnalysis}
                className="text-red-600 hover:text-red-700"
              >
                Stop
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-4 min-h-0 overflow-hidden">
        {/* Prompt Input with Character Limit - REDUCED TO MAKE ROOM FOR RESULTS */}
        <div className="space-y-2 flex-shrink-0">
          <div className="relative">
            <Textarea
              placeholder="Ask me anything about what you see in the video... (e.g., 'Count red cars')"
              value={prompt}
              onChange={handlePromptChange}
              className={`min-h-[80px] max-h-[100px] resize-none text-base leading-relaxed pr-20 ${
                isPromptTooLong ? 'border-red-500 focus:border-red-500' : ''
              }`}
              disabled={loading || isAnalyzing}
              maxLength={MAX_PROMPT_LENGTH}
            />
            {/* Character Counter */}
            <div className={`absolute bottom-2 right-2 text-xs ${
              isPromptTooLong ? 'text-red-500' :
              promptCharacterCount > MAX_PROMPT_LENGTH * 0.8 ? 'text-yellow-600' :
              'text-slate-500'
            }`}>
              {promptCharacterCount} / {MAX_PROMPT_LENGTH}
            </div>
          </div>

          {/* Error message for character limit */}
          {isPromptTooLong && (
            <p className="text-xs text-red-500 mt-1">
              Prompt exceeds maximum length of {MAX_PROMPT_LENGTH} characters. Please shorten your prompt.
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button
              onClick={handleSubmit}
              disabled={
                !prompt.trim() ||
                loading ||
                isAnalyzing ||
                !selectedCameraId ||
                isPromptTooLong
              }
              className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white flex-1"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Starting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Analyze
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Example Prompts - PURE MODEL SUGGESTIONS ONLY */}
        <div className="space-y-1 flex-shrink-0">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {loadingSuggestions ? "Generating suggestions..." : "Try these examples:"}
          </p>
          {loadingSuggestions ? (
            <div className="flex items-center justify-center py-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
              <span className="ml-2 text-sm text-slate-500">Analyzing stream...</span>
            </div>
          ) : suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {suggestions.map((example, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleExampleClick(example)}
                  className="text-xs h-6 px-2"
                  disabled={loading || isAnalyzing}
                >
                  {example}
                </Button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic py-1">
              Model suggestion generation failed. Please check camera stream or try again.
            </div>
          )}
        </div>

        {/* Current Analysis Status - REDUCED TO MAKE ROOM FOR RESULTS */}
        {(isAnalyzing || currentPrompt) && (
          <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                {isAnalyzing && (
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                )}
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  {isAnalyzing ? 'Analyzing' : 'Last Analysis'}: "{currentPrompt}"
                </span>
              </div>
              {isPaused && (
                <Badge variant="outline" className="text-xs">
                  Paused
                </Badge>
              )}
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              {isAnalyzing ? (
                <>
                  Updates every {getIntervalText()} • Stream ID: {currentStreamId?.substring(0, 8)}...
                </>
              ) : (
                `Analysis completed • ${userFacingResults.length} results available`
              )}
            </p>
          </div>
        )}

        {/* Results History - MAXIMIZED HEIGHT BY REDUCING OTHER SECTIONS */}
        <div className="flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <History className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Live Results
            </span>
            {userFacingResults.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {userFacingResults.length}
              </Badge>
            )}
          </div>

          {/* MAXIMIZED HEIGHT - 460px by reducing space from other sections */}
          <div className="h-[460px] border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-800/50">
            {userFacingResults.length > 0 ? (
              <ScrollArea className="h-full p-3">
                <div className="space-y-2">
                  {userFacingResults.slice(0, 2).map((result, index) => (
                    <div
                      key={result._id}
                      className="p-3 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {new Date(result.timestamp).toLocaleTimeString()}
                          </span>
                          {index === 0 && (
                            <Badge variant="secondary" className="text-xs">
                              Latest
                            </Badge>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {Math.round(result.accuracyScore * 100)}%
                        </Badge>
                      </div>

                      {/* MODEL RESPONSE DISPLAY */}
                      <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        <div
                          className="whitespace-pre-wrap break-words overflow-wrap-anywhere word-break-break-all hyphens-auto"
                          style={{
                            fontSize: result.answer.length > 150 ? '0.75rem' : '0.875rem',
                            lineHeight: '1.4',
                            maxWidth: '100%',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word'
                          }}
                        >
                          {result.answer}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Show older results in collapsed form if there are more than 2 */}
                  {userFacingResults.length > 2 && (
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500 dark:text-slate-400 text-center py-1 border-t border-slate-200 dark:border-slate-700">
                        Older Results ({userFacingResults.length - 2} more)
                      </div>
                      {userFacingResults.slice(2).map((result, index) => (
                        <div
                          key={result._id}
                          className="p-2 rounded-lg border bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {new Date(result.timestamp).toLocaleTimeString()}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {Math.round(result.accuracyScore * 100)}%
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            <div
                              className="whitespace-pre-wrap break-words overflow-wrap-anywhere word-break-break-all hyphens-auto"
                              style={{
                                maxWidth: '100%',
                                wordWrap: 'break-word',
                                overflowWrap: 'break-word'
                              }}
                            >
                              {result.answer.length > 100 ? result.answer.substring(0, 100) + '...' : result.answer}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <Brain className="h-10 w-10 text-slate-400 mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                  {isAnalyzing ? "Waiting for analysis results..." : "No analysis results yet"}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {isAnalyzing ? "Results will appear here in real-time" : "Click 'Analyze' to start"}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}