// WHY THIS FILE EXISTS
// --------------------
// A single configured Axios instance used by the whole app.
//   - baseURL = '/api'  -> works with nginx proxy in prod AND Vite proxy in dev.
//   - request interceptor  -> auto-attaches the JWT from localStorage.
//   - response interceptor -> on 401, clears the token and redirects to /login.
// Centralising this means feature code just calls apiClient.get('/incidents') —
// no auth boilerplate scattered around.

import axios from 'axios';

export const TOKEN_KEY = 'incidentapp.token';

export const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      // Only signal expiry when the user was already inside the app (not on the login page itself).
      // A custom DOM event lets the SessionExpiredDialog component show a dialog instead of a
      // silent hard-redirect, so the user knows why they were bounced.
      if (!window.location.pathname.startsWith('/login')) {
        window.dispatchEvent(new CustomEvent('session-expired'));
      }
    }
    return Promise.reject(error);
  },
);
