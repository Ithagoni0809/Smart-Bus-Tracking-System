// src/pages/driver/DriverDashboard.jsx
// Complete Driver Dashboard - GPS sharing, trip lifecycle, emergency alerts

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, MapPin, Users, AlertTriangle, Wrench, Navigation, Clock, History, Bus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { tripAPI, authAPI } from '../../services/api';
import toast from 'react-hot-toast';

const StatusBadge = ({ active, label }) => (
  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
    <span className={`w-2 h-2 rounded-full ${active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
    {label}
  </div>
);

const InfoTile = ({ icon: Icon, label, value, color = 'text-brand-blue' }) => (
  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
    <Icon size={18} className={`${color} mx-auto mb-1`} />
    <p className="text-lg font-bold text-gray-900 dark:text-white">{value ?? '–'}</p>
    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
  </div>
);

const DriverDashboard = () => {
  const { user, setUser } = useAuth();
  const { socket, isConnected } = useSocket();
  const [trip, setTrip] = useState(null);
  const [occupancy, setOccupancy] = useState(0);
  const [gpsStatus, setGpsStatus] = useState('idle');
  const [currentPos, setCurrentPos] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [deviationAlert, setDeviationAlert] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const gpsIntervalRef = useRef(null);
  const elapsedIntervalRef = useRef(null);
  const occupancyRef = useRef(0);
  occupancyRef.current = occupancy;

  // Refresh this driver's own data on mount. WHY: `user` in AuthContext is
  // only set once, at login/app-load, and never refreshed automatically.
  // If an admin assigns this driver to a bus WHILE they're already logged
  // in, `user.assignedBus` stays stale in memory — starting a trip would
  // then silently send `busId: undefined` and fail with a confusing
  // "valid busId is required" error, even though the assignment is
  // correct server-side. Re-fetching here (cheap, one-time on mount)
  // keeps this page's view of the driver's own assignment current
  // without requiring a full logout/login.
  useEffect(() => {
    authAPI.getMe().then(res => setUser(res.data.user)).catch(() => {});
  }, []);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await tripAPI.getHistory({ limit: 5 });
        setHistory(res.data.trips || []);
      } catch { /* silent */ }
    };
    loadHistory();
  }, [trip]);

  useEffect(() => {
    if (!socket) return;
    socket.on('driver-join-ack', () => toast.success('GPS sharing confirmed by server'));
    socket.on('route-deviation', (d) => {
      setDeviationAlert(true);
      toast.error(`Off route by ${Math.round(d.distanceFromRoute * 1000)}m!`, { duration: 6000 });
      setTimeout(() => setDeviationAlert(false), 10000);
    });
    socket.on('error-message', (d) => toast.error(d.message));
    return () => { socket.off('driver-join-ack'); socket.off('route-deviation'); socket.off('error-message'); };
  }, [socket]);

  const startGPS = useCallback((busId, routeId, tripId) => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); setGpsStatus('error'); return; }
    const sendPing = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, speed: s, heading, accuracy } = pos.coords;
          const kmh = s != null ? Math.round(s * 3.6) : 0;
          setCurrentPos({ lat: latitude, lng: longitude });
          setSpeed(kmh);
          setGpsStatus('active');
          socket?.emit('gps-update', { latitude, longitude, speed: kmh, heading: heading || 0, accuracy, occupancy: occupancyRef.current });
        },
        (err) => { setGpsStatus('error'); console.error(err.message); },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 2000 }
      );
    };
    sendPing();
    gpsIntervalRef.current = setInterval(sendPing, 5000);
  }, [socket]);

  const stopGPS = useCallback(() => {
    clearInterval(gpsIntervalRef.current);
    clearInterval(elapsedIntervalRef.current);
    setGpsStatus('idle'); setSpeed(0); setElapsed(0);
  }, []);

  const handleStartTrip = async () => {
    setLoading(true);
    try {
      const res = await tripAPI.start({ busId: user?.assignedBus });
      const newTrip = res.data.trip;
      const bus = res.data.bus;
      setTrip(newTrip);
      setOccupancy(0);
      socket?.emit('driver-join', { busId: bus._id, routeId: bus.assignedRoute, tripId: newTrip._id });
      startGPS(bus._id, bus.assignedRoute, newTrip._id);
      elapsedIntervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
      toast.success('Trip started! GPS sharing active.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not start trip. Are you assigned to a bus?');
    } finally { setLoading(false); }
  };

  const handleEndTrip = async () => {
    if (!trip) return;
    setLoading(true);
    stopGPS();
    try {
      await tripAPI.end(trip._id, currentPos ? { latitude: currentPos.lat, longitude: currentPos.lng } : {});
      setTrip(null); setCurrentPos(null); setDeviationAlert(false);
      toast.success('Trip ended successfully.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to end trip.');
    } finally { setLoading(false); }
  };

  const handleEmergency = () => {
    if (!socket) return;
    socket.emit('emergency-alert', { message: 'Driver triggered emergency alert!' }, (res) => {
      if (res?.success) {
        toast.error('Emergency alert sent!', { duration: 6000 });
      } else {
        toast.error(res?.message || 'Failed to send emergency alert.', { duration: 6000 });
      }
    });
  };

  const handleBreakdown = () => {
    if (!socket) return;
    socket.emit('breakdown-report', { description: 'Breakdown reported by driver.' }, (res) => {
      if (res?.success) {
        toast.error('Breakdown reported to admin!', { duration: 5000 });
      } else {
        toast.error(res?.message || 'Failed to report breakdown.', { duration: 5000 });
      }
    });
  };

  useEffect(() => () => { stopGPS(); }, []);

  const formatElapsed = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const isOnTrip = !!trip;
  const gpsColorMap = { idle: 'text-gray-400', active: 'text-green-500', error: 'text-red-500' };
  const gpsLabelMap = { idle: 'GPS Idle', active: 'GPS Live (every 5s)', error: 'GPS Error' };

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="card text-center space-y-2">
        <div className="w-14 h-14 bg-brand-navy rounded-2xl flex items-center justify-center mx-auto">
          <Bus size={26} className="text-white" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Driver Panel</h1>
        <p className="text-sm text-gray-500">Welcome, <strong>{user?.name}</strong></p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <StatusBadge active={isOnTrip} label={isOnTrip ? 'On Trip' : 'Off Duty'} />
          <StatusBadge active={isConnected} label={isConnected ? 'Connected' : 'Offline'} />
          {deviationAlert && (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold bg-red-100 text-red-700 animate-pulse">
              <AlertTriangle size={14} /> Off Route!
            </span>
          )}
        </div>
      </div>

      {/* GPS Status */}
      <div className="card flex items-center gap-3">
        <Navigation size={22} className={gpsColorMap[gpsStatus]} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800 dark:text-white">{gpsLabelMap[gpsStatus]}</p>
          {currentPos ? (
            <p className="text-xs font-mono text-gray-500">{currentPos.lat.toFixed(5)}, {currentPos.lng.toFixed(5)}</p>
          ) : (
            <p className="text-xs text-gray-400">Waiting for GPS signal...</p>
          )}
        </div>
      </div>

      {/* Trip Stats */}
      {isOnTrip && (
        <div className="grid grid-cols-3 gap-3">
          <InfoTile icon={Clock} label="Elapsed" value={formatElapsed(elapsed)} color="text-brand-blue" />
          <InfoTile icon={MapPin} label="Speed" value={`${speed} km/h`} color="text-green-500" />
          <InfoTile icon={Users} label="Passengers" value={occupancy} color="text-brand-amber" />
        </div>
      )}

      {/* Start / End */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Trip Control</h2>
        {!isOnTrip ? (
          <button onClick={handleStartTrip} disabled={loading || !isConnected}
            className="btn-primary w-full py-4 text-base gap-3 justify-center">
            {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Play size={22} fill="white" />}
            {loading ? 'Starting...' : 'Start Trip'}
          </button>
        ) : (
          <button onClick={handleEndTrip} disabled={loading}
            className="btn-danger w-full py-4 text-base gap-3 justify-center">
            {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Square size={22} fill="white" />}
            {loading ? 'Ending...' : 'End Trip'}
          </button>
        )}
        {trip && <p className="text-xs text-center text-gray-400 font-mono">Trip ID: {trip._id}</p>}
      </div>

      {/* Passenger Count */}
      {isOnTrip && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Users size={14} className="text-brand-blue" /> Passenger Count
          </h2>
          <div className="flex items-center gap-4">
            <button onClick={() => setOccupancy(o => Math.max(0, o - 1))}
              className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 text-2xl font-bold text-gray-700 dark:text-white hover:bg-gray-200 transition-colors flex items-center justify-center">−</button>
            <div className="flex-1 text-center">
              <p className="text-5xl font-extrabold text-brand-navy dark:text-white tabular-nums">{occupancy}</p>
              <p className="text-xs text-gray-500 mt-1">passengers on board</p>
            </div>
            <button onClick={() => setOccupancy(o => o + 1)}
              className="w-12 h-12 rounded-xl bg-brand-blue text-white text-2xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center">+</button>
          </div>
        </div>
      )}

      {/* Emergency */}
      <div className="card space-y-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-500" /> Emergency Actions
        </h2>
        {!isOnTrip && (
          <p className="text-xs text-gray-500">Start a trip to enable emergency reporting.</p>
        )}
        <button onClick={handleEmergency} disabled={!isOnTrip}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-600 text-white font-bold text-sm transition-colors">
          <AlertTriangle size={18} fill="white" /> SEND EMERGENCY ALERT
        </button>
        <button onClick={handleBreakdown} disabled={!isOnTrip}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 font-semibold text-sm hover:bg-orange-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-orange-100 transition-colors">
          <Wrench size={16} /> Report Breakdown
        </button>
      </div>

      {/* Trip History */}
      <div className="card">
        <button onClick={() => setShowHistory(h => !h)}
          className="w-full flex items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-300">
          <span className="flex items-center gap-2"><History size={14} className="text-brand-blue" /> Recent Trips</span>
          <span className="text-xs text-brand-blue">{showHistory ? 'Hide' : 'Show'}</span>
        </button>
        {showHistory && (
          <div className="mt-3 space-y-2">
            {history.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-3">No completed trips yet.</p>
            ) : history.map((t) => (
              <div key={t._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-white">{t.route?.routeNumber} — {t.route?.routeName || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">{t.actualStartTime ? new Date(t.actualStartTime).toLocaleDateString('en-IN') : '–'}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{t.status}</span>
                  {t.delayMinutes > 0 && <p className="text-xs text-yellow-600 mt-0.5">+{t.delayMinutes}m delay</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="card bg-brand-light dark:bg-gray-800/50 border border-brand-blue/10">
        <h3 className="text-xs font-semibold text-brand-navy dark:text-brand-blue mb-2">How GPS Sharing Works</h3>
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <li>✅ Click <strong>Start Trip</strong> — allow location access when prompted</li>
          <li>✅ GPS sent every <strong>5 seconds</strong> via Socket.IO</li>
          <li>✅ Passengers see your bus moving live on the map</li>
          <li>✅ Click <strong>End Trip</strong> at the final stop</li>
        </ul>
      </div>
    </div>
  );
};

export default DriverDashboard;
