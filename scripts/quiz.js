import { askConfirmation } from './confirm.js';
import { authService } from './auth.js';

const SESSION_KEY = 'dq-quiz-session';
const RESULT_KEY = 'dq-last-result';
const REVIEW_KEY = 'dq-review';

class QuizRunner {
  constructor() {
    this.currentUser = authService.requireLogin('/index.html');
    this.greetingEl = document.getElementById('user-greeting');
    this.logoutBtn = document.getElementById('logout-btn');
    this.titleEl = document.getElementById('quiz-title');
    this.descriptionEl = document.getElementById('quiz-description');
    this.progressEl = document.getElementById('quiz-progress');
    this.scoreEl = document.getElementById('quiz-score');
    this.placeholder = document.getElementById('quiz-placeholder');
    this.panel = document.getElementById('quiz-panel');
    this.questionLabel = document.getElementById('quiz-question-label');
    this.questionIndexEl = document.getElementById('quiz-question-index');
    this.questionTextEl = document.getElementById('quiz-question-text');
    this.optionsEl = document.getElementById('quiz-options');
    this.feedbackEl = document.getElementById('quiz-feedback');
    this.nextBtn = document.getElementById('next-question-btn');
    this.selectedAnswer = null;

    this.session = this.loadSession();
    this.bindEvents();
    this.populateUserInfo();
    this.initialize();
  }

  bindEvents() {
    this.logoutBtn.addEventListener('click', this.handleLogout.bind(this));
    this.nextBtn.addEventListener('click', this.handleNext.bind(this));
  }

  populateUserInfo() {
    this.greetingEl.textContent = this.currentUser?.name ?? '';
  }

  initialize() {
    if (!this.session || !this.session.questions?.length) {
      this.showMissingSession();
      return;
    }
    this.ensureAnswersArray();
    this.placeholder.classList.add('d-none');
    this.panel.classList.remove('d-none');
    this.renderHeader();
    this.renderQuestion();
  }

  loadSession() {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  saveSession() {
    if (!this.session) return;
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
  }

  ensureAnswersArray() {
    if (!this.session) return;
    this.session.currentIndex = typeof this.session.currentIndex === 'number' ? this.session.currentIndex : 0;
    this.session.score = typeof this.session.score === 'number' ? this.session.score : 0;
    if (!Array.isArray(this.session.answers)) {
      this.session.answers = Array(this.session.questions.length).fill(null);
      return;
    }
    if (this.session.answers.length < this.session.questions.length) {
      const additional = Array(this.session.questions.length - this.session.answers.length).fill(null);
      this.session.answers = [...this.session.answers, ...additional];
    }
  }

  renderHeader() {
    const total = this.session.questions.length;
    const current = Math.min(this.session.currentIndex + 1, total);
    this.titleEl.textContent = this.session.title || 'Untitled quiz';
    this.descriptionEl.textContent = this.session.description || '';
    this.progressEl.textContent = `${current}/${total}`;
    this.scoreEl.textContent = this.session.score ?? 0;
  }

  renderQuestion() {
    const question = this.session.questions[this.session.currentIndex];
    if (!question) {
      this.finishQuiz();
      return;
    }
    this.questionLabel.textContent = question.category || 'Question';
    this.questionIndexEl.textContent = `Question ${this.session.currentIndex + 1} of ${this.session.questions.length}`;
    this.questionTextEl.textContent = question.question;
    this.optionsEl.innerHTML = '';
    this.selectedAnswer = null;
    this.feedbackEl.textContent = '';
    question.options.forEach((option, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'col-12';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-outline-light rounded-3 w-100 text-start option-choice';
      button.dataset.index = index;
      button.innerHTML = `<strong>${String.fromCharCode(65 + index)}.</strong> ${option}`;
      button.addEventListener('click', () => this.selectAnswer(index, button));
      wrapper.appendChild(button);
      this.optionsEl.appendChild(wrapper);
      const previous = this.session.answers?.[this.session.currentIndex];
      if (typeof previous === 'number' && previous === index) {
        button.classList.add('active');
        this.selectedAnswer = index;
      }
    });
    this.updateNextButton();
    this.renderHeader();
  }

  selectAnswer(index, button) {
    this.selectedAnswer = index;
    this.optionsEl.querySelectorAll('.option-choice').forEach((optionBtn) => {
      optionBtn.classList.remove('active');
    });
    button.classList.add('active');
    this.feedbackEl.textContent = '';
    if (this.session) {
      this.session.answers[this.session.currentIndex] = index;
      this.saveSession();
    }
  }

  updateNextButton() {
    const isLast = this.session.currentIndex + 1 >= this.session.questions.length;
    this.nextBtn.textContent = isLast ? 'Finish quiz' : 'Next question';
  }

  async handleLogout() {
    const confirmed = await askConfirmation({
      title: 'Confirm sign out',
      message: 'Are you sure you want to leave the quiz and log out?',
      confirmLabel: 'Log out',
      cancelLabel: 'Keep playing',
    });
    if (!confirmed) return;
    authService.logout();
    window.location.href = '/index.html';
  }

  handleNext() {
    if (this.selectedAnswer === null) {
      this.feedbackEl.textContent = 'Please select an answer before continuing.';
      return;
    }
    this.evaluateAnswer();
    this.session.currentIndex += 1;
    if (this.session.currentIndex >= this.session.questions.length) {
      this.finishQuiz();
      return;
    }
    this.saveSession();
    this.renderQuestion();
  }

  evaluateAnswer() {
    const question = this.session.questions[this.session.currentIndex];
    const correct = Array.isArray(question.correctAnswers)
      ? question.correctAnswers
      : [];
    if (correct.includes(this.selectedAnswer)) {
      this.session.score += 1;
    }
  }

  finishQuiz() {
    const result = {
      quizTitle: this.session.title,
      correct: this.session.score,
      total: this.session.questions.length,
      score: this.session.score,
      duration: this.session.duration ?? null,
      timestamp: new Date().toISOString(),
    };
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));
    sessionStorage.setItem(REVIEW_KEY, JSON.stringify({
      quizTitle: this.session.title,
      questions: this.session.questions,
      answers: this.session.answers,
      correct: this.session.score,
      total: this.session.questions.length,
    }));
    window.localStorage.removeItem(SESSION_KEY);
    window.location.href = '/results.html';
  }

  showMissingSession() {
    this.placeholder.innerHTML = '<p class="text-warning mb-0">No active quiz was found. Redirecting back to the dashboard…</p>';
    setTimeout(() => {
      window.location.href = '/dashboard.html';
    }, 1800);
  }
}

new QuizRunner();
