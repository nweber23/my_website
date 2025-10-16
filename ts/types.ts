// Type definitions for the portfolio website

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  techStack: string[];
  highlights: string[];
  githubUrl: string;
  demoUrl?: string;
  imageUrl?: string;
  featured: boolean;
  order: number;
}

export interface Skill {
  name: string;
  level: number; // 1-100
  category: 'languages' | 'frameworks' | 'tools' | 'concepts';
}

export interface AdminAuth {
  hashedPassword: string;
  sessionToken?: string;
  sessionExpiry?: Date;
  loginAttempts: number;
  lastLoginAttempt: Date;
}

export interface Analytics {
  pageViews: number;
  sectionViews: { [key: string]: number };
  dailyViews: { [date: string]: number };
  messagesCount: number;
  lastUpdated: Date;
}

export interface Settings {
  darkMode: boolean;
  animationsEnabled: boolean;
  contactFormEnabled: boolean;
  analyticsEnabled: boolean;
}

export interface WebsiteData {
  messages: ContactMessage[];
  projects: Project[];
  skills: Skill[];
  adminAuth: AdminAuth;
  analytics: Analytics;
  settings: Settings;
  aboutMe: {
    intro: string;
    quote: string;
    focusAreas: string[];
    interests: string[];
  };
}

export interface FormValidationResult {
  isValid: boolean;
  errors: { [key: string]: string };
}

export interface DashboardStats {
  totalMessages: number;
  unreadMessages: number;
  recentMessages: number;
  totalViews: number;
  weeklyViews: number;
}

export type ThemeMode = 'light' | 'dark';
export type NavigationSection = 'home' | 'about' | 'skills' | 'projects' | 'contact';