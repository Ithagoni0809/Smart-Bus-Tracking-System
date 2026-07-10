// src/pages/passenger/Dashboard.jsx
// Shows the passenger's personalised overview:
// - Quick access to live map
// - Favourite routes
// - Recent notifications summary
// - Live active buses count

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Map, Star, Bell, Bus, ChevronRight, Navigation, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { busAPI, favoriteAPI, notificationAPI, authAPI } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import OccupancyBadge from '../../components/common/OccupancyBadge';
import Spinner from '../../components/common/Spinner';
import toast from 'react-hot-toast';

const StatCard = ({ icon: Icon, label, value, color, to }) => (
  <Link to={to} className="card hover:shadow-md transition-all group cursor-pointer">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{value}</p>
      </div>
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
        <Icon size={22} className="text-white" />
      </div>
    </div>
  </Link>
);

const Dashboard = () => {
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const [liveBuses, setLiveBuses]         = useState([]);
  const [favorites, setFavorites]         = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(true);
  const [sendingVerification, setSendingVerification] = useState(false);

  const handleResendVerification = async () => {
  try {
    setSendingVerification(true);

    const res = await authAPI.resendVerification();

    toast.success(res.data.message);
  } catch (err) {
    toast.error(
      err.response?.data?.message ||
      "Failed to send verification email."
    );
  } finally {
    setSendingVerification(false);
  }
};

  useEffect(() => {
    const loadData = async () => {
      try {
        const [busRes, notifRes] = await Promise.allSettled([
          busAPI.getLive(),
          notificationAPI.getAll({ isRead: false, limit: 5 }),
        ]);
        if (busRes.status === 'fulfilled') setLiveBuses(busRes.value.data.buses);
        if (notifRes.status === 'fulfilled') setUnreadCount(notifRes.value.data.total || 0);
      } catch (err) {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <Spinner size="lg" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 animate-fade-in">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {greeting()}, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isConnected
              ? `${liveBuses.length} bus${liveBuses.length !== 1 ? 'es' : ''} currently live`
              : 'Connecting to live feed...'}
          </p>
        </div>
        <Link to="/live-map" className="btn-primary">
          <Map size={16} /> Live Map
        </Link>
      </div>
      {/* ── Email Verification Status ───────────────────────────── */}
    <div
    className={`rounded-xl p-4 border flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
      user?.isEmailVerified
        ? "bg-green-50 border-green-300"
        : "bg-yellow-50 border-yellow-300"
    }`}
    >
    <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            {user?.isEmailVerified ? (
        <>
          <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-green-700">Email Verified</span>
        </>
      ) : (
        <>
          <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
          <span className="text-yellow-800">Verify Your Email</span>
        </>
      )}
        </h3>
      <p
        className={`text-sm mt-1 ${
          user?.isEmailVerified
            ? "text-green-700"
            : "text-yellow-700"
        }`}
      >
        {user?.isEmailVerified
          ? "Your email has been successfully verified. Your account is fully secured."
          : "Your email address is not verified. Please verify it to secure your account."}
      </p>
    </div>

    {!user?.isEmailVerified && (
      <button
        onClick={handleResendVerification}
        disabled={sendingVerification}
        className="btn-primary disabled:opacity-60"
      >
        {sendingVerification
          ? "Sending..."
          : "Verify Email"}
      </button>
    )}
</div>
      {/* ── Stats Row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Bus}        label="Live Buses"   value={liveBuses.length} color="bg-brand-blue"  to="/live-map" />
        <StatCard icon={Star}       label="Saved Routes" value={favorites.length} color="bg-pink-500"    to="/favorites" />
        <StatCard icon={Bell}       label="Unread Alerts"value={unreadCount}      color="bg-purple-500"  to="/notifications" />
        <StatCard icon={TrendingUp} label="Active Routes"value="–"               color="bg-green-500"   to="/live-map" />
      </div>

      {/* ── Quick Actions ─────────────────────────────────────────── */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-800 dark:text-white mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Search Bus',       to: '/search',        icon: Bus,        color: 'bg-brand-blue/10 text-brand-blue' },
            { label: 'Live Map',         to: '/live-map',      icon: Map,        color: 'bg-green-100 text-green-700' },
            { label: 'Saved Routes',     to: '/favorites',     icon: Star,       color: 'bg-pink-100 text-pink-700' },
            { label: 'Notifications',    to: '/notifications', icon: Bell,       color: 'bg-purple-100 text-purple-700' },
          ].map(({ label, to, icon: Icon, color }) => (
            <Link key={to} to={to} className={`flex flex-col items-center gap-2 p-3 rounded-xl ${color} hover:opacity-80 transition-opacity`}>
              <Icon size={20} />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Live Buses Snapshot ───────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live Buses Now
          </h2>
          <Link to="/live-map" className="text-xs text-brand-blue font-medium flex items-center gap-1">
            View All <ChevronRight size={14} />
          </Link>
        </div>

        {liveBuses.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            No active buses right now
          </p>
        ) : (
          <div className="space-y-2">
            {liveBuses.slice(0, 5).map((bus) => (
              <Link
                key={bus._id}
                to={`/buses/${bus._id}`}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-blue/10 flex items-center justify-center">
                    <Bus size={16} className="text-brand-blue" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">{bus.busNumber}</p>
                    <p className="text-xs text-gray-500">{bus.assignedRoute?.routeName || 'No route'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-xs text-gray-500">
                    <p>{bus.currentSpeed ?? 0} km/h</p>
                    <OccupancyBadge occupancy={bus.currentOccupancy} capacity={bus.capacity} />
                  </div>
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
