/**
 * Results Presenter
 * Summarizes quiz outcomes and renders optional review details from sessionStorage.
 * Uses ES6 modules and reads saved session data so the screen survives refreshes.
 */

import { authService } from './auth.js';
import { askConfirmation } from './confirm.js';

// Controller for the results page; it renders score summaries and optional review lists.
// ============================================================================

const RESULT_KEY = 'dq-last-result';
const REVIEW_KEY = 'dq-review';

// ============================================================================
// Results Presenter Controller
// ============================================================================

// Manages the results screen: wires DOM nodes, loads stored session data, and renders the summary/review.
class ResultPresenter {
  constructor() {
    // Ensure the user is logged in before showing the results.
    this.currentUser = authService.requireLogin('/index.html');

    // Cache the DOM nodes that the presenter will update.
    this.greetingEl = document.getElementById('user-greeting');
    this.logoutBtn = document.getElementById('logout-btn');
    this.contentEl = document.getElementById('result-content');
    this.reviewBtn = document.getElementById('review-btn');
    this.reviewContainer = document.getElementById('review-container');
    this.reviewList = document.getElementById('review-list');

    // Track the loaded result, review data, and UI state.
    this.resultData = null;
    this.reviewData = null;
    this.isReviewOpen = false;

    // Kick off initialization handlers.
    this.bindEvents();
    this.populateUserInfo();
    this.populate();
  }

  /**
   * Hook up logout and review button listeners.
   */
  bindEvents() {
    this.logoutBtn.addEventListener('click', this.handleLogout.bind(this));
    if (this.reviewBtn) {
      this.reviewBtn.addEventListener('click', this.handleReviewToggle.bind(this));
    }
  }

  /**
   * Display the current user's name in the greeting area.
   */
  populateUserInfo() {
    if (this.currentUser?.name) {
      this.greetingEl.textContent = this.currentUser.name;
    }
  }

  /**
   * Load stored result data and render the UI.
   */
  populate() {
    // Pull the saved result payload from sessionStorage.
    const resultPayload = sessionStorage.getItem(RESULT_KEY);

    if (!resultPayload) {
      this.showNoResultsMessage();
      return;
    }

    try {
      this.resultData = JSON.parse(resultPayload);
      this.reviewData = this.retrieveReviewData();
      this.renderResults();
      this.configureReviewButton();
    } catch (error) {
      console.error('Failed to parse result data:', error);
      this.showNoResultsMessage();
    }
  }

  /**
   * Load review data from sessionStorage if present.
   */
  retrieveReviewData() {
    const reviewPayload = sessionStorage.getItem(REVIEW_KEY);
    if (!reviewPayload) return null;

    try {
      return JSON.parse(reviewPayload);
    } catch (error) {
      console.error('Failed to parse review data:', error);
      return null;
    }
  }

  /**
   * Render the score summary, percentage, and performance message.
   */
  renderResults() {
    if (!this.resultData) return;

    const { quizTitle, correct, total, percentage, duration, timestamp } = this.resultData;

    // Compute the letter grade (A-F) for the percentage.
    const grade = this.calculateGrade(percentage);

    // Format the timestamp for the UI.
    const formattedDate = new Date(timestamp).toLocaleString();

    // Choose CSS classes that reflect the achieved performance.
    const scoreClass = this.getScoreClass(percentage);

    // Build the result summary HTML structure.
    this.contentEl.innerHTML = `
      <div class="mb-3">
        <h3 class="mb-1">${this.escapeHtml(quizTitle)}</h3>
        <p class="text-muted mb-0">
          <small>Completed on ${formattedDate}</small>
        </p>
      </div>

      <div class="d-flex gap-3 flex-wrap mt-4">
        <div class="border border-secondary rounded-3 px-4 py-3 flex-grow-1">
          <small class="text-muted d-block mb-1">Score</small>
          <div class="d-flex align-items-baseline gap-2">
            <strong class="display-6 ${scoreClass}">${correct}</strong>
            <span class="text-muted">/ ${total}</span>
          </div>
        </div>

        <div class="border border-secondary rounded-3 px-4 py-3">
          <small class="text-muted d-block mb-1">Percentage</small>
          <div class="d-flex align-items-baseline gap-2">
            <strong class="h4">${percentage}%</strong>
            <span class="badge text-bg-info">${grade}</span>
          </div>
        </div>

        ${
          duration
            ? `
        <div class="border border-secondary rounded-3 px-4 py-3">
          <small class="text-muted d-block mb-1">Duration</small>
          <strong class="h5">${duration} min</strong>
        </div>
        `
            : ''
        }
      </div>

      <div class="mt-4 p-3 rounded-3 ${this.getPerformanceAlertClass(percentage)}">
        ${this.getPerformanceMessage(percentage, correct, total)}
      </div>
    `;
  }

  /**
   * Determine the letter grade for the quiz percentage.
   */
  calculateGrade(percentage) {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }

  /**
   * Select the text class representing the score range.
   */
  getScoreClass(percentage) {
    if (percentage >= 80) return 'text-success';
    if (percentage >= 60) return 'text-warning';
    return 'text-danger';
  }

  /**
   * Pick the Bootstrap alert class that matches the performance.
   */
  getPerformanceAlertClass(percentage) {
    if (percentage >= 80) return 'alert alert-success';
    if (percentage >= 60) return 'alert alert-warning';
    return 'alert alert-danger';
  }

  /**
   * Create a motivating message based on the score percentage.
   */
  getPerformanceMessage(percentage, correct, total) {
    if (percentage >= 90) {
      return '🎉 <strong>Excellent work!</strong> You mastered this quiz. Keep up the great performance!';
    }
    if (percentage >= 80) {
      return '✅ <strong>Great job!</strong> You demonstrated strong knowledge. Review the missed questions to improve further.';
    }
    if (percentage >= 70) {
      return '👍 <strong>Good effort!</strong> You passed the quiz. Review the material for the questions you missed.';
    }
    if (percentage >= 60) {
      return '📚 <strong>Room for improvement.</strong> Study the material more thoroughly and try again.';
    }
    return '❌ <strong>Please review the material</strong> and retake the quiz to better understand the concepts.';
  }

  /**
   * Enable or disable the review button depending on available data.
   */
  configureReviewButton() {
    if (!this.reviewBtn) return;

    // If review data is missing, disable the button.
    if (!this.reviewData || !this.reviewData.questions) {
      this.reviewBtn.disabled = true;
      this.reviewBtn.title = 'Review data not available';
      return;
    }

    // Enable the review button and set its default label.
    this.reviewBtn.disabled = false;
    this.reviewBtn.textContent = 'Review quiz';
  }

  /**
   * Toggle and render the review section when the button is clicked.
   */
  handleReviewToggle() {
    if (!this.reviewContainer) return;

    const isHidden = this.reviewContainer.classList.contains('d-none');

    if (isHidden && !this.isReviewOpen) {
      // On the first open, render the review details.
      this.renderReview();
      this.isReviewOpen = true;
    }

    // Toggle the review container's visibility.
    this.reviewContainer.classList.toggle('d-none');

    // Update the review button text to match visibility.
    const newText = this.reviewContainer.classList.contains('d-none')
      ? 'Review quiz'
      : 'Hide review';
    this.reviewBtn.textContent = newText;
  }

  /**
   * Render each question-review card with answers and explanations.
   */
  renderReview() {
    if (!this.reviewList || !this.reviewData) return;

    this.reviewList.innerHTML = '';
    const questions = this.reviewData.questions || [];
    const answers = this.reviewData.answers || [];

    questions.forEach((question, index) => {
      const reviewItem = this.createReviewItem(question, index, answers);
      this.reviewList.appendChild(reviewItem);
    });
  }

  /**
   * Build the DOM element for a single reviewed question.
   */
  createReviewItem(question, index, answers) {
    const item = document.createElement('div');
    item.className = 'bg-panel border border-secondary rounded-3 p-3';

    // Render the question header and category badge.
    const header = document.createElement('div');
    header.className = 'd-flex justify-content-between align-items-center mb-3';
    header.innerHTML = `
      <strong>Question ${index + 1}</strong>
      <span class="badge text-bg-secondary">${this.escapeHtml(question.category || 'General')}</span>
    `;
    item.appendChild(header);

    // Display the question text.
    const questionText = document.createElement('p');
    questionText.className = 'mb-3 fw-semibold';
    questionText.textContent = question.question;
    item.appendChild(questionText);

    // Append the options list for this question.
    const optionsList = this.createOptionsList(question, index, answers);
    item.appendChild(optionsList);

    return item;
  }

  /**
   * Create the list of options shown in the review card.
   */
  createOptionsList(question, questionIndex, answers) {
    const container = document.createElement('div');
    container.className = 'list-group';

    const options = question.options || [];
    const correctAnswers = Array.isArray(question.correctAnswers) ? question.correctAnswers : [];
    const userAnswerIndex = answers[questionIndex];

    options.forEach((optionText, optionIndex) => {
      const optionElement = this.createOptionElement(
        optionText,
        optionIndex,
        userAnswerIndex,
        correctAnswers,
      );
      container.appendChild(optionElement);
    });

    return container;
  }

  /**
   * Create one option entry showing correctness and user choice.
   */
  createOptionElement(optionText, optionIndex, userAnswerIndex, correctAnswers) {
    const optionEl = document.createElement('div');
    optionEl.className = 'list-group-item bg-dark text-white border d-flex justify-content-between align-items-center';

    // Adjust styling classes based on whether the answer was correct or selected.
    const isCorrect = correctAnswers.includes(optionIndex);
    const isUserSelected = userAnswerIndex === optionIndex;

    if (isCorrect) {
      optionEl.classList.add('border-success', 'border-3');
    } else if (isUserSelected && !isCorrect) {
      optionEl.classList.add('border-warning', 'border-3');
    }

    // Label each option with its letter (A, B, C...).
    const letterLabel = String.fromCharCode(65 + optionIndex);
    const optionTextEl = document.createElement('span');
    optionTextEl.innerHTML = `<strong>${letterLabel}.</strong> ${this.escapeHtml(optionText)}`;
    optionEl.appendChild(optionTextEl);

    // Append a badge that highlights correctness or the user's answer.
    const badgeContainer = document.createElement('div');
    if (isCorrect) {
      const badge = document.createElement('span');
      badge.className = 'badge bg-success';
      badge.textContent = '✓ Correct';
      badgeContainer.appendChild(badge);
    } else if (isUserSelected && !isCorrect) {
      const badge = document.createElement('span');
      badge.className = 'badge bg-warning text-dark';
      badge.textContent = '✗ Your answer';
      badgeContainer.appendChild(badge);
    }

    if (badgeContainer.children.length > 0) {
      optionEl.appendChild(badgeContainer);
    }

    return optionEl;
  }

  /**
   * Show a warning message when no result data exists.
   */
  showNoResultsMessage() {
    this.contentEl.innerHTML = `
      <div class="alert alert-warning" role="alert">
        <strong>No results found.</strong>
        <p class="mb-0">Run a quiz to see your results here. <a href="/dashboard.html">Go to dashboard</a></p>
      </div>
    `;

    if (this.reviewBtn) {
      this.reviewBtn.disabled = true;
    }
  }

  /**
   * Confirm sign-out, then clear stored data and navigate to login.
   */
  async handleLogout() {
    const confirmed = await askConfirmation({
      title: 'Confirm sign out',
      message: 'Are you sure you want to sign out?',
      confirmLabel: 'Log out',
      cancelLabel: 'Stay',
    });

    if (!confirmed) return;

    // Clear the stored result/review data before logging out.
    sessionStorage.removeItem(RESULT_KEY);
    sessionStorage.removeItem(REVIEW_KEY);
    authService.logout();
    window.location.href = '/index.html';
  }

  /**
   * Escape HTML characters to prevent XSS when inserting content.
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return String(text).replace(/[&<>"']/g, (char) => map[char]);
  }
}


// Instantiate the result presenter once the DOM is ready.
document.addEventListener('DOMContentLoaded', () => {
  new ResultPresenter();
});
