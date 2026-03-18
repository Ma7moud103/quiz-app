import { loadQuestions, loadQuizzes } from './data-store.js';
import { authService } from './auth.js';
import { askConfirmation } from './confirm.js';

const QUIZ_SESSION_KEY = 'dq-quiz-session';

// Controller for the quiz dashboard, including filtering, search, and session creation.
class DashboardApp {
  constructor() {
    this.quizGrid = document.getElementById('quiz-grid');
    this.skeletonGrid = document.getElementById('skeleton-grid');
    this.filtersEl = document.getElementById('category-filters');
    this.searchInput = document.getElementById('search-input');
    this.greetingEl = document.getElementById('user-greeting');
    this.roleEl = document.getElementById('active-role');
    this.questionBankLink = document.getElementById('question-bank-link');
    this.logoutBtn = document.getElementById('logout-btn');

    this.state = {
      quizzes: [],
      search: '',
      category: 'All',
      categories: ['All'],
    };

    this.currentUser = authService.requireLogin('/index.html');
    this.bindEvents();
    this.populateUserInfo();
    this.init();
  }

  bindEvents() {
    // Attach event handlers for logout and search filtering.
    this.logoutBtn.addEventListener('click', this.handleLogout.bind(this));
    this.searchInput.addEventListener('input', this.handleSearch.bind(this));
  }

  populateUserInfo() {
    if (this.currentUser) {
      this.greetingEl.textContent = `Hi, ${this.currentUser.name}!`;
      this.roleEl.textContent = `Role: ${authService.isAdmin(this.currentUser) ? 'Administrator' : 'Learner'}`;
      if (!authService.isAdmin(this.currentUser)) {
        this.questionBankLink.classList.add('visually-hidden');
      }
    }
  }

  async init() {
    // Load quiz metadata and refresh UI once data is ready.
    try {
      const quizzes = await loadQuizzes();
      this.state.quizzes = Array.isArray(quizzes) ? quizzes : [];
      this.state.categories = ['All', ...new Set(this.state.quizzes.map((quiz) => quiz.category))];
      this.renderFilters();
      this.renderQuizzes();
    } catch (error) {
      this.quizGrid.innerHTML = `
        <div class="col-12 text-danger text-center">
          ${error.message}
        </div>
      `;
    } finally {
      this.skeletonGrid.classList.add('d-none');
      this.quizGrid.classList.remove('d-none');
    }
  }

  handleSearch(event) {
    this.state.search = event.target.value;
    this.renderQuizzes();
  }

  async handleLogout() {
    const confirmed = await askConfirmation({
      title: 'Confirm sign out',
      message: 'Are you sure you want to log out of the quiz console?',
      confirmLabel: 'Log out',
      cancelLabel: 'Stay',
    });
    if (!confirmed) return;
    authService.logout();
    window.location.href = '/index.html';
  }

  // Generate the set of filter buttons based on loaded categories.
  renderFilters() {
    this.filtersEl.innerHTML = '';
    this.state.categories.forEach((category) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `btn btn-sm ${this.state.category === category ? 'btn-primary' : 'btn-outline-light'}`;
      button.textContent = category;
      button.addEventListener('click', () => {
        this.state.category = category;
        this.renderFilters();
        this.renderQuizzes();
      });
      this.filtersEl.appendChild(button);
    });
  }

  renderQuizzes() {
    const normalizedSearch = this.state.search.trim().toLowerCase();
    const filtered = this.state.quizzes.filter((quiz) => {
      const matchesCategory = this.state.category === 'All' || quiz.category === this.state.category;
      const matchesSearch = !normalizedSearch || quiz.title.toLowerCase().includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });

    this.quizGrid.innerHTML = '';
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'col-12 text-center text-white py-5';
      empty.innerHTML = '<p class="mb-0">No quizzes match your filters yet.</p>';
      this.quizGrid.appendChild(empty);
      return;
    }

    const isAdmin = authService.isAdmin(this.currentUser);
    filtered.forEach((quiz) => {
      const card = document.createElement('div');
      card.className = 'col-sm-6 col-xl-4';
      const startButtonHtml = isAdmin
        ? ''
        : `<button class="btn btn-primary mt-3 align-self-start" type="button">Start quiz</button>`;
      card.innerHTML = `
        <div class="card bg-panel text-white h-100 fade-in">
          <div class="card-body d-flex flex-column gap-3">
            <div>
              <h5 class="card-title mb-1">${quiz.title}</h5>
              <p class="text-muted mb-2">${quiz.description}</p>
              <span class="badge text-bg-secondary">${quiz.category}</span>
            </div>
            <div class="mt-auto d-flex justify-content-between text-muted small">
              <div>${quiz.questionCount} questions</div>
              <div>${quiz.duration} min</div>
            </div>
            ${startButtonHtml}
          </div>
        </div>
      `;
      const startBtn = card.querySelector('button');
      if (startBtn) {
        startBtn.addEventListener('click', async () => {
          try {
            await this.startQuizSession(quiz);
            window.location.href = '/quiz.html';
          } catch (error) {
            this.showStartError(error);
          }
        });
      }
      this.quizGrid.appendChild(card);
    });
  }

  async startQuizSession(quiz) {
    // Build the quiz session payload and persist it before redirecting.
    const bank = await loadQuestions();
    const questionIds =
      Array.isArray(quiz.questionIds) && quiz.questionIds.length
        ? quiz.questionIds
        : bank.slice(0, quiz.questionCount || bank.length).map((entry) => entry.id);
    
    const questions = questionIds
      .map((id) => bank.find((question) => question.id === id))
      .filter(Boolean);
    
    if (!questions.length) {
      throw new Error('Unable to load the questions for this quiz.');
    }
    const session = {
      quizId: quiz.id,
      title: quiz.title,
      description: quiz.description ?? '',
      duration: quiz.duration ?? 0,
      questions,
      currentIndex: 0,
      score: 0,
    };
    window.localStorage.setItem(QUIZ_SESSION_KEY, JSON.stringify(session));
  }

  showStartError(error) {
    alert(error.message || 'Unable to start the quiz right now.');
  }
}

new DashboardApp();
