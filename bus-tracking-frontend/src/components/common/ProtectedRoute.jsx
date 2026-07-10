// src/components/common/ProtectedRoute.jsx
// ─────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS:
//   Wraps any route that requires the user to be logged in.
//   If not authenticated, redirects to /login.
//   If authenticated but wrong role (e.g. passenger trying to visit
//   /driver), redirects to their correct home page.
//
// USAGE in App.jsx:
//   <Route path="/dashboard" element={<ProtectedRoute roles={['passenger']}><Dashboard /></ProtectedRoute>} />
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Spinner from './Spinner';

const ProtectedRoute = ({ children, roles = [] }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // While AuthContext is checking the session (page load), show spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Not authenticated → redirect to login, preserve the intended destination
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated but wrong role
  if (roles.length > 0 && !roles.includes(user.role)) {
    const redirectMap = {
      passenger: '/dashboard',
      driver:    '/driver',
      admin:     '/admin',
      superadmin:'/admin',
    };
    return <Navigate to={redirectMap[user.role] || '/'} replace />;
  }

  return children;
};

export default ProtectedRoute;
