// src/services/api.js
// ─────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS:
//   Every component in the app that makes an HTTP request imports
//   this pre-configured Axios instance instead of raw `axios`.
//   Benefits:
//   1. baseURL set once — never type "http://localhost:5000/api" again
//   2. Request interceptor auto-attaches the JWT access token to
//      every request's Authorization header
//   3. Response interceptor catches 401 "token expired" errors
//      and silently refreshes the access token, retries the original
//      request, and resolves — the calling component never knows
//      the refresh happened (seamless user experience)
// ─────────────────────────────────────────────────────────────

import axios from 'axios';

// Create an Axios instance with defaults
// baseURL resolution:
//  - Local dev (`npm run dev`): relative '/api' lets Vite's server.proxy
//    (vite.config.js) forward to http://localhost:5000/api — avoids CORS
//    entirely during development.
//  - Production build: Vite's dev proxy does NOT exist at runtime (it's a
//    dev-server-only feature), and frontend/backend are separate deployed
//    services with different domains — so we need the real backend URL,
//    baked in at build time via VITE_API_URL.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,  // CRITICAL: sends the httpOnly refreshToken cookie on every request
  headers: { 'Content-Type': 'application/json' },
});

// ── Request Interceptor ─────────────────────────────────────────────────────
// Runs before EVERY outgoing request.
// Reads the access token from the module-level store and attaches it.
// (We use a module-level variable instead of localStorage for XSS safety.)
let accessToken = null;

export const setAccessToken = (token) => { accessToken = token; };
export const clearAccessToken = () => { accessToken = null; };
export const getAccessToken = () => accessToken;

api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor ─────────────────────────────────────────────────────
// Runs after EVERY incoming response.
// If the server returns 401 (access token expired), we:
//   1. Call POST /api/auth/refresh-token (the refreshToken httpOnly cookie is
//      automatically sent with this request because withCredentials: true)
//   2. Store the new access token
//   3. Retry the original failed request with the new token
// If the refresh itself fails (refresh token also expired), we clear state
// and redirect to login.
let isRefreshing = false;
let failedQueue = []; // Queue of requests that failed while we were refreshing

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response, // Pass successful responses through unchanged

  async (error) => {
    const originalRequest = error.config;

    // Only intercept 401 errors that aren't from the auth endpoints themselves
    // (to avoid infinite loops — if /auth/login returns 401, that's a real error)
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/')
    ) {
      if (isRefreshing) {
        // If a refresh is already in progress, queue this request to retry
        // after the refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true; // Flag to prevent infinite retry loop
      isRefreshing = true;

      try {
        const response = await api.post('/auth/refresh-token');
        const newToken = response.data.accessToken;
        setAccessToken(newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAccessToken();
        // Redirect to login page — refresh token also expired
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ── Named API helpers ─────────────────────────────────────────────────────────
// Convenience wrappers so controllers don't import and call `api.get(...)` directly.
// Every module has its own section of endpoints here.

// Auth
export const authAPI = {
  register:             (data) => api.post('/auth/register', data),
  login:                (data) => api.post('/auth/login', data),
  logout:               ()     => api.post('/auth/logout'),
  getMe:                ()     => api.get('/auth/me'),
  forgotPassword:       (data) => api.post('/auth/forgot-password', data),
  resetPassword:        (token, data) => api.patch(`/auth/reset-password/${token}`, data),
  changePassword:       (data) => api.patch('/auth/change-password', data),
  verifyEmail:          (token) => api.get(`/auth/verify-email/${token}`),
  resendVerification:   ()     => api.post('/auth/resend-verification'),
};

// Buses
export const busAPI = {
  getAll:        (params) => api.get('/buses', { params }),
  search:        (params) => api.get('/buses/search', { params }),
  getLive:       (params) => api.get('/buses/live', { params }),
  getById:       (id)     => api.get(`/buses/${id}`),
  create:        (data)   => api.post('/buses', data),
  update:        (id, data) => api.put(`/buses/${id}`, data),
  delete:        (id)     => api.delete(`/buses/${id}`),
  assignDriver:  (id, driverId) => api.patch(`/buses/${id}/assign-driver`, { driverId }),
  assignRoute:   (id, routeId)  => api.patch(`/buses/${id}/assign-route`, { routeId }),
};

// Routes
export const routeAPI = {
  getAll:         ()       => api.get('/routes'),
  search:         (params) => api.get('/routes/search', { params }),
  getById:        (id)     => api.get(`/routes/${id}`),
  getNearestStops:(params) => api.get('/routes/stops/nearest', { params }),
  getRemainingStops:(id, currentSequence) => api.get(`/routes/${id}/remaining-stops`, { params: { currentSequence } }),
  create:         (data)   => api.post('/routes', data),
  update:         (id, data) => api.put(`/routes/${id}`, data),
  delete:         (id)     => api.delete(`/routes/${id}`),
  addStop:        (id, data) => api.post(`/routes/${id}/stops`, data),
  removeStop:     (id, stopId) => api.delete(`/routes/${id}/stops/${stopId}`),
};

// Trips
export const tripAPI = {
  start:      (data)   => api.post('/trips/start', data),
  end:        (tripId, data) => api.patch(`/trips/${tripId}/end`, data),
  getById:    (id)     => api.get(`/trips/${id}`),
  getHistory: (params) => api.get('/trips/history', { params }),
};

// Favourites (these will hit /api/favorites once we build that controller)
export const favoriteAPI = {
  getAll:   () => api.get('/favorites'),
  add:      (data) => api.post('/favorites', data),
  remove:   (id)  => api.delete(`/favorites/${id}`),
};

// Notifications
export const notificationAPI = {
  getAll:   (params) => api.get('/notifications', { params }),
  markRead: (id)     => api.patch(`/notifications/${id}/read`),
  markAllRead: ()    => api.patch('/notifications/read-all'),
};

export default api;

// Stops
export const stopAPI = {
  getAll:   (params) => api.get('/stops', { params }),
  getById:  (id)     => api.get(`/stops/${id}`),
  create:   (data)   => api.post('/stops', data),
  update:   (id, data) => api.put(`/stops/${id}`, data),
  delete:   (id)     => api.delete(`/stops/${id}`),
  getNearest: (params) => api.get('/stops/nearest', { params }),
};

// Admin
export const adminAPI = {
  getAnalytics:     ()       => api.get('/admin/analytics'),
  getAllDrivers:     (params) => api.get('/admin/drivers', { params }),
  createDriver:     (data)   => api.post('/admin/drivers', data),
  getDriver:        (id)     => api.get(`/admin/drivers/${id}`),
  updateDriver:     (id, data) => api.put(`/admin/drivers/${id}`, data),
  toggleDriverStatus: (id)   => api.patch(`/admin/drivers/${id}/deactivate`),
  getAllUsers:       (params) => api.get('/admin/users', { params }),
  toggleUserStatus: (id)     => api.patch(`/admin/users/${id}/toggle`),
  // Admin management (superadmin only)
  getAllAdmins:         ()        => api.get('/admin/admins'),
  createAdmin:          (data)    => api.post('/admin/admins', data),
  toggleAdminStatus:    (id)      => api.patch(`/admin/admins/${id}/toggle`),
  updateAdminRole:      (id, role) => api.patch(`/admin/admins/${id}/role`, { role }),
  updateAdminPermissions: (id, permissions) => api.patch(`/admin/admins/${id}/permissions`, { permissions }),
};
