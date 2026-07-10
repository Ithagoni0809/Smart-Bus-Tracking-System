// src/hooks/useBusTracking.js
// Custom hook that subscribes to real-time position updates for a specific bus.
// Components import this and get back live busData that updates every 5 seconds.
// Handles joining/leaving socket rooms automatically on mount/unmount.

import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

const useBusTracking = (busId, routeId) => {
  const { socket } = useSocket();
  const [busData, setBusData] = useState(null);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // Join the relevant rooms
    if (busId)   socket.emit('join-bus',   { busId });
    if (routeId) socket.emit('join-route', { routeId });

    const handlePosition = (data) => {
      if (busId && data.busId !== busId) return; // Filter if tracking specific bus
      setBusData(data);
      setIsOnline(true);
    };

    const handleTripEnded = (data) => {
      if (data.busId === busId) {
        setIsOnline(false);
        setBusData(null);
      }
    };

    socket.on('bus-position', handlePosition);
    socket.on('trip-ended',   handleTripEnded);

    return () => {
      if (busId)   socket.emit('leave-bus',   { busId });
      if (routeId) socket.emit('leave-route', { routeId });
      socket.off('bus-position', handlePosition);
      socket.off('trip-ended',   handleTripEnded);
    };
  }, [socket, busId, routeId]);

  return { busData, isOnline };
};

export default useBusTracking;
