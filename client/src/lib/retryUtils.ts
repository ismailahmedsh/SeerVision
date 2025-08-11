import { shouldRetry } from './errorUtils';

/**
 * Smart retry utilities with single-flight guards and proper error classification
 */

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
  retryableStatuses: number[];
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
  aborted: boolean;
}

// In-flight request tracking
const inFlightRequests = new Map<string, AbortController>();

/**
 * Check if a request is already in flight
 */
export function isRequestInFlight(key: string): boolean {
  return inFlightRequests.has(key);
}

/**
 * Cancel an in-flight request
 */
export function cancelInFlightRequest(key: string): void {
  const controller = inFlightRequests.get(key);
  if (controller) {
    controller.abort();
    inFlightRequests.delete(key);
  }
}

/**
 * Check if an error is retryable based on status code
 */
export function isRetryableError(error: any): boolean {
  // Use the centralized error classification
  return shouldRetry(error);
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
export function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = Math.min(
    config.baseDelay * Math.pow(2, attempt),
    config.maxDelay
  );
  
  if (config.jitter) {
    // Add ±25% jitter to avoid thundering herd
    const jitterRange = delay * 0.25;
    return delay + (Math.random() * jitterRange * 2) - jitterRange;
  }
  
  return delay;
}

/**
 * Smart retry function with single-flight protection
 */
export async function smartRetry<T>(
  key: string,
  requestFn: (signal: AbortSignal) => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const finalConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    jitter: true,
    retryableStatuses: [500, 502, 503, 504],
    ...config
  };

  // Check if request is already in flight
  if (isRequestInFlight(key)) {
    console.log(`[RETRY] Request ${key} already in flight, skipping`);
    return {
      success: false,
      error: 'Request already in progress',
      attempts: 0,
      aborted: false
    };
  }

  // Create abort controller for this request
  const controller = new AbortController();
  inFlightRequests.set(key, controller);

  try {
    let lastError: any;
    
    for (let attempt = 0; attempt < finalConfig.maxAttempts; attempt++) {
      try {
        console.log(`[RETRY] Attempt ${attempt + 1}/${finalConfig.maxAttempts} for ${key}`);
        
        const result = await requestFn(controller.signal);
        
        console.log(`[RETRY] Request ${key} completed successfully`);
        console.log(`[RETRY] Result type:`, typeof result);
        console.log(`[RETRY] Result:`, result);
        
        // Success - clean up and return
        inFlightRequests.delete(key);
        return {
          success: true,
          data: result,
          attempts: attempt + 1,
          aborted: false
        };
        
      } catch (error: any) {
        lastError = error;
        
        // Check if request was aborted
        if (error.name === 'AbortError' || controller.signal.aborted) {
          console.log(`[RETRY] Request ${key} was aborted`);
          inFlightRequests.delete(key);
          return {
            success: false,
            error: 'Request was cancelled',
            attempts: attempt + 1,
            aborted: true
          };
        }
        
        // Check if error is retryable
        if (!isRetryableError(error)) {
          console.log(`[RETRY] Non-retryable error for ${key}:`, error.response?.status, error.message);
          inFlightRequests.delete(key);
          return {
            success: false,
            error: error.message,
            attempts: attempt + 1,
            aborted: false
          };
        }
        
        // If this is the last attempt, don't wait
        if (attempt === finalConfig.maxAttempts - 1) {
          break;
        }
        
        // Calculate delay and wait
        const delay = calculateDelay(attempt, finalConfig);
        console.log(`[RETRY] Waiting ${delay}ms before retry for ${key}`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // All attempts failed
    inFlightRequests.delete(key);
    return {
      success: false,
      error: lastError?.message || 'All retry attempts failed',
      attempts: finalConfig.maxAttempts,
      aborted: false
    };
    
  } catch (error: any) {
    // Unexpected error
    inFlightRequests.delete(key);
    return {
      success: false,
      error: error.message || 'Unexpected error during retry',
      attempts: 0,
      aborted: false
    };
  }
}

/**
 * Clean up all in-flight requests (useful for cleanup)
 */
export function cleanupInFlightRequests(): void {
  for (const [key, controller] of inFlightRequests.entries()) {
    controller.abort();
    inFlightRequests.delete(key);
  }
}

/**
 * Get count of in-flight requests
 */
export function getInFlightRequestCount(): number {
  return inFlightRequests.size;
}
