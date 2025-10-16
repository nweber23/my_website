// API Client for interacting with the backend
class ApiClient {
  constructor() {
    // Use environment variable or fallback to current origin
    this.baseUrl = window.location.origin.includes('localhost') 
      ? 'http://localhost:3000' 
      : window.location.origin;
    this.apiBase = `${this.baseUrl}/api`;
    
    this.token = localStorage.getItem('admin_token');
  }

  // Set authentication token
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('admin_token', token);
    } else {
      localStorage.removeItem('admin_token');
    }
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Add auth token if available
    if (this.token) {
      config.headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${this.apiBase}${endpoint}`, config);
      
      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response: ${text}`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Authentication methods
  async login(password) {
    try {
      const data = await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });

      if (data.success && data.token) {
        this.setToken(data.token);
        return { success: true, data };
      }

      return { success: false, error: data.message || 'Login failed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.warn('Logout request failed:', error);
    } finally {
      this.setToken(null);
    }
  }

  async changePassword(currentPassword, newPassword) {
    try {
      const data = await this.request('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      return { success: data.success, error: data.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Message methods
  async submitMessage(messageData) {
    try {
      const data = await this.request('/messages', {
        method: 'POST',
        body: JSON.stringify(messageData),
      });

      return { success: data.success, data: data.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getMessages(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const endpoint = `/messages${queryString ? `?${queryString}` : ''}`;
      const data = await this.request(endpoint);

      return { success: true, data: data.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getMessage(id) {
    try {
      const data = await this.request(`/messages/${id}`);
      return { success: true, data: data.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async markMessageAsRead(id) {
    try {
      const data = await this.request(`/messages/${id}/read`, {
        method: 'PATCH',
      });

      return { success: data.success, data: data.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async markMessagesAsRead(messageIds) {
    try {
      const data = await this.request('/messages/bulk-read', {
        method: 'PATCH',
        body: JSON.stringify({ messageIds }),
      });

      return { success: data.success, data: data.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteMessage(id) {
    try {
      const data = await this.request(`/messages/${id}`, {
        method: 'DELETE',
      });

      return { success: data.success };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteMessages(messageIds) {
    try {
      const data = await this.request('/messages/bulk', {
        method: 'DELETE',
        body: JSON.stringify({ messageIds }),
      });

      return { success: data.success, data: data.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getMessageStats() {
    try {
      const data = await this.request('/messages/stats/summary');
      return { success: true, data: data.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Analytics methods
  async trackEvent(eventType, eventData = {}) {
    try {
      // Don't await this request to avoid blocking UI
      this.request('/analytics/track', {
        method: 'POST',
        body: JSON.stringify({
          event_type: eventType,
          event_data: eventData,
          url: window.location.href,
          referrer: document.referrer,
        }),
      }).catch(error => {
        console.warn('Analytics tracking failed:', error);
      });
    } catch (error) {
      console.warn('Analytics tracking failed:', error);
    }
  }

  async getAnalyticsDashboard() {
    try {
      const data = await this.request('/analytics/dashboard');
      return { success: true, data: data.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getAnalyticsChart(type, params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const endpoint = `/analytics/charts/${type}${queryString ? `?${queryString}` : ''}`;
      const data = await this.request(endpoint);

      return { success: true, data: data.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.token;
  }

  // Utility method to handle API errors consistently
  handleApiError(error) {
    console.error('API Error:', error);
    
    // If token is invalid, clear it
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      this.setToken(null);
      // Redirect to login if on admin page
      if (window.location.pathname.includes('/admin')) {
        window.location.reload();
      }
    }

    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Export for legacy usage
window.apiClient = apiClient;