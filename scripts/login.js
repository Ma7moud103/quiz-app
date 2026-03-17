import { authService, getCurrentUser } from './auth.js';

class LoginController {
  constructor() {
    this.form = document.getElementById('login-form');
    this.errorEl = document.getElementById('login-error');
    if (getCurrentUser()) {
      window.location.href = '/dashboard.html';
      return;
    }
    this.form.addEventListener('submit', this.handleSubmit.bind(this));
  }

  async handleSubmit(event) {
    event.preventDefault();
    this.errorEl.classList.add('d-none');
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
    this.errorEl.textContent = message;
    this.errorEl.classList.remove('d-none');
  }
}

new LoginController();
