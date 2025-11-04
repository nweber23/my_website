const express = require('express');
const { query } = require('../database/db');
const router = express.Router();

// Helper to get client IP
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress;
}

// Helper to generate session ID (can use from cookies or generate)
function getSessionID(req) {
  // You could use express-session or cookies, for now use a simple approach
  return req.headers['x-session-id'] || 'anonymous';
}

// POST /api/xp - Log XP event
router.post('/', async (req, res) => {
  try {
    const { event, xp } = req.body;
    
    // Validate input
    if (!event || typeof event !== 'string') {
      return res.status(400).json({ error: 'Invalid event name' });
    }
    
    if (!xp || typeof xp !== 'number' || xp <= 0) {
      return res.status(400).json({ error: 'Invalid XP amount' });
    }
    
    // Prevent XP farming - max 500 XP per event
    if (xp > 500) {
      return res.status(400).json({ error: 'XP amount too high' });
    }
    
    const sessionId = getSessionID(req);
    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'];
    
    // Insert XP event into database
    const result = await query(
      `INSERT INTO xp_events (event, xp, session_id, ip_address, user_agent, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW()) 
       RETURNING id, event, xp, created_at`,
      [event, xp, sessionId, ipAddress, userAgent]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error logging XP event:', error);
    // Don't fail frontend if backend is down
    res.status(500).json({ 
      success: false,
      error: 'Failed to log XP event' 
    });
  }
});

// GET /api/xp/summary - Get XP summary for today
router.get('/summary', async (req, res) => {
  try {
    const sessionId = getSessionID(req);
    
    // Get today's XP for this session
    const result = await query(
      `SELECT 
        COUNT(*) as event_count,
        SUM(xp) as total_xp,
        MIN(created_at) as first_event,
        MAX(created_at) as last_event
       FROM xp_events 
       WHERE session_id = $1 
       AND created_at >= CURRENT_DATE`,
      [sessionId]
    );
    
    // Get top events today
    const topEvents = await query(
      `SELECT event, COUNT(*) as count, SUM(xp) as total_xp
       FROM xp_events 
       WHERE session_id = $1 
       AND created_at >= CURRENT_DATE
       GROUP BY event
       ORDER BY total_xp DESC
       LIMIT 5`,
      [sessionId]
    );
    
    res.json({
      success: true,
      data: {
        today: result.rows[0],
        topEvents: topEvents.rows
      }
    });
  } catch (error) {
    console.error('Error fetching XP summary:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch XP summary' 
    });
  }
});

// GET /api/xp/leaderboard - Get global XP leaderboard (optional)
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const timeframe = req.query.timeframe || 'today'; // today, week, month, all
    
    let timeCondition = '';
    if (timeframe === 'today') {
      timeCondition = 'AND created_at >= CURRENT_DATE';
    } else if (timeframe === 'week') {
      timeCondition = 'AND created_at >= CURRENT_DATE - INTERVAL \'7 days\'';
    } else if (timeframe === 'month') {
      timeCondition = 'AND created_at >= CURRENT_DATE - INTERVAL \'30 days\'';
    }
    
    const result = await query(
      `SELECT 
        session_id,
        COUNT(*) as event_count,
        SUM(xp) as total_xp,
        MAX(created_at) as last_activity
       FROM xp_events 
       WHERE session_id != 'anonymous' ${timeCondition}
       GROUP BY session_id
       ORDER BY total_xp DESC
       LIMIT $1`,
      [limit]
    );
    
    res.json({
      success: true,
      data: {
        timeframe,
        leaderboard: result.rows
      }
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch leaderboard' 
    });
  }
});

module.exports = router;
