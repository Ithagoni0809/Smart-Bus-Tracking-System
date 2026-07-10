// src/context/AuthContext.jsx
// ─────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS:
//   Provides global auth state (user, token, role) to every component
//   in the app without prop-drilling. Any component can call
//   useAuth() to know if the user is logged in, who they are, and
//   what role they have — without passing these down through 10 layers.
//
// IMPORTANT: The access token is stored in a JavaScript variable
//   (via services/api.js:setAccessToken) — NOT in localStorage.
//   This prevents XSS attacks from stealing tokens.
//   The refresh token lives in an httpOnly cookie (server sets it),
//   which is completely inaccessible from JavaScript.
// ─────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import { setAccessToken, clearAccessToken } from '../services/api';
import { disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true); // true while checking existing session

  // ── On mount: try to restore session ──────────────────────────────────────
  // If the user had a valid session before refreshing the page, the httpOnly
  // refresh token cookie is still in the browser. We call /auth/me — the
  // Axios interceptor in api.js will auto-refresh the access token if needed.
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const res = await authAPI.getMe();
        setUser(res.data.user);
        // The Axios interceptor has already set the access token by this point
      } catch {
        // No valid session — user needs to log in
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  // ── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const res = await authAPI.login({ email, password });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  // ── Register ─────────────────────────────────────────────────────────────
  const register = useCallback(async (formData) => {
    const res = await authAPI.register(formData);
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch { /* best-effort */ }
    clearAccessToken();
    disconnectSocket();
    setUser(null);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isAuthenticated = !!user;
  const isPassenger = user?.role === 'passenger';
  const isDriver    = user?.role === 'driver';
  const isAdmin     = user?.role === 'admin' || user?.role === 'superadmin';

  return (
    <AuthContext.Provider value={{
      user, setUser, loading,
      login, register, logout,
      isAuthenticated, isPassenger, isDriver, isAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook — components import this instead of useContext(AuthContext)
// which would require also importing AuthContext itself
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
