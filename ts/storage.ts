import { WebsiteData, ContactMessage, Project, Skill, Settings, Analytics, AdminAuth } from './types.js';

class StorageManager {
  private readonly STORAGE_KEY = 'portfolioWebsiteData';

  private defaultData: WebsiteData = {
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
      { name: 'Java', level: 70, category: 'languages' },
      { name: 'TypeScript', level: 80, category: 'languages' },
      { name: 'HTML5', level: 85, category: 'languages' },
      { name: 'System Programming', level: 85, category: 'concepts' },
      { name: 'Algorithms & Data Structures', level: 80, category: 'concepts' },
      { name: 'Concurrent Programming', level: 70, category: 'concepts' },
      { name: 'Performance Optimization', level: 75, category: 'concepts' },
      { name: 'Git', level: 85, category: 'tools' },
      { name: 'Linux/Unix', level: 80, category: 'tools' },
      { name: 'GDB', level: 70, category: 'tools' }
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

  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async initializeStorage(): Promise<void> {
    const existingData = this.getData();
    if (!existingData) {
      // Set default admin password hash
      const defaultPasswordHash = await this.hashPassword('admin123');
      this.defaultData.adminAuth.hashedPassword = defaultPasswordHash;
      this.saveData(this.defaultData);
    }
  }

  getData(): WebsiteData | null {
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
      parsed.messages.forEach((msg: any) => {
        msg.timestamp = new Date(msg.timestamp);
      });
      return parsed;
    } catch (error) {
      console.error('Error parsing stored data:', error);
      return null;
    }
  }

  saveData(data: WebsiteData): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }

  addMessage(message: Omit<ContactMessage, 'id' | 'timestamp' | 'isRead'>): void {
    const data = this.getData() || this.defaultData;
    const newMessage: ContactMessage = {
      ...message,
      id: this.generateId(),
      timestamp: new Date(),
      isRead: false
    };
    data.messages.unshift(newMessage); // Add to beginning for chronological order
    data.analytics.messagesCount++;
    this.saveData(data);
  }

  markMessageAsRead(messageId: string): void {
    const data = this.getData();
    if (!data) return;

    const message = data.messages.find(m => m.id === messageId);
    if (message) {
      message.isRead = true;
      this.saveData(data);
    }
  }

  deleteMessage(messageId: string): void {
    const data = this.getData();
    if (!data) return;

    data.messages = data.messages.filter(m => m.id !== messageId);
    this.saveData(data);
  }

  updateSettings(newSettings: Partial<Settings>): void {
    const data = this.getData();
    if (!data) return;

    data.settings = { ...data.settings, ...newSettings };
    this.saveData(data);
  }

  trackPageView(section?: string): void {
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

  exportData(): string {
    const data = this.getData();
    return JSON.stringify(data, null, 2);
  }

  async importData(jsonData: string): Promise<boolean> {
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

  clearAllData(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private isValidWebsiteData(data: any): boolean {
    return data &&
      Array.isArray(data.messages) &&
      Array.isArray(data.projects) &&
      Array.isArray(data.skills) &&
      data.adminAuth &&
      data.analytics &&
      data.settings;
  }

  // Helper method to get dashboard statistics
  getDashboardStats(): { totalMessages: number; unreadMessages: number; recentMessages: number; totalViews: number; weeklyViews: number } {
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