import { auth } from './auth.js';
import { storage } from './storage.js';

class AdminPanel {
  constructor() {
    this.currentSection = 'dashboard';
    this.selectedMessages = new Set();
    this.isNavOpen = false;
    this.init();
  }

  async init() {
    await storage.initializeStorage();
    this.checkAuthStatus();
    this.setupEventListeners();
  }

  checkAuthStatus() {
    if (auth.isLoggedIn()) {
      this.showAdminPanel();
      this.loadDashboard();
    } else {
      this.showLoginScreen();
    }
  }

  setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('login-form');
    loginForm?.addEventListener('submit', (e) => this.handleLogin(e));

    // Password toggle
    const passwordToggle = document.getElementById('password-toggle');
    passwordToggle?.addEventListener('click', () => this.togglePasswordVisibility());

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn?.addEventListener('click', () => this.handleLogout());

    // Navigation
    const navLinks = document.querySelectorAll('.nav-link[data-section]');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.getAttribute('data-section');
        if (section) this.switchSection(section);
      });
    });

    // Mobile navigation
    const mobileToggle = document.getElementById('mobile-nav-toggle');
    mobileToggle?.addEventListener('click', () => this.toggleMobileNav());

    // Theme toggle
    const themeToggle = document.getElementById('admin-theme-toggle');
    themeToggle?.addEventListener('click', () => this.toggleTheme());

    // Messages functionality
    this.setupMessagesEventListeners();

    // Settings functionality
    this.setupSettingsEventListeners();

    // Dashboard functionality
    this.setupDashboardEventListeners();

    // Modal functionality
    this.setupModalEventListeners();
  }

  togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleButton = document.getElementById('password-toggle');
    
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      toggleButton.classList.add('visible');
    } else {
      passwordInput.type = 'password';
      toggleButton.classList.remove('visible');
    }
  }

  setupMessagesEventListeners() {
    // Search and filter
    const searchInput = document.getElementById('messages-search');
    const filterSelect = document.getElementById('messages-filter');
    
    searchInput?.addEventListener('input', () => this.filterMessages());
    filterSelect?.addEventListener('change', () => this.filterMessages());

    // Select all checkbox
    const selectAllCheckbox = document.getElementById('select-all-messages');
    selectAllCheckbox?.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      this.toggleAllMessages(isChecked);
    });

    // Delete selected button
    const deleteSelectedBtn = document.getElementById('delete-selected');
    deleteSelectedBtn?.addEventListener('click', () => this.deleteSelectedMessages());
  }

  setupSettingsEventListeners() {
    // Password form
    const passwordForm = document.getElementById('password-form');
    passwordForm?.addEventListener('submit', (e) => this.handlePasswordChange(e));

    // Data management
    const exportBtn = document.getElementById('export-data');
    const importBtn = document.getElementById('import-data');
    const importFile = document.getElementById('import-file');
    const clearDataBtn = document.getElementById('clear-data');

    exportBtn?.addEventListener('click', () => this.exportData());
    importBtn?.addEventListener('click', () => importFile?.click());
    importFile?.addEventListener('change', (e) => this.handleImportData(e));
    clearDataBtn?.addEventListener('click', () => this.confirmClearData());
  }

  setupDashboardEventListeners() {
    const viewAllMessagesBtn = document.getElementById('view-all-messages');
    viewAllMessagesBtn?.addEventListener('click', () => this.switchSection('messages'));
  }

  setupModalEventListeners() {
    // Message modal
    const messageModal = document.getElementById('message-modal');
    const modalClose = document.getElementById('modal-close');
    const modalMarkRead = document.getElementById('modal-mark-read');
    const modalDelete = document.getElementById('modal-delete');
    const modalReply = document.getElementById('modal-reply');

    modalClose?.addEventListener('click', () => this.closeModal('message-modal'));
    modalMarkRead?.addEventListener('click', () => this.markModalMessageAsRead());
    modalDelete?.addEventListener('click', () => this.deleteModalMessage());
    modalReply?.addEventListener('click', () => this.replyToMessage());

    // Confirmation modal
    const confirmModal = document.getElementById('confirm-modal');
    const confirmCancel = document.getElementById('confirm-cancel');
    const confirmOk = document.getElementById('confirm-ok');

    confirmCancel?.addEventListener('click', () => this.closeModal('confirm-modal'));
    confirmOk?.addEventListener('click', () => this.handleConfirmAction());

    // Close modal when clicking outside
    [messageModal, confirmModal].forEach(modal => {
      modal?.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal(modal.id);
      });
    });
  }

  // Authentication
  async handleLogin(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const password = formData.get('password');
    const loginBtn = document.getElementById('login-btn');
    const errorElement = document.getElementById('password-error');

    // Clear previous errors
    errorElement.textContent = '';
    errorElement.classList.remove('show');

    // Show loading state
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;

    try {
      console.log('Attempting login with admin panel...');
      const result = await auth.login(password);
      
      if (result.success) {
        console.log('Login successful, showing admin panel');
        this.showAdminPanel();
        this.loadDashboard();
        form.reset();
      } else {
        console.log('Login failed:', result.error);
        errorElement.textContent = result.error || 'Login failed';
        errorElement.classList.add('show');
      }
    } catch (error) {
      console.error('Login error:', error);
      errorElement.textContent = 'An error occurred during login';
      errorElement.classList.add('show');
    } finally {
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
    }
  }

  handleLogout() {
    auth.logout();
    this.showLoginScreen();
  }

  showLoginScreen() {
    document.getElementById('login-container').style.display = 'flex';
    document.getElementById('admin-panel').style.display = 'none';
  }

  showAdminPanel() {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'flex';
    this.setupTheme();
  }

  setupTheme() {
    const savedTheme = localStorage.getItem('portfolio-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('portfolio-theme', newTheme);
    storage.updateSettings({ darkMode: newTheme === 'dark' });
  }

  // Navigation
  switchSection(section) {
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`)?.classList.add('active');

    // Update sections
    document.querySelectorAll('.admin-section').forEach(sec => {
      sec.classList.remove('active');
    });
    document.getElementById(`${section}-section`)?.classList.add('active');

    // Update page title
    const titles = {
      dashboard: 'Dashboard',
      messages: 'Messages',
      analytics: 'Analytics',
      settings: 'Settings'
    };
    
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = titles[section] || section;

    this.currentSection = section;

    // Load section-specific data
    switch (section) {
      case 'dashboard':
        this.loadDashboard();
        break;
      case 'messages':
        this.loadMessages();
        break;
      case 'analytics':
        this.loadAnalytics();
        break;
      case 'settings':
        this.loadSettings();
        break;
    }

    // Close mobile navigation
    this.closeMobileNav();
  }

  toggleMobileNav() {
    const nav = document.querySelector('.admin-nav');
    this.isNavOpen = !this.isNavOpen;
    nav?.classList.toggle('active', this.isNavOpen);
  }

  closeMobileNav() {
    const nav = document.querySelector('.admin-nav');
    this.isNavOpen = false;
    nav?.classList.remove('active');
  }

  // Dashboard
  loadDashboard() {
    const stats = storage.getDashboardStats();
    this.updateDashboardStats(stats);
    this.loadRecentMessages();
    this.updateUnreadBadge(stats.unreadMessages);
  }

  updateDashboardStats(stats) {
    document.getElementById('total-messages').textContent = stats.totalMessages.toString();
    document.getElementById('unread-messages').textContent = stats.unreadMessages.toString();
    document.getElementById('total-views').textContent = stats.totalViews.toString();
    document.getElementById('weekly-views').textContent = stats.weeklyViews.toString();
  }

  updateUnreadBadge(count) {
    const badge = document.getElementById('unread-badge');
    if (badge) {
      if (count > 0) {
        badge.textContent = count.toString();
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  loadRecentMessages() {
    const data = storage.getData();
    if (!data) return;

    const recentMessages = data.messages
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 5);

    const container = document.getElementById('recent-messages-list');
    if (!container) return;

    if (recentMessages.length === 0) {
      container.innerHTML = '<p class="no-data">No messages yet</p>';
      return;
    }

    container.innerHTML = recentMessages.map(message => `
      <div class="activity-item ${!message.isRead ? 'unread' : ''}" data-message-id="${message.id}">
        <div class="activity-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4C22,2.89 21.1,2 20,2Z"/>
          </svg>
        </div>
        <div class="activity-content">
          <div class="activity-title">${message.subject}</div>
          <div class="activity-meta">From ${message.name} • ${this.formatDate(message.timestamp)}</div>
        </div>
      </div>
    `).join('');

    // Add click handlers to recent messages
    container.querySelectorAll('.activity-item').forEach(item => {
      item.addEventListener('click', () => {
        const messageId = item.getAttribute('data-message-id');
        if (messageId) this.showMessageModal(messageId);
      });
    });
  }

  // Messages
  loadMessages() {
    const data = storage.getData();
    if (!data) return;

    this.renderMessagesTable(data.messages);
    this.updateUnreadBadge(data.messages.filter(m => !m.isRead).length);
  }

  renderMessagesTable(messages) {
    const tbody = document.getElementById('messages-tbody');
    if (!tbody) return;

    if (messages.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="no-data">No messages found</td></tr>';
      return;
    }

    tbody.innerHTML = messages
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .map(message => `
        <tr class="${!message.isRead ? 'unread' : ''}" data-message-id="${message.id}">
          <td>
            <input type="checkbox" class="message-checkbox" data-message-id="${message.id}" ${this.selectedMessages.has(message.id) ? 'checked' : ''}>
          </td>
          <td>
            <span class="status-indicator ${!message.isRead ? 'unread' : 'read'}"></span>
          </td>
          <td>${this.escapeHtml(message.name)}</td>
          <td>${this.escapeHtml(message.email)}</td>
          <td class="subject-cell" title="${this.escapeHtml(message.subject)}">${this.truncateText(message.subject, 30)}</td>
          <td>${this.formatDate(message.timestamp)}</td>
          <td>
            <div class="message-actions">
              <button class="action-btn" title="View" onclick="adminPanel.showMessageModal('${message.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>
                </svg>
              </button>
              ${!message.isRead ? `
                <button class="action-btn" title="Mark as read" onclick="adminPanel.markMessageAsRead('${message.id}')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>
                  </svg>
                </button>
              ` : ''}
              <button class="action-btn danger" title="Delete" onclick="adminPanel.deleteMessage('${message.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

    // Add event listeners for checkboxes
    tbody.querySelectorAll('.message-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const messageId = e.target.getAttribute('data-message-id');
        const isChecked = e.target.checked;
        
        if (isChecked) {
          this.selectedMessages.add(messageId);
        } else {
          this.selectedMessages.delete(messageId);
        }
        
        this.updateDeleteSelectedButton();
        this.updateSelectAllCheckbox();
      });
    });
  }

  filterMessages() {
    const searchInput = document.getElementById('messages-search');
    const filterSelect = document.getElementById('messages-filter');
    
    if (!searchInput || !filterSelect) return;

    const data = storage.getData();
    if (!data) return;

    const searchTerm = searchInput.value.toLowerCase();
    const filterValue = filterSelect.value;

    let filteredMessages = data.messages.filter(message => {
      const matchesSearch = !searchTerm || 
        message.name.toLowerCase().includes(searchTerm) ||
        message.email.toLowerCase().includes(searchTerm) ||
        message.subject.toLowerCase().includes(searchTerm) ||
        message.message.toLowerCase().includes(searchTerm);

      const matchesFilter = filterValue === 'all' ||
        (filterValue === 'read' && message.isRead) ||
        (filterValue === 'unread' && !message.isRead);

      return matchesSearch && matchesFilter;
    });

    this.renderMessagesTable(filteredMessages);
  }

  toggleAllMessages(isChecked) {
    const checkboxes = document.querySelectorAll('.message-checkbox');
    
    checkboxes.forEach(checkbox => {
      checkbox.checked = isChecked;
      const messageId = checkbox.getAttribute('data-message-id');
      
      if (isChecked) {
        this.selectedMessages.add(messageId);
      } else {
        this.selectedMessages.delete(messageId);
      }
    });
    
    this.updateDeleteSelectedButton();
  }

  updateDeleteSelectedButton() {
    const deleteBtn = document.getElementById('delete-selected');
    if (deleteBtn) {
      deleteBtn.disabled = this.selectedMessages.size === 0;
    }
  }

  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-messages');
    const checkboxes = document.querySelectorAll('.message-checkbox');
    
    if (selectAllCheckbox && checkboxes.length > 0) {
      const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
      selectAllCheckbox.checked = checkedCount === checkboxes.length;
      selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
    }
  }

  deleteSelectedMessages() {
    if (this.selectedMessages.size === 0) return;

    this.showConfirmDialog(
      'Delete Messages',
      `Are you sure you want to delete ${this.selectedMessages.size} message(s)? This action cannot be undone.`,
      () => {
        this.selectedMessages.forEach(messageId => {
          storage.deleteMessage(messageId);
        });
        this.selectedMessages.clear();
        this.loadMessages();
      }
    );
  }

  // Message Modal
  showMessageModal(messageId) {
    const data = storage.getData();
    if (!data) return;

    const message = data.messages.find(m => m.id === messageId);
    if (!message) return;

    // Update modal content
    document.getElementById('modal-subject').textContent = message.subject;
    document.getElementById('modal-sender').textContent = message.name;
    document.getElementById('modal-email').textContent = message.email;
    document.getElementById('modal-date').textContent = this.formatDate(message.timestamp);
    document.getElementById('modal-message').textContent = message.message;

    // Update modal buttons
    const markReadBtn = document.getElementById('modal-mark-read');
    markReadBtn.style.display = message.isRead ? 'none' : 'inline-flex';
    markReadBtn.setAttribute('data-message-id', messageId);

    const deleteBtn = document.getElementById('modal-delete');
    deleteBtn?.setAttribute('data-message-id', messageId);

    const replyBtn = document.getElementById('modal-reply');
    replyBtn?.setAttribute('data-message-id', messageId);

    // Show modal
    this.showModal('message-modal');

    // Mark as read automatically
    if (!message.isRead) {
      storage.markMessageAsRead(messageId);
      this.loadDashboard();
      this.loadMessages();
    }
  }

  markMessageAsRead(messageId) {
    storage.markMessageAsRead(messageId);
    this.loadMessages();
    this.loadDashboard();
  }

  markModalMessageAsRead() {
    const messageId = document.getElementById('modal-mark-read')?.getAttribute('data-message-id');
    if (messageId) {
      this.markMessageAsRead(messageId);
      this.closeModal('message-modal');
    }
  }

  deleteMessage(messageId) {
    this.showConfirmDialog(
      'Delete Message',
      'Are you sure you want to delete this message? This action cannot be undone.',
      () => {
        storage.deleteMessage(messageId);
        this.loadMessages();
        this.loadDashboard();
      }
    );
  }

  deleteModalMessage() {
    const messageId = document.getElementById('modal-delete')?.getAttribute('data-message-id');
    if (messageId) {
      this.closeModal('message-modal');
      this.deleteMessage(messageId);
    }
  }

  replyToMessage() {
    const messageId = document.getElementById('modal-reply')?.getAttribute('data-message-id');
    const data = storage.getData();
    if (!messageId || !data) return;

    const message = data.messages.find(m => m.id === messageId);
    if (!message) return;

    const subject = `Re: ${message.subject}`;
    const mailtoUrl = `mailto:${message.email}?subject=${encodeURIComponent(subject)}`;
    window.open(mailtoUrl);
  }

  // Analytics
  loadAnalytics() {
    const data = storage.getData();
    if (!data) return;

    this.renderSectionStats(data.analytics.sectionViews);
    this.renderDailyChart(data.analytics.dailyViews);
  }

  renderSectionStats(sectionViews) {
    const container = document.getElementById('section-stats');
    if (!container) return;

    const maxViews = Math.max(...Object.values(sectionViews));
    
    container.innerHTML = Object.entries(sectionViews)
      .map(([section, views]) => {
        const percentage = maxViews > 0 ? (views / maxViews) * 100 : 0;
        return `
          <div class="stat-row">
            <div class="stat-info">
              <span class="stat-name">${this.capitalizeFirst(section)}</span>
              <span class="stat-value">${views} views</span>
            </div>
            <div class="stat-bar">
              <div class="stat-bar-fill" style="width: ${percentage}%"></div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  renderDailyChart(dailyViews) {
    const container = document.getElementById('daily-chart');
    if (!container) return;

    const last7Days = this.getLast7Days();
    const maxViews = Math.max(...last7Days.map(date => dailyViews[date] || 0), 1);

    container.innerHTML = last7Days
      .map(date => {
        const views = dailyViews[date] || 0;
        const height = (views / maxViews) * 100;
        const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
        return `
          <div class="chart-bar" 
               style="height: ${Math.max(height, 2)}%" 
               data-value="${views} views on ${dayName}"
               title="${dayName}: ${views} views">
          </div>
        `;
      })
      .join('');
  }

  getLast7Days() {
    const days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      days.push(date.toISOString().split('T')[0]);
    }
    
    return days;
  }

  // Settings
  loadSettings() {
    const data = storage.getData();
    if (!data) return;

    // System information
    document.getElementById('last-updated').textContent = 
      this.formatDate(data.analytics.lastUpdated);
    
    document.getElementById('data-size').textContent = 
      this.formatFileSize(JSON.stringify(data).length);
    
    document.getElementById('browser-info').textContent = 
      `${navigator.userAgent.match(/(Firefox|Chrome|Safari|Edge)/)?.[0] || 'Unknown'} ${navigator.appVersion.match(/[\d.]+/)?.[0] || ''}`;
  }

  async handlePasswordChange(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const currentPassword = formData.get('currentPassword');
    const newPassword = formData.get('newPassword');
    const confirmPassword = formData.get('confirmPassword');

    if (newPassword !== confirmPassword) {
      alert('New passwords do not match');
      return;
    }

    try {
      const result = await auth.changePassword(currentPassword, newPassword);
      
      if (result.success) {
        alert('Password changed successfully');
        form.reset();
      } else {
        alert(result.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Password change error:', error);
      alert('An error occurred while changing password');
    }
  }

  exportData() {
    const jsonData = storage.exportData();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  async handleImportData(e) {
    const input = e.target;
    const file = input.files?.[0];
    
    if (!file) return;

    try {
      const text = await file.text();
      const success = await storage.importData(text);
      
      if (success) {
        alert('Data imported successfully');
        this.loadDashboard();
      } else {
        alert('Failed to import data. Please check the file format.');
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('An error occurred while importing data');
    }

    input.value = ''; // Reset file input
  }

  confirmClearData() {
    this.showConfirmDialog(
      'Clear All Data',
      'Are you sure you want to clear all data? This will delete all messages, settings, and analytics. This action cannot be undone.',
      () => {
        storage.clearAllData();
        alert('All data has been cleared');
        this.handleLogout();
      }
    );
  }

  // Modal management
  showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal?.classList.add('show');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal?.classList.remove('show');
  }

  showConfirmDialog(title, message, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    
    const confirmOkBtn = document.getElementById('confirm-ok');
    const newBtn = confirmOkBtn.cloneNode(true);
    confirmOkBtn.parentNode.replaceChild(newBtn, confirmOkBtn);
    
    newBtn.addEventListener('click', () => {
      this.closeModal('confirm-modal');
      onConfirm();
    });
    
    this.showModal('confirm-modal');
  }

  handleConfirmAction() {
    // This will be overridden by showConfirmDialog
  }

  // Utility functions
  formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Global instance for onclick handlers
const adminPanel = new AdminPanel();
globalThis.adminPanel = adminPanel;

export default AdminPanel;