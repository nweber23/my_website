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
      
      if (!container) {
        return;
      }

      const skillsHTML = skillsByCategory[category]
        .map(skill => `
          <div class="skill-item fade-in">
            <div class="skill-info">
              <div class="skill-logo">${this.getTechLogo(skill.name)}</div>
              <span class="skill-name">${skill.name}</span>
            </div>
            <div class="skill-bar">
              <div class="skill-fill" data-level="${skill.level}"></div>
            </div>
          </div>
        `)
        .join('');
      
      container.innerHTML = skillsHTML;

      // Ensure bars fill even when elements are rendered after the observer is set up
      const items = container.querySelectorAll('.skill-item');
      items.forEach((item, idx) => {
        setTimeout(() => this.animateSkillBar(item), 100 + idx * 50);
      });
    });
  }

  getTechLogo(techName) {
    const logos = {
      'C': '<svg width="24" height="24" viewBox="0 0 24 24" fill="#A8B9CC"><path d="M16.5 9.4c-.4-.7-1.1-1.2-2-1.6-.9-.5-2-.7-3.1-.7-1.6 0-3 .6-4.1 1.6-1.2 1.1-1.8 2.5-1.8 4.3s.6 3.2 1.8 4.3c1.1 1.1 2.5 1.6 4.1 1.6.5 0 1-.1 1.5-.2.5-.1.9-.3 1.3-.5.4-.2.7-.5 1-.8.3-.3.5-.7.7-1.1l-2.1-1.2c-.1.3-.2.5-.4.7-.2.2-.4.3-.6.4-.2.1-.5.2-.8.2-.3 0-.6.1-.9.1-.8 0-1.5-.3-2.1-.8-.6-.5-.9-1.3-.9-2.3s.3-1.8.9-2.3c.6-.5 1.3-.8 2.1-.8.8 0 1.5.2 2 .7.5.5.8 1.1.8 1.9h2.5c0-.9-.2-1.7-.6-2.4z"/></svg>',
      'C++': '<svg width="24" height="24" viewBox="0 0 24 24" fill="#00599C"><path d="M22.39 10.87c0-1.44-.67-2.74-1.69-3.6L15.3 3.87c-1.02-.86-2.58-.86-3.6 0L6.3 7.27c-1.02.86-1.69 2.16-1.69 3.6v6.26c0 1.44.67 2.74 1.69 3.6l5.4 3.4c1.02.86 2.58.86 3.6 0l5.4-3.4c1.02-.86 1.69-2.16 1.69-3.6v-6.26zM12 7.5c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4zm-6.5 4h1.5v1.5H5.5V11.5zm7 0h1.5v1.5h-1.5V11.5zm-7-1.5h1.5V11.5H5.5V10zm7 0h1.5V11.5h-1.5V10z"/></svg>',
      'Java': '<svg width="24" height="24" viewBox="0 0 24 24" fill="#007396"><path d="M8.851 18.56s-.917.534.653.714c1.902.218 2.874.187 4.969-.211 0 0 .552.346 1.321.646-4.699 2.013-10.633-.118-6.943-1.149M8.276 15.933s-1.028.761.542.924c2.032.209 3.636.227 6.413-.308 0 0 .384.389.987.602-5.679 1.661-12.007.13-7.942-1.218M13.116 11.475c1.158 1.333-.304 2.533-.304 2.533s2.939-1.518 1.589-3.418c-1.261-1.772-2.228-2.652 3.007-5.688 0-.001-8.216 2.051-4.292 6.573M19.33 20.504s.679.559-.747.991c-2.712.822-11.288 1.069-13.669.033-.856-.373.75-.89 1.254-.998.527-.114.828-.093.828-.093-.953-.671-6.156 1.317-2.643 1.887 9.58 1.553 17.462-.7 14.977-1.82M9.292 13.21s-4.362 1.036-1.544 1.412c1.189.159 3.561.123 5.77-.062 1.806-.152 3.618-.477 3.618-.477s-.637.272-1.098.587c-4.429 1.165-12.986.623-10.522-.568 2.082-1.006 3.776-.892 3.776-.892M17.116 17.584c4.503-2.34 2.421-4.589.968-4.285-.355.074-.515.138-.515.138s.132-.207.385-.297c2.875-1.011 5.086 2.981-.928 4.562 0-.001.07-.062.09-.118M14.401 0s2.494 2.494-2.365 6.33c-3.896 3.077-.888 4.832-.001 6.836-2.274-2.053-3.943-3.858-2.824-5.539 1.644-2.469 6.197-3.665 5.19-7.627M9.734 23.924c4.322.277 10.959-.153 11.116-2.198 0 0-.302.775-3.572 1.391-3.688.694-8.239.613-10.937.168 0-.001.553.457 3.393.639"/></svg>',
      'TypeScript': '<svg width="24" height="24" viewBox="0 0 24 24" fill="#3178C6"><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0H1.125zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.213.776.213 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/></svg>',
      'JavaScript': '<svg width="24" height="24" viewBox="0 0 24 24" fill="#F7DF1E"><path d="M0 0h24v24H0V0zm22.034 18.276c-.175-1.095-.888-2.015-3.003-2.873-.736-.345-1.554-.585-1.797-1.14-.091-.33-.105-.51-.046-.705.15-.646.915-.84 1.515-.66.39.12.75.42.976.9 1.034-.676 1.034-.676 1.755-1.125-.27-.42-.404-.601-.586-.78-.63-.705-1.469-1.065-2.834-1.034l-.705.089c-.676.165-1.32.525-1.71 1.005-1.14 1.291-.811 3.541.569 4.471 1.365 1.02 3.361 1.244 3.616 2.205.24 1.17-.87 1.545-1.966 1.41-.811-.18-1.26-.586-1.755-1.336l-1.83 1.051c.21.48.45.689.81 1.109 1.74 1.756 6.09 1.666 6.871-1.004.029-.09.24-.705.074-1.65l.046.067zm-8.983-7.245h-2.248c0 1.938-.009 3.864-.009 5.805 0 1.232.063 2.363-.138 2.711-.33.689-1.18.601-1.566.48-.396-.196-.597-.466-.83-.855-.063-.105-.11-.196-.127-.196l-1.825 1.125c.305.63.75 1.172 1.324 1.517.855.51 2.004.675 3.207.405.783-.226 1.458-.691 1.811-1.411.51-.93.402-2.07.397-3.346.012-2.054 0-4.109 0-6.179l.004-.056z"/></svg>',
      'HTML5': '<svg width="24" height="24" viewBox="0 0 24 24" fill="#E34F26"><path d="m1.5 0h21l-1.91 21.563L11.977 24l-8.565-2.438L1.5 0zm7.031 9.75l-.232-2.718 10.059.003.23-2.622L5.412 4.41l.698 8.01h9.126l-.326 3.426-2.91.804-2.955-.81-.188-2.11H6.248l.33 4.171L12 19.351l5.379-1.443.744-8.157H8.531z"/></svg>',
      'CSS3': '<svg width="24" height="24" viewBox="0 0 24 24" fill="#1572B6"><path d="M1.5 0h21l-1.91 21.563L11.977 24l-8.564-2.438L1.5 0zm7.031 9.75l-.232-2.718 10.059.003.23-2.622L5.412 4.41l.698 8.01h9.126l-.326 3.426-2.91.804-2.955-.81-.188-2.11H6.248l.33 4.171L12 19.351l5.379-1.443.744-8.157H8.531z"/></svg>',
      'Git': '<svg width="24" height="24" viewBox="0 0 24 24" fill="#F05032"><path d="M23.546 10.93L13.067.452c-.604-.603-1.582-.603-2.188 0L8.708 2.627l2.76 2.76c.645-.215 1.379-.07 1.889.441.516.515.658 1.258.438 1.9l2.658 2.66c.645-.223 1.387-.078 1.9.435.721.72.721 1.884 0 2.604-.719.719-1.881.719-2.6 0-.539-.541-.674-1.337-.404-1.996L12.86 8.955v6.525c.176.086.342.203.488.348.713.721.713 1.883 0 2.6-.719.721-1.889.721-2.609 0-.719-.719-.719-1.879 0-2.598.182-.18.387-.316.605-.406V8.835c-.217-.091-.424-.222-.6-.401-.545-.545-.676-1.342-.396-2.009L7.636 3.7.45 10.881c-.6.605-.6 1.584 0 2.189l10.48 10.477c.604.604 1.582.604 2.186 0l10.43-10.43c.605-.603.605-1.582 0-2.187"/></svg>',
      'Linux': '<svg width="24" height="24" viewBox="0 0 24 24" fill="#FCC624"><path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a3.5 3.5 0 00.164.429c.341.81.185 1.345-.012 1.176-.831-.726-1.188-2.491-1.012-4.028.056-.469.342-.898.644-1.245.684-.787 1.18-1.66 1.188-2.669.01-.707-.414-1.055-.707-1.387-.581-.659-1.254-1.317-1.644-2.297-.258-.646-.518-1.671-.24-2.607.341-1.156.676-2.411 1.644-3.098l.014-.014c.302-.302.684-.302.991 0 .302.302.302.684 0 .991 0 0-.069.051-.206.206-.137.155-.412.687-.412 1.617 0 .934.273 1.652.684 2.297.342.537.889 1.02 1.379 1.617.537.659.889 1.387.822 2.217-.067.822-.479 1.645-1.379 2.914-.302.43-.685.98-.685 1.617 0 .89.274 1.71.822 2.297.685.734 1.567.274 1.567-.137 0-.273-.137-.685-.274-1.02 0 0 .137-.547.274-1.02.137-.479.411-.889.822-1.387.822-.99 1.567-2.034 1.635-3.568.068-1.534-.685-2.911-1.705-4.178-.205-.274-.548-.822-.616-1.02-.067-.205.206-.479.411-.548.205-.068.411 0 .616.137.205.137.479.822.685 1.02.205.205.615.205.889 0 .274-.206.274-.616.068-.822-.137-.137-.411-.411-.685-.685-.274-.274-.548-.822-.548-1.387 0-.548.274-1.02.685-1.387.411-.342.822-.274 1.02 0 .205.274.205.685 0 .889-.137.137-.274.411-.274.685 0 .274.137.548.411.685.274.137.685 0 .822-.274.137-.274.068-.685-.068-.889-.137-.205-.342-.479-.342-.822 0-.342.205-.685.548-.822.342-.137.685-.068.889.137.205.205.274.548.205.822-.068.274-.205.548-.274.822-.068.342 0 .685.274.889.274.205.685.137.889-.137s.137-.685-.068-.889c-.205-.205-.479-.411-.479-.822 0-.411.274-.685.616-.822.342-.137.685 0 .889.274.205.274.137.685-.068.889-.205.205-.342.479-.274.822.068.342.274.685.616.822.342.137.685 0 .822-.274.137-.274.068-.685-.137-.889-.205-.205-.479-.342-.479-.685 0-.342.205-.616.479-.822.274-.205.685-.137.889.137.205.274.137.616-.068.822-.205.205-.342.411-.274.685.068.274.205.548.479.685.274.137.616.068.822-.137.205-.205.205-.548.068-.822-.137-.274-.342-.479-.342-.822 0-.342.205-.616.479-.822.274-.205.616-.137.822.137.205.274.137.616-.068.822-.205.205-.342.411-.274.685.068.274.205.548.479.685.274.137.616.068.822-.137.205-.205.205-.548.068-.822-.137-.274-.342-.479-.342-.822 0-.342.205-.616.479-.822.274-.205.616-.137.822.137.205.274.137.616-.068.822-.205.205-.342.411-.274.685.068.274.205.548.479.685.274.137.616.068.822-.137.205-.205.205-.548.068-.822-.137-.274-.342-.479-.342-.822 0-.342.205-.616.479-.822.274-.205.616-.137.822.137.205.274.137.616-.068.822-.205.205-.342.411-.274.685.068.274.205.548.479.685.274.137.616.068.822-.137.205-.205.205-.548.068-.822-.137-.274-.342-.479-.342-.822 0-.342.205-.616.479-.822.274-.205.616-.137.822.137.205.274.137.616-.068.822-.205.205-.342.411-.274.685.068.274.205.548.479.685.274.137.616.068.822-.137.205-.205.205-.548.068-.822-.137-.274-.342-.479-.342-.822 0-.342.205-.616.479-.822.274-.205.616-.137.822.137.205.274.137.616-.068.822-.205.205-.342.411-.274.685.068.274.205.548.479.685.274.137.616.068.822-.137.205-.205.205-.548.068-.822-.137-.274-.342-.479-.342-.822 0-.342.205-.616.479-.822.274-.205.616-.137.822.137.205.274.137.616-.068.822-.205.205-.342.411-.274.685.068.274.205.548.479.685.274.137.616.068.822-.137.205-.205.205-.548.068-.822-.137-.274-.342-.479-.342-.822z"/></svg>',
      'Linux/Unix': '<svg width="24" height="24" viewBox="0 0 24 24" fill="#FCC624"><path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a3.5 3.5 0 00.164.429c.341.81.185 1.345-.012 1.176-.831-.726-1.188-2.491-1.012-4.028.056-.469.342-.898.644-1.245.684-.787 1.18-1.66 1.188-2.669.01-.707-.414-1.055-.707-1.387-.581-.659-1.254-1.317-1.644-2.297-.258-.646-.518-1.671-.24-2.607.341-1.156.676-2.411 1.644-3.098l.014-.014c.302-.302.684-.302.991 0 .302.302.302.684 0 .991 0 0-.069.051-.206.206-.137.155-.412.687-.412 1.617 0 .934.273 1.652.684 2.297.342.537.889 1.02 1.379 1.617.537.659.889 1.387.822 2.217-.067.822-.479 1.645-1.379 2.914-.302.43-.685.98-.685 1.617 0 .89.274 1.71.822 2.297.685.734 1.567.274 1.567-.137 0-.273-.137-.685-.274-1.02 0 0 .137-.547.274-1.02.137-.479.411-.889.822-1.387.822-.99 1.567-2.034 1.635-3.568.068-1.534-.685-2.911-1.705-4.178-.205-.274-.548-.822-.616-1.02-.067-.205.206-.479.411-.548.205-.068.411 0 .616.137.205.137.479.822.685 1.02.205.205.615.205.889 0 .274-.206.274-.616.068-.822-.137-.137-.411-.411-.685-.685-.274-.274-.548-.822-.548-1.387 0-.548.274-1.02.685-1.387.411-.342.822-.274 1.02 0 .205.274.205.685 0 .889-.137.137-.274.411-.274.685 0 .274.137.548.411.685.274.137.685 0 .822-.274.137-.274.068-.685-.068-.889-.137-.205-.342-.479-.342-.822 0-.342.205-.685.548-.822.342-.137.685-.068.889.137.205.205.274.548.205.822-.068.274-.205.548-.274.822-.068.342 0 .685.274.889.274.205.685.137.889-.137s.137-.685-.068-.889c-.205-.205-.479-.411-.479-.822 0-.411.274-.685.616-.822.342-.137.685 0 .889.274.205.274.137.685-.068.889-.205.205-.342.479-.274.822.068.342.274.685.616.822.342.137.685 0 .822-.274.137-.274.068-.685-.137-.889-.205-.205-.479-.342-.479-.685 0-.342.205-.616.479-.822.274-.205.685-.137.889.137.205.274.137.616-.068.822-.205.205-.342.411-.274.685.068.274.205.548.479.685.274.137.616.068.822-.137.205-.205.205-.548.068-.822-.137-.274-.342-.479-.342-.822 0-.342.205-.616.479-.822.274-.205.616-.137.822.137.205.274.137.616-.068.822-.205.205-.342.411-.274.685.068.274.205.548.479.685.274.137.616.068.822-.137.205-.205.205-.548.068-.822-.137-.274-.342-.479-.342-.822 0-.342.205-.616.479-.822.274-.205.616-.137.822.137.205.274.137.616-.068.822-.205.205-.342.411-.274.685.068.274.205.548.479.685.274.137.616.068.822-.137.205-.205.205-.548.068-.822-.137-.274-.342-.479-.342-.822 0-.342.205-.616.479-.822.274-.205.616-.137.822.137.205.274.137.616-.068.822-.205.205-.342.411-.274.685.068.274.205.548.479.685.274.137.616.068.822-.137.205-.205.205-.548.068-.822-.137-.274-.342-.479-.342-.822 0-.342.205-.616.479-.822.274-.205.616-.137.822.137.205.274.137.616-.068.822-.205.205-.342.411-.274.685.068.274.205.548.479.685.274.137.616.068.822-.137.205-.205.205-.548.068-.822-.137-.274-.342-.479-.342-.822 0-.342.205-.616.479-.822.274-.205.616-.137.822.137.205.274.137.616-.068.822-.205.205-.342.411-.274.685.068.274.205.548.479.685.274.137.616.068.822-.137.205-.205.205-.548.068-.822-.137-.274-.342-.479-.342-.822z"/></svg>',
      'System Programming': '<svg width="24" height="24" viewBox="0 0 24 24" fill="#6C757D"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 5-5v3h4v4h-4v3z"/></svg>',
      'Algorithms & Data Structures': '<svg width="24" height="24" viewBox="0 0 24 24" fill="#28A745"><path d="M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2.5 2.25l1.25-2.75L16 15V5l4.75-1.25L19.5 1.25 15 2.5L12 1l-3 1.5L4.5 1.25 3.25 3.75 8 5v10l-4.75 1.25 1.25 2.75L9 17.5l3 1.5 3-1.5z"/></svg>',
      'Makefile': '<svg width="24" height="24" viewBox="0 0 24 24" fill="#427819"><path d="M2 3h20c.55 0 1 .45 1 1v16c0 .55-.45 1-1 1H2c-.55 0-1-.45-1-1V4c0-.55.45-1 1-1zm0 2v14h20V5H2zm2 2h16v2H4V7zm0 4h12v2H4v-2zm0 4h8v2H4v-2z"/></svg>',
      'GDB': '<svg width="24" height="24" viewBox="0 0 24 24" fill="#A8B9CC"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 5-5v3h4v4h-4v3z"/></svg>',
      'Valgrind': '<svg width="24" height="24" viewBox="0 0 24 24" fill="#FF6B6B"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>'
    };
    return logos[techName] || '<svg width="24" height="24" viewBox="0 0 24 24" fill="#6C757D"><path d="M4 6V4h16v2H4zm0 5V9h16v2H4zm0 5v-2h16v2H4z"/></svg>';
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