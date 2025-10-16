# Niklas Weber - Portfolio Website

A modern, full-stack personal portfolio website with an integrated admin panel. Built with Node.js, Express, PostgreSQL backend and vanilla JavaScript frontend, containerized with Docker for easy deployment.

![Portfolio Preview](https://img.shields.io/badge/Portfolio-Live-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-404D59?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

## ✨ Features

### 🎯 Portfolio Website
- **Modern Design**: Clean, professional aesthetic with smooth animations
- **Dark Mode**: Toggle between light and dark themes with persistent storage
- **Responsive**: Mobile-first design that works perfectly on all devices
- **Interactive**: Smooth scrolling, typing animations, and particle effects
- **Contact Form**: Working contact form with validation and local storage
- **SEO Optimized**: Proper meta tags, semantic HTML, and accessibility features

### 🔒 Admin Panel
- **JWT Authentication**: Secure token-based authentication with session management
- **Dashboard**: Real-time overview of messages, analytics, and key metrics
- **Message Management**: Full CRUD operations with search, filtering, and pagination
- **Analytics Tracking**: Server-side analytics with PostgreSQL persistence
- **Data Management**: Export/import functionality and system administration
- **Mobile Responsive**: Professional admin interface optimized for all devices

### 🏗️ Backend Features
- **RESTful API**: Clean API architecture with Express.js
- **PostgreSQL Database**: Robust data persistence with proper schema design
- **JWT Security**: Secure authentication with token expiration
- **Rate Limiting**: Built-in protection against spam and abuse
- **Input Validation**: Server-side validation for all endpoints
- **CORS Support**: Configurable cross-origin resource sharing

## 🚀 Quick Start

### Prerequisites
- **Node.js** 16+ and npm
- **PostgreSQL** 12+ (or use Docker)
- **Docker** (optional, for containerized deployment)
- Modern web browser with ES6 module support

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/nweber23/portfolio-website.git
   cd portfolio-website
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and JWT secret
   ```

4. **Start PostgreSQL database:**
   
   **Using Docker (recommended):**
   ```bash
   docker-compose up -d postgres
   ```
   
   **Or use your local PostgreSQL installation**

5. **Run database migrations:**
   ```bash
   npm run db:setup
   ```

6. **Start the development server:**
   ```bash
   npm run dev
   ```

7. **Open your browser:**
   - Portfolio: `http://localhost:3000`
   - Admin Panel: `http://localhost:3000/admin.html`

### Docker Deployment

1. **Build and start all services:**
   ```bash
   docker-compose up --build
   ```

2. **For production deployment:**
   ```bash
   docker-compose -f docker-compose.prod.yml up --build -d
   ```

### First-Time Setup

1. **Default admin credentials:**
   - Email: `niklasweber610@gmail.com`
   - Password: `admin123`
   - **Important**: Change password immediately after first login

2. **Access the application:**
   - Portfolio: `http://localhost:3000`
   - Admin Panel: `http://localhost:3000/admin.html`

## 📁 Project Structure

```
portfolio-website/
├── server.js              # Express server entry point
├── package.json           # Node.js dependencies and scripts
├── .env                   # Environment configuration
├── Dockerfile             # Docker container configuration
├── docker-compose.yml     # Docker services orchestration
├── index.html             # Main portfolio page
├── admin.html             # Admin panel interface
├── css/
│   ├── style.css          # Main styles and design system
│   ├── admin.css          # Admin panel specific styles
│   └── responsive.css     # Mobile and tablet responsive styles
├── js/
│   ├── api-client.js      # Frontend API communication
│   ├── main.js            # Portfolio functionality
│   └── admin.js           # Admin panel functionality
├── routes/
│   ├── auth.js            # Authentication endpoints
│   ├── messages.js        # Contact messages API
│   └── analytics.js       # Analytics tracking API
├── database/
│   ├── db.js              # Database connection and utilities
│   └── schema.sql         # Database schema and migrations
├── utils/
│   └── validation.js      # Input validation utilities
└── README.md              # This documentation
```

## 🎨 Customization

### Environment Configuration
Edit `.env` file for your setup:

```bash
# Database Configuration
DB_HOST=localhost
DB_NAME=portfolio_db
DB_USER=your_username
DB_PASSWORD=your_password

# JWT Secret (use a strong secret in production)
JWT_SECRET=your-strong-jwt-secret

# Admin Configuration
ADMIN_EMAIL=your.email@example.com
DEFAULT_ADMIN_PASSWORD=your_secure_password
```

### Styling & Branding
Customize colors and design in `/css/style.css`:

```css
:root {
  --primary-color: #6879F2;    /* Your brand color */
  --secondary-color: #ff6b6b;  /* Accent color */
  --accent-color: #4ecdc4;     /* Additional accent */
  /* ... */
}
```

### Content Management
- Use the admin panel to update projects, skills, and personal information
- Access at `/admin.html` after authentication
- All content is managed through the web interface

## 🔐 Security

### Admin Panel Security
- **Change Default Password**: Always change the default password (`admin123`) immediately
- **Strong Passwords**: Use passwords with at least 6 characters
- **Session Management**: Sessions expire after 24 hours of inactivity
- **Rate Limiting**: Built-in protection against brute force attacks

### Data Storage
- **PostgreSQL Database**: All data stored in robust relational database
- **JWT Authentication**: Secure token-based session management
- **API-First Architecture**: RESTful endpoints for all operations
- **Data Persistence**: Reliable server-side data storage
- **Backup Support**: Database backup and restore capabilities

## 🔠 Development

### Available Scripts

```bash
npm run dev          # Start development server with hot reload
npm run start        # Start production server
npm run db:setup     # Initialize database schema
npm run db:migrate   # Run database migrations
npm run test         # Run test suite (if available)
```

### API Endpoints

**Authentication:**
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout
- `POST /api/auth/change-password` - Change admin password

**Messages:**
- `GET /api/messages` - Get all messages (admin only)
- `POST /api/messages` - Submit contact form
- `PUT /api/messages/:id` - Update message status
- `DELETE /api/messages/:id` - Delete message

**Analytics:**
- `POST /api/analytics/track` - Track page view
- `GET /api/analytics/stats` - Get analytics data (admin only)

## 📈 Database Schema

### Core Tables
- **messages**: Contact form submissions
- **analytics_events**: Page view and interaction tracking
- **admin_sessions**: JWT session management
- **settings**: Application configuration

## 🎯 Performance

### Optimization Features
- **Vanilla JavaScript**: No framework overhead
- **CSS Grid/Flexbox**: Modern layout techniques
- **Lazy Loading**: Animations trigger on scroll
- **Local Storage**: Fast data persistence
- **Minified Assets**: Optimized for production

### Loading Strategy
- Critical CSS inlined
- Non-critical CSS loaded asynchronously
- JavaScript modules loaded on demand
- Images optimized for web

## 🔧 Troubleshooting

### Common Issues

**1. Blank Page or Script Errors**
- Ensure you're using a web server, not opening files directly
- Check browser console for JavaScript errors
- Verify all files are in the correct directory structure

**2. Database Connection Issues**
- Ensure PostgreSQL is running and accessible
- Verify database credentials in `.env` file
- Check if database schema has been initialized with `npm run db:setup`

**3. Admin Panel Login Issues**
- Try the default credentials: `niklasweber610@gmail.com` / `admin123`
- Verify JWT_SECRET is set in `.env` file
- Check server logs for authentication errors

**4. API Errors**
- Ensure backend server is running on correct port
- Check CORS configuration in environment variables
- Verify API endpoints are accessible

**5. Styles Not Loading**
- Verify CSS files are being served correctly
- Check network tab for 404 errors
- Clear browser cache and refresh

### Development Reset
To reset development environment:
1. Stop all services: `docker-compose down`
2. Remove volumes: `docker-compose down -v`
3. Rebuild: `docker-compose up --build`

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Feel free to fork this project and customize it for your own portfolio needs. If you make improvements that could benefit others, pull requests are welcome!

## 📞 Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Review server and browser console logs
3. Ensure all environment variables are properly configured
4. Verify database connectivity

---

**Built with ❤️ by Niklas Weber**

*Personal portfolio showcasing systems programming expertise*
