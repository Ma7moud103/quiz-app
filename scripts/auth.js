/**
 * Authentication Service Module
 * Handles user login, registration, and session management
 * Uses DataStore for user data persistence
 */

import { DataStore } from './data-store.js';

/**
 * AuthService - Central authentication management
 * Handles user authentication, registration, and authorization
 */
class AuthService {
  /**
   * Load all users from data store
   * @returns {Promise<Array>} Array of user objects
   */
  async loadUsers() {
    return DataStore.loadUsers();
  }

  /**
   * Get currently logged-in user
   * @returns {Object|null} Current user object or null
   */
  getCurrentUser() {
    return DataStore.getStorageItem(DataStore.currentUserKey);
  }

  /**
   * Set current user in storage
   * @param {Object} user - User object to store
   */
  setCurrentUser(user) {
    if (user) {
      DataStore.setStorageItem(DataStore.currentUserKey, user);
    }
  }

  /**
   * Logout current user
   * Clears user from localStorage
   */
  logout() {
    window.localStorage.removeItem(DataStore.currentUserKey);
  }

  /**
   * Check if user is admin
   * @param {Object} user - User object to check
   * @returns {boolean} True if user is admin
   */
  isAdmin(user) {
    return user?.role === 'admin';
  }

  /**
   * Login user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} User object if successful
   * @throws {Error} If credentials are invalid
   */
  async loginUser(email, password) {
    const users = await this.loadUsers();
    const normalized = (email || '').trim().toLowerCase();
    const user = users.find(
      (entry) => entry.email.toLowerCase() === normalized && entry.password === password,
    );
    
    if (!user) {
      throw new Error('Invalid credentials.');
    }
    
    this.setCurrentUser(user);
    return user;
  }

  /**
   * Register new user
   * @param {Object} payload - Registration data { name, email, password }
   * @returns {Promise<Object>} New user object
   * @throws {Error} If validation fails or email exists
   */
  async registerUser(payload) {
    const { name, email, password } = payload;
    
    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      throw new Error('All fields are required.');
    }
    
    const users = await this.loadUsers();
    const normalized = email.trim().toLowerCase();
    
    if (users.some((entry) => entry.email.toLowerCase() === normalized)) {
      throw new Error('Email already registered.');
    }
    
    const newUser = {
      id: Date.now(),
      name: name.trim(),
      email: normalized,
      password,
      role: 'student',
    };
    
    users.push(newUser);
    DataStore.setStorageItem(DataStore.usersKey, users);
    return newUser;
  }

  /**
   * Require user to be logged in
   * Redirects to login page if not authenticated
   * @param {string} fallback - Redirect URL if not logged in
   * @returns {Object} Current user object
   * @throws {Error} If user not logged in
   */
  requireLogin(fallback = '/index.html') {
    const user = this.getCurrentUser();
    
    if (!user) {
      window.location.href = fallback;
      throw new Error('Redirecting to login.');
    }
    
    return user;
  }
}

// ============================================================================
// Module Exports
// ============================================================================

const authService = new AuthService();

export { authService };
export const getCurrentUser = () => authService.getCurrentUser();
export const loginUser = (email, password) => authService.loginUser(email, password);
export const registerUser = (payload) => authService.registerUser(payload);
export const logoutUser = () => authService.logout();
export const userIsAdmin = (user) => authService.isAdmin(user);
export const requireLogin = (fallback) => authService.requireLogin(fallback);
