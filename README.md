# Personal Portfolio Website with Admin Panel

A modern, professional personal portfolio website with an integrated admin panel for managing content and messages. Built with vanilla HTML, CSS, and TypeScript for optimal performance and simplicity.

![Portfolio Preview](https://img.shields.io/badge/Portfolio-Live-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)

## ✨ Features

### 🎯 Portfolio Website
- **Modern Design**: Clean, professional aesthetic with smooth animations
- **Dark Mode**: Toggle between light and dark themes with persistent storage
- **Responsive**: Mobile-first design that works perfectly on all devices
- **Interactive**: Smooth scrolling, typing animations, and particle effects
- **Contact Form**: Working contact form with validation and local storage
- **SEO Optimized**: Proper meta tags, semantic HTML, and accessibility features

### 🔒 Admin Panel
- **Secure Authentication**: Password-protected access with session management
- **Dashboard**: Overview of messages, analytics, and key metrics
- **Message Management**: View, search, filter, and manage contact form submissions
- **Analytics**: Track page views, section visits, and user engagement
- **Data Management**: Export/import functionality and system settings
- **Mobile Friendly**: Responsive admin interface for on-the-go management

## 🚀 Quick Start

### Prerequisites
- A modern web browser that supports ES6 modules
- A local web server (for development)

### Installation

1. **Clone or download** this repository to your desired directory:
   ```bash
   cd "/path/to/your/projects"
   git clone <your-repo-url> my_website
   # OR download and extract the files
   ```

2. **Start a local web server** in the project directory:
   
   **Using Python:**
   ```bash
   cd my_website
   python -m http.server 8000
   ```
   
   **Using Node.js (npx):**
   ```bash
   cd my_website
   npx serve .
   ```
   
   **Using PHP:**
   ```bash
   cd my_website
   php -S localhost:8000
   ```

3. **Open your browser** and navigate to:
   - Portfolio: `http://localhost:8000`
   - Admin Panel: `http://localhost:8000/admin.html`

### First-Time Setup

1. **Access the Admin Panel**: 
   - Go to `http://localhost:8000/admin.html`
   - Use the default password: `admin123`
   - **Important**: Change this password immediately after first login

2. **Customize Your Content**:
   - Update personal information in the TypeScript files
   - Replace placeholder GitHub URLs with your actual repositories
   - Add your real email address and contact information

## 📁 Project Structure

```
my_website/
├── index.html              # Main portfolio page
├── admin.html              # Admin panel interface
├── css/
│   ├── style.css          # Main styles and CSS variables
│   ├── admin.css          # Admin panel specific styles
│   └── responsive.css     # Mobile and tablet responsive styles
├── ts/
│   ├── types.ts           # TypeScript interface definitions
│   ├── storage.ts         # Local storage utilities and data management
│   ├── auth.ts            # Authentication and session management
│   ├── main.ts            # Portfolio functionality
│   └── admin.ts           # Admin panel functionality
├── assets/
│   └── images/            # Image assets (add your own)
└── README.md              # This file
```

## 🎨 Customization

### Personal Information
Edit the default data in `/ts/storage.ts`:

```typescript
aboutMe: {
  intro: "Your introduction text here...",
  quote: "Your personal quote",
  focusAreas: ["Your", "Focus", "Areas"],
  interests: ["Your", "Personal", "Interests"]
}
```

### Projects
Update the projects array in `/ts/storage.ts`:

```typescript
projects: [
  {
    name: 'Your Project Name',
    description: 'Project description...',
    techStack: ['Tech1', 'Tech2'],
    highlights: ['Feature 1', 'Feature 2'],
    githubUrl: 'https://github.com/yourusername/project',
    featured: true,
    order: 1
  }
]
```

### Styling
Customize colors and design in `/css/style.css`:

```css
:root {
  --primary-color: #00599C;    /* Your brand color */
  --secondary-color: #ff6b6b;  /* Accent color */
  --accent-color: #4ecdc4;     /* Additional accent */
  /* ... */
}
```

### Contact Information
Update contact details in `/index.html`:

```html
<div class="contact-details">
  <h4>Email</h4>
  <p>your.email@example.com</p>
</div>
```

## 🔐 Security

### Admin Panel Security
- **Change Default Password**: Always change the default password (`admin123`) immediately
- **Strong Passwords**: Use passwords with at least 6 characters
- **Session Management**: Sessions expire after 24 hours of inactivity
- **Rate Limiting**: Built-in protection against brute force attacks

### Data Storage
- All data is stored locally in the browser's localStorage
- No server-side storage or external dependencies
- Data persists between browser sessions
- Export functionality for backup purposes

## 📱 Browser Compatibility

- **Chrome/Chromium**: 88+
- **Firefox**: 85+
- **Safari**: 14+
- **Edge**: 88+

### Required Browser Features
- ES6 Module support
- CSS Grid and Flexbox
- Local Storage API
- Fetch API
- CSS Custom Properties

## 🛠️ Development

### TypeScript Compilation
This project uses TypeScript with ES6 modules. For development:

1. **Install TypeScript** (optional, for type checking):
   ```bash
   npm install -g typescript
   ```

2. **Type Check** (optional):
   ```bash
   tsc --noEmit --checkJs ts/*.ts
   ```

### File Serving Requirements
- Must be served over HTTP/HTTPS (not file://)
- Required for ES6 module imports to work
- Use any local development server

## 📊 Analytics & Data

### Local Storage Schema
```typescript
{
  messages: ContactMessage[],        // Contact form submissions
  projects: Project[],              // Portfolio projects
  skills: Skill[],                  // Technical skills
  adminAuth: AdminAuth,             // Authentication data
  analytics: Analytics,             // Page view statistics
  settings: Settings,               // User preferences
  aboutMe: AboutMe                  // Personal information
}
```

### Data Export/Import
- **Export**: Download all data as JSON file
- **Import**: Upload previously exported JSON file
- **Clear**: Remove all stored data (requires confirmation)

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

**2. Admin Panel Login Issues**
- Try the default password: `admin123`
- Clear browser localStorage if corrupted
- Check for JavaScript errors in browser console

**3. Styles Not Loading**
- Verify CSS files are in the `/css/` directory
- Check browser network tab for 404 errors
- Clear browser cache

**4. Contact Form Not Working**
- Ensure JavaScript is enabled
- Check browser localStorage permissions
- Verify form validation in browser console

### Reset Everything
If you need to start fresh:
1. Clear browser localStorage for the site
2. Or use the "Clear All Data" button in admin settings
3. Refresh the page

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Feel free to fork this project and customize it for your own portfolio needs. If you make improvements that could benefit others, pull requests are welcome!

## 📞 Support

If you encounter any issues or have questions:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Ensure all files are properly structured
4. Verify you're using a supported browser

---

**Made with ❤️ for the 42 Heilbronn community**

*"The best way to learn is to build, break, and rebuild."*