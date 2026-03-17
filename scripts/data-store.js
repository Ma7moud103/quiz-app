const DATA_URL = '/data/app-data.json';

const STORAGE_KEYS = Object.freeze({
  QUESTIONS: 'dq-questions',
  QUIZZES: 'dq-quizzes',
  USERS: 'dq-users',
  CURRENT_USER: 'dq-current-user',
});

class DataStore {
  static cache = null;

  static async fetchAppData() {
    if (this.cache) {
      return this.cache;
    }
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Unable to load the content catalog.');
    }
    this.cache = await response.json();
    return this.cache;
  }

  static getStorageItem(key) {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }

  static setStorageItem(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  static normalizeQuestion(entry) {
    const options = Array.isArray(entry.options) ? entry.options : [];
    let correctIndexes = Array.isArray(entry.correctAnswers)
      ? entry.correctAnswers
      : typeof entry.correctAnswer === 'number'
      ? [entry.correctAnswer]
      : [];
    correctIndexes = correctIndexes
      .map((index) => Number(index))
      .filter((index) => Number.isFinite(index) && index >= 0 && index < options.length);
    return {
      ...entry,
      options,
      correctAnswers: [...new Set(correctIndexes)],
    };
  }

  static async loadQuestions() {
    const stored = this.getStorageItem(STORAGE_KEYS.QUESTIONS);
    if (stored) {
      return stored;
    }
    const data = await this.fetchAppData();
    const initial = Array.isArray(data.questions)
      ? data.questions.map((entry) => this.normalizeQuestion(entry))
      : [];
    this.setStorageItem(STORAGE_KEYS.QUESTIONS, initial);
    return initial;
  }

  static persistQuestions(value) {
    this.setStorageItem(STORAGE_KEYS.QUESTIONS, value);
  }

  static async loadQuizzes() {
    const stored = this.getStorageItem(STORAGE_KEYS.QUIZZES);
    if (stored) {
      return stored;
    }
    const data = await this.fetchAppData();
    const initial = Array.isArray(data.quizzes) ? data.quizzes : [];
    this.setStorageItem(STORAGE_KEYS.QUIZZES, initial);
    return initial;
  }

  static persistQuizzes(value) {
    this.setStorageItem(STORAGE_KEYS.QUIZZES, value);
  }

  static async loadUsers() {
    const stored = this.getStorageItem(STORAGE_KEYS.USERS);
    if (stored) {
      return stored;
    }
    const data = await this.fetchAppData();
    const initial = Array.isArray(data.users) ? data.users : [];
    this.setStorageItem(STORAGE_KEYS.USERS, initial);
    return initial;
  }

  static get currentUserKey() {
    return STORAGE_KEYS.CURRENT_USER;
  }

  static get usersKey() {
    return STORAGE_KEYS.USERS;
  }

  static get quizzesKey() {
    return STORAGE_KEYS.QUIZZES;
  }

  static get questionsKey() {
    return STORAGE_KEYS.QUESTIONS;
  }
}

export { DataStore };
export const STORAGE = STORAGE_KEYS;
export const fetchAppData = () => DataStore.fetchAppData();
export const loadQuestions = () => DataStore.loadQuestions();
export const persistQuestions = (list) => DataStore.persistQuestions(list);
export const loadQuizzes = () => DataStore.loadQuizzes();
export const persistQuizzes = (list) => DataStore.persistQuizzes(list);
