// src/services/socket.js
// ─────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS:
//   Socket.IO connections are expensive. We create ONE connection for
//   the entire app (Singleton pattern) and reuse it everywhere.
//   Without this, each component that imports socket.io-client would
//   create its own connection — flooding the server with websockets.
//
// HOW IT WORKS:
//   getSocket() creates the connection the FIRST time it's called,
//   then returns the same instance on every subsequent call.
//   Components connect/disconnect from ROOMS (not from the socket itself).
// ─────────────────────────────────────────────────────────────

import { io } from 'socket.io-client';

let socketInstance = null;

/**
 * getSocket — returns the singleton Socket.IO client.
 * @param {string} token - The JWT access token for authenticated connections.
 *                         Pass null for anonymous (public bus tracking).
 */
export const getSocket = (token = null) => {
  // If no socket exists, OR the existing socket is disconnected, create a new one
  if (!socketInstance || !socketInstance.connected) {
    socketInstance = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token }, // Sent to socket server's middleware for JWT verification
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,         // Start with 1s
      reconnectionDelayMax: 10000,     // Max out at 10s (exponential backoff)
      timeout: 20000,
    });
  }
  return socketInstance;
};

/**
 * disconnectSocket — cleanly closes the socket connection.
 * Called on logout so the server knows this client is gone.
 */
export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};

export default getSocket;
