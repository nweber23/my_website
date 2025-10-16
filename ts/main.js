import { storage } from './storage.js';

class PortfolioApp {
  constructor() {
    this.currentSection = 'home';
    this.isNavToggleOpen = false;
    this.typingTimeout = null;
    this.observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };
    this.init();
  }

  async init() {
    await this.initializeStorage();
    this.setupTheme();
    this.setupNavigation();
    this.setupAnimations();
    this.setupTypingEffect();
    this.setupScrollEffects();
    this.setupContactForm();
    this.loadContent();
    this.setupParticles();
    this.trackPageView();
  }

  async initializeStorage() {
    await storage.initializeStorage();
  }

  trackPageView() {
    storage.trackPageView();
  }

  // Theme Management
  setupTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('portfolio-theme') || 'light';
    
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    themeToggle?.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('portfolio-theme', newTheme);
      
      storage.updateSettings({ darkMode: newTheme === 'dark' });
    });
  }

  // Navigation
  setupNavigation() {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    // Mobile menu toggle
    navToggle?.addEventListener('click', () => {
      this.isNavToggleOpen = !this.isNavToggleOpen;
      navToggle.classList.toggle('active', this.isNavToggleOpen);
      navMenu?.classList.toggle('active', this.isNavToggleOpen);
    });

    // Close mobile menu when clicking on a link
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (this.isNavToggleOpen) {
          this.isNavToggleOpen = false;
          navToggle?.classList.remove('active');
          navMenu?.classList.remove('active');
        }
      });
    });

    // Smooth scrolling and active link highlighting
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href')?.substring(1);
        if (targetId) {
          this.scrollToSection(targetId);
        }
      });
    });

    // Update active nav link on scroll
    window.addEventListener('scroll', () => {
      this.updateActiveNavLink();
      this.updateNavbarBackground();
    });
  }

  scrollToSection(section) {
    const element = document.getElementById(section);
    if (element) {
      const navbarHeight = 70; // Navbar height
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - navbarHeight;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });

      storage.trackPageView(section);
    }
  }

  updateActiveNavLink() {
    const sections = ['home', 'about', 'skills', 'projects', 'contact'];
    const navLinks = document.querySelectorAll('.nav-link');
    const scrollPosition = window.scrollY + 100;

    for (const section of sections) {
      const element = document.getElementById(section);
      if (element) {
        const elementTop = element.getBoundingClientRect().top + window.pageYOffset;
        const elementBottom = elementTop + element.offsetHeight;

        if (scrollPosition >= elementTop && scrollPosition < elementBottom) {
          navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${section}`) {
              link.classList.add('active');
            }
          });
          this.currentSection = section;
          break;
        }
      }
    }
  }

  updateNavbarBackground() {
    const navbar = document.getElementById('navbar');
    if (navbar) {
      navbar.classList.toggle('scrolled', window.scrollY > 50);
    }
  }

  // Typing Effect
  setupTypingEffect() {
    const typingElement = document.getElementById('typing-text');
    if (!typingElement) return;

    const phrases = [
      'Systems Programmer',
      '42 Student',
      'Problem Solver',
      'Code Optimizer',
      'Low-Level Enthusiast'
    ];

    let currentPhraseIndex = 0;
    let currentCharIndex = 0;
    let isDeleting = false;

    const typeEffect = () => {
      const currentPhrase = phrases[currentPhraseIndex];
      const displayText = currentPhrase.substring(0, currentCharIndex);
      
      typingElement.textContent = displayText;

      if (!isDeleting && currentCharIndex === currentPhrase.length) {
        // Pause at end of phrase
        this.typingTimeout = setTimeout(() => {
          isDeleting = true;
          typeEffect();
        }, 2000);
        return;
      }

      if (isDeleting && currentCharIndex === 0) {
        // Move to next phrase
        isDeleting = false;
        currentPhraseIndex = (currentPhraseIndex + 1) % phrases.length;
      }

      const typingSpeed = isDeleting ? 50 : 100;
      currentCharIndex += isDeleting ? -1 : 1;

      this.typingTimeout = setTimeout(typeEffect, typingSpeed);
    };

    typeEffect();
  }

  // Animations
  setupAnimations() {
    const observerCallback = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate');
          
          // Special handling for skill bars
          if (entry.target.classList.contains('skill-item')) {
            this.animateSkillBar(entry.target);
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, this.observerOptions);

    // Observe elements for animation
    const animatedElements = document.querySelectorAll(
      '.fade-in, .fade-in-left, .fade-in-right, .skill-item, .project-card, .exploring-item'
    );
    
    animatedElements.forEach(el => observer.observe(el));
  }

  animateSkillBar(skillItem) {
    const skillFill = skillItem.querySelector('.skill-fill');
    if (skillFill) {
      const level = skillFill.getAttribute('data-level') || '0';
      setTimeout(() => {
        skillFill.style.width = `${level}%`;
      }, 200);
    }
  }

  setupScrollEffects() {
    let ticking = false;

    const updateParallax = () => {
      const scrolled = window.pageYOffset;
      const hero = document.querySelector('.hero');
      
      if (hero) {
        // Subtle parallax effect for hero background
        hero.style.transform = `translateY(${scrolled * 0.2}px)`;
      }
      
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    });
  }

  // Contact Form
  setupContactForm() {
    const form = document.getElementById('contact-form');
    const submitBtn = document.getElementById('submit-btn');
    const successMessage = document.getElementById('form-success');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(form);
      const data = {
        name: formData.get('name'),
        email: formData.get('email'),
        subject: formData.get('subject'),
        message: formData.get('message')
      };

      // Validate form
      const validation = this.validateContactForm(data);
      this.displayValidationErrors(validation);

      if (!validation.isValid) return;

      // Show loading state
      submitBtn.classList.add('loading');
      submitBtn.disabled = true;

      try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Save message to storage
        storage.addMessage(data);

        // Show success message
        form.style.display = 'none';
        successMessage?.classList.add('show');

        // Reset form after delay
        setTimeout(() => {
          form.reset();
          form.style.display = 'grid';
          successMessage?.classList.remove('show');
          this.clearValidationErrors();
        }, 5000);

      } catch (error) {
        console.error('Error submitting form:', error);
        alert('There was an error sending your message. Please try again.');
      } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
      }
    });

    // Real-time validation
    const inputs = form.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      input.addEventListener('blur', () => {
        const fieldName = input.getAttribute('name');
        if (fieldName) {
          this.validateField(fieldName, input);
        }
      });
    });
  }

  validateContactForm(data) {
    const errors = {};

    if (!data.name.trim()) {
      errors.name = 'Name is required';
    } else if (data.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    if (!data.email.trim()) {
      errors.email = 'Email is required';
    } else if (!this.isValidEmail(data.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!data.subject.trim()) {
      errors.subject = 'Subject is required';
    } else if (data.subject.trim().length < 5) {
      errors.subject = 'Subject must be at least 5 characters';
    }

    if (!data.message.trim()) {
      errors.message = 'Message is required';
    } else if (data.message.trim().length < 10) {
      errors.message = 'Message must be at least 10 characters';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  validateField(fieldName, input) {
    const value = input.value;
    let error = '';

    switch (fieldName) {
      case 'name':
        if (!value.trim()) error = 'Name is required';
        else if (value.trim().length < 2) error = 'Name must be at least 2 characters';
        break;
      case 'email':
        if (!value.trim()) error = 'Email is required';
        else if (!this.isValidEmail(value)) error = 'Please enter a valid email address';
        break;
      case 'subject':
        if (!value.trim()) error = 'Subject is required';
        else if (value.trim().length < 5) error = 'Subject must be at least 5 characters';
        break;
      case 'message':
        if (!value.trim()) error = 'Message is required';
        else if (value.trim().length < 10) error = 'Message must be at least 10 characters';
        break;
    }

    const errorElement = document.getElementById(`${fieldName}-error`);
    if (errorElement) {
      errorElement.textContent = error;
      errorElement.classList.toggle('show', !!error);
    }

    input.classList.toggle('error', !!error);
  }

  displayValidationErrors(validation) {
    Object.keys(validation.errors).forEach(field => {
      const errorElement = document.getElementById(`${field}-error`);
      const inputElement = document.getElementById(field);
      
      if (errorElement && inputElement) {
        errorElement.textContent = validation.errors[field];
        errorElement.classList.add('show');
        inputElement.classList.add('error');
      }
    });
  }

  clearValidationErrors() {
    const errorElements = document.querySelectorAll('.error-message');
    const inputElements = document.querySelectorAll('.form-group input, .form-group textarea');
    
    errorElements.forEach(el => {
      el.classList.remove('show');
      el.textContent = '';
    });
    
    inputElements.forEach(el => el.classList.remove('error'));
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Content Loading
  loadContent() {
    const data = storage.getData();
    if (!data) return;

    // Load about me content
    this.loadAboutContent(data.aboutMe);
    
    // Load skills
    this.loadSkills(data.skills);
    
    // Load projects
    this.loadProjects(data.projects);
  }

  loadAboutContent(aboutMe) {
    const introElement = document.getElementById('about-intro');
    const quoteElement = document.getElementById('about-quote');
    const focusListElement = document.getElementById('focus-list');
    const interestsListElement = document.getElementById('interests-list');

    if (introElement) introElement.textContent = aboutMe.intro;
    if (quoteElement) quoteElement.textContent = aboutMe.quote;
    
    if (focusListElement) {
      focusListElement.innerHTML = aboutMe.focusAreas
        .map((area) => `<li>${area}</li>`)
        .join('');
    }
    
    if (interestsListElement) {
      interestsListElement.innerHTML = aboutMe.interests
        .map((interest) => `<li>${interest}</li>`)
        .join('');
    }
  }

  loadSkills(skills) {
    const languagesContainer = document.getElementById('languages-skills');
    const conceptsContainer = document.getElementById('concepts-skills');
    const toolsContainer = document.getElementById('tools-skills');

    const containers = {
      languages: languagesContainer,
      concepts: conceptsContainer,
      tools: toolsContainer
    };

    // Group skills by category
    const skillsByCategory = skills.reduce((acc, skill) => {
      if (!acc[skill.category]) acc[skill.category] = [];
      acc[skill.category].push(skill);
      return acc;
    }, {});

    // Render skills in each category
    Object.keys(skillsByCategory).forEach(category => {
      const container = containers[category];
      if (!container) return;

      container.innerHTML = skillsByCategory[category]
        .map(skill => `
          <div class="skill-item fade-in">
            <div class="skill-info">
              <span class="skill-name">${skill.name}</span>
              <span class="skill-level">${skill.level}%</span>
            </div>
            <div class="skill-bar">
              <div class="skill-fill" data-level="${skill.level}"></div>
            </div>
          </div>
        `)
        .join('');
    });
  }

  loadProjects(projects) {
    const projectsGrid = document.getElementById('projects-grid');
    if (!projectsGrid) return;

    projectsGrid.innerHTML = projects
      .filter(project => project.featured)
      .sort((a, b) => a.order - b.order)
      .map(project => `
        <div class="project-card fade-in">
          <div class="project-header">
            <h3 class="project-title">${project.name}</h3>
            <p class="project-description">${project.description}</p>
            <div class="project-tech">
              ${project.techStack.map((tech) => `<span class="tech-tag">${tech}</span>`).join('')}
            </div>
            <ul class="project-highlights">
              ${project.highlights.map((highlight) => `<li>${highlight}</li>`).join('')}
            </ul>
          </div>
          <div class="project-footer">
            <div class="project-links">
              <a href="${project.githubUrl}" target="_blank" rel="noopener noreferrer" class="project-link">
                <span>GitHub</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
              ${project.demoUrl ? `
                <a href="${project.demoUrl}" target="_blank" rel="noopener noreferrer" class="project-link">
                  <span>Demo</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
                  </svg>
                </a>
              ` : ''}
            </div>
          </div>
        </div>
      `)
      .join('');
  }

  // Particles Effect
  setupParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;

    const createParticle = () => {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: absolute;
        width: 2px;
        height: 2px;
        background: var(--primary-color);
        opacity: 0.3;
        border-radius: 50%;
        animation: float ${Math.random() * 6 + 4}s linear infinite;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
      `;
      
      particlesContainer.appendChild(particle);
      
      setTimeout(() => {
        particle.remove();
      }, 10000);
    };

    // Add CSS for particle animation
    if (!document.querySelector('#particle-styles')) {
      const style = document.createElement('style');
      style.id = 'particle-styles';
      style.textContent = `
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); opacity: 0.3; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 0.6; }
          100% { transform: translateY(-40px) rotate(360deg); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    // Create particles periodically
    setInterval(createParticle, 3000);
    
    // Create initial particles
    for (let i = 0; i < 5; i++) {
      setTimeout(createParticle, i * 600);
    }
  }

  // Cleanup method
  cleanup() {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PortfolioApp();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    storage.trackPageView();
  }
});