// src/pages/NotFound.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Bus, Home } from 'lucide-react';

const NotFound = () => (
  <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 bg-gray-50 dark:bg-gray-950">
    <div className="text-8xl mb-6">🚌</div>
    <h1 className="text-6xl font-extrabold text-brand-navy dark:text-white mb-2">404</h1>
    <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">This bus doesn't exist</h2>
    <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs">
      The page you're looking for has left the route. Try going back home.
    </p>
    <Link to="/" className="btn-primary px-6 py-3">
      <Home size={16} /> Back to Home
    </Link>
  </div>
);

export default NotFound;
