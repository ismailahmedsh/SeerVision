import { shouldRetry } from './errorUtils';



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


const inFlightRequests = new Map<string, AbortController>();


export function isRequestInFlight(key: string): boolean {
  return inFlightRequests.has(key);
}


export function cancelInFlightRequest(key: string): void {
  const controller = inFlightRequests.get(key);
  if (controller) {
    controller.abort();
    inFlightRequests.delete(key);
  }
}


export function isRetryableError(error: any): boolean {

  return shouldRetry(error);
}


export function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = Math.min(
    config.baseDelay * Math.pow(2, attempt),
    config.maxDelay
  );
  
  if (config.jitter) {

    const jitterRange = delay * 0.25;
    return delay + (Math.random() * jitterRange * 2) - jitterRange;
  }
  
  return delay;
}


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

  if (isRequestInFlight(key)) {
    return {
      success: false,
      error: 'Request already in progress',
      attempts: 0,
      aborted: false
    };
  }


  const controller = new AbortController();
  inFlightRequests.set(key, controller);

  try {
    let lastError: any;
    
    for (let attempt = 0; attempt < finalConfig.maxAttempts; attempt++) {
      try {
        const result = await requestFn(controller.signal);
        inFlightRequests.delete(key);
        return {
          success: true,
          data: result,
          attempts: attempt + 1,
          aborted: false
        };
        
      } catch (error: any) {
        lastError = error;
        
        if (error.name === 'AbortError' || controller.signal.aborted) {
          inFlightRequests.delete(key);
          return {
            success: false,
            error: 'Request was cancelled',
            attempts: attempt + 1,
            aborted: true
          };
        }
        
        if (!isRetryableError(error)) {
          inFlightRequests.delete(key);
          return {
            success: false,
            error: error.message,
            attempts: attempt + 1,
            aborted: false
          };
        }
        
        if (attempt === finalConfig.maxAttempts - 1) {
          break;
        }
        
        const delay = calculateDelay(attempt, finalConfig);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    

    inFlightRequests.delete(key);
    return {
      success: false,
      error: lastError?.message || 'All retry attempts failed',
      attempts: finalConfig.maxAttempts,
      aborted: false
    };
    
  } catch (error: any) {

    inFlightRequests.delete(key);
    return {
      success: false,
      error: error.message || 'Unexpected error during retry',
      attempts: 0,
      aborted: false
    };
  }
}


export function cleanupInFlightRequests(): void {
  for (const [key, controller] of inFlightRequests.entries()) {
    controller.abort();
    inFlightRequests.delete(key);
  }
}


export function getInFlightRequestCount(): number {
  return inFlightRequests.size;
}
