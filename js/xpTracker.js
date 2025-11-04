/**
 * XP Tracker - Automatically tracks user interactions and awards XP
 */

import xpSystem from './xpSystem.js';

class XPTracker {
  constructor() {
    this.initialized = false;
    this.pageLoadTime = Date.now();
    this.scrollDepthReached = {
      25: false,
      50: false,
      75: false,
      100: false
    };
    this.timeCheckpoints = {
      60000: false,    // 1 min
      180000: false,   // 3 min
      300000: false,   // 5 min
      600000: false    // 10 min
    };
    this.konamiCode = [];
    this.konamiPattern = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  }
  
  init() {
    if (this.initialized) return;
    this.initialized = true;
    
    // Track initial visit
    this.trackInitialVisit();
    
    // Setup all event listeners
    this.trackSectionVisits();
    this.trackScrollDepth();
    this.trackTimeOnSite();
    this.trackInteractions();
    this.trackThemeToggle();
    this.trackMobileMenu();
    this.trackContactForm();
    this.trackEasterEggs();
    this.trackSpecialConditions();
    
    console.log('🎮 XP Tracker initialized');
  }
  
  trackInitialVisit() {
    // Award XP for visiting home
    xpSystem.addXP('visited_home', null);
    
    // Check if return visitor
    const data = xpSystem.getData();
    if (data.visitCount > 0) {
      xpSystem.addXP('return_visitor', null);
    }
    
    // Increment visit count
    data.visitCount++;
    xpSystem.saveData();
  }
  
  trackSectionVisits() {
    // Use Intersection Observer to track section visibility
    const sections = ['home', 'about', 'skills', 'projects', 'contact'];
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
          const sectionId = entry.target.id;
          if (sections.includes(sectionId)) {
            this.handleSectionVisit(sectionId);
          }
        }
      });
    }, {
      threshold: [0.3],
      rootMargin: '0px'
    });
    
    sections.forEach(sectionId => {
      const section = document.getElementById(sectionId);
      if (section) {
        observer.observe(section);
      }
    });
  }
  
  handleSectionVisit(sectionId) {
    const eventName = `visited_${sectionId}`;
    const success = xpSystem.addXP(eventName, null);
    
    if (success) {
      // Track section in data
      const data = xpSystem.getData();
      if (!data.sectionsVisited) {
        data.sectionsVisited = [];
      }
      
      if (!data.sectionsVisited.includes(sectionId)) {
        data.sectionsVisited.push(sectionId);
        xpSystem.saveData();
        
        // Check if all sections visited
        if (data.sectionsVisited.length === 5) {
          xpSystem.addXP('visited_all_sections', null);
        }
      }
    }
  }
  
  trackScrollDepth() {
    let ticking = false;
    
    const checkScrollDepth = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollPercentage = (scrollTop / (documentHeight - windowHeight)) * 100;
      
      // Check each depth milestone
      [25, 50, 75, 100].forEach(depth => {
        if (scrollPercentage >= depth && !this.scrollDepthReached[depth]) {
          this.scrollDepthReached[depth] = true;
          xpSystem.addXP(`scroll_depth_${depth}`, null);
        }
      });
      
      ticking = false;
    };
    
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(checkScrollDepth);
        ticking = true;
      }
    });
  }
  
  trackTimeOnSite() {
    // Check time milestones periodically
    setInterval(() => {
      const timeOnSite = Date.now() - this.pageLoadTime;
      
      Object.keys(this.timeCheckpoints).forEach(checkpoint => {
        const time = parseInt(checkpoint);
        if (timeOnSite >= time && !this.timeCheckpoints[checkpoint]) {
          this.timeCheckpoints[checkpoint] = true;
          const minutes = time / 60000;
          xpSystem.addXP(`time_on_site_${minutes}min`, null);
        }
      });
    }, 10000); // Check every 10 seconds
  }
  
  trackInteractions() {
    // Track project card clicks
    document.addEventListener('click', (e) => {
      const projectCard = e.target.closest('.project-card, .project-item');
      if (projectCard) {
        xpSystem.addXP('clicked_project_card', null);
      }
      
      // Track external links
      const link = e.target.closest('a');
      if (link && link.href) {
        if (link.href.includes('github.com')) {
          xpSystem.addXP('clicked_github_link', null);
        } else if (link.href.includes('linkedin.com')) {
          xpSystem.addXP('clicked_linkedin', null);
        } else if (link.target === '_blank') {
          xpSystem.addXP('clicked_external_link', null);
        }
      }
      
      // Track CTA button clicks
      const ctaButton = e.target.closest('.btn-primary, .cta-button');
      if (ctaButton) {
        xpSystem.addXP('clicked_project_card', null);
      }
    });
    
    // Track skill badge hovers
    let hoverTimeout;
    document.addEventListener('mouseover', (e) => {
      const skillBadge = e.target.closest('.skill-badge, .tech-badge, .skill-item');
      if (skillBadge) {
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
          xpSystem.addXP('hovered_skill_badge', null);
        }, 1000); // Must hover for 1 second
      }
    });
    
    document.addEventListener('mouseout', (e) => {
      const skillBadge = e.target.closest('.skill-badge, .tech-badge, .skill-item');
      if (skillBadge) {
        clearTimeout(hoverTimeout);
      }
    });
    
    // Track code window view (if present)
    const codeWindow = document.querySelector('.code-window, .code-content');
    if (codeWindow) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            xpSystem.addXP('viewed_code_window', null);
          }
        });
      }, { threshold: 0.5 });
      observer.observe(codeWindow);
    }
  }
  
  trackThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        xpSystem.addXP('toggled_theme', null);
      });
    }
  }
  
  trackMobileMenu() {
    const navToggle = document.getElementById('nav-toggle');
    if (navToggle) {
      navToggle.addEventListener('click', () => {
        xpSystem.addXP('opened_mobile_menu', null);
      });
    }
  }
  
  trackContactForm() {
    // Track form field interactions
    const formInputs = document.querySelectorAll('input[type="text"], input[type="email"], textarea');
    formInputs.forEach(input => {
      let fieldFilled = false;
      input.addEventListener('focus', () => {
        if (!fieldFilled) {
          xpSystem.addXP('opened_contact_form', null);
        }
      });
      
      input.addEventListener('blur', () => {
        if (input.value.trim().length > 3 && !fieldFilled) {
          fieldFilled = true;
          xpSystem.addXP('filled_contact_field', null);
        }
      });
    });
    
    // Track form submission
    const contactForm = document.querySelector('form[action*="contact"], form[action*="message"]');
    if (contactForm) {
      contactForm.addEventListener('submit', () => {
        xpSystem.addXP('submitted_contact_form', null);
      });
    }
  }
  
  trackEasterEggs() {
    // Konami Code
    document.addEventListener('keydown', (e) => {
      this.konamiCode.push(e.key);
      if (this.konamiCode.length > this.konamiPattern.length) {
        this.konamiCode.shift();
      }
      
      if (JSON.stringify(this.konamiCode) === JSON.stringify(this.konamiPattern)) {
        xpSystem.addXP('konami_code', null);
        this.showSecretMessage('🎮 Konami Code Activated! You are a true gamer!');
        this.konamiCode = [];
      }
    });
    
    // Triple click on logo/name
    let clickCount = 0;
    let clickTimer;
    const logo = document.querySelector('.name, .hero-title, h1');
    if (logo) {
      logo.addEventListener('click', () => {
        clickCount++;
        clearTimeout(clickTimer);
        
        if (clickCount === 3) {
          xpSystem.addXP('triple_click_logo', null);
          this.showSecretMessage('✨ You found the secret! Triple click master!');
          clickCount = 0;
        } else {
          clickTimer = setTimeout(() => {
            clickCount = 0;
          }, 600);
        }
      });
    }
  }
  
  showSecretMessage(message) {
    const msg = document.createElement('div');
    msg.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 24px 32px;
      border-radius: 16px;
      font-size: 18px;
      font-weight: 600;
      z-index: 999999;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      animation: secretBounce 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    `;
    msg.textContent = message;
    document.body.appendChild(msg);
    
    // Add animation keyframes
    if (!document.getElementById('secret-animation-styles')) {
      const style = document.createElement('style');
      style.id = 'secret-animation-styles';
      style.textContent = `
        @keyframes secretBounce {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.1); }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    setTimeout(() => {
      msg.style.opacity = '0';
      msg.style.transform = 'translate(-50%, -50%) scale(0.8)';
      msg.style.transition = 'all 0.3s';
      setTimeout(() => msg.remove(), 300);
    }, 3000);
    
    xpSystem.addXP('found_secret_message', null);
  }
  
  trackSpecialConditions() {
    // Check time of day for special bonuses
    const hour = new Date().getHours();
    
    // Night owl (10pm - 6am)
    if (hour >= 22 || hour < 6) {
      setTimeout(() => {
        xpSystem.addXP('night_owl', null);
      }, 5000);
    }
    
    // Early bird (5am - 8am)
    if (hour >= 5 && hour < 8) {
      setTimeout(() => {
        xpSystem.addXP('early_bird', null);
      }, 5000);
    }
    
    // Track if user completes site very quickly (speed reader)
    setTimeout(() => {
      const data = xpSystem.getData();
      if (data.sectionsVisited && data.sectionsVisited.length === 5) {
        const timeOnSite = Date.now() - this.pageLoadTime;
        if (timeOnSite < 120000) { // Less than 2 minutes
          xpSystem.addXP('speed_reader', null);
        }
      }
    }, 120000);
  }
}

// Create singleton instance
const xpTracker = new XPTracker();

export default xpTracker;
