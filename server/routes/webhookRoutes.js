const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./middleware/auth');
const webhookService = require('../services/webhookService');

// Test webhook endpoint
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const { url, secret, payload } = req.body;
    
    // Validate required fields
    if (!url) {
      return res.status(400).json({ error: 'Webhook URL is required' });
    }
    
    if (!payload) {
      return res.status(400).json({ error: 'Payload is required' });
    }
    
    // Call webhook service to test the webhook
    const result = await webhookService.testWebhook({
      url,
      secret,
      payload
    });
    
    res.json({
      success: result.success,
      status: result.status,
      message: result.message,
      responseTime: result.responseTime
    });
    
  } catch (error) {
    console.error('[WEBHOOK_ROUTES] Error testing webhook:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to test webhook',
      message: error.message
    });
  }
});

module.exports = router;