

export interface ErrorInfo {
  status?: number;
  code?: string;
  message: string;
  isRetryable: boolean;
  userMessage: string;
  actionRequired?: string;
}


export function classifyError(error: any): ErrorInfo {

  if (!error.response) {
    return {
      message: error.message || 'Network error',
      isRetryable: true,
      userMessage: 'Connection failed. Please check your internet connection and try again.',
      actionRequired: 'Check network connection'
    };
  }

  const status = error.response.status;
  const data = error.response.data;


  switch (status) {
    case 400:
      return {
        status,
        message: data?.error || 'Bad request',
        isRetryable: false,
        userMessage: 'Invalid request. Please check your input and try again.',
        actionRequired: 'Verify request parameters'
      };
    
    case 401:
      return {
        status,
        message: 'Unauthorized',
        isRetryable: false,
        userMessage: 'Authentication required. Please log in again.',
        actionRequired: 'Re-authenticate'
      };
    
    case 403:
      return {
        status,
        message: 'Forbidden',
        isRetryable: false,
        userMessage: 'Access denied. You don\'t have permission for this action.',
        actionRequired: 'Check permissions'
      };
    
    case 404:
      return {
        status,
        message: 'Not found',
        isRetryable: false,
        userMessage: 'The requested resource was not found.',
        actionRequired: 'Verify resource exists'
      };
    
    case 409:
      return {
        status,
        message: 'Conflict',
        isRetryable: false,
        userMessage: 'Request conflicts with current state. Please try a different approach.',
        actionRequired: 'Resolve conflict'
      };
    
    case 422:
      return {
        status,
        message: 'Validation error',
        isRetryable: false,
        userMessage: 'Invalid data provided. Please check your input.',
        actionRequired: 'Fix validation errors'
      };
    
    case 429:
      return {
        status,
        message: 'Too many requests',
        isRetryable: true,
        userMessage: 'Too many requests. Please wait a moment and try again.',
        actionRequired: 'Wait and retry'
      };
  }


  if (status >= 500) {
    return {
      status,
      message: data?.error || `Server error (${status})`,
      isRetryable: true,
      userMessage: 'Server temporarily unavailable. We\'re working on it.',
      actionRequired: 'Retry later'
    };
  }


  return {
    status,
    message: data?.error || error.message || 'Unknown error',
    isRetryable: false,
    userMessage: 'An unexpected error occurred. Please try again.',
    actionRequired: 'Contact support if problem persists'
  };
}


export function getToastMessage(error: any): { message: string; type: 'error' | 'warning' | 'info' } {
  const errorInfo = classifyError(error);
  
  if (errorInfo.isRetryable) {
    return {
      message: errorInfo.userMessage,
      type: 'warning'
    };
  }
  
  return {
    message: errorInfo.userMessage,
    type: 'error'
  };
}


export function shouldRetry(error: any): boolean {
  return classifyError(error).isRetryable;
}


export function getActionRequired(error: any): string | undefined {
  return classifyError(error).actionRequired;
}


export function formatErrorForLog(error: any, context?: string): string {
  const errorInfo = classifyError(error);
  const contextStr = context ? `[${context}] ` : '';
  
  return `${contextStr}${errorInfo.status ? `HTTP ${errorInfo.status}: ` : ''}${errorInfo.message}`;
}
