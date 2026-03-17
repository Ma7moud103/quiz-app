/**
 * DataStore Module
 * Handles all data persistence and retrieval from localStorage and app-data.json
 * Uses caching to minimize server requests
 */

const DATA_URL = 'public/data/app-data.json';

const STORAGE_KEYS = Object.freeze({
  QUESTIONS: 'dq-questions',
  QUIZZES: 'dq-quizzes',
  USERS: 'dq-users',
  CURRENT_USER: 'dq-current-user',
});

/**
 * DataStore - Central data management service
 * Handles fetching from server and caching in localStorage
 */
class DataStore {
  static cache = null;

  /**
   * Fetch application data from JSON file
   * @returns {Promise<Object>} Application data with questions, quizzes, users
   */
  static async fetchAppData() {
    if (this.cache) {
      return this.cache;
    }

    try {
      console.log('📡 Fetching app data from:', DATA_URL);
      
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      
      console.log('📊 Response status:', response.status);
      
      if (!response.ok) {
        console.error('❌ HTTP Error:', response.status, response.statusText);
        
        if (response.status === 404) {
          throw new Error(
            `Data file not found at: ${DATA_URL}\n\n` +
            `Please ensure app-data.json exists at public/data/app-data.json`
          );
        } else if (response.status === 403) {
          throw new Error(`Access denied to: ${DATA_URL}`);
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }
      
      this.cache = await response.json();
      console.log('✅ App data loaded successfully');
      console.log('📊 Data summary:', {
        quizzes: this.cache.quizzes?.length || 0,
        questions: this.cache.questions?.length || 0,
        users: this.cache.users?.length || 0
      });
      
      return this.cache;
    } catch (error) {
      console.error('❌ Data loading failed:', error);
      console.error('📋 Attempted URL:', DATA_URL);
      console.error('📍 Current page:', window.location.href);
      
      if (error instanceof TypeError) {
        throw new Error(
          'Unable to reach the data server. Check:\n' +
          '1. Server is running\n' +
          '2. File exists at: public/data/app-data.json\n' +
          '3. Internet connection is working'
        );
      }
      
      throw error;
    }
  }

  /**
   * Get item from localStorage with JSON parsing
   * @param {string} key - Storage key
   * @returns {any} Parsed value or null
   */
  static getStorageItem(key) {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }

  /**
   * Set item in localStorage with JSON stringification
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   */
  static setStorageItem(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  /**
   * Normalize question data structure
   * Ensures all questions have consistent format
   * @param {Object} entry - Question entry from data
   * @returns {Object} Normalized question object
   */
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

  /**
   * Load and cache questions
   * @returns {Promise<Array>} Array of question objects
   */
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

  /**
   * Persist questions to localStorage
   * @param {Array} value - Questions array
   */
  static persistQuestions(value) {
    this.setStorageItem(STORAGE_KEYS.QUESTIONS, value);
  }

  /**
   * Load and cache quizzes
   * @returns {Promise<Array>} Array of quiz objects
   */
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

  /**
   * Persist quizzes to localStorage
   * @param {Array} value - Quizzes array
   */
  static persistQuizzes(value) {
    this.setStorageItem(STORAGE_KEYS.QUIZZES, value);
  }

  /**
   * Load and cache users
   * @returns {Promise<Array>} Array of user objects
   */
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

  /**
   * Get current user storage key
   * @returns {string} Storage key constant
   */
  static get currentUserKey() {
    return STORAGE_KEYS.CURRENT_USER;
  }

  /**
   * Get users storage key
   * @returns {string} Storage key constant
   */
  static get usersKey() {
    return STORAGE_KEYS.USERS;
  }

  /**
   * Get quizzes storage key
   * @returns {string} Storage key constant
   */
  static get quizzesKey() {
    return STORAGE_KEYS.QUIZZES;
  }

  /**
   * Get questions storage key
   * @returns {string} Storage key constant
   */
  static get questionsKey() {
    return STORAGE_KEYS.QUESTIONS;
  }
}

// ============================================================================
// Module Exports
// ============================================================================

export { DataStore };
export const STORAGE = STORAGE_KEYS;
export const fetchAppData = () => DataStore.fetchAppData();
export const loadQuestions = () => DataStore.loadQuestions();
export const persistQuestions = (list) => DataStore.persistQuestions(list);
export const loadQuizzes = () => DataStore.loadQuizzes();
export const persistQuizzes = (list) => DataStore.persistQuizzes(list);
