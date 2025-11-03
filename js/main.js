import { apiClient } from './api-client.js';

class PortfolioApp {
  constructor() {
    this.currentSection = 'home';
    this.isNavToggleOpen = false;
    this.typingTimeout = null;
    this.observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };
    this._intersectionObserver = null;
    this.init();
  }

  async init() {
    this.setupTheme();
    this.setupNavigation();
    this.setupAnimations();
    this.setupTypingEffect();
    this.setupScrollEffects();
    this.setupContactForm();
    this.loadStaticContent(); // Load static content immediately
    this.setupParticles();
    this.trackPageView();
  }

  trackPageView() {
    // Track page view using API
    apiClient.trackEvent('page_view', {
      section: 'home',
      timestamp: new Date().toISOString()
    });
  }

  // Theme Management
  setupTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('portfolio-theme');
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

    document.documentElement.setAttribute('data-theme', initialTheme);

    themeToggle?.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('portfolio-theme', newTheme);

      // Track theme change
      apiClient.trackEvent('theme_change', { theme: newTheme });
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
      const navbarHeight = 70;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - navbarHeight;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });

      // Track section view
      apiClient.trackEvent('section_view', { section });
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

          // Track section view if changed
          if (this.currentSection !== section) {
            this.currentSection = section;
            apiClient.trackEvent('section_view', { section });
          }
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
        this.typingTimeout = setTimeout(() => {
          isDeleting = true;
          typeEffect();
        }, 2000);
        return;
      }

      if (isDeleting && currentCharIndex === 0) {
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
          entry.target.classList.add('in-view');

          // Special handling for skill bars
          if (entry.target.classList.contains('skill-item')) {
            this.animateSkillBar(entry.target);
          }

          // Animate stat numbers in profile card
          if (entry.target.classList.contains('profile-stats')) {
            this.animateProfileStats(entry.target);
          }
        }
      });
    };

    this._intersectionObserver = new IntersectionObserver(observerCallback, this.observerOptions);
    this.observeAnimatedElements();
  }

  observeAnimatedElements() {
    if (!this._intersectionObserver) return;
    const animatedElements = document.querySelectorAll(
      '.fade-in, .fade-in-left, .fade-in-right, .skill-item, .skill-tag, .project-card, .exploring-item, .profile-stats'
    );
    animatedElements.forEach(el => this._intersectionObserver.observe(el));
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

  animateProfileStats(statsContainer) {
    const statValues = statsContainer.querySelectorAll('.stat-value');
    statValues.forEach(stat => {
      const target = stat.getAttribute('data-target');
      if (target && !isNaN(target)) {
        this.animateNumber(stat, parseInt(target));
      }
    });
  }

  setupScrollEffects() {
    let ticking = false;

    const updateParallax = () => {
      const scrolled = window.pageYOffset;
      const hero = document.querySelector('.hero');

      if (hero) {
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

  // Contact Form with API integration
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
        // Submit via API
        const result = await apiClient.submitMessage(data);

        if (result.success) {
          // Show success message
          form.style.display = 'none';
          successMessage?.classList.add('show');

          // Track successful submission
          apiClient.trackEvent('contact_form_submit', {
            subject: data.subject,
            timestamp: new Date().toISOString()
          });

          // Reset form after delay
          setTimeout(() => {
            form.reset();
            form.style.display = 'grid';
            successMessage?.classList.remove('show');
            this.clearValidationErrors();
          }, 5000);
        } else {
          alert(`Failed to send message: ${result.error}`);
        }

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

  // Load static content (projects, skills, about)
  loadStaticContent() {
    this.loadAboutContent();
    this.loadSkills();
    this.loadProjects();
  }

  loadAboutContent() {
    // About content
    const aboutContent = {
        intro: "Welcome to my world of code and innovation! I'm a systems programming student at 42 Heilbronn, where I embrace the peer-to-peer learning philosophy. My journey is driven by curiosity, determination, and a passion for creating efficient, elegant solutions to complex problems.",

        focusAreas: [
            "Systems Programming & Memory Management",
            "Algorithm Design & Optimization",
            "Low-level Computing & Performance",
            "Clean Code Architecture",
            "Problem-Solving Methodologies"
        ],

        interests: [
            "FC Bayern Munich - Official Member & Passionate Fan",
            "Automotive Technology & Innovation",
            "Open Source Contributions",
            "Continuous Learning & Growth",
            "Music & Creative Expression"
        ],

        quote: "The best way to learn is to build, break, and rebuild."
    };

    // Populate about content
    const aboutIntro = document.getElementById('about-intro');
    const aboutQuote = document.getElementById('about-quote');
    const focusList = document.getElementById('focus-list');
    const interestsList = document.getElementById('interests-list');

    if (aboutIntro) {
        aboutIntro.textContent = aboutContent.intro;
    }

    if (aboutQuote) {
        aboutQuote.textContent = aboutContent.quote;
    }

    if (focusList) {
        aboutContent.focusAreas.forEach(area => {
            const li = document.createElement('li');
            li.textContent = area;
            focusList.appendChild(li);
        });
    }

    if (interestsList) {
        aboutContent.interests.forEach(interest => {
            const li = document.createElement('li');
            li.textContent = interest;
            interestsList.appendChild(li);
        });
    }
  }

  loadSkills() {
    const skills = [
      { name: 'C', level: 90, category: 'languages' },
      { name: 'C++', level: 70, category: 'languages' },
      { name: 'JavaScript', level: 75, category: 'languages' },
      { name: 'Python', level: 70, category: 'languages' },
      { name: 'Java', level: 70, category: 'languages' },
      { name: 'TypeScript', level: 80, category: 'languages' },
      { name: 'HTML5', level: 85, category: 'languages' },
      { name: 'CSS3', level: 80, category: 'languages' },
      { name: 'System Programming', level: 85, category: 'concepts' },
      { name: 'Data Structures & Algorithms', level: 80, category: 'concepts' },
      { name: 'Memory Management', level: 80, category: 'concepts' },
      { name: 'Concurrent Programming', level: 70, category: 'concepts' },
      { name: 'Operating Systems', level: 75, category: 'concepts' },
      { name: 'Network Programming', level: 65, category: 'concepts' },
      { name: 'Performance Optimization', level: 75, category: 'concepts' },
      { name: 'Object-Oriented Programming', level: 75, category: 'concepts' },
      { name: 'Git', level: 90, category: 'tools' },
      { name: 'Linux/Unix', level: 85, category: 'tools' },
      { name: 'Docker', level: 70, category: 'tools' },
      { name: 'VS Code', level: 85, category: 'tools' },
      { name: 'Make', level: 80, category: 'tools' },
      { name: 'Shell/Bash', level: 80, category: 'tools' },
      { name: 'GDB', level: 75, category: 'tools' },
      { name: 'Valgrind', level: 70, category: 'tools' }
    ];

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

    // Render skills as simple tags (icon + name), no rankings
    Object.keys(skillsByCategory).forEach(category => {
      const container = containers[category];
      if (!container) return;

      container.innerHTML = skillsByCategory[category]
        .map(skill => `
          <div class="skill-tag fade-in" aria-label="${skill.name}">
            <span class="skill-logo">${this.getTechLogo(skill.name)}</span>
            <span class="skill-name">${skill.name}</span>
          </div>
        `)
        .join('');
    });

  // Observe newly inserted animated elements
  this.observeAnimatedElements();
  }

  // rankings removed by request; no level labels

  getTechLogo(techName) {
    const logos = {
      'C': '<svg width="16" height="16" viewBox="0 0 100 100" fill="none"><defs><linearGradient id="cGrad1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#659ad2"/><stop offset="100%" stop-color="#03599c"/></linearGradient><linearGradient id="cGrad2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#ffffff"/></linearGradient></defs><path d="M92.86 24.46L50 0L7.14 24.46v48.08L50 97L92.86 72.54V24.46z" fill="url(#cGrad1)"/><circle cx="50" cy="50" r="25" fill="none" stroke="url(#cGrad2)" stroke-width="4"/><path d="M35 50A15 15 0 0 1 50 35" fill="none" stroke="url(#cGrad2)" stroke-width="4" stroke-linecap="round"/></svg>',
      'C++': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#00599C"><path d="M22.394 6c-.167-.29-.398-.543-.652-.69L12.926.22c-.509-.294-1.34-.294-1.848 0L2.26 5.31c-.508.293-.923 1.013-.923 1.6v10.18c0 .294.104.62.271.846.167.227.398.434.652.58l8.816 5.09c.508.295 1.34.295 1.848 0l8.816-5.09c.254-.146.485-.353.652-.58.167-.227.271-.553.271-.846V6.91c.002-.294-.102-.62-.269-.91zM12 19.109c-3.92 0-7.109-3.189-7.109-7.109S8.08 4.891 12 4.891a7.133 7.133 0 016.156 3.552l-3.076 1.781A3.567 3.567 0 0012 8.445c-1.96 0-3.554 1.595-3.554 3.555S10.04 15.555 12 15.555a3.57 3.57 0 003.08-1.778l3.077 1.78A7.135 7.135 0 0112 19.109zm7.109-6.714h-.79v.79h-.79v-.79h-.79v-.79h.79v-.79h.79v.79h.79v.79zm-2.962 0h-.79v.79h-.79v-.79h-.79v-.79h.79v-.79h.79v.79h.79v.79z"/></svg>',
      'JavaScript': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#F7DF1E"><path d="M0 0h24v24H0V0zm22.034 18.276c-.175-1.095-.888-2.015-3.003-2.873-.736-.345-1.554-.585-1.797-1.14-.091-.33-.105-.51-.046-.705.15-.646.915-.84 1.515-.66.39.12.75.42.976.9 1.034-.676 1.034-.676 1.755-1.125-.27-.42-.404-.601-.586-.78-.63-.705-1.469-1.065-2.834-1.034l-.705.089c-.676.165-1.32.525-1.71 1.005-1.14 1.291-.811 3.541.569 4.471 1.365 1.02 3.361 1.244 3.616 2.205.24 1.17-.87 1.545-1.966 1.41-.811-.18-1.26-.586-1.755-1.336l-1.83 1.051c.21.48.45.689.81 1.109 1.74 1.756 6.09 1.666 6.871-1.004.029-.09.24-.705.074-1.65l.046.067zm-8.983-7.245h-2.248c0 1.938-.009 3.864-.009 5.805 0 1.232.063 2.363-.138 2.711-.33.689-1.18.601-1.566.48-.396-.196-.597-.466-.83-.855-.063-.105-.11-.196-.127-.196l-1.825 1.125c.305.63.75 1.172 1.324 1.517.855.51 2.004.675 3.207.405.783-.226 1.458-.691 1.811-1.411.51-.93.402-2.07.397-3.346.012-2.054 0-4.109 0-6.179l.004-.056z"/></svg>',
      'Python': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#3776ab"><path d="M14.25.18l.9.2.73.26.59.3.45.32.34.34.25.34.16.33.1.3.04.26.02.2-.01.13V8.5l-.05.63-.13.55-.21.46-.26.38-.3.31-.33.25-.35.19-.35.14-.33.1-.3.07-.26.04-.21.02H8.77l-.69.05-.59.14-.5.22-.41.27-.33.32-.27.35-.2.36-.15.37-.1.35-.07.32-.04.27-.02.21v3.06H3.17l-.21-.03-.28-.07-.32-.12-.35-.18-.36-.26-.36-.36-.35-.46-.32-.59-.28-.73-.21-.88-.14-1.05-.05-1.23.06-1.22.16-1.04.24-.87.32-.71.36-.57.4-.44.42-.33.42-.24.4-.16.36-.1.32-.05.24-.01h.16l.06.01h8.16v-.83H6.18l-.01-2.75-.02-.37.05-.34.11-.31.17-.28.25-.26.31-.23.38-.2.44-.18.51-.15.58-.12.64-.1.71-.06.77-.04.84-.02 1.27.05zm-6.3 1.98l-.23.33-.08.41.08.41.23.34.33.22.41.09.41-.09.33-.22.23-.34.08-.41-.08-.41-.23-.33-.33-.22-.41-.09-.41.09zm13.09 3.95l.28.06.32.12.35.18.36.27.36.35.35.47.32.59.28.73.21.88.14 1.04.05 1.23-.06 1.23-.16 1.04-.24.86-.32.71-.36.57-.4.45-.42.33-.42.24-.4.16-.36.09-.32.05-.24.02-.16-.01h-8.22v.82h5.84l.01 2.76.02.36-.05.34-.11.31-.17.29-.25.25-.31.24-.38.2-.44.17-.51.15-.58.13-.64.09-.71.07-.77.04-.84.01-1.27-.04-1.07-.14-.9-.2-.73-.25-.59-.3-.45-.33-.34-.34-.25-.34-.16-.33-.1-.3-.04-.25-.02-.2.01-.13v-5.34l.05-.64.13-.54.21-.46.26-.38.3-.32.33-.24.35-.2.35-.14.33-.1.3-.06.26-.04.21-.02.13-.01h5.84l.69-.05.59-.14.5-.21.41-.28.33-.32.27-.35.2-.36.15-.36.1-.35.07-.32.04-.28.02-.21V6.07h2.09l.14.01zm-6.47 14.25l-.23.33-.08.41.08.41.23.33.33.23.41.08.41-.08.33-.23.23-.33.08-.41-.08-.41-.23-.33-.33-.23-.41-.08-.41.08z"/></svg>',
      'Java': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#f89820"><path d="M8.851 18.56s-.917.534.653.714c1.902.218 2.874.187 4.969-.211 0 0 .552.346 1.321.646-4.699 2.013-10.633-.118-6.943-1.149M8.276 15.933s-1.028.761.542.924c2.032.209 3.636.227 6.413-.308 0 0 .384.389.987.602-5.679 1.661-12.007.13-7.942-1.218M13.116 11.475c1.158 1.333-.304 2.533-.304 2.533s2.939-1.518 1.589-3.418c-1.261-1.772-2.228-2.652 3.007-5.688 0-.001-8.216 2.051-4.292 6.573M19.33 20.504s.679.559-.747.991c-2.712.822-11.288 1.069-13.669.033-.856-.373.75-.89 1.254-.998.527-.114.828-.093.828-.093-.953-.671-6.156 1.317-2.643 1.887 9.58 1.553 17.462-.7 14.977-1.82M9.292 13.21s-4.362 1.036-1.544 1.412c1.189.159 3.561.123 5.77-.062 1.806-.152 3.618-.477 3.618-.477s-.637.272-1.098.587c-4.429 1.165-12.986.623-10.522-.568 2.082-1.006 3.776-.892 3.776-.892M17.116 17.584c4.503-2.34 2.421-4.589.968-4.285-.355.074-.515.138-.515.138s.132-.207.385-.297c2.875-1.011 5.086 2.981-.928 4.562 0-.001.07-.062.09-.118M14.401 0s2.494 2.494-2.365 6.33c-3.896 3.077-.888 4.832-.001 6.836-2.274-2.053-3.943-3.858-2.824-5.539 1.644-2.469 6.197-3.665 5.19-7.627M9.734 23.924c4.322.277 10.959-.153 11.116-2.198 0 0-.302.775-3.572 1.391-3.688.694-8.239.613-10.937.168 0-.001.553.457 3.393.639"/></svg>',
      'TypeScript': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#3178c6"><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.213.776.213 1.253 0 .657-.125 1.218-.373 1.682a3.057 3.057 0 0 1-1.012 1.085 4.395 4.395 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/></svg>',
      'HTML5': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#e34c26"><path d="M1.5 0h21l-1.91 21.563L11.977 24l-8.564-2.438L1.5 0zm7.031 9.75l-.232-2.718 10.059.003.23-2.622L5.412 4.41l.698 8.01h9.126l-.326 3.426-2.91.804-2.955-.81-.188-2.11H6.248l.33 4.171L12 19.351l5.379-1.443.744-8.157H8.531z"/></svg>',
      'CSS3': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#1572b6"><path d="M1.5 0h21l-1.91 21.563L11.977 24l-8.565-2.438L1.5 0zm17.09 4.413L5.41 4.41l.213 2.622 10.125.002-.255 2.716h-6.64l.24 2.573h6.182l-.366 3.523-2.91.804-2.956-.81-.188-2.11h-2.61l.29 3.855L12 19.288l5.373-1.53L18.59 4.414z"/></svg>',
      'Git': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#F1502F"><path d="M23.546 10.93L13.067.452a1.55 1.55 0 0 0-2.188 0L8.708 2.627l2.76 2.76a1.838 1.838 0 0 1 1.96 1.96l2.66 2.66a1.838 1.838 0 0 1 1.96 1.96 1.837 1.837 0 0 1-3.675 0 1.838 1.838 0 0 1-.24-.89l-2.48-2.48v6.522a1.837 1.837 0 0 1 .484 1.245 1.838 1.838 0 0 1-3.675 0 1.837 1.837 0 0 1 .484-1.245V8.137a1.838 1.838 0 0 1-.997-1.614 1.837 1.837 0 0 1 .24-.89L4.81 2.893.454 7.25a1.55 1.55 0 0 0 0 2.188l10.477 10.477a1.55 1.55 0 0 0 2.188 0L23.546 13.118a1.55 1.55 0 0 0 0-2.188"/></svg>',
      'Linux/Unix': '<svg width="16" height="16" viewBox="0 0 100 100" fill="none"><ellipse cx="50" cy="25" rx="8" ry="12" fill="#000"/><ellipse cx="50" cy="50" rx="25" ry="35" fill="#fff"/><ellipse cx="50" cy="15" rx="20" ry="15" fill="#000"/><ellipse cx="45" cy="12" rx="2" ry="3" fill="#fff"/><ellipse cx="55" cy="12" rx="2" ry="3" fill="#fff"/><ellipse cx="45" cy="10" rx="1" ry="1" fill="#000"/><ellipse cx="55" cy="10" rx="1" ry="1" fill="#000"/><path d="M45 18c2 2 8 2 10 0" stroke="#FFA500" stroke-width="2" fill="none"/><ellipse cx="35" cy="75" rx="8" ry="12" fill="#FFA500"/><ellipse cx="65" cy="75" rx="8" ry="12" fill="#FFA500"/><ellipse cx="42" cy="65" rx="3" ry="8" fill="#000"/><ellipse cx="58" cy="65" rx="3" ry="8" fill="#000"/></svg>',
      'Docker': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#2496ed"><path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186H8.1a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186H5.136a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338 0-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.919-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983 0 1.94-.089 2.849-.26a11.94 11.94 0 003.825-1.389 9.855 9.855 0 002.628-2.232 11.26 11.26 0 001.85-2.878 8.428 8.428 0 00.787-1.675c.986.042 2.94.032 3.85-1.935l.06-.126-.278-.22"/></svg>',
      'VS Code': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#0078d4"><path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/></svg>',
      'Make': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#427819"><path d="M12.82 1.4l10.63 6.13a1.6 1.6 0 010 2.77L13 16.6a3.2 3.2 0 01-3.2 0L.37 10.27a1.6 1.6 0 010-2.77L10.82 1.4a3.2 3.2 0 012 0z"/><path fill="#fff" d="M12 8.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7z"/></svg>',
      'Shell/Bash': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#4EAA25"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM9.29 16.29L5.7 12.7a.996.996 0 010-1.41L9.29 7.7a.996.996 0 111.41 1.41L7.41 12l3.29 2.89c.39.39.39 1.02 0 1.41-.39.38-1.03.38-1.41-.01zM16 17h-3c-.55 0-1-.45-1-1s.45-1 1-1h3c.55 0 1 .45 1 1s-.45 1-1 1z"/></svg>',
      'GDB': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#A8B9CC"><path d="M12 2L2 7v10l10 5 10-5V7l-10-5zM8.5 8.5h7v7h-7v-7z"/></svg>',
      'Valgrind': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#3B82F6"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
    };
    return logos[techName] || '';
  }

  loadProjects() {
    const projects = [
      {
        id: '1',
        name: 'minishell',
        description:
          'A custom Unix shell with advanced parsing and execution: pipelines, logical operators (&&, ||), subshells, redirections, heredocs, environment expansion, and robust signal handling.',
        techStack: ['C', 'Readline', 'POSIX', 'Unix System Calls', 'Makefile'],
        highlights: [
          'Lexer, parser, and AST-based execution',
          'Pipes, redirections, and heredocs',
          'Built-in commands (cd, echo, env, export, unset, exit)',
          'Signal-safe interactive prompt with history'
        ],
        githubUrl: 'https://github.com/nweber23/minishell',
        featured: true,
        order: 1
      },
      {
        id: '2',
        name: 'base42',
        description:
          'A full‑stack platform for 42 students to connect, collaborate, and manage projects with dashboards, peers, chat, calendar, and 42 OAuth.',
        techStack: [
          'React',
          'TypeScript',
          'Tailwind CSS',
          'Node.js',
          'Express',
          'PostgreSQL',
          'Redis',
          'Docker'
        ],
        highlights: [
          'Dashboard, Peers, Projects, Messages, Calendar, Profile',
          '42 OAuth authentication',
          'Dockerized dev and prod workflows',
          'Responsive UI with Tailwind'
        ],
        githubUrl: 'https://github.com/nweber23/base42',
        featured: true,
        order: 2
      },
      {
        id: '3',
        name: '2048 in Java',
        description:
          'Console-based 2048 game with ANSI color themes, ASCII tile rendering, menu system, and persistent high scores. Supports 4×4 and 5×5 boards.',
        techStack: ['Java', 'Gradle', 'Terminal/ANSI'],
        highlights: [
          'WASD/Arrow key controls',
          'Color and ASCII art modes',
          'High score saving',
          'CLI options and resize handling'
        ],
        githubUrl: 'https://github.com/nweber23/2048_in_java',
        featured: true,
        order: 3
      }
    ];

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
              ${project.techStack.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
            </div>
            <ul class="project-highlights">
              ${project.highlights.map(highlight => `<li>${highlight}</li>`).join('')}
            </ul>
          </div>
          <div class="project-footer">
            <div class="project-links">
              <a href="${project.githubUrl}" target="_blank" rel="noopener noreferrer" class="project-link" onclick="apiClient.trackEvent('project_click', { project: '${project.name}', action: 'github' })">
                <span>GitHub</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      `)
      .join('');

    // Observe newly inserted animated elements
    this.observeAnimatedElements();
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

  // Animate stats numbers
  animateStats() {
    const statsNumbers = document.querySelectorAll('.stat-number');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const target = parseInt(entry.target.getAttribute('data-target'));
          this.animateNumber(entry.target, target);
          observer.unobserve(entry.target);
        }
      });
    });

    statsNumbers.forEach(stat => observer.observe(stat));
  }

  animateNumber(element, target) {
    let current = 0;
    const increment = target / 50;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        element.textContent = target;
        clearInterval(timer);
      } else {
        element.textContent = Math.floor(current);
      }
    }, 40);
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
    apiClient.trackEvent('page_view');
  }
});