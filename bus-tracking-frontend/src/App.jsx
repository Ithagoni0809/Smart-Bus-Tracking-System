// src/App.jsx — All routes, lazy-loaded, with role-based protection

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider }   from './context/AuthContext';
import { ThemeProvider }  from './context/ThemeContext';
import { SocketProvider } from './context/SocketContext';
import { ProtectedRoute } from './components/common';
import Navbar  from './components/common/Navbar';
import Spinner from './components/common/Spinner';

// Public
const Home           = lazy(() => import('./pages/passenger/Home'));
const Login          = lazy(() => import('./pages/Login'));
const Register       = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const NotFound       = lazy(() => import('./pages/NotFound'));

// Passenger
const Dashboard     = lazy(() => import('./pages/passenger/Dashboard'));
const LiveMap       = lazy(() => import('./pages/passenger/LiveMap'));
const SearchBus     = lazy(() => import('./pages/passenger/SearchBus'));
const BusDetails    = lazy(() => import('./pages/passenger/BusDetails'));
const RouteDetails  = lazy(() => import('./pages/passenger/RouteDetails'));
const Favorites     = lazy(() => import('./pages/passenger/Favorites'));
const Notifications = lazy(() => import('./pages/passenger/Notifications'));
const Profile       = lazy(() => import('./pages/passenger/Profile'));

// Driver
const DriverDashboard = lazy(() => import('./pages/driver/DriverDashboard'));

// Admin
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ManageBuses    = lazy(() => import('./pages/admin/ManageBuses'));
const ManageRoutes   = lazy(() => import('./pages/admin/ManageRoutes'));
const ManageDrivers  = lazy(() => import('./pages/admin/ManageDrivers'));
const ManageStops    = lazy(() => import('./pages/admin/ManageStops'));
const ManageUsers    = lazy(() => import('./pages/admin/ManageUsers'));
const ManageAdmins   = lazy(() => import('./pages/admin/ManageAdmins'));
const Analytics      = lazy(() => import('./pages/admin/Analytics'));

const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <Spinner size="lg" />
  </div>
);

const ADMIN_ROLES = ['admin', 'superadmin'];

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: { background: '#fff', color: '#1a1a1a', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '14px' },
              }}
            />
            <Navbar />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* ── Public ─────────────────────────────── */}
                <Route path="/"                element={<Home />} />
                <Route path="/login"           element={<Login />} />
                <Route path="/register"        element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />

                {/* ── Passenger ──────────────────────────── */}
                <Route path="/dashboard"     element={<ProtectedRoute roles={['passenger']}><Dashboard /></ProtectedRoute>} />
                <Route path="/live-map"      element={<ProtectedRoute roles={['passenger']}><LiveMap /></ProtectedRoute>} />
                <Route path="/search"        element={<ProtectedRoute roles={['passenger']}><SearchBus /></ProtectedRoute>} />
                <Route path="/favorites"     element={<ProtectedRoute roles={['passenger']}><Favorites /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute roles={['passenger']}><Notifications /></ProtectedRoute>} />
                <Route path="/buses/:id"     element={<ProtectedRoute roles={['passenger', ...ADMIN_ROLES]}><BusDetails /></ProtectedRoute>} />
                <Route path="/routes/:id"    element={<ProtectedRoute roles={['passenger', ...ADMIN_ROLES]}><RouteDetails /></ProtectedRoute>} />
                <Route path="/profile"       element={<ProtectedRoute roles={['passenger', 'driver', ...ADMIN_ROLES]}><Profile /></ProtectedRoute>} />

                {/* ── Driver ─────────────────────────────── */}
                <Route path="/driver" element={<ProtectedRoute roles={['driver']}><DriverDashboard /></ProtectedRoute>} />

                {/* ── Admin ──────────────────────────────── */}
                <Route path="/admin"                element={<ProtectedRoute roles={ADMIN_ROLES}><AdminDashboard /></ProtectedRoute>} />
                <Route path="/admin/buses"          element={<ProtectedRoute roles={ADMIN_ROLES}><ManageBuses /></ProtectedRoute>} />
                <Route path="/admin/routes"         element={<ProtectedRoute roles={ADMIN_ROLES}><ManageRoutes /></ProtectedRoute>} />
                <Route path="/admin/drivers"        element={<ProtectedRoute roles={ADMIN_ROLES}><ManageDrivers /></ProtectedRoute>} />
                <Route path="/admin/stops"          element={<ProtectedRoute roles={ADMIN_ROLES}><ManageStops /></ProtectedRoute>} />
                <Route path="/admin/users"          element={<ProtectedRoute roles={ADMIN_ROLES}><ManageUsers /></ProtectedRoute>} />
                <Route path="/admin/admins"         element={<ProtectedRoute roles={['superadmin']}><ManageAdmins /></ProtectedRoute>} />
                <Route path="/admin/analytics"      element={<ProtectedRoute roles={ADMIN_ROLES}><Analytics /></ProtectedRoute>} />

                {/* ── Fallback ────────────────────────────── */}
                <Route path="/home" element={<Navigate to="/" replace />} />
                <Route path="*"    element={<NotFound />} />
              </Routes>
            </Suspense>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
