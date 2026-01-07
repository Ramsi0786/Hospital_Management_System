const FormValidator = {
  validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return "Email is required";
    if (!regex.test(email)) return "Invalid email format";
    return null;
  },

  validatePassword(password, minLength = 6) {
    if (!password) return "Password is required";
    if (password.length < minLength) return `Password must be at least ${minLength} characters`;
    return null;
  },

  validateName(name, minLength = 3) {
    if (!name || name.trim().length < minLength) return `Name must be at least ${minLength} characters`;
    return null;
  },

  validatePhone(phone) {
    const regex = /^[0-9]{10}$/;
    if (!phone) return "Phone number is required";
    if (!regex.test(phone)) return "Phone number must be 10 digits";
    return null;
  },

  validatePasswordMatch(password, confirmPassword) {
    if (password !== confirmPassword) return "Passwords do not match";
    return null;
  },

  showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.color = '#dc3545';
      errorElement.style.fontSize = '0.875rem';
      errorElement.style.marginTop = '0.25rem';
    }
    
    const fieldName = elementId.replace('error', '').toLowerCase();
    const inputField = document.getElementById(fieldName);
    if (inputField) {
      inputField.style.borderColor = '#dc3545';
      inputField.style.boxShadow = '0 0 0 0.2rem rgba(220, 53, 69, 0.25)';
    }
  },

  clearAllErrors(prefix = 'error') {
    document.querySelectorAll(`[id^="${prefix}"]`).forEach(el => {
      el.textContent = '';
      el.style.color = '';
    });
    
    document.querySelectorAll('.form-control').forEach(input => {
      input.style.borderColor = '';
      input.style.boxShadow = '';
    });
    
    const serverError = document.getElementById('serverError');
    const successMessage = document.getElementById('successMessage');
    if (serverError) serverError.textContent = '';
    if (successMessage) successMessage.textContent = '';
  },

  validateSignupForm(formData) {
    const errors = {};
    
    const nameError = this.validateName(formData.name);
    if (nameError) errors.name = nameError;
    
    const emailError = this.validateEmail(formData.email);
    if (emailError) errors.email = emailError;
    
    const phoneError = this.validatePhone(formData.phone);
    if (phoneError) errors.phone = phoneError;
    
    const passwordError = this.validatePassword(formData.password);
    if (passwordError) errors.password = passwordError;
    
    const matchError = this.validatePasswordMatch(formData.password, formData.confirmPassword);
    if (matchError) errors.confirmPassword = matchError;
    
    return errors;
  },

  validateLoginForm(formData) {
    const errors = {};
    
    const emailError = this.validateEmail(formData.email);
    if (emailError) errors.email = emailError;
    
    const passwordError = this.validatePassword(formData.password);
    if (passwordError) errors.password = passwordError;
    
    return errors;
  },

  validateForgotPasswordForm(formData) {
    const errors = {};
    
    const emailError = this.validateEmail(formData.email);
    if (emailError) errors.email = emailError;
    
    return errors;
  },

  
  validateResetPasswordForm(formData) {
  const errors = {};
  
  const password = formData.password ? formData.password.trim() : '';
  const confirmPassword = formData.confirmPassword ? formData.confirmPassword.trim() : '';
  
  if (!password || password.length === 0) {
    errors.password = "Password is required";
  } else if (password.length < 6) {
    errors.password = "Password must be at least 6 characters";
  }
  
  if (!confirmPassword || confirmPassword.length === 0) {
    errors.confirmPassword = "Please confirm your password";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }
  
  return errors;
},

  async handleFormSubmit(formId, endpoint, validationType, callbacks = {}) {
    const form = document.getElementById(formId);
    
    if (!form) {
      console.error(`Form with id "${formId}" not found`);
      return;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      this.clearAllErrors();
  
      const formData = new FormData(form);
      const data = {};
      
      formData.forEach((value, key) => {
        if (key === 'remember') {
          data[key] = value === 'on';
        } else {
          data[key] = typeof value === 'string' ? value.trim() : value;
        }
      });
      
      let errors = {};
      if (validationType === 'signup') {
        errors = this.validateSignupForm(data);
      } else if (validationType === 'login') {
        errors = this.validateLoginForm(data);
      } else if (validationType === 'forgotPassword') {
        errors = this.validateForgotPasswordForm(data);
      } else if (validationType === 'resetPassword') {
        errors = this.validateResetPasswordForm(data);
      }
      
      if (Object.keys(errors).length > 0) {
        Object.keys(errors).forEach(field => {
          const errorId = `error${field.charAt(0).toUpperCase() + field.slice(1)}`;
          this.showError(errorId, errors[field]);
        });
        return;
      }
      
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
         
          if (callbacks.onSuccess) {
            callbacks.onSuccess(result);
          }
        } else {

          const serverErrors = result.errors || {};
          Object.keys(serverErrors).forEach(field => {
            if (field === 'general') {
              this.showError('serverError', serverErrors[field]);
            } else {
              const errorId = `error${field.charAt(0).toUpperCase() + field.slice(1)}`;
              this.showError(errorId, serverErrors[field]);
            }
          });
          
          if (callbacks.onError) {
            callbacks.onError(serverErrors);
          }
        }
      } catch (err) {
        this.showError('serverError', 'Server error. Please try again later.');
        if (callbacks.onError) {
          callbacks.onError({ general: 'Server error' });
        }
      }
    });
  },

  setupPasswordToggle(passwordFieldId, toggleIconId) {
    const passwordField = document.getElementById(passwordFieldId);
    const toggleIcon = document.getElementById(toggleIconId);
    
    if (passwordField && toggleIcon) {
      toggleIcon.addEventListener('click', () => {
        const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordField.setAttribute('type', type);
        toggleIcon.classList.toggle('fa-eye');
        toggleIcon.classList.toggle('fa-eye-slash');
      });
    }
  }
};


window.FormValidator = FormValidator;