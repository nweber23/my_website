/**
 * XP Gamification System
 * Tracks user interactions and rewards XP for exploring the portfolio
 */

class XPSystem {
  constructor() {
    this.storageKey = 'portfolio_xp_data';
    this.cooldownKey = 'portfolio_xp_cooldowns';
    this.sessionId = this.getOrCreateSessionId();
    this.data = this.loadData();
    this.cooldowns = this.loadCooldowns();
    this.eventLog = [];
    this.maxLogSize = 5;

    // XP Configuration - Diverse sources autonomously determined
    this.xpConfig = {
      // Page/Section visits
      visited_home: { xp: 10, cooldown: 60000 },
      visited_about: { xp: 50, cooldown: 3600000 }, // 1 hour
      visited_skills: { xp: 50, cooldown: 3600000 },
      visited_projects: { xp: 100, cooldown: 3600000 },
      visited_contact: { xp: 50, cooldown: 3600000 },

      // Scrolling engagement
      scroll_depth_25: { xp: 15, cooldown: 1800000 }, // 30 min
      scroll_depth_50: { xp: 25, cooldown: 1800000 },
      scroll_depth_75: { xp: 35, cooldown: 1800000 },
      scroll_depth_100: { xp: 50, cooldown: 1800000 },

      // Time on site
      time_on_site_1min: { xp: 20, cooldown: 0 },
      time_on_site_3min: { xp: 40, cooldown: 0 },
      time_on_site_5min: { xp: 60, cooldown: 0 },
      time_on_site_10min: { xp: 100, cooldown: 0 },

      // Interactions
      clicked_project_card: { xp: 30, cooldown: 300000 }, // 5 min
      clicked_github_link: { xp: 40, cooldown: 600000 }, // 10 min
      clicked_linkedin: { xp: 40, cooldown: 600000 },
      clicked_external_link: { xp: 25, cooldown: 300000 },
      hovered_skill_badge: { xp: 5, cooldown: 60000 }, // 1 min

      // Contact form
      opened_contact_form: { xp: 20, cooldown: 3600000 },
      filled_contact_field: { xp: 10, cooldown: 120000 }, // 2 min
      submitted_contact_form: { xp: 200, cooldown: 86400000 }, // 24 hours

      // Theme/UI interactions
      toggled_theme: { xp: 15, cooldown: 300000 },
      opened_mobile_menu: { xp: 10, cooldown: 300000 },

      // Special achievements
      visited_all_sections: { xp: 150, cooldown: 0 },
      return_visitor: { xp: 50, cooldown: 43200000 }, // 12 hours
      night_owl: { xp: 75, cooldown: 86400000 }, // Visit between 10pm-6am
      early_bird: { xp: 75, cooldown: 86400000 }, // Visit between 5am-8am
      speed_reader: { xp: 100, cooldown: 86400000 }, // Complete site < 2min

      // Easter eggs
      konami_code: { xp: 500, cooldown: 0 }, // Once only
      found_secret_message: { xp: 250, cooldown: 0 },
      triple_click_logo: { xp: 150, cooldown: 0 },

      // Reading content
      read_about_section: { xp: 40, cooldown: 3600000 },
      read_project_description: { xp: 35, cooldown: 300000 },
      expanded_skill_details: { xp: 20, cooldown: 600000 },

      // Social engagement
      watched_animation_complete: { xp: 30, cooldown: 1800000 },
      viewed_code_window: { xp: 25, cooldown: 3600000 },

      // Streaks
      daily_streak_2: { xp: 100, cooldown: 0 },
      daily_streak_5: { xp: 250, cooldown: 0 },
      daily_streak_7: { xp: 500, cooldown: 0 },
    };

    // Level thresholds (exponential growth)
    this.levelThresholds = this.calculateLevelThresholds(50);

    this.widget = null;
    this.initialized = false;
  }

  // Generate session ID
  getOrCreateSessionId() {
    let sessionId = sessionStorage.getItem('portfolio_session_id');
    if (!sessionId) {
      sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('portfolio_session_id', sessionId);
    }
    return sessionId;
  }

  // Calculate level thresholds (doubles each level)
  calculateLevelThresholds(maxLevel = 50) {
    const thresholds = [0];
    let baseXP = 100;
    for (let i = 1; i <= maxLevel; i++) {
      thresholds.push(thresholds[i - 1] + baseXP);
      baseXP *= 2;
    }
    return thresholds;
  }

  // Load data from localStorage
  loadData() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading XP data:', e);
    }
    return {
      totalXP: 0,
      level: 1,
      sectionsVisited: [],
      firstVisit: Date.now(),
      lastVisit: Date.now(),
      visitCount: 0
    };
  }

  // Save data to localStorage
  saveData() {
    try {
      this.data.lastVisit = Date.now();
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch (e) {
      console.error('Error saving XP data:', e);
    }
  }

  // Load cooldowns
  loadCooldowns() {
    try {
      const stored = localStorage.getItem(this.cooldownKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading cooldowns:', e);
    }
    return {};
  }

  // Save cooldowns
  saveCooldowns() {
    try {
      localStorage.setItem(this.cooldownKey, JSON.stringify(this.cooldowns));
    } catch (e) {
      console.error('Error saving cooldowns:', e);
    }
  }

  // Check if event is on cooldown
  isOnCooldown(event) {
    const lastTime = this.cooldowns[event];
    if (!lastTime) return false;

    const config = this.xpConfig[event];
    if (!config || !config.cooldown) return false;

    const elapsed = Date.now() - lastTime;
    return elapsed < config.cooldown;
  }

  // Add XP for an event
  addXP(event, customAmount = null) {
    const config = this.xpConfig[event];
    if (!config) {
      console.warn(`Unknown XP event: ${event}`);
      return false;
    }

    // Check cooldown
    if (this.isOnCooldown(event)) {
      console.log(`Event ${event} is on cooldown`);
      return false;
    }

    const xpAmount = customAmount || config.xp;
    const oldLevel = this.data.level;

    // Add XP
    this.data.totalXP += xpAmount;

    // Update level
    this.data.level = this.calculateLevel(this.data.totalXP);

    // Set cooldown
    if (config.cooldown > 0) {
      this.cooldowns[event] = Date.now();
      this.saveCooldowns();
    }

    // Save data
    this.saveData();

    // Add to event log
    this.addToEventLog(event, xpAmount);

    // Update widget
    if (this.widget) {
      this.widget.updateDisplay();
      this.widget.animateXPGain(xpAmount);

      // Level up animation
      if (this.data.level > oldLevel) {
        this.widget.showLevelUp(this.data.level);
      }
    }

    // Send to backend (optional, non-blocking)
    this.logToBackend(event, xpAmount);

    return true;
  }

  // Calculate level from total XP
  calculateLevel(totalXP) {
    for (let i = this.levelThresholds.length - 1; i >= 0; i--) {
      if (totalXP >= this.levelThresholds[i]) {
        return i;
      }
    }
    return 1;
  }

  // Get XP progress in current level
  getLevelProgress() {
    const currentLevel = this.data.level;
    const currentThreshold = this.levelThresholds[currentLevel];
    const nextThreshold = this.levelThresholds[currentLevel + 1] || currentThreshold + 100;
    const progressXP = this.data.totalXP - currentThreshold;
    const neededXP = nextThreshold - currentThreshold;
    const percentage = Math.min((progressXP / neededXP) * 100, 100);

    return {
      current: progressXP,
      needed: neededXP,
      percentage: percentage,
      level: currentLevel,
      nextLevel: currentLevel + 1,
      totalXP: this.data.totalXP
    };
  }

  // Add to event log
  addToEventLog(event, xp) {
    this.eventLog.unshift({
      event,
      xp,
      timestamp: Date.now()
    });

    // Keep only last N events
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(0, this.maxLogSize);
    }
  }

  // Log to backend
  async logToBackend(event, xp) {
    try {
      await fetch('/api/xp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': this.sessionId
        },
        body: JSON.stringify({ event, xp })
      });
    } catch (e) {
      // Silently fail - frontend XP still works
      console.debug('Backend XP logging unavailable:', e.message);
    }
  }

  // Get level title
  getLevelTitle(level) {
    const titles = [
      'Visitor', 'Curious Explorer', 'Web Wanderer', 'Code Apprentice',
      'Digital Navigator', 'Portfolio Detective', 'Site Enthusiast', 'Interaction Master',
      'Engagement Expert', 'Experience Guru', 'Web Wizard', 'Interface Sage',
      'Digital Virtuoso', 'Portfolio Legend', 'XP Champion', 'Ultimate Explorer'
    ];

    if (level <= 0) return titles[0];
    if (level >= titles.length) return titles[titles.length - 1];
    return titles[level];
  }

  // Reset XP (for testing)
  resetXP() {
    this.data = {
      totalXP: 0,
      level: 1,
      sectionsVisited: [],
      firstVisit: Date.now(),
      lastVisit: Date.now(),
      visitCount: 0
    };
    this.cooldowns = {};
    this.saveData();
    this.saveCooldowns();
    if (this.widget) {
      this.widget.updateDisplay();
    }
  }

  // Public API
  getXP() {
    return this.data.totalXP;
  }

  getLevel() {
    return this.data.level;
  }

  getData() {
    return this.data;
  }
}

// Export as singleton
const xpSystem = new XPSystem();
export default xpSystem;
