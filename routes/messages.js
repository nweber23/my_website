const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { query: dbQuery } = require('../database/db');
const { validateMessage, validatePagination } = require('../utils/validation');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Rate limiting for message submission
const submitMessageLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 messages per hour (generous for testing/development)
  message: { success: false, error: 'Too many messages submitted. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true, // Don't count failed requests
});

// Rate limiting for admin operations
const adminLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // Increased from 60 to 200 requests per minute for admin
  skipSuccessfulRequests: true,
  message: { success: false, error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route   POST /api/messages
 * @desc    Submit a new contact message (public endpoint)
 * @access  Public (rate limited)
 */
router.post('/', submitMessageLimit, [
  body('name').trim().isLength({ min: 2, max: 100 }).escape(),
  body('email').isEmail().normalizeEmail(),
  body('subject').trim().isLength({ min: 5, max: 200 }).escape(),
  body('message').trim().isLength({ min: 10, max: 2000 }).escape(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg
        }))
      });
    }

    const { name, email, subject, message } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;

    const insertQuery = `
      INSERT INTO messages (name, email, subject, message, ip_address)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, subject, message, created_at, is_read
    `;

    const result = await dbQuery(insertQuery, [name, email, subject, message, clientIp]);
    const newMessage = result.rows[0];

    // Log analytics event
    await dbQuery(
      'INSERT INTO analytics_events (event_type, event_data) VALUES ($1, $2)',
      ['message_submitted', { message_id: newMessage.id }]
    );

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        id: newMessage.id,
        name: newMessage.name,
        subject: newMessage.subject,
        created_at: newMessage.created_at
      }
    });

  } catch (error) {
    console.error('Error submitting message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit message'
    });
  }
});

/**
 * @route   GET /api/messages
 * @desc    Get all messages with pagination and filtering (admin only)
 * @access  Private (admin)
 */
router.get('/', authenticateToken, adminLimit, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim().escape(),
  query('filter').optional().isIn(['all', 'read', 'unread']),
  query('sort').optional().isIn(['created_at', 'name', 'subject']),
  query('order').optional().isIn(['asc', 'desc'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parameters',
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg
        }))
      });
    }

    const {
      page = 1,
      limit = 20,
      search = '',
      filter = 'all',
      sort = 'created_at',
      order = 'desc'
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = '1=1';
    const queryParams = [];
    let paramIndex = 1;

    // Add search functionality
    if (search) {
      whereClause += ` AND (
        name ILIKE $${paramIndex} OR 
        email ILIKE $${paramIndex} OR 
        subject ILIKE $${paramIndex} OR 
        message ILIKE $${paramIndex}
      )`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Add filter functionality
    if (filter === 'read') {
      whereClause += ` AND is_read = true`;
    } else if (filter === 'unread') {
      whereClause += ` AND is_read = false`;
    }

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) FROM messages WHERE ${whereClause}`;
    const countResult = await dbQuery(countQuery, queryParams);
    const totalMessages = parseInt(countResult.rows[0].count);

    // Get messages with pagination
    const messagesQuery = `
      SELECT id, name, email, subject, message, created_at, updated_at, is_read, ip_address
      FROM messages 
      WHERE ${whereClause}
      ORDER BY ${sort} ${order.toUpperCase()}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    queryParams.push(limit, offset);

    const messagesResult = await dbQuery(messagesQuery, queryParams);

    res.json({
      success: true,
      data: {
        messages: messagesResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalMessages,
          pages: Math.ceil(totalMessages / limit)
        },
        filters: {
          search,
          filter,
          sort,
          order
        }
      }
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
});

/**
 * @route   GET /api/messages/:id
 * @desc    Get a specific message by ID (admin only)
 * @access  Private (admin)
 */
router.get('/:id', authenticateToken, adminLimit, [
  param('id').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID',
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg
        }))
      });
    }

    const { id } = req.params;

    const query = `
      SELECT id, name, email, subject, message, created_at, updated_at, is_read, ip_address
      FROM messages 
      WHERE id = $1
    `;

    const result = await dbQuery(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch message'
    });
  }
});

/**
 * @route   PATCH /api/messages/:id/read
 * @desc    Mark a message as read (admin only)
 * @access  Private (admin)
 */
router.patch('/:id/read', authenticateToken, adminLimit, [
  param('id').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID',
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg
        }))
      });
    }

    const { id } = req.params;

    const query = `
      UPDATE messages 
      SET is_read = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND is_read = false
      RETURNING id, is_read, updated_at
    `;

    const result = await dbQuery(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or already marked as read'
      });
    }

    res.json({
      success: true,
      message: 'Message marked as read',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark message as read'
    });
  }
});

/**
 * @route   PATCH /api/messages/bulk-read
 * @desc    Mark multiple messages as read (admin only)
 * @access  Private (admin)
 */
router.patch('/bulk-read', authenticateToken, adminLimit, [
  body('messageIds').isArray({ min: 1, max: 100 }),
  body('messageIds.*').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message IDs',
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg
        }))
      });
    }

    const { messageIds } = req.body;

    const query = `
      UPDATE messages 
      SET is_read = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($1) AND is_read = false
      RETURNING id
    `;

    const result = await dbQuery(query, [messageIds]);

    res.json({
      success: true,
      message: `${result.rows.length} message(s) marked as read`,
      data: {
        updated_count: result.rows.length,
        updated_ids: result.rows.map(row => row.id)
      }
    });

  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read'
    });
  }
});

/**
 * @route   DELETE /api/messages/:id
 * @desc    Delete a message (admin only)
 * @access  Private (admin)
 */
router.delete('/:id', authenticateToken, adminLimit, [
  param('id').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID',
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg
        }))
      });
    }

    const { id } = req.params;

    const query = 'DELETE FROM messages WHERE id = $1 RETURNING id';
    const result = await dbQuery(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message'
    });
  }
});

/**
 * @route   DELETE /api/messages/bulk
 * @desc    Delete multiple messages (admin only)
 * @access  Private (admin)
 */
router.delete('/bulk', authenticateToken, adminLimit, [
  body('messageIds').isArray({ min: 1, max: 100 }),
  body('messageIds.*').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message IDs',
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg
        }))
      });
    }

    const { messageIds } = req.body;

    const query = 'DELETE FROM messages WHERE id = ANY($1) RETURNING id';
    const result = await dbQuery(query, [messageIds]);

    res.json({
      success: true,
      message: `${result.rows.length} message(s) deleted successfully`,
      data: {
        deleted_count: result.rows.length,
        deleted_ids: result.rows.map(row => row.id)
      }
    });

  } catch (error) {
    console.error('Error deleting messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete messages'
    });
  }
});

/**
 * @route   GET /api/messages/stats
 * @desc    Get message statistics (admin only)
 * @access  Private (admin)
 */
router.get('/stats/summary', authenticateToken, adminLimit, async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_messages,
        COUNT(*) FILTER (WHERE is_read = false) as unread_messages,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as recent_messages,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '1 day') as today_messages
      FROM messages
    `;

    const result = await dbQuery(statsQuery);
    const stats = result.rows[0];

    // Convert string counts to integers
    Object.keys(stats).forEach(key => {
      stats[key] = parseInt(stats[key]);
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching message stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch message statistics'
    });
  }
});

module.exports = router;