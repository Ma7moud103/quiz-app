import { authService, getCurrentUser } from './auth.js';

// Controller that wires the login form to authService and handles errors.
class LoginController {
  constructor() {
    this.form = document.getElementById('login-form');
    this.errorEl = document.getElementById('login-error');
    // Immediately redirect any already authenticated user.
    if (getCurrentUser()) {
      window.location.href = '/dashboard.html';
      return;
    }
    this.form.addEventListener('submit', this.handleSubmit.bind(this));
  }

  async handleSubmit(event) {
    event.preventDefault();
    this.errorEl.classList.add('d-none');
    // Read credentials from the user inputs.
    const email = this.form.querySelector('#login-email').value;
    const password = this.form.querySelector('#login-password').value;
    try {
      await authService.loginUser(email, password);
      window.location.href = '/dashboard.html';
    } catch (error) {
      this.showError(error.message);
    }
  }

  showError(message) {
    // Reveal the message overlay so the user can retry.
    this.errorEl.textContent = message;
    this.errorEl.classList.remove('d-none');
  }
}

new LoginController();
