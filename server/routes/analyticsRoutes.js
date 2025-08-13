const express = require('express');
const router = express.Router();
const LiveResult = require('../models/LiveResult');
const Camera = require('../models/Camera');
const { authenticateToken } = require('./middleware/auth');

router.use(authenticateToken);

// GET /api/analytics/summary?from&to
router.get('/summary', async (req, res) => {
  try {
    const { from, to, cameraId } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({
        error: 'from and to parameters are required (ISO date strings)'
      });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format. Use ISO date strings (e.g., 2024-01-01T00:00:00Z)'
      });
    }

    const summary = await LiveResult.getSummary(from, to);
    
    // Calculate daily average
    const daysDiff = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24));
    const dailyAverage = daysDiff > 0 ? Math.round(summary.totalDetections / daysDiff) : 0;

    res.json({
      success: true,
      data: {
        totalDetections: summary.totalDetections || 0,
        averageConfidence: summary.averageConfidence || 0,
        activeCameras: summary.activeCameras || 0,
        dailyAverage,
        timeRange: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
          days: daysDiff
        }
      }
    });
  } catch (error) {
    console.error('[ANALYTICS] Error getting summary:', error.message);
    res.status(500).json({
      error: 'Failed to retrieve analytics summary'
    });
  }
});

// GET /api/analytics/top-queries?from&to&limit=5
router.get('/top-queries', async (req, res) => {
  try {
    const { from, to, limit = 5 } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({
        error: 'from and to parameters are required (ISO date strings)'
      });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format. Use ISO date strings (e.g., 2024-01-01T00:00:00Z)'
      });
    }

    const topQueries = await LiveResult.getTopQueries(from, to, parseInt(limit));
    
    res.json({
      success: true,
      data: topQueries.map(q => ({
        query: q.query,
        count: q.count,
        confidence: q.confidence || 0
      }))
    });
  } catch (error) {
    console.error('[ANALYTICS] Error getting top queries:', error.message);
    res.status(500).json({
      error: 'Failed to retrieve top queries'
    });
  }
});

// GET /api/analytics/camera-performance?from&to
router.get('/camera-performance', async (req, res) => {
  try {
    const { from, to } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({
        error: 'from and to parameters are required (ISO date strings)'
      });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format. Use ISO date strings (e.g., 2024-01-01T00:00:00Z)'
      });
    }

    const cameraPerformance = await LiveResult.getCameraPerformance(from, to);
    
    res.json({
      success: true,
      data: cameraPerformance.map(c => ({
        cameraId: c.cameraId,
        name: c.name,
        detections: c.detections,
        confidence: c.confidence || 0
      }))
    });
  } catch (error) {
    console.error('[ANALYTICS] Error getting camera performance:', error.message);
    res.status(500).json({
      error: 'Failed to retrieve camera performance'
    });
  }
});

// GET /api/analytics (comprehensive endpoint for the frontend)
router.get('/', async (req, res) => {
  try {
    const { timeRange = '7d' } = req.query;
    
    // Calculate date range based on timeRange parameter
    const now = new Date();
    let from, to;
    
    switch (timeRange) {
      case '24h':
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        to = now;
        break;
      case '7d':
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        to = now;
        break;
      case '30d':
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        to = now;
        break;
      case '90d':
        from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        to = now;
        break;
      default:
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        to = now;
    }

    // Get all analytics data in parallel
    const [summary, topQueries, cameraPerformance] = await Promise.all([
      LiveResult.getSummary(from.toISOString(), to.toISOString()),
      LiveResult.getTopQueries(from.toISOString(), to.toISOString(), 5),
      LiveResult.getCameraPerformance(from.toISOString(), to.toISOString())
    ]);

    // Calculate daily average
    const daysDiff = Math.ceil((to - from) / (1000 * 60 * 60 * 24));
    const dailyAverage = daysDiff > 0 ? Math.round((summary.totalDetections || 0) / daysDiff) : 0;

    // Find most active camera
    const mostActiveCamera = cameraPerformance.length > 0 ? cameraPerformance[0].name : 'N/A';

    res.json({
      success: true,
      data: {
        totalDetections: summary.totalDetections || 0,
        averageConfidence: summary.averageConfidence || 0,
        mostActiveCamera,
        topQueries: topQueries.map(q => ({
          query: q.query,
          count: q.count,
          confidence: q.confidence || 0
        })),
        dailyStats: [], // This would need a separate method for daily breakdown
        cameraStats: cameraPerformance.map(c => ({
          cameraId: c.cameraId,
          name: c.name,
          detections: c.detections,
          confidence: c.confidence || 0
        }))
      }
    });
  } catch (error) {
    console.error('[ANALYTICS] Error getting comprehensive analytics:', error.message);
    res.status(500).json({
      error: 'Failed to retrieve analytics data'
    });
  }
});

// GET /api/analytics/timeseries/detections
router.get('/timeseries/detections', async (req, res) => {
  try {
    const { from, to, timeRange = '7d' } = req.query;
    
    let fromDate, toDate;
    if (from && to) {
      fromDate = new Date(from);
      toDate = new Date(to);
    } else {
      // Use timeRange if from/to not provided
      const now = new Date();
      switch (timeRange) {
        case '1h':
          fromDate = new Date(now.getTime() - 60 * 60 * 1000);
          toDate = now;
          break;
        case '6h':
          fromDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
          toDate = now;
          break;
        case '24h':
          fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          toDate = now;
          break;
        case '7d':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          toDate = now;
          break;
        case '30d':
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          toDate = now;
          break;
        case '90d':
          fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          toDate = now;
          break;
        default:
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          toDate = now;
      }
    }
    
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format. Use ISO date strings (e.g., 2024-01-01T00:00:00Z)'
      });
    }

    const detectionsData = await LiveResult.getTimeseriesDetections(fromDate.toISOString(), toDate.toISOString(), timeRange);
    
    res.json({
      success: true,
      data: {
        points: detectionsData
      }
    });
  } catch (error) {
    console.error('[ANALYTICS] Error getting detections timeseries:', error.message);
    res.status(500).json({
      error: 'Failed to retrieve detections timeseries data'
    });
  }
});

// GET /api/analytics/timeseries/confidence
router.get('/timeseries/confidence', async (req, res) => {
  try {
    const { from, to, timeRange = '7d' } = req.query;
    
    let fromDate, toDate;
    if (from && to) {
      fromDate = new Date(from);
      toDate = new Date(to);
    } else {
      // Use timeRange if from/to not provided
      const now = new Date();
      switch (timeRange) {
        case '1h':
          fromDate = new Date(now.getTime() - 60 * 60 * 1000);
          toDate = now;
          break;
        case '6h':
          fromDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
          toDate = now;
          break;
        case '24h':
          fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          toDate = now;
          break;
        case '7d':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          toDate = now;
          break;
        case '30d':
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          toDate = now;
          break;
        case '90d':
          fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          toDate = now;
          break;
        default:
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          toDate = now;
      }
    }
    
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format. Use ISO date strings (e.g., 2024-01-01T00:00:00Z)'
      });
    }

    const confidenceData = await LiveResult.getTimeseriesConfidence(fromDate.toISOString(), toDate.toISOString(), timeRange);
    
    res.json({
      success: true,
      data: {
        points: confidenceData
      }
    });
  } catch (error) {
    console.error('[ANALYTICS] Error getting confidence timeseries:', error.message);
    res.status(500).json({
      error: 'Failed to retrieve confidence timeseries data'
    });
  }
});

module.exports = router;
