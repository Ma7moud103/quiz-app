import { authService, getCurrentUser } from './auth.js';

// Handles the registration form lifecycle and validation.
class RegisterController {
  constructor() {
    this.form = document.getElementById('register-form');
    this.errorEl = document.getElementById('register-error');
    this.successEl = document.getElementById('register-success');
    // Prevent signed-in users from re-registering.
    if (getCurrentUser()) {
      window.location.href = '/dashboard.html';
      return;
    }
    this.form.addEventListener('submit', this.handleSubmit.bind(this));
  }

  async handleSubmit(event) {
    event.preventDefault();
    this.hideMessages();
    // Gather form values and compare the confirmation field.
    const payload = this.buildPayload();
    if (payload.password !== payload.confirm) {
      this.showError('Passwords must match.');
      return;
    }
    try {
      await authService.registerUser(payload);
      // Inform the user before redirecting back to login.
      this.successEl.textContent = 'Account ready – redirecting to login ...';
      this.successEl.classList.remove('d-none');
      this.form.reset();
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 1600);
    } catch (error) {
      this.showError(error.message);
    }
  }

  buildPayload() {
    return {
      name: this.form.querySelector('#register-name').value,
      email: this.form.querySelector('#register-email').value,
      password: this.form.querySelector('#register-password').value,
      confirm: this.form.querySelector('#register-confirm').value,
    };
  }

  hideMessages() {
    this.errorEl.classList.add('d-none');
    this.successEl.classList.add('d-none');
  }

  showError(message) {
    this.errorEl.textContent = message;
    this.errorEl.classList.remove('d-none');
  }
}

new RegisterController();
