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
      // Only redirect if we're not already on the login page (avoids loops).
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
