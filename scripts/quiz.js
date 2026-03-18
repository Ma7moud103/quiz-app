/**
 * Quiz Runner Application
 * Starts a quiz, shows questions, tracks the user's selections, and keeps score.
 * Works as an ES6 module and stores the session in localStorage so data stays across refreshes.
 */

import { authService } from './auth.js';
import { askConfirmation } from './confirm.js';

// ============================================================================
// Constants
// ============================================================================

const SESSION_KEY = 'dq-quiz-session'; 
const RESULT_KEY = 'dq-last-result';   
const REVIEW_KEY = 'dq-review';        
const DATA_URL = 'public/data/app-data.json'; 

// Data helper responsible for loading quiz + question data once per session.
// ============================================================================
// Quiz Data Service — handles fetching the JSON and caching it locally.
// ============================================================================

class QuizDataService {
  static cache = null;

  /**
   * Fetch application data from the JSON file.
   * @returns {Promise<Object>} The quizzes, questions, and users payload.
   */
  static async fetchAppData() {
    if (this.cache) {
      return this.cache; // Reuse cached data instead of fetching again.
    }

    try {
      console.log('📡 بنعمل fetch للداتا من:', DATA_URL);
      
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      
      if (!response.ok) {
        // If the response object reports an error, throw a descriptive one.
        if (response.status === 404) {
          throw new Error('ملف الـ json مش موجود في المسار ده.');
        } else {
          throw new Error(`السيرفر مطلع error برقم: ${response.status}`);
        }
      }
      
      this.cache = await response.json();
      return this.cache;
    } catch (error) {
      console.error('❌ الـ fetch باظ عشان:', error);
      throw error;
    }
  }

  // Given a quiz ID, return the matching quiz definition.
  static async getQuizById(quizId) {
    const data = await this.fetchAppData();
    return data.quizzes?.find((q) => q.id === quizId) || null;
  }

  // Given a question ID, return the corresponding record.
  static async getQuestionById(questionId) {
    const data = await this.fetchAppData();
    return data.questions?.find((q) => q.id === questionId) || null;
  }

  // Load all questions described by the supplied IDs.
  static async loadQuestionsForQuiz(questionIds) {
    const data = await this.fetchAppData();
    const allQuestions = data.questions || [];

    return questionIds
      .map((id) => allQuestions.find((q) => q.id === id))
      .filter((q) => q !== undefined);
  }
}

// ============================================================================
// Quiz runner controller stitches the session data to the interface.
// ============================================================================
// Quiz Runner Controller (maestro)
// ============================================================================

class QuizRunner {
  constructor() {
    // Ensure the user is logged in; otherwise send them back to login.
    this.currentUser = authService.requireLogin('/index.html');

    // Cache the DOM elements we need from the HTML.
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

    // Track the current quiz session, selection, and submission state.
    this.session = null;
    this.selectedAnswer = null;
    this.isAnswerSubmitted = false;

    // Run the initialization helpers.
    this.bindEvents();
    this.populateUserInfo();
    this.initialize();
  }

  // Wire click events for logout and navigation buttons.
  // Attach logout and next buttons to their handlers.
  bindEvents() {
    this.logoutBtn.addEventListener('click', this.handleLogout.bind(this));
    this.nextBtn.addEventListener('click', this.handleNext.bind(this));
  }

  // Display the greeting for the logged-in user.
  // Update the UI greeting with the authenticated user.
  populateUserInfo() {
    if (this.currentUser?.name) {
      this.greetingEl.textContent = this.currentUser.name;
    }
  }

  // At startup, load the session and begin displaying the quiz.
  // Load the saved quiz session and render the first question.
  async initialize() {
    try {
      this.session = this.loadSession();

      if (!this.session || !this.session.questions?.length) {
      this.showMissingSession(); // If no session exists, send the user back to the dashboard.
        return;
      }

      this.ensureSessionStructure(); // Ensure the session object has the expected shape.

      // Hide the loading placeholder and show the quiz panel.
      this.placeholder.classList.add('d-none');
      this.panel.classList.remove('d-none');

      this.renderHeader();
      this.renderQuestion();
    } catch (error) {
      this.showError(error.message);
    }
  }

  // Read the current quiz session from localStorage.
  // Deserialize the quiz session from localStorage.
  loadSession() {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  // Persist the session into localStorage so refreshing keeps the progress.
  // Persist the current progress so it survives refreshes.
  saveSession() {
    if (!this.session) return;
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
  }

  // Make sure the session object contains the needed properties and arrays.
  // Guarantee the session object has all required fields before rendering.
  ensureSessionStructure() {
    if (!this.session) return;
    this.session.currentIndex = typeof this.session.currentIndex === 'number' ? this.session.currentIndex : 0;
    this.session.score = typeof this.session.score === 'number' ? this.session.score : 0;

    if (!Array.isArray(this.session.answers)) {
      this.session.answers = Array(this.session.questions.length).fill(null);
    }
  }

  // Render the header area including title, progress bar, and score.
  // Refresh header text, progress bar and score display.
  renderHeader() {
    const total = this.session.questions.length;
    const current = Math.min(this.session.currentIndex + 1, total);
    const percentage = Math.round((current / total) * 100);

    this.titleEl.textContent = this.session.title || 'Untitled Quiz';
    this.descriptionEl.textContent = this.session.description || '';
    this.progressEl.textContent = `${current}/${total}`;
    
    const progressBar = document.querySelector('.quiz-progress-bar');
    if (progressBar) {
      progressBar.style.width = percentage + '%';
    }
    
    this.scoreEl.textContent = this.session.score ?? 0;
  }

  // Display the active question and its answer choices.
  // Draw the current question and its options.
  renderQuestion() {
    const currentQuestion = this.session.questions[this.session.currentIndex];

    if (!currentQuestion) {
      this.finishQuiz();
      return;
    }

    this.selectedAnswer = null;
    this.feedbackEl.textContent = '';

    this.questionLabel.textContent = currentQuestion.category || 'Question';
    this.questionIndexEl.textContent = `Question ${this.session.currentIndex + 1} of ${this.session.questions.length}`;
    this.questionTextEl.textContent = currentQuestion.question;

    this.optionsEl.innerHTML = '';
    this.renderOptions(currentQuestion);
    this.restorePreviousAnswer(); // Reapply any previously selected answer.
    this.updateNextButton();      // Update the button label to "Finish" on the last question.
    this.renderHeader();
  }

  // Generate the option buttons inside the HTML layout.
  // Generate the option buttons for a question.
  renderOptions(question) {
    const options = question.options || [];
    options.forEach((optionText, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'col-12';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-outline-light rounded-3 w-100 text-start option-choice';
      
      const letterLabel = String.fromCharCode(65 + index); // Assign letters A, B, C... to the options.
      button.innerHTML = `<strong>${letterLabel}.</strong> ${this.escapeHtml(optionText)}`;

      button.addEventListener('click', () => this.selectAnswer(index, button));
      wrapper.appendChild(button);
      this.optionsEl.appendChild(wrapper);
    });
  }

  // If the user already selected an answer for this question, mark it active.
  // Highlight the previously selected option if the user already answered.
  restorePreviousAnswer() {
    const previousAnswerIndex = this.session.answers?.[this.session.currentIndex];
    if (typeof previousAnswerIndex === 'number' && previousAnswerIndex >= 0) {
      const optionButtons = this.optionsEl.querySelectorAll('.option-choice');
      if (optionButtons[previousAnswerIndex]) {
        optionButtons[previousAnswerIndex].classList.add('active');
        this.selectedAnswer = previousAnswerIndex;
      }
    }
  }

  // When the user clicks an option, record the selection.
  // Track user selection and persist it immediately.
  selectAnswer(index, button) {
    this.selectedAnswer = index;
    // Remove the active class from all options, then mark the clicked button.
    this.optionsEl.querySelectorAll('.option-choice').forEach((btn) => btn.classList.remove('active'));
    button.classList.add('active');
    this.feedbackEl.textContent = '';

    if (this.session) {
      this.session.answers[this.session.currentIndex] = index;
      this.saveSession();
    }
  }

  // Set the Next button label to "Finish quiz" on the last question.
  // Update the Next/Finish button label depending on progress.
  updateNextButton() {
    const isLastQuestion = this.session.currentIndex + 1 >= this.session.questions.length;
    this.nextBtn.textContent = isLastQuestion ? 'Finish quiz' : 'Next question';
  }

  // Handle the Next button click, or finish if on the last question.
  // Validate selection, grade it, and move to the next question.
  handleNext() {
    // Validation: require a selected answer before moving on.
    if (this.selectedAnswer === null) {
      this.feedbackEl.textContent = '⚠️ معلش اختار إجابة الأول.';
      return;
    }

    this.evaluateAnswer(); // Check if the answer is correct and adjust the score.
    this.session.currentIndex += 1;
    this.saveSession();

    if (this.session.currentIndex >= this.session.questions.length) {
      this.finishQuiz();
      return;
    }

    this.renderQuestion();
  }

  // Compare the selected answer against the correct answers list.
  // Compare the selected option with the stored correct answers.
  evaluateAnswer() {
    const currentQuestion = this.session.questions[this.session.currentIndex];
    const correctAnswers = Array.isArray(currentQuestion.correctAnswers) ? currentQuestion.correctAnswers : [];

    if (correctAnswers.includes(this.selectedAnswer)) {
      this.session.score += 1;
    }
  }

  // End the quiz, save the result and answers into sessionStorage, then redirect to results.
  // Compile the result payload and redirect to the summary screen.
  finishQuiz() {
    const total = this.session.questions.length;
    const score = this.session.score;
    const percentage = Math.round((score / total) * 100);

    const result = {
      quizTitle: this.session.title,
      correct: score,
      total: total,
      percentage: percentage,
      timestamp: new Date().toISOString(),
    };

    sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));
    sessionStorage.setItem(REVIEW_KEY, JSON.stringify({
      quizTitle: this.session.title,
      questions: this.session.questions,
      answers: this.session.answers,
      correct: score,
      total: total,
    }));

    window.localStorage.removeItem(SESSION_KEY);
    window.location.href = '/results.html';
  }

  // Logout with confirmation before clearing the session.
  // Ask for confirmation and reset session-related storage on logout.
  async handleLogout() {
    const confirmed = await askConfirmation({
      title: 'Confirm sign out',
      message: 'إنت متأكد إنك عايز تخرج وتوقف الكويز؟',
      confirmLabel: 'Log out',
      cancelLabel: 'Keep playing',
    });

    if (!confirmed) return;

    window.localStorage.removeItem(SESSION_KEY);
    authService.logout();
    window.location.href = '/index.html';
  }

  // Escape HTML characters to guard against XSS.
  // Guard against XSS when rendering free text from the data file.
  escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, (char) => map[char]);
  }
}

// When the DOM is ready, instantiate QuizRunner.
document.addEventListener('DOMContentLoaded', () => {
  new QuizRunner();
});
