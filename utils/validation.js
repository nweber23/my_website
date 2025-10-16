const Joi = require('joi');

// Login validation schema
const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters long',
    'any.required': 'Password is required'
  })
});

// Contact message validation schema
const messageSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot exceed 100 characters',
    'any.required': 'Name is required'
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  subject: Joi.string().min(5).max(200).required().messages({
    'string.min': 'Subject must be at least 5 characters long',
    'string.max': 'Subject cannot exceed 200 characters',
    'any.required': 'Subject is required'
  }),
  message: Joi.string().min(10).max(2000).required().messages({
    'string.min': 'Message must be at least 10 characters long',
    'string.max': 'Message cannot exceed 2000 characters',
    'any.required': 'Message is required'
  })
});

// Analytics event validation schema
const analyticsEventSchema = Joi.object({
  eventType: Joi.string().valid(
    'page_view', 
    'section_view', 
    'form_submit', 
    'link_click',
    'download',
    'contact_form_submit'
  ).required(),
  eventData: Joi.object().optional(),
  page: Joi.string().max(100).optional(),
  section: Joi.string().max(100).optional(),
  sessionId: Joi.string().max(255).optional()
});

// Settings update validation schema
const settingsSchema = Joi.object({
  darkMode: Joi.boolean().optional(),
  analyticsEnabled: Joi.boolean().optional(),
  contactFormEnabled: Joi.boolean().optional(),
  adminNotificationsEnabled: Joi.boolean().optional()
});

// Query parameter validation schemas
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('created_at', 'updated_at', 'name', 'email').default('created_at'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
  search: Joi.string().max(255).optional(),
  filter: Joi.string().valid('all', 'read', 'unread').default('all')
});

const dateRangeSchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
  period: Joi.string().valid('7d', '30d', '90d', '1y').default('30d')
});

// Validation functions
function validateLogin(data) {
  return loginSchema.validate(data, { abortEarly: false });
}

function validateMessage(data) {
  return messageSchema.validate(data, { abortEarly: false });
}

function validateAnalyticsEvent(data) {
  return analyticsEventSchema.validate(data, { abortEarly: false });
}

function validateSettings(data) {
  return settingsSchema.validate(data, { abortEarly: false });
}

function validatePagination(data) {
  return paginationSchema.validate(data, { abortEarly: false });
}

function validateDateRange(data) {
  return dateRangeSchema.validate(data, { abortEarly: false });
}

// Custom validation middleware
function validateRequest(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    req.validatedBody = value;
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false });
    
    if (error) {
      return res.status(400).json({
        error: 'Query validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    req.validatedQuery = value;
    next();
  };
}

// Sanitization helpers
function sanitizeHtml(str) {
  if (!str) return str;
  
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function sanitizeMessage(data) {
  return {
    ...data,
    name: sanitizeHtml(data.name?.trim()),
    subject: sanitizeHtml(data.subject?.trim()),
    message: sanitizeHtml(data.message?.trim())
  };
}

module.exports = {
  validateLogin,
  validateMessage,
  validateAnalyticsEvent,
  validateSettings,
  validatePagination,
  validateDateRange,
  validateRequest,
  validateQuery,
  sanitizeHtml,
  sanitizeMessage,
  schemas: {
    loginSchema,
    messageSchema,
    analyticsEventSchema,
    settingsSchema,
    paginationSchema,
    dateRangeSchema
  }
};