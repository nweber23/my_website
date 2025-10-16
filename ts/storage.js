class StorageManager {
  constructor() {
    this.STORAGE_KEY = 'portfolioWebsiteData';
    
    this.defaultData = {
      messages: [],
      projects: [
        {
          id: '1',
          name: 'fract-ol',
          description: 'Interactive fractal visualizer built with C and MLX42. Features real-time zooming, multiple fractal types (Mandelbrot, Julia, Burning Ship), and smooth color gradients.',
          techStack: ['C', 'MLX42', 'Mathematics', 'Computer Graphics'],
          highlights: [
            'Real-time fractal rendering',
            'Interactive zoom and navigation',
            'Multiple fractal algorithms',
            'Optimized for performance'
          ],
          githubUrl: 'https://github.com/nweber23/fract-ol',
          featured: true,
          order: 1
        },
        {
          id: '2',
          name: 'libunit',
          description: 'Minimalist unit testing framework for C projects. Provides simple assertion macros, test organization, and detailed output formatting.',
          techStack: ['C', 'Makefile', 'Testing Framework'],
          highlights: [
            'Lightweight and fast',
            'Simple macro-based API',
            'Colored output',
            'Memory leak detection'
          ],
          githubUrl: 'https://github.com/nweber23/libunit',
          featured: true,
          order: 2
        },
        {
          id: '3',
          name: 'minishell',
          description: 'Custom Unix shell implementation with built-in commands, pipe handling, environment variables, and signal management.',
          techStack: ['C', 'Unix System Calls', 'Process Management'],
          highlights: [
            'Built-in commands (cd, echo, pwd, etc.)',
            'Pipe and redirection support',
            'Environment variable handling',
            'Signal processing'
          ],
          githubUrl: 'https://github.com/nweber23/minishell',
          featured: true,
          order: 3
        }
      ],
      skills: [
        { name: 'C', level: 90, category: 'languages' },
        { name: 'C++', level: 75, category: 'languages' },
        { name: 'Java', level: 90, category: 'languages' },
        { name: 'TypeScript', level: 80, category: 'languages' },
        { name: 'HTML5', level: 85, category: 'languages' },
        { name: 'System Programming', level: 85, category: 'concepts' },
        { name: 'Algorithms & Data Structures', level: 80, category: 'concepts' },
        { name: 'Concurrent Programming', level: 70, category: 'concepts' },
        { name: 'Performance Optimization', level: 75, category: 'concepts' },
        { name: 'Git', level: 95, category: 'tools' },
        { name: 'Linux/Unix', level: 92, category: 'tools' },
        { name: 'GDB', level: 88, category: 'tools' },
        { name: 'Makefile', level: 90, category: 'tools' },
        { name: 'Valgrind', level: 85, category: 'tools' }
      ],
      adminAuth: {
        hashedPassword: '', // Will be set on first run
        loginAttempts: 0,
        lastLoginAttempt: new Date()
      },
      analytics: {
        pageViews: 0,
        sectionViews: {
          home: 0,
          about: 0,
          skills: 0,
          projects: 0,
          contact: 0
        },
        dailyViews: {},
        messagesCount: 0,
        lastUpdated: new Date()
      },
      settings: {
        darkMode: false,
        animationsEnabled: true,
        contactFormEnabled: true,
        analyticsEnabled: true
      },
      aboutMe: {
        intro: `Hi! I'm Niklas, a systems programming student at 42 Heilbronn. I'm passionate about low-level computing, algorithm optimization, and building efficient software that makes a difference.`,
        quote: "The best way to learn is to build, break, and rebuild.",
        focusAreas: [
          'Systems Programming',
          'Low-level Computing', 
          'Algorithm Optimization',
          'Performance Engineering'
        ],
        interests: [
          'FC Bayern Munich fan & member',
          'Automotive enthusiast',
          'Open source contributor',
          'Problem solving'
        ]
      }
    };
  }

  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async initializeStorage() {
    const existingData = this.getData();
    if (!existingData) {
      // Set default admin password hash
      console.log('Initializing storage with default password...');
      const defaultPasswordHash = await this.hashPassword('admin123');
      this.defaultData.adminAuth.hashedPassword = defaultPasswordHash;
      this.saveData(this.defaultData);
      console.log('Storage initialized successfully');
    } else {
      // Force update skills data if it's outdated
      if (!existingData.skills.find(s => s.name === 'Makefile' && s.level === 90)) {
        console.log('Updating skills data with new values...');
        existingData.skills = this.defaultData.skills;
        this.saveData(existingData);
      }
    }
  }

  getData() {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) return null;
    
    try {
      const parsed = JSON.parse(data);
      // Convert date strings back to Date objects
      parsed.analytics.lastUpdated = new Date(parsed.analytics.lastUpdated);
      parsed.adminAuth.lastLoginAttempt = new Date(parsed.adminAuth.lastLoginAttempt);
      if (parsed.adminAuth.sessionExpiry) {
        parsed.adminAuth.sessionExpiry = new Date(parsed.adminAuth.sessionExpiry);
      }
      parsed.messages.forEach((msg) => {
        msg.timestamp = new Date(msg.timestamp);
      });
      return parsed;
    } catch (error) {
      console.error('Error parsing stored data:', error);
      return null;
    }
  }

  saveData(data) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }

  addMessage(message) {
    const data = this.getData() || this.defaultData;
    const newMessage = {
      ...message,
      id: this.generateId(),
      timestamp: new Date(),
      isRead: false
    };
    data.messages.unshift(newMessage); // Add to beginning for chronological order
    data.analytics.messagesCount++;
    this.saveData(data);
  }

  markMessageAsRead(messageId) {
    const data = this.getData();
    if (!data) return;
    
    const message = data.messages.find(m => m.id === messageId);
    if (message) {
      message.isRead = true;
      this.saveData(data);
    }
  }

  deleteMessage(messageId) {
    const data = this.getData();
    if (!data) return;
    
    data.messages = data.messages.filter(m => m.id !== messageId);
    this.saveData(data);
  }

  updateSettings(newSettings) {
    const data = this.getData();
    if (!data) return;
    
    data.settings = { ...data.settings, ...newSettings };
    this.saveData(data);
  }

  trackPageView(section) {
    const data = this.getData();
    if (!data || !data.settings.analyticsEnabled) return;
    
    data.analytics.pageViews++;
    const today = new Date().toISOString().split('T')[0];
    data.analytics.dailyViews[today] = (data.analytics.dailyViews[today] || 0) + 1;
    
    if (section) {
      data.analytics.sectionViews[section]++;
    }
    
    data.analytics.lastUpdated = new Date();
    this.saveData(data);
  }

  exportData() {
    const data = this.getData();
    return JSON.stringify(data, null, 2);
  }

  async importData(jsonData) {
    try {
      const importedData = JSON.parse(jsonData);
      // Validate the structure
      if (this.isValidWebsiteData(importedData)) {
        this.saveData(importedData);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  clearAllData() {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  isValidWebsiteData(data) {
    return data &&
      Array.isArray(data.messages) &&
      Array.isArray(data.projects) &&
      Array.isArray(data.skills) &&
      data.adminAuth &&
      data.analytics &&
      data.settings;
  }

  // Helper method to get dashboard statistics
  getDashboardStats() {
    const data = this.getData();
    if (!data) return { totalMessages: 0, unreadMessages: 0, recentMessages: 0, totalViews: 0, weeklyViews: 0 };

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const recentMessages = data.messages.filter(m => m.timestamp > weekAgo).length;
    const unreadMessages = data.messages.filter(m => !m.isRead).length;
    
    const weeklyViews = Object.entries(data.analytics.dailyViews)
      .filter(([date]) => new Date(date) > weekAgo)
      .reduce((sum, [, views]) => sum + views, 0);

    return {
      totalMessages: data.messages.length,
      unreadMessages,
      recentMessages,
      totalViews: data.analytics.pageViews,
      weeklyViews
    };
  }
}

export const storage = new StorageManager();