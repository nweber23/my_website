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
    const savedTheme = localStorage.getItem('portfolio-theme') || 'light';
    
    document.documentElement.setAttribute('data-theme', savedTheme);
    
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
          entry.target.classList.add('animate');
          
          // Special handling for skill bars
          if (entry.target.classList.contains('skill-item')) {
            this.animateSkillBar(entry.target);
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, this.observerOptions);

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
    const aboutMe = {
      intro: `Hi! I'm Niklas, a systems programming student at 42 Heilbronn. I'm passionate about low-level computing, algorithm optimization, and building efficient software that makes a difference.`,
      quote: "The best way to learn is to build, break, and rebuild.",
      focusAreas: [
        'Systems Programming',
        'Low-level Computing',
        'Algorithm Optimization',
        'Performance Engineering'
      ],
      interests: [
        'FC Bayern Munich fan & member',
        'Automotive enthusiast',
        'Open source contributor',
        'Problem solving'
      ]
    };

    const introElement = document.getElementById('about-intro');
    const quoteElement = document.getElementById('about-quote');
    const focusListElement = document.getElementById('focus-list');
    const interestsListElement = document.getElementById('interests-list');

    if (introElement) introElement.textContent = aboutMe.intro;
    if (quoteElement) quoteElement.textContent = aboutMe.quote;
    
    if (focusListElement) {
      focusListElement.innerHTML = aboutMe.focusAreas
        .map(area => `<li>${area}</li>`)
        .join('');
    }
    
    if (interestsListElement) {
      interestsListElement.innerHTML = aboutMe.interests
        .map(interest => `<li>${interest}</li>`)
        .join('');
    }
  }

  loadSkills() {
    const skills = [
      { name: 'C', level: 90, category: 'languages' },
      { name: 'C++', level: 70, category: 'languages' },
      { name: 'Java', level: 70, category: 'languages' },
      { name: 'TypeScript', level: 80, category: 'languages' },
      { name: 'HTML5', level: 85, category: 'languages' },
      { name: 'System Programming', level: 85, category: 'concepts' },
      { name: 'Algorithms & Data Structures', level: 80, category: 'concepts' },
      { name: 'Concurrent Programming', level: 70, category: 'concepts' },
      { name: 'Performance Optimization', level: 75, category: 'concepts' },
      { name: 'Git', level: 90, category: 'tools' },
      { name: 'Linux/Unix', level: 85, category: 'tools' },
      { name: 'GDB', level: 75, category: 'tools' }
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

    // Render skills in each category without percentage text
    Object.keys(skillsByCategory).forEach(category => {
      const container = containers[category];
      if (!container) return;

      container.innerHTML = skillsByCategory[category]
        .map(skill => `
          <div class="skill-item fade-in">
            <div class="skill-info">
              <span class="skill-name">${this.getTechLogo(skill.name)} ${skill.name}</span>
            </div>
            <div class="skill-bar">
              <div class="skill-fill" data-level="${skill.level}"></div>
            </div>
          </div>
        `)
        .join('');
    });
  }

  getTechLogo(techName) {
    const logos = {
      'C': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#A8B9CC"><path d="M16.5392 8.7H15.7292L14.7192 9.7L14.4092 11.2V12.5L15.0392 12.8L15.7292 12.2H16.5392L17.3192 11.5L17.6292 10.3V9.4L17.3192 8.3L16.5392 8.7ZM11.9592 1.3C6.4792 1.3 1.9592 5.8 1.9592 11.3S6.4792 21.3 11.9592 21.3S21.9592 16.8 21.9592 11.3S17.4392 1.3 11.9592 1.3ZM11.9592 19.7C7.3192 19.7 3.5592 15.9 3.5592 11.3C3.5592 6.7 7.3192 2.9 11.9592 2.9S20.3592 6.7 20.3592 11.3C20.3592 15.9 16.5992 19.7 11.9592 19.7ZM13.8592 6.4L12.7592 7.5L11.8592 9.1L11.4592 11.3L11.8592 13.5L12.7592 15.1L13.8592 16.2L15.4592 16.6L16.9592 16.2L18.0592 15.1L18.9592 13.5L19.3592 11.3L18.9592 9.1L18.0592 7.5L16.9592 6.4L15.4592 6L13.8592 6.4ZM8.0592 8.7H7.2492L6.2392 9.7L5.9292 11.2V12.5L6.5592 12.8L7.2492 12.2H8.0592L8.8392 11.5L9.1492 10.3V9.4L8.8392 8.3L8.0592 8.7Z"/></svg>',
      'C++': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#00599C"><path d="M22.394 6v12l-10.081 6L2.232 18V6L12.313 0z"/><path fill="#004482" d="M8.883 18h4.774l6.717-3.88V9.883L13.657 6H8.883l-6.717 3.88V14.12z"/><path fill="#fff" d="M12 7a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm2.5 8h-5V9h5z"/></svg>',
      'Java': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#f89820"><path d="M8.851 18.56s-.917.534.653.714c1.902.218 2.874.187 4.969-.211 0 0 .552.346 1.321.646-4.699 2.013-10.633-.118-6.943-1.149M8.276 15.933s-1.028.761.542.924c2.032.209 3.636.227 6.413-.308 0 0 .384.389.987.602-5.679 1.661-12.007.13-7.942-1.218M13.116 11.475c1.158 1.333-.304 2.533-.304 2.533s2.939-1.518 1.589-3.418c-1.261-1.772-2.228-2.652 3.007-5.688 0-.001-8.216 2.051-4.292 6.573M19.33 20.504s.679.559-.747.991c-2.712.822-11.288 1.069-13.669.033-.856-.373.75-.89 1.254-.998.527-.114.828-.093.828-.093-.953-.671-6.156 1.317-2.643 1.887 9.58 1.553 17.462-.7 14.977-1.82M9.292 13.21s-4.362 1.036-1.544 1.412c1.189.159 3.561.123 5.77-.062 1.806-.152 3.618-.477 3.618-.477s-.637.272-1.098.587c-4.429 1.165-12.986.623-10.522-.568 2.082-1.006 3.776-.892 3.776-.892M17.116 17.584c4.503-2.34 2.421-4.589.968-4.285-.355.074-.515.138-.515.138s.132-.207.385-.297c2.875-1.011 5.086 2.981-.928 4.562 0-.001.07-.062.09-.118M14.401 0s2.494 2.494-2.365 6.33c-3.896 3.077-.888 4.832-.001 6.836-2.274-2.053-3.943-3.858-2.824-5.539 1.644-2.469 6.197-3.665 5.19-7.627M9.734 23.924c4.322.277 10.959-.153 11.116-2.198 0 0-.302.775-3.572 1.391-3.688.694-8.239.613-10.937.168 0-.001.553.457 3.393.639"/></svg>',
      'TypeScript': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#3178c6"><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.213.776.213 1.253 0 .657-.125 1.218-.373 1.682a3.057 3.057 0 0 1-1.012 1.085 4.395 4.395 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/></svg>',
      'HTML5': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#e34c26"><path d="M1.5 0h21l-1.91 21.563L11.977 24l-8.564-2.438L1.5 0zm7.031 9.75l-.232-2.718 10.059.003.23-2.622L5.412 4.41l.698 8.01h9.126l-.326 3.426-2.91.804-2.955-.81-.188-2.11H6.248l.33 4.171L12 19.351l5.379-1.443.744-8.157H8.531z"/></svg>',
      'Git': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#F1502F"><path d="M23.546 10.93L13.067.452a1.55 1.55 0 0 0-2.188 0L8.708 2.627l2.76 2.76a1.838 1.838 0 0 1 1.96 1.96l2.66 2.66a1.838 1.838 0 0 1 1.96 1.96 1.837 1.837 0 0 1-3.675 0 1.838 1.838 0 0 1-.24-.89l-2.48-2.48v6.522a1.837 1.837 0 0 1 .484 1.245 1.838 1.838 0 0 1-3.675 0 1.837 1.837 0 0 1 .484-1.245V8.137a1.838 1.838 0 0 1-.997-1.614 1.837 1.837 0 0 1 .24-.89L4.81 2.893.454 7.25a1.55 1.55 0 0 0 0 2.188l10.477 10.477a1.55 1.55 0 0 0 2.188 0L23.546 13.118a1.55 1.55 0 0 0 0-2.188"/></svg>',
      'Linux/Unix': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#FCC624"><path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 0 0-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 0 1-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 0 1-.004-.021l-.004-.024a1.807 1.807 0 0 1-.15.706l-.002.05a1.803 1.803 0 0 1-.17.667c-.148.377-.347.618-.675.618-.534 0-.99-.46-.99-1.055 0-.595.456-1.055.99-1.055z"/></svg>',
      'GDB': '<svg width="16" height="16" viewBox="0 0 24 24" fill="#A8B9CC"><path d="M12 2L2 7v10l10 5 10-5V7l-10-5zM8.5 8.5h7v7h-7v-7z"/></svg>'
    };
    return logos[techName] || '';
  }

  loadProjects() {
    const projects = [
      {
        id: '1',
        name: 'fract-ol',
        description: 'Interactive fractal visualizer built with C and MLX42. Features real-time zooming, multiple fractal types (Mandelbrot, Julia, Burning Ship), and smooth color gradients.',
        techStack: ['C', 'MLX42', 'Mathematics', 'Computer Graphics'],
        highlights: [
          'Real-time fractal rendering',
          'Interactive zoom and navigation',
          'Multiple fractal algorithms',
          'Optimized for performance'
        ],
        githubUrl: 'https://github.com/nweber23/fract-ol',
        featured: true,
        order: 1
      },
      {
        id: '2',
        name: 'libunit',
        description: 'Minimalist unit testing framework for C projects. Provides simple assertion macros, test organization, and detailed output formatting.',
        techStack: ['C', 'Makefile', 'Testing Framework'],
        highlights: [
          'Lightweight and fast',
          'Simple macro-based API',
          'Colored output',
          'Memory leak detection'
        ],
        githubUrl: 'https://github.com/nweber23/libunit',
        featured: true,
        order: 2
      },
      {
        id: '3',
        name: 'minishell',
        description: 'Custom Unix shell implementation with built-in commands, pipe handling, environment variables, and signal management.',
        techStack: ['C', 'Unix System Calls', 'Process Management'],
        highlights: [
          'Built-in commands (cd, echo, pwd, etc.)',
          'Pipe and redirection support',
          'Environment variable handling',
          'Signal processing'
        ],
        githubUrl: 'https://github.com/nweber23/minishell',
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
    apiClient.trackEvent('page_view');
  }
});