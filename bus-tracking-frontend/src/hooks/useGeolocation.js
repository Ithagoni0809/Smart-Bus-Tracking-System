// src/hooks/useGeolocation.js
// Custom hook that wraps the browser Geolocation API.
// Returns { position, error, loading } and starts watching
// for position updates as soon as the component mounts.
// Used by LiveMap and DriverDashboard.

import { useState, useEffect } from 'react';

const useGeolocation = (watch = false) => {
  const [position, setPosition] = useState(null);
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }

    const onSuccess = (pos) => {
      setPosition({
        lat:      pos.coords.latitude,
        lng:      pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed:    pos.coords.speed,
        heading:  pos.coords.heading,
      });
      setLoading(false);
      setError(null);
    };

    const onError = (err) => {
      setError(err.message);
      setLoading(false);
    };

    const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 };

    let watchId;
    if (watch) {
      watchId = navigator.geolocation.watchPosition(onSuccess, onError, options);
    } else {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [watch]);

  return { position, error, loading };
};

export default useGeolocation;
