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
import { getAccessToken } from '../services/api';

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
    //
    // IMPORTANT: the access token lives in an in-memory module variable
    // (api.js), NOT localStorage — see setAccessToken's comment for why.
    // getAccessToken() reads that same variable, so this always reflects
    // the token actually being used for API calls.
    const token = isAuthenticated ? getAccessToken() : null;
    const s = getSocket(token);

    // Joining the admin room needs to happen AFTER the server has processed
    // this connection's auth handshake — doing it synchronously right after
    // getSocket() would race ahead of that if a reconnect was just triggered
    // (e.g. token changed from anonymous to authenticated). 'connect' fires
    // once the handshake completes, whether this is a brand-new connection
    // or a reconnect, so it's the correct place for this.
    const handleConnect = () => {
      setIsConnected(true);
      if (user?.role === 'admin' || user?.role === 'superadmin') {
        s.emit('join-admin');
      }
    };
    const handleDisconnect = () => setIsConnected(false);

    s.on('connect', handleConnect);
    s.on('disconnect', handleDisconnect);

    // Edge case: socket was already connected with the correct auth (e.g.
    // this effect re-ran for an unrelated reason, like `user` object
    // reference changing without the token actually changing) — 'connect'
    // won't fire again since no new handshake happens, so join explicitly.
    if (s.connected) handleConnect();

    setSocket(s);

    return () => {
      s.off('connect', handleConnect);
      s.off('disconnect', handleDisconnect);
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
