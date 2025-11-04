import { apiClient } from './api-client.js';

class AdminPanel {
  constructor() {
    this.currentSection = 'dashboard';
    this.selectedMessages = new Set();
    this.isNavOpen = false;
    this.init();
  }

  async init() {
    this.checkAuthStatus();
    this.setupEventListeners();
  }

  checkAuthStatus() {
    if (apiClient.isAuthenticated()) {
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
    const clearDataBtn = document.getElementById('clear-data');

    exportBtn?.addEventListener('click', () => this.exportData());
    clearDataBtn?.addEventListener('click', () => this.confirmClearData());
  }

  setupDashboardEventListeners() {
    const viewAllMessagesBtn = document.getElementById('view-all-messages');
    viewAllMessagesBtn?.addEventListener('click', () => this.switchSection('messages'));

    // Analytics retry button
    const retryAnalyticsBtn = document.getElementById('retry-analytics');
    retryAnalyticsBtn?.addEventListener('click', () => this.loadAnalytics());

    // Quick actions navigation
    const quickActions = document.querySelectorAll('.quick-action-item[data-section]');
    quickActions.forEach(action => {
      action.addEventListener('click', (e) => {
        e.preventDefault();
        const section = action.getAttribute('data-section');
        if (section) this.switchSection(section);
      });
    });
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
      const result = await apiClient.login(password);

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

  async handleLogout() {
    await apiClient.logout();
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
  async loadDashboard() {
    try {
      // Load message stats
      const statsResult = await apiClient.getMessageStats();
      if (statsResult.success) {
        this.updateDashboardStats(statsResult.data);
        this.updateUnreadBadge(statsResult.data.unread_messages);
      }

      // Load analytics dashboard
      const analyticsResult = await apiClient.getAnalyticsDashboard();
      if (analyticsResult.success) {
        this.updateAnalyticsStats(analyticsResult.data);
      }

      // Load recent messages
      await this.loadRecentMessages();
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  }

  updateDashboardStats(stats) {
    document.getElementById('total-messages').textContent = stats.total_messages.toString();
    document.getElementById('unread-messages').textContent = stats.unread_messages.toString();
    document.getElementById('total-views').textContent = '0'; // Will be updated by analytics
    document.getElementById('weekly-views').textContent = '0'; // Will be updated by analytics
  }

  updateAnalyticsStats(data) {
    const stats = data.summary;
    document.getElementById('total-views').textContent = stats.page_views.toString();
    document.getElementById('weekly-views').textContent = stats.weekly_events.toString();
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

  async loadRecentMessages() {
    try {
      const result = await apiClient.getMessages({ limit: 5, sort: 'created_at', order: 'desc' });

      if (result.success) {
        this.renderRecentMessages(result.data.messages);
      }
    } catch (error) {
      console.error('Error loading recent messages:', error);
    }
  }

  renderRecentMessages(messages) {
    const container = document.getElementById('recent-messages-list');
    if (!container) return;

    if (messages.length === 0) {
      container.innerHTML = '<p class="no-data">No messages yet</p>';
      return;
    }

    container.innerHTML = messages.map(message => `
      <div class="activity-item ${!message.is_read ? 'unread' : ''}" data-message-id="${message.id}">
        <div class="activity-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4C22,2.89 21.1,2 20,2Z"/>
          </svg>
        </div>
        <div class="activity-content">
          <div class="activity-title">${this.escapeHtml(message.subject)}</div>
          <div class="activity-meta">From ${this.escapeHtml(message.name)} • ${this.formatDate(new Date(message.created_at))}</div>
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
  async loadMessages() {
    try {
      const params = {
        page: 1,
        limit: 50,
        sort: 'created_at',
        order: 'desc'
      };

      // Add search and filter parameters
      const searchInput = document.getElementById('messages-search');
      const filterSelect = document.getElementById('messages-filter');

      if (searchInput?.value) {
        params.search = searchInput.value;
      }

      if (filterSelect?.value && filterSelect.value !== 'all') {
        params.filter = filterSelect.value;
      }

      const result = await apiClient.getMessages(params);

      if (result.success) {
        this.renderMessagesTable(result.data.messages);
        this.updateUnreadBadge(result.data.messages.filter(m => !m.is_read).length);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }

  renderMessagesTable(messages) {
    const tbody = document.getElementById('messages-tbody');
    if (!tbody) return;

    if (messages.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="no-data">No messages found</td></tr>';
      return;
    }

    tbody.innerHTML = messages.map(message => `
      <tr class="${!message.is_read ? 'unread' : ''}" data-message-id="${message.id}">
        <td>
          <input type="checkbox" class="message-checkbox" data-message-id="${message.id}" ${this.selectedMessages.has(message.id) ? 'checked' : ''}>
        </td>
        <td>
          <span class="status-indicator ${!message.is_read ? 'unread' : 'read'}"></span>
        </td>
        <td>${this.escapeHtml(message.name)}</td>
        <td>${this.escapeHtml(message.email)}</td>
        <td class="subject-cell" title="${this.escapeHtml(message.subject)}">${this.truncateText(message.subject, 30)}</td>
        <td>${this.formatDate(new Date(message.created_at))}</td>
        <td>
          <div class="message-actions">
            <button class="action-btn view-btn" title="View" data-message-id="${message.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>
              </svg>
            </button>
            ${!message.is_read ? `
              <button class="action-btn mark-read-btn" title="Mark as read" data-message-id="${message.id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>
                </svg>
              </button>
            ` : ''}
            <button class="action-btn danger delete-btn" title="Delete" data-message-id="${message.id}">
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

    // Add event listeners for action buttons
    tbody.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const messageId = e.currentTarget.getAttribute('data-message-id');
        if (messageId) this.showMessageModal(messageId);
      });
    });

    tbody.querySelectorAll('.mark-read-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const messageId = e.currentTarget.getAttribute('data-message-id');
        if (messageId) this.markMessageAsRead(messageId);
      });
    });

    tbody.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const messageId = e.currentTarget.getAttribute('data-message-id');
        if (messageId) this.deleteMessage(messageId);
      });
    });
  }

  async filterMessages() {
    await this.loadMessages();
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

  async deleteSelectedMessages() {
    if (this.selectedMessages.size === 0) return;

    this.showConfirmDialog(
      'Delete Messages',
      `Are you sure you want to delete ${this.selectedMessages.size} message(s)? This action cannot be undone.`,
      async () => {
        try {
          const result = await apiClient.deleteMessages(Array.from(this.selectedMessages));
          if (result.success) {
            this.selectedMessages.clear();
            await this.loadMessages();
            await this.loadDashboard();
          } else {
            alert('Failed to delete messages: ' + result.error);
          }
        } catch (error) {
          console.error('Error deleting messages:', error);
          alert('An error occurred while deleting messages');
        }
      }
    );
  }

  // Message Modal and Actions
  async showMessageModal(messageId) {
    try {
      const result = await apiClient.getMessage(messageId);

      if (result.success) {
        const message = result.data;

        // Update modal content
        document.getElementById('modal-subject').textContent = message.subject;
        document.getElementById('modal-sender').textContent = message.name;
        document.getElementById('modal-email').textContent = message.email;
        document.getElementById('modal-date').textContent = this.formatDate(new Date(message.created_at));
        document.getElementById('modal-message').textContent = message.message;

        // Update modal buttons
        const markReadBtn = document.getElementById('modal-mark-read');
        markReadBtn.style.display = message.is_read ? 'none' : 'inline-flex';
        markReadBtn.setAttribute('data-message-id', messageId);

        const deleteBtn = document.getElementById('modal-delete');
        deleteBtn?.setAttribute('data-message-id', messageId);

        const replyBtn = document.getElementById('modal-reply');
        replyBtn?.setAttribute('data-message-id', messageId);

        // Show modal
        this.showModal('message-modal');

        // Mark as read automatically if not already read
        if (!message.is_read) {
          await apiClient.markMessageAsRead(messageId);
          await this.loadDashboard();
          await this.loadMessages();
        }
      }
    } catch (error) {
      console.error('Error showing message modal:', error);
    }
  }

  async markMessageAsRead(messageId) {
    try {
      const result = await apiClient.markMessageAsRead(messageId);
      if (result.success) {
        await this.loadMessages();
        await this.loadDashboard();
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }

  markModalMessageAsRead() {
    const messageId = document.getElementById('modal-mark-read')?.getAttribute('data-message-id');
    if (messageId) {
      this.markMessageAsRead(messageId);
      this.closeModal('message-modal');
    }
  }

  async deleteMessage(messageId) {
    this.showConfirmDialog(
      'Delete Message',
      'Are you sure you want to delete this message? This action cannot be undone.',
      async () => {
        try {
          const result = await apiClient.deleteMessage(messageId);
          if (result.success) {
            await this.loadMessages();
            await this.loadDashboard();
          } else {
            alert('Failed to delete message: ' + result.error);
          }
        } catch (error) {
          console.error('Error deleting message:', error);
          alert('An error occurred while deleting the message');
        }
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
    if (!messageId) return;

    // Get message data from modal
    const subject = document.getElementById('modal-subject')?.textContent;
    const email = document.getElementById('modal-email')?.textContent;

    if (subject && email) {
      const replySubject = `Re: ${subject}`;
      const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(replySubject)}`;
      window.open(mailtoUrl);
    }
  }

  // Analytics
  async loadAnalytics() {
    const loadingEl = document.getElementById('analytics-loading');
    const errorEl = document.getElementById('analytics-error');
    const statsGrid = document.querySelector('.analytics-stats-grid');
    const chartsGrid = document.querySelector('.analytics-charts-grid');

    try {
      // Show loading state
      if (loadingEl) loadingEl.style.display = 'flex';
      if (errorEl) errorEl.style.display = 'none';
      if (statsGrid) statsGrid.style.display = 'none';
      if (chartsGrid) chartsGrid.style.display = 'none';

      const dashboardResult = await apiClient.getAnalyticsDashboard();

      if (dashboardResult.success) {
        const data = dashboardResult.data;

        // Hide loading, show content
        if (loadingEl) loadingEl.style.display = 'none';
        if (statsGrid) statsGrid.style.display = 'grid';
        if (chartsGrid) chartsGrid.style.display = 'grid';

        // Update overview stats
        this.updateAnalyticsOverview(data.summary);

        // Render charts
        this.renderSectionStats(data.section_views || []);
        this.renderDailyChart(data.daily_views || []);
        this.renderReferrers(data.top_referrers || []);
      } else {
        throw new Error(dashboardResult.error || 'Failed to load analytics');
      }
    } catch (error) {
      console.error('Error loading analytics:', error);

      // Show error state
      if (loadingEl) loadingEl.style.display = 'none';
      if (statsGrid) statsGrid.style.display = 'none';
      if (chartsGrid) chartsGrid.style.display = 'none';
      if (errorEl) {
        errorEl.style.display = 'flex';
        const errorMsg = document.getElementById('analytics-error-message');
        if (errorMsg) errorMsg.textContent = error.message || 'Please try again later.';
      }
    }
  }

  updateAnalyticsOverview(summary) {
    // Total Views
    const totalViews = summary.page_views || 0;
    const totalViewsEl = document.getElementById('analytics-total-views');
    if (totalViewsEl) totalViewsEl.textContent = totalViews.toLocaleString();

    // Unique Visitors
    const uniqueVisitors = summary.unique_visitors || 0;
    const uniqueVisitorsEl = document.getElementById('analytics-unique-visitors');
    if (uniqueVisitorsEl) uniqueVisitorsEl.textContent = uniqueVisitors.toLocaleString();

    // Weekly Views
    const weeklyViews = summary.weekly_events || 0;
    const weeklyViewsEl = document.getElementById('analytics-weekly-views');
    if (weeklyViewsEl) weeklyViewsEl.textContent = weeklyViews.toLocaleString();

    // Daily Views
    const dailyViews = summary.daily_events || 0;
    const dailyViewsEl = document.getElementById('analytics-daily-views');
    if (dailyViewsEl) dailyViewsEl.textContent = dailyViews.toLocaleString();

    // Update change indicators (hide for now since we don't have historical data)
    ['views', 'visitors', 'weekly', 'daily'].forEach(type => {
      const changeEl = document.getElementById(`analytics-${type}-change`);
      if (changeEl) {
        changeEl.querySelector('span').textContent = '';
        changeEl.querySelector('svg')?.remove();
      }
    });
  }

  renderSectionStats(sectionViews) {
    const container = document.getElementById('section-stats');
    if (!container) return;

    if (!sectionViews || sectionViews.length === 0) {
      container.innerHTML = '<p class="no-data" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No section data available</p>';
      return;
    }

    const maxViews = Math.max(...sectionViews.map(s => s.views), 1);

    container.innerHTML = sectionViews
      .slice(0, 5) // Show top 5
      .map(({section, views}) => {
        const percentage = (views / maxViews) * 100;
        return `
          <div class="section-stat-item">
            <div class="section-stat-header">
              <span class="section-stat-name">${this.capitalizeFirst(section || 'Unknown')}</span>
              <span class="section-stat-value">${views.toLocaleString()} views</span>
            </div>
            <div class="section-stat-bar">
              <div class="section-stat-fill" style="width: ${percentage}%"></div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  renderDailyChart(dailyViews) {
    const container = document.getElementById('daily-chart');
    if (!container) return;

    if (!dailyViews || dailyViews.length === 0) {
      container.innerHTML = '<p class="no-data" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No daily data available</p>';
      return;
    }

    const maxViews = Math.max(...dailyViews.map(d => d.views), 1);

    container.innerHTML = dailyViews
      .slice(-7) // Last 7 days
      .map(({date, views}) => {
        const height = Math.max((views / maxViews) * 100, 4);
        const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
        return `
          <div class="chart-bar"
               style="height: ${height}%"
               data-value="${views}"
               data-label="${dayName}"
               title="${dayName}: ${views} views">
          </div>
        `;
      })
      .join('');
  }

  renderReferrers(referrers) {
    const container = document.getElementById('referrers-list');
    if (!container) return;

    if (!referrers || referrers.length === 0) {
      container.innerHTML = '<p class="no-data" style="text-align: center; color: var(--text-secondary); padding: 2rem; grid-column: 1 / -1;">No referrer data available</p>';
      return;
    }

    container.innerHTML = referrers
      .slice(0, 10) // Top 10
      .map(({referrer, visits}) => {
        const displayName = referrer === 'Direct' ? 'Direct' : new URL(referrer || 'https://direct').hostname.replace('www.', '');
        const initial = displayName.charAt(0).toUpperCase();
        return `
          <div class="referrer-item">
            <div class="referrer-icon">${initial}</div>
            <div class="referrer-details">
              <div class="referrer-name" title="${referrer}">${displayName}</div>
              <div class="referrer-visits">${visits.toLocaleString()} visits</div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // Settings
  loadSettings() {
    // System information
    document.getElementById('last-updated').textContent =
      this.formatDate(new Date());

    document.getElementById('data-size').textContent = 'API-based';

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
      const result = await apiClient.changePassword(currentPassword, newPassword);

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

  async exportData() {
    try {
      // For API-based system, we'll just download the messages
      const result = await apiClient.getMessages({ limit: 1000 });
      if (result.success) {
        const jsonData = JSON.stringify(result.data, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `portfolio-messages-${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data');
    }
  }

  confirmClearData() {
    alert('Data clearing is not supported in API mode. Please contact the administrator.');
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