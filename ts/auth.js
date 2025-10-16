import { storage } from './storage.js';

class AuthManager {
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  private readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private generateSessionToken(): string {
    return crypto.getRandomValues(new Uint32Array(4)).join('');
  }

  async login(password: string): Promise<{ success: boolean; error?: string }> {
    const data = storage.getData();
    if (!data) {
      return { success: false, error: 'System not initialized' };
    }

    const auth = data.adminAuth;
    const now = new Date();

    // Check if account is locked
    if (auth.loginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      const timeSinceLastAttempt = now.getTime() - auth.lastLoginAttempt.getTime();
      if (timeSinceLastAttempt < this.LOCKOUT_DURATION) {
        const remainingTime = Math.ceil((this.LOCKOUT_DURATION - timeSinceLastAttempt) / 60000);
        return { 
          success: false, 
          error: `Account locked. Try again in ${remainingTime} minute(s).` 
        };
      } else {
        // Reset attempts after lockout period
        auth.loginAttempts = 0;
      }
    }

    const hashedInput = await this.hashPassword(password);
    
    if (hashedInput === auth.hashedPassword) {
      // Successful login
      auth.loginAttempts = 0;
      auth.sessionToken = this.generateSessionToken();
      auth.sessionExpiry = new Date(now.getTime() + this.SESSION_DURATION);
      storage.saveData(data);
      
      return { success: true };
    } else {
      // Failed login
      auth.loginAttempts++;
      auth.lastLoginAttempt = now;
      storage.saveData(data);
      
      const remainingAttempts = this.MAX_LOGIN_ATTEMPTS - auth.loginAttempts;
      if (remainingAttempts > 0) {
        return { 
          success: false, 
          error: `Invalid password. ${remainingAttempts} attempt(s) remaining.` 
        };
      } else {
        return { 
          success: false, 
          error: `Too many failed attempts. Account locked for ${this.LOCKOUT_DURATION / 60000} minutes.` 
        };
      }
    }
  }

  isLoggedIn(): boolean {
    const data = storage.getData();
    if (!data || !data.adminAuth.sessionToken || !data.adminAuth.sessionExpiry) {
      return false;
    }

    const now = new Date();
    return now < data.adminAuth.sessionExpiry;
  }

  logout(): void {
    const data = storage.getData();
    if (data) {
      data.adminAuth.sessionToken = undefined;
      data.adminAuth.sessionExpiry = undefined;
      storage.saveData(data);
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isLoggedIn()) {
      return { success: false, error: 'Not authenticated' };
    }

    if (newPassword.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long' };
    }

    const data = storage.getData();
    if (!data) {
      return { success: false, error: 'System error' };
    }

    const currentHash = await this.hashPassword(currentPassword);
    if (currentHash !== data.adminAuth.hashedPassword) {
      return { success: false, error: 'Current password is incorrect' };
    }

    const newHash = await this.hashPassword(newPassword);
    data.adminAuth.hashedPassword = newHash;
    storage.saveData(data);

    return { success: true };
  }

  getSessionInfo(): { isLoggedIn: boolean; expiryTime?: Date; remainingTime?: number } {
    const data = storage.getData();
    if (!data || !this.isLoggedIn()) {
      return { isLoggedIn: false };
    }

    const expiryTime = data.adminAuth.sessionExpiry!;
    const remainingTime = expiryTime.getTime() - new Date().getTime();

    return {
      isLoggedIn: true,
      expiryTime,
      remainingTime
    };
  }

  extendSession(): void {
    if (!this.isLoggedIn()) return;

    const data = storage.getData();
    if (data && data.adminAuth.sessionExpiry) {
      const now = new Date();
      data.adminAuth.sessionExpiry = new Date(now.getTime() + this.SESSION_DURATION);
      storage.saveData(data);
    }
  }
}

export const auth = new AuthManager();