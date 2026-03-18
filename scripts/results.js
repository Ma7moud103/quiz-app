/**
 * تطبيق عرض النتائج (Results Presenter)
 * بيعرض نتيجة الكويز وبيعمل مراجعة (review) تفصيلية للأسئلة والإجابات.
 * بيستخدم ES6 modules والـ sessionStorage عشان يشيل الداتا بشكل مؤقت.
 */

import { authService } from './auth.js';
import { askConfirmation } from './confirm.js';

// ============================================================================
// Constants
// ============================================================================

const RESULT_KEY = 'dq-last-result';
const REVIEW_KEY = 'dq-review';

// ============================================================================
// Results Presenter Controller
// ============================================================================

/**
 * الـ ResultPresenter - مسؤول عن عرض النتيجة وإدارة الـ review
 * بيسحب الداتا من الـ sessionStorage وبيعمل render للـ UI بتاع النتيجة والمراجعة
 */
class ResultPresenter {
  constructor() {
    // التأكد إن الـ user عامل login
    this.currentUser = authService.requireLogin('/index.html');

    // مسك الـ DOM Elements
    this.greetingEl = document.getElementById('user-greeting');
    this.logoutBtn = document.getElementById('logout-btn');
    this.contentEl = document.getElementById('result-content');
    this.reviewBtn = document.getElementById('review-btn');
    this.reviewContainer = document.getElementById('review-container');
    this.reviewList = document.getElementById('review-list');

    // الـ State
    this.resultData = null;
    this.reviewData = null;
    this.isReviewOpen = false;

    // البداية (Initialize)
    this.bindEvents();
    this.populateUserInfo();
    this.populate();
  }

  /**
   * ربط الـ event listeners بالعناصر
   */
  bindEvents() {
    this.logoutBtn.addEventListener('click', this.handleLogout.bind(this));
    if (this.reviewBtn) {
      this.reviewBtn.addEventListener('click', this.handleReviewToggle.bind(this));
    }
  }

  /**
   * عرض اسم الـ user في الـ greeting
   */
  populateUserInfo() {
    if (this.currentUser?.name) {
      this.greetingEl.textContent = this.currentUser.name;
    }
  }

  /**
   * الـ Method الأساسية - بتسحب النتائج وتعرضها
   */
  populate() {
    // سحب الداتا من الـ sessionStorage
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
   * سحب بيانات الـ review من الـ sessionStorage
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
   * رسم (Render) نتائج الكويز في المنطقة المخصصة لها
   */
  renderResults() {
    if (!this.resultData) return;

    const { quizTitle, correct, total, percentage, duration, timestamp } = this.resultData;

    // حساب الـ letter grade (A, B, C...)
    const grade = this.calculateGrade(percentage);

    // تظبيط شكل الـ timestamp
    const formattedDate = new Date(timestamp).toLocaleString();

    // تحديد الـ CSS classes بناءً على الـ performance
    const scoreClass = this.getScoreClass(percentage);

    // بناء الـ HTML بتاع النتيجة
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
   * حساب التقدير (Grade) بناءً على الـ percentage
   */
  calculateGrade(percentage) {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }

  /**
   * اختيار الـ CSS class للـ score بناءً على الـ performance
   */
  getScoreClass(percentage) {
    if (percentage >= 80) return 'text-success';
    if (percentage >= 60) return 'text-warning';
    return 'text-danger';
  }

  /**
   * اختيار الـ Bootstrap alert class بناءً على الـ performance
   */
  getPerformanceAlertClass(percentage) {
    if (percentage >= 80) return 'alert alert-success';
    if (percentage >= 60) return 'alert alert-warning';
    return 'alert alert-danger';
  }

  /**
   * اختيار رسالة التشجيع بناءً على الـ score
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
   * تظبيط حالة زرار الـ review
   */
  configureReviewButton() {
    if (!this.reviewBtn) return;

    // لو مفيش داتا للمراجعة، بنقفل الزرار
    if (!this.reviewData || !this.reviewData.questions) {
      this.reviewBtn.disabled = true;
      this.reviewBtn.title = 'Review data not available';
      return;
    }

    // تفعيل الزرار وكتابة النص المبدئي
    this.reviewBtn.disabled = false;
    this.reviewBtn.textContent = 'Review quiz';
  }

  /**
   * الـ handler بتاع زرار المراجعة - بيفتح ويقفل القسم ويعمل render لو محتاج
   */
  handleReviewToggle() {
    if (!this.reviewContainer) return;

    const isHidden = this.reviewContainer.classList.contains('d-none');

    if (isHidden && !this.isReviewOpen) {
      // أول مرة يفتح - بنرسم الـ review
      this.renderReview();
      this.isReviewOpen = true;
    }

    // تبديل الـ visibility (إظهار/إخفاء)
    this.reviewContainer.classList.toggle('d-none');

    // تحديث نص الزرار
    const newText = this.reviewContainer.classList.contains('d-none')
      ? 'Review quiz'
      : 'Hide review';
    this.reviewBtn.textContent = newText;
  }

  /**
   * رسم تفاصيل المراجعة (الأسئلة، الإجابات، والشرح)
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
   * كاريته عنصر مراجعة لـ سؤال واحد
   */
  createReviewItem(question, index, answers) {
    const item = document.createElement('div');
    item.className = 'bg-panel border border-secondary rounded-3 p-3';

    // الـ Question header
    const header = document.createElement('div');
    header.className = 'd-flex justify-content-between align-items-center mb-3';
    header.innerHTML = `
      <strong>Question ${index + 1}</strong>
      <span class="badge text-bg-secondary">${this.escapeHtml(question.category || 'General')}</span>
    `;
    item.appendChild(header);

    // نص السؤال
    const questionText = document.createElement('p');
    questionText.className = 'mb-3 fw-semibold';
    questionText.textContent = question.question;
    item.appendChild(questionText);

    // قائمة الاختيارات
    const optionsList = this.createOptionsList(question, index, answers);
    item.appendChild(optionsList);

    return item;
  }

  /**
   * كاريته قائمة الاختيارات في مراجعة السؤال
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
   * كاريته عنصر اختيار واحد للمراجعة
   */
  createOptionElement(optionText, optionIndex, userAnswerIndex, correctAnswers) {
    const optionEl = document.createElement('div');
    optionEl.className = 'list-group-item bg-dark text-white border d-flex justify-content-between align-items-center';

    // تحديد الـ styling بناءً على الإجابة صح ولا غلط
    const isCorrect = correctAnswers.includes(optionIndex);
    const isUserSelected = userAnswerIndex === optionIndex;

    if (isCorrect) {
      optionEl.classList.add('border-success', 'border-3');
    } else if (isUserSelected && !isCorrect) {
      optionEl.classList.add('border-warning', 'border-3');
    }

    // نص الاختيار مع الـ letter label (A, B...)
    const letterLabel = String.fromCharCode(65 + optionIndex);
    const optionTextEl = document.createElement('span');
    optionTextEl.innerHTML = `<strong>${letterLabel}.</strong> ${this.escapeHtml(optionText)}`;
    optionEl.appendChild(optionTextEl);

    // الـ Status badge (صح ولا غلطتك)
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
   * إظهار رسالة لو مفيش نتائج موجودة
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
   * الـ Logout مع رسالة التأكيد
   */
  async handleLogout() {
    const confirmed = await askConfirmation({
      title: 'Confirm sign out',
      message: 'Are you sure you want to sign out?',
      confirmLabel: 'Log out',
      cancelLabel: 'Stay',
    });

    if (!confirmed) return;

    // تنظيف الـ sessionStorage وعمل logout
    sessionStorage.removeItem(RESULT_KEY);
    sessionStorage.removeItem(REVIEW_KEY);
    authService.logout();
    window.location.href = '/index.html';
  }

  /**
   * عمل escape للـ HTML عشان نمنع الـ XSS
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


// تشغيل الـ result presenter أول ما الـ DOM يجهز
document.addEventListener('DOMContentLoaded', () => {
  new ResultPresenter();
});