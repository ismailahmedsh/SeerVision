const axios = require('axios');
const crypto = require('crypto');
const { URL } = require('url');

// Webhook service for testing and sending webhook notifications
class WebhookService {
  constructor() {
    console.log('[WEBHOOK_SERVICE] Initialized');
    
    // Create axios instance with timeout and retry configuration
    this.httpClient = axios.create({
      timeout: 10000, // 10 seconds timeout
      maxRedirects: 3,
      headers: {
        'User-Agent': 'VisLangStream-Webhook/1.0',
        'Content-Type': 'application/json'
      }
    });
    
    // Add request interceptor for logging
    this.httpClient.interceptors.request.use((config) => {
      console.log(`[WEBHOOK_SERVICE] Outbound request to: ${config.url}`);
      return config;
    });
    
    // Add response interceptor for logging
    this.httpClient.interceptors.response.use(
      (response) => {
        console.log(`[WEBHOOK_SERVICE] Response from ${response.config.url}: ${response.status}`);
        return response;
      },
      (error) => {
        if (error.response) {
          console.log(`[WEBHOOK_SERVICE] Error response from ${error.config?.url}: ${error.response.status}`);
        } else {
          console.log(`[WEBHOOK_SERVICE] Network error for ${error.config?.url}: ${error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Validate webhook URL for security
   */
  validateWebhookUrl(url) {
    try {
      const urlObj = new URL(url);
      
      // Only allow HTTP and HTTPS
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { valid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
      }
      
      // Block localhost and private IP ranges for security
      const hostname = urlObj.hostname.toLowerCase();
      
      // Block localhost
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        // Allow localhost only in development
        if (process.env.NODE_ENV !== 'development') {
          return { valid: false, error: 'Localhost URLs are not allowed in production' };
        }
      }
      
      // Block private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
      const isPrivateIP = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(hostname);
      if (isPrivateIP && process.env.NODE_ENV !== 'development') {
        return { valid: false, error: 'Private IP addresses are not allowed in production' };
      }
      
      return { valid: true };
      
    } catch (error) {
      return { valid: false, error: 'Invalid URL format' };
    }
  }
  
  /**
   * Create HMAC signature for webhook payload
   */
  createSignature(payload, secret) {
    if (!secret) return null;
    
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }
  
  /**
   * Test a webhook URL by sending a test payload
   */
  async testWebhook({ url, secret, payload }) {
    const startTime = Date.now();
    
    console.log('[WEBHOOK_SERVICE] Testing webhook:', {
      url: url,
      hasSecret: !!secret,
      payloadSize: JSON.stringify(payload).length
    });
    
    try {
      // Validate URL
      const validation = this.validateWebhookUrl(url);
      if (!validation.valid) {
        console.log('[WEBHOOK_SERVICE] URL validation failed:', validation.error);
        return {
          success: false,
          status: 400,
          message: validation.error,
          responseTime: Date.now() - startTime
        };
      }
      
      // Prepare headers
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Add signature if secret is provided
      if (secret) {
        const signature = this.createSignature(payload, secret);
        headers['X-Webhook-Signature'] = signature;
        console.log('[WEBHOOK_SERVICE] Added webhook signature');
      }
      
      // Send the webhook
      const response = await this.httpClient.post(url, payload, { headers });
      
      const responseTime = Date.now() - startTime;
      
      console.log('[WEBHOOK_SERVICE] Webhook test successful:', {
        status: response.status,
        responseTime: `${responseTime}ms`
      });
      
      return {
        success: true,
        status: response.status,
        message: 'Test succeeded.',
        responseTime
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      console.error('[WEBHOOK_SERVICE] Webhook test failed:', {
        error: error.message,
        status: error.response?.status,
        responseTime: `${responseTime}ms`
      });
      
      let message = 'Test failed: Unknown error';
      let status = 500;
      
      if (error.code === 'ENOTFOUND') {
        message = 'Test failed: Host not found';
        status = 404;
      } else if (error.code === 'ECONNREFUSED') {
        message = 'Test failed: Connection refused';
        status = 503;
      } else if (error.code === 'ETIMEDOUT') {
        message = 'Test failed: Request timeout';
        status = 408;
      } else if (error.response) {
        status = error.response.status;
        message = `Test failed: ${status} ${error.response.statusText}`;
      } else {
        message = `Test failed: ${error.message}`;
      }
      
      return {
        success: false,
        status,
        message,
        responseTime
      };
    }
  }
  
  /**
   * Send a webhook notification (for future use)
   */
  async sendWebhook({ url, secret, payload }) {
    // This will be used for actual analysis results
    // For now, just use the same logic as testWebhook
    return this.testWebhook({ url, secret, payload });
  }
}

// Create singleton instance
const webhookService = new WebhookService();

module.exports = webhookService;