# Portfolio Website Deployment Guide

Your personal portfolio website is now complete with a full-stack backend API and Docker deployment! 🎉

## 🚀 Quick Start

### Development Mode

1. **Start with Docker (Recommended)**:
```bash
# Copy environment file
cp .env.example .env

# Edit the .env file with your settings
nano .env

# Start the full stack
docker-compose up --build
```

2. **Or run locally**:
```bash
# Install dependencies
npm install

# Set environment variables
export DATABASE_URL="postgres://portfolio_user:secure_password123@localhost:5432/portfolio"
export JWT_SECRET="your-super-secret-jwt-key-change-this"
export ADMIN_PASSWORD="admin123"

# Start the server
npm start
```

Your website will be available at:
- **Portfolio**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin.html

## 📁 Project Structure

```
my_website/
├── server.js                 # Express server entry point
├── package.json              # Node.js dependencies
├── Dockerfile                # Docker container config
├── docker-compose.yml        # Multi-service Docker setup
├── docker-compose.prod.yml   # Production Docker config
├── .env.example              # Environment template
│
├── routes/                   # API endpoints
│   ├── auth.js              # Authentication routes
│   ├── messages.js          # Contact messages API
│   └── analytics.js         # Analytics tracking API
│
├── database/                # Database configuration
│   ├── db.js               # PostgreSQL connection
│   └── schema.sql          # Database schema
│
├── utils/                   # Utility functions
│   └── validation.js       # Input validation
│
├── ts/                      # Frontend JavaScript
│   ├── api-client.js       # Backend API client
│   ├── main.js             # Portfolio functionality
│   └── admin.js            # Admin panel functionality
│
├── css/                     # Stylesheets
│   ├── style.css           # Main portfolio styles
│   ├── admin.css           # Admin panel styles
│   └── responsive.css      # Mobile responsive styles
│
├── index.html               # Main portfolio page
├── admin.html               # Admin panel interface
└── README.md                # Project documentation
```

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL=postgres://portfolio_user:secure_password123@localhost:5432/portfolio

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Admin Credentials
ADMIN_EMAIL=niklasweber610@gmail.com
ADMIN_PASSWORD=admin123

# CORS (for production)
CORS_ORIGIN=https://yourdomain.com
```

### Admin Panel Access

- **URL**: http://localhost:3000/admin.html
- **Default Password**: `admin123`
- **Features**: 
  - 🔒 Secure JWT-based authentication with show/hide password
  - 📊 Dashboard with real-time statistics
  - 📧 Contact message management (CRUD operations)
  - 📈 Analytics dashboard with charts
  - ⚙️ Settings panel with password change
  - 📥 Data export functionality

## 🐋 Docker Deployment

### Development
```bash
docker-compose up --build
```

### Production
```bash
# Create production environment file
cp .env.example .env.prod

# Edit with production settings
nano .env.prod

# Deploy with production config
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### Docker Services
- **app**: Node.js/Express application
- **db**: PostgreSQL database with persistent storage
- **redis**: Session storage and caching (optional)
- **nginx**: Reverse proxy (production only)

## 🌐 Production Deployment

### VPS/Server Setup

1. **Clone your repository**:
```bash
git clone https://github.com/nweber23/portfolio-website.git
cd portfolio-website
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit with production values:
# - Strong JWT_SECRET
# - Secure ADMIN_PASSWORD  
# - Your domain for CORS_ORIGIN
# - Database credentials
```

3. **Deploy with Docker**:
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

4. **Set up SSL (Let's Encrypt)**:
```bash
# Run certbot service
docker-compose -f docker-compose.prod.yml --profile ssl run certbot certonly \
  --webroot --webroot-path /var/www/certbot \
  --email niklasweber610@gmail.com \
  --agree-tos --no-eff-email \
  -d yourdomain.com
```

### Domain Setup

1. **DNS Configuration**:
   - Point your domain to your server IP
   - Set up A record: `yourdomain.com -> YOUR_SERVER_IP`

2. **SSL Certificate**:
   - Uses Let's Encrypt via Certbot
   - Automatic renewal configured

3. **Nginx Configuration**:
   - HTTP to HTTPS redirect
   - Static file serving
   - Reverse proxy to Node.js app

## 🚦 Health Checks

The application includes built-in health monitoring:

- **Health Endpoint**: `GET /api/health`
- **Database Check**: Connection verification  
- **Docker Health**: Container monitoring
- **Logs**: Structured logging with rotation

## 📊 Features Overview

### Portfolio Website
✅ **Responsive Design** - Mobile-first approach  
✅ **Dark/Light Mode** - Persistent theme toggle  
✅ **Smooth Animations** - Intersection Observer based  
✅ **Contact Form** - Real-time validation & API submission  
✅ **Analytics Tracking** - Page views and interactions  
✅ **SEO Optimized** - Meta tags and structured data  
✅ **Performance** - Lazy loading and optimized assets  
✅ **Accessibility** - ARIA labels and semantic HTML

### Admin Panel
✅ **Secure Authentication** - JWT-based with rate limiting  
✅ **Dashboard Analytics** - Real-time statistics and charts  
✅ **Message Management** - Full CRUD operations  
✅ **Search & Filtering** - Advanced message queries  
✅ **Data Export** - JSON download functionality  
✅ **Mobile Responsive** - Works on all devices  
✅ **Password Management** - Secure password changes  
✅ **Session Management** - Auto-expiry and refresh

### Backend API
✅ **RESTful Design** - Standard HTTP methods and responses  
✅ **Input Validation** - Joi-based validation for all endpoints  
✅ **Rate Limiting** - Protection against abuse  
✅ **Security Headers** - Helmet.js for security  
✅ **CORS Support** - Configurable cross-origin requests  
✅ **Error Handling** - Comprehensive error responses  
✅ **Database Management** - PostgreSQL with connection pooling  
✅ **Authentication** - JWT tokens with secure sessions

## 🔒 Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Authentication**: Secure token-based auth
- **Rate Limiting**: Protection against brute force
- **Input Validation**: XSS and injection prevention  
- **CORS Configuration**: Controlled cross-origin requests
- **Security Headers**: Helmet.js protection
- **Session Management**: Secure cookie handling
- **Environment Variables**: Sensitive data protection

## 📈 Analytics & Monitoring

- **Page View Tracking**: Automatic visitor analytics
- **Section Analytics**: User interaction tracking
- **Daily/Weekly Stats**: Trend analysis
- **Contact Form Analytics**: Conversion tracking
- **Admin Dashboard**: Real-time metrics
- **Export Functionality**: Data analysis support

## 🛠 Maintenance

### Database Backups
```bash
# Manual backup
docker-compose exec db pg_dump -U portfolio_user portfolio > backup.sql

# Automated backups (production)
docker-compose -f docker-compose.prod.yml --profile backup run db-backup
```

### Log Management
```bash
# View logs
docker-compose logs -f app

# Log rotation is configured automatically
```

### Updates
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose up --build -d
```

## 🎯 API Endpoints

### Public Endpoints
- `POST /api/messages` - Submit contact form
- `POST /api/analytics/track` - Track user interactions

### Admin Endpoints (Authentication Required)
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout
- `POST /api/auth/change-password` - Change admin password
- `GET /api/messages` - List messages with pagination/filtering
- `GET /api/messages/:id` - Get specific message
- `PATCH /api/messages/:id/read` - Mark message as read
- `DELETE /api/messages/:id` - Delete message
- `GET /api/analytics/dashboard` - Analytics dashboard data
- `GET /api/analytics/charts/:type` - Chart data

## 🤝 Contributing

Your portfolio is now a full-stack application! You can:

1. **Customize Content**: Edit the data in the JavaScript files
2. **Modify Styling**: Update CSS files for design changes  
3. **Add Features**: Extend the API and frontend functionality
4. **Deploy Updates**: Use Docker for consistent deployments

## 📞 Support

If you need help with deployment or customization:

1. Check the logs: `docker-compose logs -f`
2. Verify environment variables in `.env`
3. Ensure database is accessible
4. Check firewall settings for ports 80/443

---

**🎉 Congratulations!** Your professional portfolio website is now ready for production deployment with a complete backend API, admin panel, and Docker containerization. You can now easily deploy it on any server and manage it through the admin interface.