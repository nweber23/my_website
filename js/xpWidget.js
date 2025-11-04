/**
 * XP Widget - Visual UI component for the XP system
 */

import xpSystem from './xpSystem.js';

class XPWidget {
  constructor() {
    this.container = null;
    this.isCollapsed = localStorage.getItem('xp_widget_collapsed') === 'true';
    this.createWidget();
    this.attachToSystem();
  }
  
  createWidget() {
    // Create widget container
    this.container = document.createElement('div');
    this.container.id = 'xp-widget';
    this.container.className = 'xp-widget';
    if (this.isCollapsed) {
      this.container.classList.add('collapsed');
    }
    
    // Widget HTML
    this.container.innerHTML = `
      <div class="xp-widget-header">
        <div class="xp-widget-title">
          <span class="xp-icon">⚡</span>
          <span class="xp-level-text">Level <span id="xp-level">1</span></span>
        </div>
        <button class="xp-toggle-btn" aria-label="Toggle XP Widget">
          <span class="toggle-icon">−</span>
        </button>
      </div>
      
      <div class="xp-widget-content">
        <div class="xp-level-info">
          <div class="xp-level-title" id="xp-level-title">Visitor</div>
          <div class="xp-stats">
            <span id="xp-current">0</span> / <span id="xp-needed">100</span> XP
          </div>
        </div>
        
        <div class="xp-progress-container">
          <div class="xp-progress-bar" id="xp-progress-bar">
            <div class="xp-progress-fill" id="xp-progress-fill" style="width: 0%"></div>
            <div class="xp-progress-glow"></div>
          </div>
          <div class="xp-percentage" id="xp-percentage">0%</div>
        </div>
        
        <div class="xp-event-log" id="xp-event-log">
          <div class="xp-log-title">Recent Activity</div>
          <div class="xp-log-items" id="xp-log-items">
            <div class="xp-log-empty">Start exploring to earn XP!</div>
          </div>
        </div>
      </div>
      
      <div class="xp-floating-text" id="xp-floating-text"></div>
    `;
    
    // Append to body
    document.body.appendChild(this.container);
    
    // Setup event listeners
    this.setupListeners();
    
    // Initial update
    this.updateDisplay();
  }
  
  attachToSystem() {
    xpSystem.widget = this;
  }
  
  setupListeners() {
    const toggleBtn = this.container.querySelector('.xp-toggle-btn');
    toggleBtn.addEventListener('click', () => this.toggleCollapse());
  }
  
  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    this.container.classList.toggle('collapsed', this.isCollapsed);
    localStorage.setItem('xp_widget_collapsed', this.isCollapsed);
    
    const icon = this.container.querySelector('.toggle-icon');
    icon.textContent = this.isCollapsed ? '+' : '−';
  }
  
  updateDisplay() {
    const progress = xpSystem.getLevelProgress();
    const level = progress.level;
    const levelTitle = xpSystem.getLevelTitle(level);
    
    // Update level
    const levelEl = document.getElementById('xp-level');
    if (levelEl) levelEl.textContent = level;
    
    // Update level title
    const levelTitleEl = document.getElementById('xp-level-title');
    if (levelTitleEl) levelTitleEl.textContent = levelTitle;
    
    // Update XP stats
    const currentEl = document.getElementById('xp-current');
    const neededEl = document.getElementById('xp-needed');
    if (currentEl) currentEl.textContent = Math.floor(progress.current);
    if (neededEl) neededEl.textContent = Math.floor(progress.needed);
    
    // Update progress bar
    const progressFill = document.getElementById('xp-progress-fill');
    const percentageEl = document.getElementById('xp-percentage');
    if (progressFill) {
      progressFill.style.width = `${progress.percentage}%`;
    }
    if (percentageEl) {
      percentageEl.textContent = `${Math.floor(progress.percentage)}%`;
    }
    
    // Update event log
    this.updateEventLog();
  }
  
  updateEventLog() {
    const logItems = document.getElementById('xp-log-items');
    if (!logItems) return;
    
    const events = xpSystem.eventLog;
    
    if (events.length === 0) {
      logItems.innerHTML = '<div class="xp-log-empty">Start exploring to earn XP!</div>';
      return;
    }
    
    logItems.innerHTML = events.map(event => {
      const eventName = this.formatEventName(event.event);
      const timeAgo = this.getTimeAgo(event.timestamp);
      return `
        <div class="xp-log-item">
          <span class="xp-log-event">${eventName}</span>
          <span class="xp-log-value">+${event.xp} XP</span>
        </div>
      `;
    }).join('');
  }
  
  formatEventName(event) {
    return event
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
  
  animateXPGain(amount) {
    // Floating text animation
    const floatingText = document.getElementById('xp-floating-text');
    if (!floatingText) return;
    
    const text = document.createElement('div');
    text.className = 'xp-float-item';
    text.textContent = `+${amount} XP`;
    floatingText.appendChild(text);
    
    // Animate
    setTimeout(() => {
      text.style.opacity = '0';
      text.style.transform = 'translateY(-60px)';
    }, 10);
    
    // Remove after animation
    setTimeout(() => {
      text.remove();
    }, 1000);
    
    // Progress bar flash
    const progressFill = document.getElementById('xp-progress-fill');
    if (progressFill) {
      progressFill.classList.add('flash');
      setTimeout(() => {
        progressFill.classList.remove('flash');
      }, 500);
    }
  }
  
  showLevelUp(level) {
    const levelTitle = xpSystem.getLevelTitle(level);
    
    // Create level up overlay
    const overlay = document.createElement('div');
    overlay.className = 'xp-levelup-overlay';
    overlay.innerHTML = `
      <div class="xp-levelup-content">
        <div class="xp-levelup-icon">🎉</div>
        <div class="xp-levelup-title">Level Up!</div>
        <div class="xp-levelup-level">Level ${level}</div>
        <div class="xp-levelup-subtitle">${levelTitle}</div>
        <div class="xp-levelup-particles"></div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Create particles
    this.createLevelUpParticles(overlay.querySelector('.xp-levelup-particles'));
    
    // Animate in
    setTimeout(() => {
      overlay.style.opacity = '1';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    }, 3000);
    
    // Flash widget
    this.container.classList.add('level-up-flash');
    setTimeout(() => {
      this.container.classList.remove('level-up-flash');
    }, 1000);
  }
  
  createLevelUpParticles(container) {
    for (let i = 0; i < 30; i++) {
      const particle = document.createElement('div');
      particle.className = 'xp-particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.top = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 0.5 + 's';
      particle.style.animationDuration = (Math.random() * 1 + 1) + 's';
      container.appendChild(particle);
    }
  }
}

// Initialize widget when DOM is ready
let widgetInstance = null;

function initWidget() {
  if (!widgetInstance && document.body) {
    widgetInstance = new XPWidget();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWidget);
} else {
  initWidget();
}

export default XPWidget;
