import { defineStore } from 'pinia';
import { api, getToken, setToken, getStoredUser, setStoredUser } from '../api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: getToken(),
    user: getStoredUser(),
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    isAdmin: (s) => s.user?.role === 'admin',
  },
  actions: {
    async login(username, password) {
      const data = await api('/api/auth/login', { method: 'POST', body: { username, password } });
      this.token = data.token;
      this.user = data.user;
      setToken(data.token);
      setStoredUser(data.user);
    },
    async register(username, password) {
      const data = await api('/api/auth/register', { method: 'POST', body: { username, password } });
      this.token = data.token;
      this.user = data.user;
      setToken(data.token);
      setStoredUser(data.user);
    },
    logout() {
      this.token = null;
      this.user = null;
      setToken(null);
      setStoredUser(null);
    },
  },
});
