import { DataStore } from './data-store.js';

class AuthService {
  async loadUsers() {
    return DataStore.loadUsers();
  }

  getCurrentUser() {
    return DataStore.getStorageItem(DataStore.currentUserKey);
  }

  setCurrentUser(user) {
    if (user) {
      DataStore.setStorageItem(DataStore.currentUserKey, user);
    }
  }

  logout() {
    window.localStorage.removeItem(DataStore.currentUserKey);
  }

  isAdmin(user) {
    return user?.role === 'admin';
  }

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

  requireLogin(fallback = '/index.html') {
    const user = this.getCurrentUser();
    if (!user) {
      window.location.href = fallback;
      throw new Error('Redirecting to login.');
    }
    return user;
  }
}

const authService = new AuthService();
export { authService };
export const getCurrentUser = () => authService.getCurrentUser();
export const loginUser = (email, password) => authService.loginUser(email, password);
export const registerUser = (payload) => authService.registerUser(payload);
export const logoutUser = () => authService.logout();
export const userIsAdmin = (user) => authService.isAdmin(user);
export const requireLogin = (fallback) => authService.requireLogin(fallback);
