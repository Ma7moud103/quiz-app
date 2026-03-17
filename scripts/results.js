import { authService } from './auth.js';
import { askConfirmation } from './confirm.js';

const REVIEW_KEY = 'dq-review';

class ResultPresenter {
  constructor() {
    this.greetingEl = document.getElementById('user-greeting');
    this.logoutBtn = document.getElementById('logout-btn');
    this.contentEl = document.getElementById('result-content');
    this.reviewBtn = document.getElementById('review-btn');
    this.reviewContainer = document.getElementById('review-container');
    this.reviewList = document.getElementById('review-list');
    this.currentUser = authService.requireLogin('/index.html');
    this.bindEvents();
    this.populate();
  }

  bindEvents() {
    this.logoutBtn.addEventListener('click', this.handleLogout.bind(this));
  }

  populate() {
    this.greetingEl.textContent = this.currentUser?.name ?? '';
    const payload = sessionStorage.getItem('dq-last-result');
    if (!payload) {
      this.contentEl.innerHTML = '<p class="text-warning">No result stored yet. Run a quiz first.</p>';
      if (this.reviewBtn) this.reviewBtn.disabled = true;
      return;
    }
    const result = JSON.parse(payload);
    this.contentEl.innerHTML = `
      <h3 class="mb-1">${result.quizTitle}</h3>
      <p class="text-muted mb-2">${new Date(result.timestamp).toLocaleString()}</p>
      <div class="d-flex gap-3 flex-wrap">
        <div class="border rounded-3 px-3 py-2">
          <small class="text-muted">Total score</small>
          <div><strong>${result.score}</strong></div>
        </div>
        <div class="border rounded-3 px-3 py-2">
          <small class="text-muted">Correct answers</small>
          <div><strong>${result.correct}</strong> / ${result.total}</div>
        </div>
        ${result.duration ? `
          <div class="border rounded-3 px-3 py-2">
            <small class="text-muted">Duration</small>
            <div>${result.duration} min</div>
          </div>` : ''}
      </div>
    `;
    this.configureReview();
  }

  configureReview() {
    if (!this.reviewBtn) return;
    const payload = sessionStorage.getItem(REVIEW_KEY);
    const reviewData = payload ? JSON.parse(payload) : null;
    if (!reviewData) {
      this.reviewBtn.disabled = true;
      return;
    }
    this.reviewBtn.disabled = false;
    this.reviewBtn.addEventListener('click', () => {
      const isHidden = this.reviewContainer.classList.contains('d-none');
      if (isHidden) {
        this.renderReview(reviewData);
      }
      this.reviewContainer.classList.toggle('d-none', !isHidden);
      this.reviewBtn.textContent = isHidden ? 'Hide review' : 'Review quiz';
    });
  }

  renderReview(reviewData) {
    if (!this.reviewList) return;
    this.reviewList.innerHTML = '';
    reviewData.questions.forEach((question, index) => {
      const item = document.createElement('div');
      item.className = 'bg-panel border border-secondary rounded-3 p-3';
      item.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <strong>Question ${index + 1}</strong>
          <span class="badge text-bg-secondary">${question.category ?? ''}</span>
        </div>
        <p class="mb-2">${question.question}</p>
      `;
      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'list-group';
      const selectedIndex = Array.isArray(reviewData.answers) ? reviewData.answers[index] : null;
      const correctIndexes = Array.isArray(question.correctAnswers) ? question.correctAnswers : [];
      question.options.forEach((option, optIndex) => {
        const optionEl = document.createElement('div');
        optionEl.className = 'list-group-item bg-dark text-white border d-flex justify-content-between align-items-center';
        if (correctIndexes.includes(optIndex)) {
          optionEl.classList.add('border-success');
        }
        if (selectedIndex === optIndex && !correctIndexes.includes(optIndex)) {
          optionEl.classList.add('border-warning');
        }
        optionEl.innerHTML = `<span><strong>${String.fromCharCode(65 + optIndex)}.</strong> ${option}</span>`;
        const badge = document.createElement('span');
        if (correctIndexes.includes(optIndex)) {
          badge.className = 'badge bg-success';
          badge.textContent = 'Correct';
        } else if (selectedIndex === optIndex) {
          badge.className = 'badge bg-warning text-dark';
          badge.textContent = 'Your answer';
        }
        if (badge.textContent) {
          optionEl.appendChild(badge);
        }
        optionsContainer.appendChild(optionEl);
      });
      item.appendChild(optionsContainer);
      this.reviewList.appendChild(item);
    });
  }

  async handleLogout() {
    const confirmed = await askConfirmation({
      title: 'Confirm sign out',
      message: 'Are you sure you want to leave the results screen?',
      confirmLabel: 'Log out',
      cancelLabel: 'Stay',
    });
    if (!confirmed) return;
    authService.logout();
    window.location.href = '/index.html';
  }
}

new ResultPresenter();
