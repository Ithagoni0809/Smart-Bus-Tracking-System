// src/pages/passenger/Home.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Bus, Map, Bell, Star, Shield, Zap, Navigation } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Feature = ({ icon: Icon, title, desc, color }) => (
  <div className="card hover:shadow-md transition-shadow">
    <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-3`}>
      <Icon size={22} className="text-white" />
    </div>
    <h3 className="font-semibold text-gray-800 dark:text-white mb-1">{title}</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400">{desc}</p>
  </div>
);

const Home = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-light via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-blue/10 text-brand-blue text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Zap size={12} /> Real-time GPS tracking for state transport buses
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-navy dark:text-white mb-4 leading-tight">
          Know <span className="text-brand-blue">exactly</span> when<br />your bus arrives
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg max-w-xl mx-auto mb-8">
          Track TSRTC, APSRTC, and KSRTC buses live on the map. Get real-time ETA,
          occupancy, and delay alerts — right in your browser.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {isAuthenticated ? (
            <>
              <Link to="/live-map" className="btn-primary text-base px-6 py-3">
                <Map size={18} /> Open Live Map
              </Link>
              <Link to="/dashboard" className="btn-secondary text-base px-6 py-3">
                My Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link to="/register" className="btn-primary text-base px-6 py-3">
                Get Started Free
              </Link>
              <Link to="/login" className="btn-secondary text-base px-6 py-3">
                Login
              </Link>
            </>
          )}
        </div>
      </section>

      {/* ── Features Grid ────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <h2 className="text-xl font-bold text-center text-gray-800 dark:text-white mb-6">
          Everything you need to commute smarter
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Feature icon={Map}        color="bg-brand-blue"  title="Live GPS Map"         desc="Watch your bus move on the map in real-time, updated every 5 seconds." />
          <Feature icon={Navigation} color="bg-green-500"   title="Accurate ETA"         desc="Know exactly how many minutes until your bus reaches your stop." />
          <Feature icon={Bus}        color="bg-brand-amber" title="Occupancy Info"        desc="See how crowded the bus is before you decide to board." />
          <Feature icon={Bell}       color="bg-purple-500"  title="Smart Notifications"  desc="Get alerted when your bus is arriving, delayed, or cancelled." />
          <Feature icon={Star}       color="bg-pink-500"    title="Save Favourites"       desc="Save your daily commute routes for one-tap access every morning." />
          <Feature icon={Shield}     color="bg-gray-600"    title="Secure & Fast"         desc="JWT authentication, end-to-end HTTPS, and sub-second map updates." />
        </div>
      </section>
    </div>
  );
};

export default Home;
