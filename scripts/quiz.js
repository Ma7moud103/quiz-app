/**
 * الـ Quiz Runner Application
 * الكود ده هو اللي بيقوم بالليلة: بيعمل start للكويز، بيعرض الأسئلة، بياخد الاختيارات، وبيحسب الـ score.
 * شغال ES6 modules وبيسيف الـ session في الـ localStorage عشان الداتا متطيرش لو عملت refresh.
 */

import { authService } from './auth.js';
import { askConfirmation } from './confirm.js';

// ============================================================================
// الـ Constants
// ============================================================================

const SESSION_KEY = 'dq-quiz-session'; 
const RESULT_KEY = 'dq-last-result';   
const REVIEW_KEY = 'dq-review';        
const DATA_URL = 'public/data/app-data.json'; 

// ============================================================================
// الـ Quiz Data Service (شغلته يسحب الداتا ويشيلها عنده)
// ============================================================================

class QuizDataService {
  static cache = null;

  /**
   * بيعمل fetch للداتا من ملف الـ JSON
   * @returns {Promise<Object>} الداتا اللي فيها الكويزات والأسئلة
   */
  static async fetchAppData() {
    if (this.cache) {
      return this.cache; // لو الداتا موجودة في الـ cache رجعها علطول بدل ما يعمل fetch تاني
    }

    try {
      console.log('📡 بنعمل fetch للداتا من:', DATA_URL);
      
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      
      if (!response.ok) {
        // لو الـ response فيه مشكلة بنرمي error بوضح السبب
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

  // بياخد الـ ID ويطلعلك الكويز بتاعه
  static async getQuizById(quizId) {
    const data = await this.fetchAppData();
    return data.quizzes?.find((q) => q.id === quizId) || null;
  }

  // بياخد الـ ID ويطلعلك السؤال بتاعه
  static async getQuestionById(questionId) {
    const data = await this.fetchAppData();
    return data.questions?.find((q) => q.id === questionId) || null;
  }

  // بيعمل load لكل الأسئلة اللي تبع كويز معين باستخدام الـ IDs بتاعتهم
  static async loadQuestionsForQuiz(questionIds) {
    const data = await this.fetchAppData();
    const allQuestions = data.questions || [];

    return questionIds
      .map((id) => allQuestions.find((q) => q.id === id))
      .filter((q) => q !== undefined);
  }
}

// ============================================================================
// الـ Quiz Runner Controller (المايسترو)
// ============================================================================

class QuizRunner {
  constructor() {
    // بيتأكد إن الـ user عامل login، لو مش عامل بيبعته لصفحة الـ index
    this.currentUser = authService.requireLogin('/index.html');

    // بنمسك الـ DOM Elements اللي هنحتاجها من الـ HTML
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

    // الـ State بتاعة الكويز
    this.session = null;
    this.selectedAnswer = null;
    this.isAnswerSubmitted = false;

    // تشغيل الـ functions الأساسية
    this.bindEvents();
    this.populateUserInfo();
    this.initialize();
  }

  // بنربط الـ click events بالزراير
  bindEvents() {
    this.logoutBtn.addEventListener('click', this.handleLogout.bind(this));
    this.nextBtn.addEventListener('click', this.handleNext.bind(this));
  }

  // بيعرض اسم الـ user اللي فاتح دلوقتي
  populateUserInfo() {
    if (this.currentUser?.name) {
      this.greetingEl.textContent = this.currentUser.name;
    }
  }

  // الـ بداية: بيعمل load للـ session ويبدأ يظهر الكويز
  async initialize() {
    try {
      this.session = this.loadSession();

      if (!this.session || !this.session.questions?.length) {
        this.showMissingSession(); // لو مفيش كويز بيبعته للـ dashboard
        return;
      }

      this.ensureSessionStructure(); // بيتأكد إن الـ session object سليم

      // بنخفي الـ loading placeholder ونظهر الـ panel بتاعة الكويز
      this.placeholder.classList.add('d-none');
      this.panel.classList.remove('d-none');

      this.renderHeader();
      this.renderQuestion();
    } catch (error) {
      this.showError(error.message);
    }
  }

  // بيجيب الـ session من الـ localStorage
  loadSession() {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  // بيسيف الـ session في الـ localStorage عشان لو عمل refresh
  saveSession() {
    if (!this.session) return;
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
  }

  // بيتأكد إن الـ session فيها كل الـ properties والـ arrays المطلوبة
  ensureSessionStructure() {
    if (!this.session) return;
    this.session.currentIndex = typeof this.session.currentIndex === 'number' ? this.session.currentIndex : 0;
    this.session.score = typeof this.session.score === 'number' ? this.session.score : 0;

    if (!Array.isArray(this.session.answers)) {
      this.session.answers = Array(this.session.questions.length).fill(null);
    }
  }

  // بيعمل render للهيدر (العنوان، والـ progress bar والـ score)
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

  // بيعرض السؤال الحالي والاختيارات بتاعته
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
    this.restorePreviousAnswer(); // لو مجاوب قبل كدة بيرجع الإجابة
    this.updateNextButton();      // بيغير نص الزرار لـ Finish لو آخر سؤال
    this.renderHeader();
  }

  // بيكريت زراير الـ options في الـ HTML
  renderOptions(question) {
    const options = question.options || [];
    options.forEach((optionText, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'col-12';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-outline-light rounded-3 w-100 text-start option-choice';
      
      const letterLabel = String.fromCharCode(65 + index); // بيدي حروف A, B, C...
      button.innerHTML = `<strong>${letterLabel}.</strong> ${this.escapeHtml(optionText)}`;

      button.addEventListener('click', () => this.selectAnswer(index, button));
      wrapper.appendChild(button);
      this.optionsEl.appendChild(wrapper);
    });
  }

  // لو الـ user كان مختار إجابة للسؤال ده قبل كدة، بنرجع الـ active class
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

  // لما الـ user يدوس على إجابة
  selectAnswer(index, button) {
    this.selectedAnswer = index;
    // بنشيل الـ active من الكل ونحطها للي اتداس عليه بس
    this.optionsEl.querySelectorAll('.option-choice').forEach((btn) => btn.classList.remove('active'));
    button.classList.add('active');
    this.feedbackEl.textContent = '';

    if (this.session) {
      this.session.answers[this.session.currentIndex] = index;
      this.saveSession();
    }
  }

  // بيخلي نص الزرار Finish quiz لو ده آخر سؤال
  updateNextButton() {
    const isLastQuestion = this.session.currentIndex + 1 >= this.session.questions.length;
    this.nextBtn.textContent = isLastQuestion ? 'Finish quiz' : 'Next question';
  }

  // لما الـ user يدوس على زرار Next
  handleNext() {
    // validation: لازم يختار إجابة الأول
    if (this.selectedAnswer === null) {
      this.feedbackEl.textContent = '⚠️ معلش اختار إجابة الأول.';
      return;
    }

    this.evaluateAnswer(); // بنشوف الإجابة صح ولا لأ ونزود الـ score
    this.session.currentIndex += 1;
    this.saveSession();

    if (this.session.currentIndex >= this.session.questions.length) {
      this.finishQuiz();
      return;
    }

    this.renderQuestion();
  }

  // بيقارن الـ selectedAnswer بالـ correctAnswers
  evaluateAnswer() {
    const currentQuestion = this.session.questions[this.session.currentIndex];
    const correctAnswers = Array.isArray(currentQuestion.correctAnswers) ? currentQuestion.correctAnswers : [];

    if (correctAnswers.includes(this.selectedAnswer)) {
      this.session.score += 1;
    }
  }

  // بينهي الكويز وبيسيف النتائج في الـ sessionStorage ويحولك لصفحة الـ results
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

  // الـ logout مع رسالة الـ confirmation
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

  // بتعمل escape للـ HTML عشان تحميك من الـ XSS
  escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, (char) => map[char]);
  }
}

// أول ما الـ DOM يحمل، بنعمل نيو QuizRunner
document.addEventListener('DOMContentLoaded', () => {
  new QuizRunner();
});