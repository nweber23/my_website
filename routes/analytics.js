const express = require('express');
const { body, query: validateQuery, param } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { query } = require('../database/db');
const { validateRequest } = require('../utils/validation');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Rate limiting for analytics tracking
const trackingLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 events per minute per IP
  message: 'Too many tracking requests',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for admin analytics access
const adminLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute for admin
  skipSuccessfulRequests: true,
});

/**
 * @route   POST /api/analytics/track
 * @desc    Track analytics events (public endpoint)
 * @access  Public (rate limited)
 */
router.post('/track', trackingLimit, [
  body('event_type').isIn(['page_view', 'section_view', 'contact_form_submit', 'project_click']),
  body('event_data').optional().isObject(),
  body('section').optional().isString().trim().escape(),
  body('url').optional().isURL(),
  body('referrer').optional().isString().trim(),
  body('user_agent').optional().isString().trim()
], async (req, res) => {
  try {
    const validation = validateRequest(req);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tracking data',
        errors: validation.errors
      });
    }

    const {
      event_type,
      event_data = {},
      section,
      url,
      referrer,
      user_agent
    } = req.body;

    const clientIp = req.ip || req.connection.remoteAddress;

    // Enhance event data with additional context
    const enhancedEventData = {
      ...event_data,
      section,
      url,
      referrer: referrer || req.get('Referer'),
      user_agent: user_agent || req.get('User-Agent'),
      client_ip: clientIp,
      timestamp: new Date().toISOString()
    };

    const insertQuery = `
      INSERT INTO analytics (event_type, event_data, client_ip, user_agent, referrer)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, event_type, created_at
    `;

    const result = await query(insertQuery, [
      event_type,
      JSON.stringify(enhancedEventData),
      clientIp,
      enhancedEventData.user_agent,
      enhancedEventData.referrer
    ]);

    res.status(201).json({
      success: true,
      message: 'Event tracked successfully',
      data: {
        id: result.rows[0].id,
        event_type: result.rows[0].event_type,
        tracked_at: result.rows[0].created_at
      }
    });

  } catch (error) {
    console.error('Error tracking analytics event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track event'
    });
  }
});

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get dashboard analytics data (admin only)
 * @access  Private (admin)
 */
router.get('/dashboard', authenticateToken, adminLimit, async (req, res) => {
  try {
    // Get basic analytics stats
    const statsQuery = `
      SELECT 
        COUNT(*) as total_events,
        COUNT(*) FILTER (WHERE event_type = 'page_view') as page_views,
        COUNT(*) FILTER (WHERE event_type = 'section_view') as section_views,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as weekly_events,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '1 day') as daily_events,
        COUNT(DISTINCT client_ip) as unique_visitors,
        COUNT(DISTINCT client_ip) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as weekly_visitors
      FROM analytics
    `;

    const statsResult = await query(statsQuery);
    const stats = statsResult.rows[0];

    // Convert string counts to integers
    Object.keys(stats).forEach(key => {
      stats[key] = parseInt(stats[key]);
    });

    // Get section views breakdown
    const sectionQuery = `
      SELECT 
        event_data->>'section' as section_name,
        COUNT(*) as views
      FROM analytics 
      WHERE event_type = 'section_view' 
        AND event_data->>'section' IS NOT NULL
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY event_data->>'section'
      ORDER BY views DESC
    `;

    const sectionResult = await query(sectionQuery);
    const sectionViews = sectionResult.rows.map(row => ({
      section: row.section_name,
      views: parseInt(row.views)
    }));

    // Get daily views for the last 7 days
    const dailyViewsQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE event_type = 'page_view') as views
      FROM analytics
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    const dailyViewsResult = await query(dailyViewsQuery);
    const dailyViews = dailyViewsResult.rows.map(row => ({
      date: row.date,
      views: parseInt(row.views)
    }));

    // Get top referrers
    const referrersQuery = `
      SELECT 
        COALESCE(NULLIF(referrer, ''), 'Direct') as referrer,
        COUNT(*) as visits
      FROM analytics
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND event_type = 'page_view'
      GROUP BY referrer
      ORDER BY visits DESC
      LIMIT 10
    `;

    const referrersResult = await query(referrersQuery);
    const topReferrers = referrersResult.rows.map(row => ({
      referrer: row.referrer,
      visits: parseInt(row.visits)
    }));

    res.json({
      success: true,
      data: {
        summary: stats,
        section_views: sectionViews,
        daily_views: dailyViews,
        top_referrers: topReferrers
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics data'
    });
  }
});

/**
 * @route   GET /api/analytics/events
 * @desc    Get analytics events with pagination and filtering (admin only)
 * @access  Private (admin)
 */
router.get('/events', authenticateToken, adminLimit, [
  validateQuery('page').optional().isInt({ min: 1 }),
  validateQuery('limit').optional().isInt({ min: 1, max: 100 }),
  validateQuery('event_type').optional().isIn(['page_view', 'section_view', 'contact_form_submit', 'project_click', 'all']),
  validateQuery('start_date').optional().isISO8601(),
  validateQuery('end_date').optional().isISO8601()
], async (req, res) => {
  try {
    const validation = validateRequest(req);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parameters',
        errors: validation.errors
      });
    }

    const {
      page = 1,
      limit = 50,
      event_type = 'all',
      start_date,
      end_date
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = '1=1';
    const queryParams = [];
    let paramIndex = 1;

    // Add event type filter
    if (event_type !== 'all') {
      whereClause += ` AND event_type = $${paramIndex}`;
      queryParams.push(event_type);
      paramIndex++;
    }

    // Add date range filter
    if (start_date) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      queryParams.push(end_date);
      paramIndex++;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM analytics WHERE ${whereClause}`;
    const countResult = await query(countQuery, queryParams);
    const totalEvents = parseInt(countResult.rows[0].count);

    // Get events with pagination
    const eventsQuery = `
      SELECT 
        id, 
        event_type, 
        event_data, 
        client_ip, 
        user_agent, 
        referrer, 
        created_at
      FROM analytics 
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    queryParams.push(limit, offset);

    const eventsResult = await query(eventsQuery, queryParams);

    res.json({
      success: true,
      data: {
        events: eventsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalEvents,
          pages: Math.ceil(totalEvents / limit)
        },
        filters: {
          event_type,
          start_date,
          end_date
        }
      }
    });

  } catch (error) {
    console.error('Error fetching analytics events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events'
    });
  }
});

/**
 * @route   GET /api/analytics/charts/:type
 * @desc    Get chart data for different analytics visualizations (admin only)
 * @access  Private (admin)
 */
router.get('/charts/:type', authenticateToken, adminLimit, [
  param('type').isIn(['daily', 'weekly', 'monthly', 'sections', 'browsers', 'devices']),
  validateQuery('days').optional().isInt({ min: 1, max: 365 }),
  validateQuery('start_date').optional().isISO8601(),
  validateQuery('end_date').optional().isISO8601()
], async (req, res) => {
  try {
    const validation = validateRequest(req);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parameters',
        errors: validation.errors
      });
    }

    const { type } = req.params;
    const { days = 30, start_date, end_date } = req.query;

    let sqlQuery = '';
    let queryParams = [];

    switch (type) {
      case 'daily':
        sqlQuery = `
          SELECT 
            DATE(created_at) as date,
            COUNT(*) FILTER (WHERE event_type = 'page_view') as page_views,
            COUNT(*) FILTER (WHERE event_type = 'section_view') as section_views,
            COUNT(DISTINCT client_ip) as unique_visitors
          FROM analytics
          WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
          GROUP BY DATE(created_at)
          ORDER BY date ASC
        `;
        break;

      case 'sections':
        sqlQuery = `
          SELECT 
            COALESCE(event_data->>'section', 'unknown') as section,
            COUNT(*) as views
          FROM analytics
          WHERE event_type = 'section_view' 
            AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
          GROUP BY event_data->>'section'
          ORDER BY views DESC
        `;
        break;

      case 'browsers':
        sqlQuery = `
          SELECT 
            CASE 
              WHEN user_agent ILIKE '%Chrome%' THEN 'Chrome'
              WHEN user_agent ILIKE '%Firefox%' THEN 'Firefox'
              WHEN user_agent ILIKE '%Safari%' AND user_agent NOT ILIKE '%Chrome%' THEN 'Safari'
              WHEN user_agent ILIKE '%Edge%' THEN 'Edge'
              ELSE 'Other'
            END as browser,
            COUNT(*) as sessions
          FROM analytics
          WHERE event_type = 'page_view'
            AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
          GROUP BY browser
          ORDER BY sessions DESC
        `;
        break;

      case 'devices':
        sqlQuery = `
          SELECT 
            CASE 
              WHEN user_agent ILIKE '%Mobile%' THEN 'Mobile'
              WHEN user_agent ILIKE '%Tablet%' THEN 'Tablet'
              ELSE 'Desktop'
            END as device_type,
            COUNT(*) as sessions
          FROM analytics
          WHERE event_type = 'page_view'
            AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
          GROUP BY device_type
          ORDER BY sessions DESC
        `;
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid chart type'
        });
    }

    const result = await query(sqlQuery, queryParams);
    
    // Convert numeric strings to numbers
    const chartData = result.rows.map(row => {
      const processed = { ...row };
      Object.keys(processed).forEach(key => {
        if (typeof processed[key] === 'string' && !isNaN(processed[key])) {
          processed[key] = parseInt(processed[key]);
        }
      });
      return processed;
    });

    res.json({
      success: true,
      data: {
        chart_type: type,
        data: chartData,
        meta: {
          days: parseInt(days),
          start_date,
          end_date
        }
      }
    });

  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chart data'
    });
  }
});

/**
 * @route   DELETE /api/analytics/events
 * @desc    Clear old analytics events (admin only)
 * @access  Private (admin)
 */
router.delete('/events', authenticateToken, adminLimit, [
  validateQuery('older_than_days').isInt({ min: 1, max: 365 })
], async (req, res) => {
  try {
    const validation = validateRequest(req);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parameters',
        errors: validation.errors
      });
    }

    const { older_than_days } = req.query;

    const deleteQuery = `
      DELETE FROM analytics 
      WHERE created_at < CURRENT_DATE - INTERVAL '${older_than_days} days'
      RETURNING id
    `;

    const result = await query(deleteQuery);

    res.json({
      success: true,
      message: `${result.rows.length} analytics events deleted`,
      data: {
        deleted_count: result.rows.length,
        older_than_days: parseInt(older_than_days)
      }
    });

  } catch (error) {
    console.error('Error deleting analytics events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete events'
    });
  }
});

module.exports = router;