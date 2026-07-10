// src/context/SocketContext.jsx
// ─────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS:
//   Provides the live Socket.IO connection to any component that needs
//   real-time data (LiveMap, BusDetails, Notifications). Components
//   call useSocket() and get back the connected socket instance, then
//   subscribe to specific events (e.g. 'bus-position') in their own
//   useEffect blocks.
// ─────────────────────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { getSocket } from '../services/socket';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket]           = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // We create (or reuse) the socket regardless of auth status —
    // anonymous passengers can still watch public live bus positions.
    // The token is null for anonymous users; the server still allows
    // connection but won't let them call driver/admin events.
    const token = isAuthenticated ? localStorage.getItem('_access_hint') : null;
    const s = getSocket(token);

    s.on('connect',    () => setIsConnected(true));
    s.on('disconnect', () => setIsConnected(false));

    // Admin automatically joins the admin room for fleet-wide updates
    if (user?.role === 'admin' || user?.role === 'superadmin') {
      s.emit('join-admin');
    }

    setSocket(s);

    return () => {
      s.off('connect');
      s.off('disconnect');
      // Don't disconnect on unmount — SocketProvider wraps the whole app
      // so it only unmounts when the user navigates away entirely.
    };
  }, [isAuthenticated, user]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used inside SocketProvider');
  return context;
};
