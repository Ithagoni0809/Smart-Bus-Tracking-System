// src/components/common/Navbar.jsx
// ─────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS:
//   Top navigation bar present on every page. Shows:
//   - Brand logo + name
//   - Main navigation links (changes based on auth state + role)
//   - Dark mode toggle button
//   - User avatar/name and logout button when logged in
// ─────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Bus, Map, Star, Bell, User, LogOut, Sun, Moon, Menu, X, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';
import toast from 'react-hot-toast';

const Navbar = () => {
  const { user, isAuthenticated, logout, isPassenger, isDriver, isAdmin } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { isConnected } = useSocket();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  // Active link styling — Tailwind class applied when route matches
  const linkClass = ({ isActive }) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-brand-blue text-white'
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`;

  return (
    <nav className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* ── Brand Logo ─────────────────────────────────────── */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 bg-brand-navy rounded-xl flex items-center justify-center shadow">
              <Bus className="text-white" size={20} />
            </div>
            <div className="hidden sm:block">
              <span className="text-lg font-bold text-brand-navy dark:text-white leading-none">
                Smart Bus
              </span>
              <span className="block text-xs text-gray-500 dark:text-gray-400 leading-none">
                Live Tracker
              </span>
            </div>
          </Link>

          {/* ── Desktop Nav Links ──────────────────────────────── */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center gap-1">
              {isPassenger && (
                <>
                  <NavLink to="/dashboard" className={linkClass}>
                    <Bus size={16} /> Dashboard
                  </NavLink>
                  <NavLink to="/live-map" className={linkClass}>
                    <Map size={16} /> Live Map
                  </NavLink>
                  <NavLink to="/favorites" className={linkClass}>
                    <Star size={16} /> Saved
                  </NavLink>
                  <NavLink to="/notifications" className={linkClass}>
                    <Bell size={16} /> Alerts
                  </NavLink>
                </>
              )}
              {isDriver && (
                <NavLink to="/driver" className={linkClass}>
                  <Bus size={16} /> Driver Panel
                </NavLink>
              )}
              {isAdmin && (
                <NavLink to="/admin" className={linkClass}>
                  Dashboard
                </NavLink>
              )}
            </div>
          )}

          {/* ── Right Side Actions ─────────────────────────────── */}
          <div className="flex items-center gap-2">
            {/* Real-time connection indicator */}
            {isAuthenticated && (
              <div
                className={`hidden sm:flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                  isConnected
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}
                title={isConnected ? 'Real-time connected' : 'Reconnecting...'}
              >
                {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                <span className="hidden lg:inline">{isConnected ? 'Live' : 'Offline'}</span>
              </div>
            )}

            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* User menu (desktop) */}
            {isAuthenticated ? (
              <div className="hidden md:flex items-center gap-2">
                <NavLink to="/profile" className={linkClass}>
                  <User size={16} />
                  <span className="max-w-[100px] truncate">{user?.name?.split(' ')[0]}</span>
                </NavLink>
                <button onClick={handleLogout} className="btn-secondary py-1.5 text-sm">
                  <LogOut size={15} /> Logout
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link to="/login"    className="btn-secondary py-1.5 text-sm">Login</Link>
                <Link to="/register" className="btn-primary  py-1.5 text-sm">Register</Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Menu ────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 space-y-1 animate-fade-in">
          {isAuthenticated ? (
            <>
              {isPassenger && (
                <>
                  <NavLink to="/dashboard"     className={linkClass} onClick={() => setMobileOpen(false)}>Dashboard</NavLink>
                  <NavLink to="/live-map"      className={linkClass} onClick={() => setMobileOpen(false)}>Live Map</NavLink>
                  <NavLink to="/favorites"     className={linkClass} onClick={() => setMobileOpen(false)}>Saved Routes</NavLink>
                  <NavLink to="/notifications" className={linkClass} onClick={() => setMobileOpen(false)}>Notifications</NavLink>
                  <NavLink to="/profile"       className={linkClass} onClick={() => setMobileOpen(false)}>Profile</NavLink>
                </>
              )}
              {isDriver && (
                <NavLink to="/driver" className={linkClass} onClick={() => setMobileOpen(false)}>Driver Panel</NavLink>
              )}
              {isAdmin && (
                <NavLink to="/admin" className={linkClass} onClick={() => setMobileOpen(false)}>Admin Dashboard</NavLink>
              )}
              <button onClick={handleLogout} className="w-full text-left flex items-center gap-2 px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg text-sm font-medium">
                <LogOut size={16} /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login"    className="block px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300" onClick={() => setMobileOpen(false)}>Login</Link>
              <Link to="/register" className="block px-3 py-2 text-sm font-medium text-brand-blue" onClick={() => setMobileOpen(false)}>Register</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
