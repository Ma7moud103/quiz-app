import { loadQuestions, persistQuestions, loadQuizzes, persistQuizzes } from './data-store.js';
import { authService } from './auth.js';
import { askConfirmation } from './confirm.js';

class QuestionBankApp {
  constructor() {
    this.questionSection = document.getElementById('question-section');
    this.skeleton = document.getElementById('question-skeletons');
    this.accessMessage = document.getElementById('access-message');
    this.userGreeting = document.getElementById('user-greeting');
    this.logoutBtn = document.getElementById('logout-btn');
    this.filtersEl = document.getElementById('category-filters');
    this.totalBadge = document.getElementById('total-count');
    this.visibleBadge = document.getElementById('visible-count');
    this.tableBody = document.getElementById('question-table-body');
    this.questionForm = document.getElementById('question-form');
    this.questionText = document.getElementById('question-text');
    this.questionCategory = document.getElementById('question-category');
    this.resetQuestionBtn = document.getElementById('reset-question');
    this.feedbackEl = document.getElementById('question-feedback');
    this.quizForm = document.getElementById('quiz-form');
    this.quizFeedback = document.getElementById('quiz-feedback');
    this.quizQuestionList = document.getElementById('quiz-questions-list');
    this.quizSelectionSummary = document.getElementById('quiz-selection-summary');
    this.optionContainer = document.getElementById('option-fields');
    this.addOptionBtn = document.getElementById('add-option');
    this.questionModal = document.getElementById('question-modal');
    this.formTitleEl = document.getElementById('question-form-title');
    this.formSubtitleEl = document.getElementById('question-form-subtitle');
    this.cancelEditBtn = document.getElementById('cancel-edit');
    this.saveQuestionBtn = document.getElementById('save-question-btn');
    this.formTitleEl = document.getElementById('question-form-title');
    this.formSubtitleEl = document.getElementById('question-form-subtitle');
    this.cancelEditBtn = document.getElementById('cancel-edit');
    this.saveQuestionBtn = document.getElementById('save-question-btn');

    this.state = {
      questions: [],
      quizzes: [],
      currentCategory: 'All',
      categories: ['All'],
    };
    this.selectedQuizQuestionIds = new Set();
    this.editingId = null;
    this.minOptions = 2;
    this.maxOptions = 8;
    this.currentUser = authService.requireLogin('/index.html');

    this.bindEvents();
    this.userGreeting.textContent = this.currentUser?.name ?? '';
    this.enforceAccess();
  }

  bindEvents() {
    this.logoutBtn.addEventListener('click', this.handleLogout.bind(this));
    this.questionForm.addEventListener('submit', this.handleQuestionSubmit.bind(this));
    this.quizForm.addEventListener('submit', this.handleQuizSubmit.bind(this));
    this.addOptionBtn.addEventListener('click', this.handleAddOption.bind(this));
    this.resetQuestionBtn.addEventListener('click', (event) => {
      event.preventDefault();
      this.resetForm();
      this.openQuestionModal('add');
    });
    this.questionModal?.addEventListener('click', (event) => {
      if (event.target === this.questionModal) {
        this.hideQuestionModal();
      }
    });
    if (this.cancelEditBtn) {
      this.cancelEditBtn.addEventListener('click', (evt) => {
        evt.preventDefault();
        this.hideQuestionModal();
        this.resetForm();
      });
    }
  }

  enforceAccess() {
    if (!authService.isAdmin(this.currentUser)) {
      this.skeleton.classList.add('d-none');
      this.accessMessage.textContent = 'Admin access required. Redirecting to dashboard…';
      this.accessMessage.classList.remove('d-none');
      setTimeout(() => window.location.href = '/dashboard.html', 1800);
      return;
    }
    this.questionSection.classList.remove('d-none');
    this.boot();
  }

  async boot() {
    try {
      this.state.questions = await loadQuestions();
      this.state.quizzes = await loadQuizzes();
      this.refreshCategories();
      this.renderFilters();
      this.resetForm();
      this.renderTable();
      this.renderQuizQuestions();
    } catch (error) {
      this.accessMessage.textContent = error.message;
      this.accessMessage.classList.remove('d-none');
    } finally {
      this.skeleton.classList.add('d-none');
      this.questionSection.classList.remove('d-none');
    }
  }

  refreshCategories() {
    const categories = new Set(this.state.questions.map((entry) => entry.category));
    this.state.categories = ['All', ...categories];
    if (!this.state.categories.includes(this.state.currentCategory)) {
      this.state.currentCategory = 'All';
    }
  }

  handleLogout() {
    return askConfirmation({
      title: 'Confirm sign out',
      message: 'Are you sure you want to log out of the question bank?',
      confirmLabel: 'Log out',
      cancelLabel: 'Stay',
    }).then((confirmed) => {
      if (!confirmed) return;
      authService.logout();
      window.location.href = '/index.html';
    });
  }

  handleAddOption() {
    if (this.optionContainer.children.length >= this.maxOptions) return;
    this.optionContainer.appendChild(this.buildOptionField('', false));
    this.updateOptionLabels();
    this.updateOptionControls();
  }

  handleQuestionSubmit(event) {
    event.preventDefault();
    this.feedbackEl.innerHTML = '';
    const payload = this.buildQuestionPayload();
    if (payload.error) {
      this.feedbackEl.innerHTML = payload.error;
      return;
    }
    const questionPayload = payload.data;
    const message = this.editingId ? this.updateQuestion(questionPayload) : this.addQuestion(questionPayload);
    persistQuestions(this.state.questions);
    this.refreshCategories();
    this.renderFilters();
    this.renderTable();
    this.renderQuizQuestions();
    this.feedbackEl.innerHTML = `<div class="alert alert-success">${message}</div>`;
    this.hideQuestionModal();
    this.resetForm();
  }

  buildQuestionPayload() {
    const text = this.questionText.value.trim();
    const category = this.questionCategory.value.trim();
    if (!text || !category) {
      return { error: '<div class="alert alert-warning">Provide a question and category.</div>' };
    }
    const optionFields = Array.from(this.optionContainer.children) || [];
    const options = optionFields.map((field) => {
      const input = field.querySelector('input[type="text"]');
      return input.value.trim();
    });
    if (options.some((value) => !value)) {
      return { error: '<div class="alert alert-warning">All option fields must have text.</div>' };
    }
    if (options.length < this.minOptions) {
      return { error: '<div class="alert alert-warning">Add at least two options.</div>' };
    }
    const correctIndexes = optionFields
      .map((field, index) => (field.querySelector('.correct-checkbox').checked ? index : -1))
      .filter((index) => index >= 0);
    if (!correctIndexes.length) {
      return { error: '<div class="alert alert-warning">Mark at least one correct answer.</div>' };
    }
    const payload = {
      id: this.editingId || Date.now(),
      question: text,
      category,
      options,
      correctAnswers: correctIndexes,
    };
    return { data: payload };
  }

  renderFilters() {
    this.filtersEl.innerHTML = '';
    this.state.categories.forEach((category) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `btn btn-sm ${this.state.currentCategory === category ? 'btn-primary' : 'btn-outline-light'}`;
      button.textContent = category;
      button.addEventListener('click', () => {
        this.state.currentCategory = category;
        this.renderFilters();
        this.renderTable();
      });
      this.filtersEl.appendChild(button);
    });
  }

  renderTable() {
    const filtered = this.state.questions.filter((entry) =>
      this.state.currentCategory === 'All' || entry.category === this.state.currentCategory,
    );
    this.totalBadge.textContent = `Total ${this.state.questions.length}`;
    this.visibleBadge.textContent = `Showing ${filtered.length}`;
    this.tableBody.innerHTML = '';
    if (!filtered.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 5;
      cell.className = 'text-muted';
      cell.textContent = 'No questions yet. Add one using the form.';
      row.appendChild(cell);
      this.tableBody.appendChild(row);
      return;
    }
    filtered.forEach((question) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="align-middle">${question.question}</td>
        <td class="align-middle">${question.category}</td>
        <td class="align-middle"><small>${question.options.join(' | ')}</small></td>
        <td class="align-middle text-success">
          ${this.formatCorrectAnswers(question)}
        </td>
        <td class="align-middle">
          <div class="d-flex gap-2 flex-wrap">
            <button type="button" class="btn btn-sm btn-outline-light" data-edit="${question.id}">Edit</button>
            <button type="button" class="btn btn-sm btn-danger" data-delete="${question.id}">Delete</button>
          </div>
        </td>
      `;
      this.tableBody.appendChild(row);
    });
    this.tableBody.querySelectorAll('[data-edit]').forEach((button) => {
      button.addEventListener('click', () => this.fillForm(Number(button.dataset.edit)));
    });
    this.tableBody.querySelectorAll('[data-delete]').forEach((button) => {
      button.addEventListener('click', () => this.handleDelete(Number(button.dataset.delete)));
    });
  }

  formatCorrectAnswers(question) {
    if (!question.correctAnswers?.length) return 'None';
    return question.correctAnswers.map((index) => {
      const label = question.options[index] ? question.options[index] : `Option ${index + 1}`;
      return `<div>${label}</div>`;
    }).join('');
  }

  handleDelete(id) {
    askConfirmation({
      title: 'Delete question',
      message: 'This will remove the question forever. Continue?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    }).then((confirmed) => {
      if (!confirmed) return;
      this.state.questions = this.state.questions.filter((entry) => entry.id !== id);
      persistQuestions(this.state.questions);
      this.refreshCategories();
      this.renderFilters();
      this.renderTable();
      this.renderQuizQuestions();
    });
  }

  fillForm(questionId) {
    const question = this.state.questions.find((entry) => entry.id === questionId);
    if (!question) return;
    this.editingId = question.id;
    this.questionText.value = question.question;
    this.questionCategory.value = question.category;
    this.populateOptionFields(question.options, question.correctAnswers);
    this.scrollToForm();
    this.updateFormMode('edit');
    this.openQuestionModal('edit');
  }

  populateOptionFields(options, correctIndexes) {
    this.optionContainer.innerHTML = '';
    const total = Math.max(options.length, 4);
    for (let index = 0; index < total; index += 1) {
      const value = options[index] ?? '';
      const isCorrect = correctIndexes.includes(index);
      this.optionContainer.appendChild(this.buildOptionField(value, isCorrect));
    }
    this.updateOptionLabels();
    this.updateOptionControls();
  }

  addQuestion(questionPayload) {
    this.state.questions = [questionPayload, ...this.state.questions];
    return 'Question added.';
  }

  updateQuestion(questionPayload) {
    this.state.questions = this.state.questions.map((item) =>
      (item.id === this.editingId ? questionPayload : item));
    return 'Question updated.';
  }

  buildOptionField(value = '', isCorrect = false) {
    const wrapper = document.createElement('div');
    wrapper.className = 'option-field';
    const inputId = `option-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const floating = document.createElement('div');
    floating.className = 'form-floating flex-grow-1';
    const input = document.createElement('input');
    input.type = 'text';
    input.id = inputId;
    input.className = 'form-control bg-dark text-white border-0';
    input.placeholder = 'Option text';
    input.required = true;
    input.value = value;
    const label = document.createElement('label');
    label.className = 'option-label';
    label.setAttribute('for', inputId);
    floating.appendChild(input);
    floating.appendChild(label);
    const checkWrapper = document.createElement('div');
    checkWrapper.className = 'form-check form-switch text-white d-flex align-items-center gap-1';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'form-check-input correct-checkbox';
    checkbox.id = `${inputId}-correct`;
    checkbox.checked = isCorrect;
    const checkboxLabel = document.createElement('label');
    checkboxLabel.className = 'form-check-label small text-white-50 mb-0';
    checkboxLabel.setAttribute('for', checkbox.id);
    checkboxLabel.textContent = 'Correct';
    checkWrapper.appendChild(checkbox);
    checkWrapper.appendChild(checkboxLabel);
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-outline-danger btn-sm remove-option';
    removeBtn.textContent = '\u00d7';
    removeBtn.addEventListener('click', () => this.removeOptionField(wrapper));
    wrapper.appendChild(floating);
    wrapper.appendChild(checkWrapper);
    wrapper.appendChild(removeBtn);
    return wrapper;
  }

  removeOptionField(field) {
    if (this.optionContainer.children.length <= this.minOptions) return;
    field.remove();
    this.updateOptionLabels();
    this.updateOptionControls();
  }

  updateOptionLabels() {
    Array.from(this.optionContainer.children).forEach((field, index) => {
      const label = field.querySelector('.option-label');
      if (label) {
        label.textContent = `Option ${index + 1}`;
      }
    });
  }

  updateOptionControls() {
    const canRemove = this.optionContainer.children.length > this.minOptions;
    this.optionContainer.querySelectorAll('.remove-option').forEach((button) => {
      button.disabled = !canRemove;
      button.classList.toggle('btn-outline-secondary', !canRemove);
      button.classList.toggle('btn-outline-danger', canRemove);
    });
    this.addOptionBtn.disabled = this.optionContainer.children.length >= this.maxOptions;
  }

  resetForm() {
    this.editingId = null;
    this.questionForm.reset();
    this.optionContainer.innerHTML = '';
    for (let index = 0; index < 4; index += 1) {
      this.optionContainer.appendChild(this.buildOptionField('', false));
    }
    this.updateOptionLabels();
    this.updateOptionControls();
    this.feedbackEl.innerHTML = '';
    this.selectedQuizQuestionIds.clear();
    this.updateQuizSelectionSummary();
    this.updateFormMode('add');
  }

  scrollToForm() {
    this.questionForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  updateFormMode(mode = 'add') {
    if (!this.formTitleEl || !this.formSubtitleEl) return;
    if (mode === 'edit') {
      this.formTitleEl.textContent = 'Edit question';
      this.formSubtitleEl.textContent = 'Adjust the existing question before saving the changes.';
      if (this.cancelEditBtn) {
        this.cancelEditBtn.classList.remove('d-none');
      }
      if (this.saveQuestionBtn) {
        this.saveQuestionBtn.classList.add('btn-primary');
        this.saveQuestionBtn.classList.remove('btn-success');
        this.saveQuestionBtn.textContent = 'Update question';
      }
    } else {
      this.formTitleEl.textContent = 'Add question';
      this.formSubtitleEl.textContent = 'Create a fresh question to expand the bank.';
      if (this.cancelEditBtn) {
        this.cancelEditBtn.classList.add('d-none');
      }
      if (this.saveQuestionBtn) {
        this.saveQuestionBtn.classList.remove('btn-primary');
        this.saveQuestionBtn.classList.add('btn-success');
        this.saveQuestionBtn.textContent = 'Save question';
      }
    }
  }

  openQuestionModal(mode = 'add') {
    this.updateFormMode(mode);
    if (this.questionModal) {
      this.questionModal.classList.remove('d-none');
    }
    document.body.classList.add('modal-open');
  }

  hideQuestionModal() {
    if (this.questionModal) {
      this.questionModal.classList.add('d-none');
    }
    document.body.classList.remove('modal-open');
  }

  renderQuizQuestions() {
    this.quizQuestionList.innerHTML = '';
    if (!this.state.questions.length) {
      this.selectedQuizQuestionIds.clear();
      this.updateQuizSelectionSummary();
      this.quizQuestionList.innerHTML = '<span class="text-muted">Add questions first.</span>';
      return;
    }
    const prevSelection = new Set(this.selectedQuizQuestionIds);
    this.selectedQuizQuestionIds.clear();
    this.state.questions.forEach((question) => {
      const label = document.createElement('label');
      label.className = 'btn btn-outline-light btn-sm flex-grow-1 quiz-question-pill d-flex align-items-center gap-2';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = question.id;
      checkbox.className = 'visually-hidden quiz-question-checkbox';
      checkbox.checked = prevSelection.has(question.id);
      if (checkbox.checked) {
        label.classList.add('active');
        this.selectedQuizQuestionIds.add(question.id);
      }
      label.appendChild(checkbox);
      label.insertAdjacentHTML('beforeend', this.truncateQuestion(question.question));
      checkbox.addEventListener('change', () => this.toggleQuizSelection(question.id, label, checkbox.checked));
      this.quizQuestionList.appendChild(label);
    });
    this.updateQuizSelectionSummary();
  }

  toggleQuizSelection(questionId, label, isChecked) {
    if (isChecked) {
      this.selectedQuizQuestionIds.add(questionId);
      label.classList.add('active');
    } else {
      this.selectedQuizQuestionIds.delete(questionId);
      label.classList.remove('active');
    }
    this.updateQuizSelectionSummary();
  }

  updateQuizSelectionSummary() {
    if (!this.quizSelectionSummary) return;
    const count = this.selectedQuizQuestionIds.size;
    this.quizSelectionSummary.textContent = `${count} question${count === 1 ? '' : 's'} selected`;
  }

  truncateQuestion(text) {
    if (text.length <= 60) {
      return `<span>${text}</span>`;
    }
    return `<span>${text.slice(0, 60)}…</span>`;
  }

  handleQuizSubmit(event) {
    event.preventDefault();
    this.quizFeedback.innerHTML = '';
    const title = this.quizForm.querySelector('#quiz-title').value.trim();
    const category = this.quizForm.querySelector('#quiz-category').value.trim();
    const duration = Number(this.quizForm.querySelector('#quiz-duration').value.trim());
    const selected = Array.from(this.quizQuestionList.querySelectorAll('.quiz-question-checkbox'))
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => Number(checkbox.value));
    if (!title || !category || !duration || !selected.length) {
      this.quizFeedback.innerHTML = '<div class="alert alert-warning">Title, category, duration, and at least one question are required.</div>';
      return;
    }
    const quiz = {
      id: Date.now(),
      title,
      category,
      duration,
      questionIds: selected,
    };
    this.state.quizzes = [quiz, ...this.state.quizzes];
    persistQuizzes(this.state.quizzes);
    this.quizForm.reset();
    this.quizFeedback.innerHTML = '<div class="alert alert-success">Quiz saved. It will be available on the dashboard.</div>';
    this.quizQuestionList.querySelectorAll('.quiz-question-checkbox').forEach((checkbox) => {
      checkbox.checked = false;
    });
  }
}

new QuestionBankApp();
