// src/pages/passenger/LiveMap.jsx
// ─────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS:
//   The main live-tracking page. Shows the full-screen Leaflet map
//   with all active buses, a route search panel on the left, and an
//   ETA/details panel that slides in when a bus is selected.
//
// COMPONENT STRUCTURE:
//   LiveMap (this file)
//   ├── SearchPanel (sidebar: search by source/destination)
//   ├── LiveBusMap (map with markers, calls our map component)
//   └── BusInfoPanel (slides in on bus marker click: ETA, occupancy, stops)
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LocateFixed, ChevronRight, X, Bus, AlertTriangle } from 'lucide-react';
import LiveBusMap from '../../components/map/LiveBusMap';
import ETACard from '../../components/common/ETACard';
import OccupancyBadge from '../../components/common/OccupancyBadge';
import Spinner from '../../components/common/Spinner';
import { routeAPI, busAPI } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import toast from 'react-hot-toast';

const LiveMap = () => {
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [searchFrom, setSearchFrom]         = useState('');
  const [searchTo, setSearchTo]             = useState('');
  const [routes, setRoutes]                 = useState([]);
  const [selectedRoute, setSelectedRoute]   = useState(null);
  const [routeDetails, setRouteDetails]     = useState(null);
  const [selectedBus, setSelectedBus]       = useState(null); // { id, ...busData }
  const [busLiveData, setBusLiveData]       = useState(null); // real-time from socket
  const [userLocation, setUserLocation]     = useState(null);
  const [centerOnUser, setCenterOnUser]     = useState(false);
  const [searching, setSearching]           = useState(false);
  const [loadingRoute, setLoadingRoute]     = useState(false);

  // ── Get user's GPS location ─────────────────────────────────────────────
  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setCenterOnUser(true);
        setTimeout(() => setCenterOnUser(false), 1000);
      },
      () => toast.error('Could not get your location — please allow location access'),
      { enableHighAccuracy: true }
    );
  }, []);

  // ── Search routes by source/destination ─────────────────────────────────
  const handleSearch = async () => {
    if (!searchFrom && !searchTo) {
      toast.error('Enter at least a source or destination');
      return;
    }
    setSearching(true);
    try {
      const res = await routeAPI.search({ from: searchFrom, to: searchTo });
      setRoutes(res.data.routes);
      if (res.data.routes.length === 0) toast('No routes found. Try different stops.', { icon: '🔍' });
    } catch {
      toast.error('Search failed — check your connection');
    } finally {
      setSearching(false);
    }
  };

  // ── Select a route — load its full stop/polyline data ───────────────────
  const handleSelectRoute = async (route) => {
    setSelectedRoute(route);
    setSelectedBus(null);
    setBusLiveData(null);
    setLoadingRoute(true);
    try {
      const res = await routeAPI.getById(route._id);
      setRouteDetails(res.data.route);
      // Join this route's Socket.IO room for live updates
      socket?.emit('join-route', { routeId: route._id });
    } catch {
      toast.error('Failed to load route details');
    } finally {
      setLoadingRoute(false);
    }
  };

  const handleClearRoute = () => {
    if (selectedRoute) socket?.emit('leave-route', { routeId: selectedRoute._id });
    setSelectedRoute(null);
    setRouteDetails(null);
    setSelectedBus(null);
    setBusLiveData(null);
  };

  // ── When a bus marker is clicked — subscribe to its live data ──────────
  const handleBusSelect = (busId, busData) => {
    setSelectedBus({ id: busId, ...busData });
    socket?.emit('join-bus', { busId });
  };

  // ── Receive real-time updates for the selected bus ──────────────────────
  useEffect(() => {
    if (!socket || !selectedBus) return;

    const handleBusPosition = (data) => {
      if (data.busId === selectedBus.id) {
        setBusLiveData(data);
      }
    };
    socket.on('bus-position', handleBusPosition);
    return () => socket.off('bus-position', handleBusPosition);
  }, [socket, selectedBus]);

  // ── Listen for emergency alerts and show toast ──────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handleEmergency = (data) => {
      toast.error(`🚨 Emergency on bus ${data.busNumber}: ${data.message}`, { duration: 8000 });
    };
    socket.on('emergency-alert', handleEmergency);
    return () => socket.off('emergency-alert', handleEmergency);
  }, [socket]);

  // Build polyline array from routeDetails (sorted by sequence)
  const polyline = routeDetails?.polyline?.length > 0
    ? routeDetails.polyline
    : routeDetails?.stops?.sort((a, b) => a.sequence - b.sequence).map((s) => [
        s.stop.location.coordinates[1],
        s.stop.location.coordinates[0],
      ]) || [];

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">

      {/* ── Left Sidebar ──────────────────────────────────────── */}
      <div className="w-80 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">

        {/* Search inputs */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <Bus size={14} className="text-brand-blue" /> Find Your Bus
          </h2>
          <input
            className="input-field"
            placeholder="From (e.g. Secunderabad)"
            value={searchFrom}
            onChange={(e) => setSearchFrom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <input
            className="input-field"
            placeholder="To (e.g. Hitech City)"
            value={searchTo}
            onChange={(e) => setSearchTo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} disabled={searching} className="btn-primary w-full">
            {searching ? <Spinner size="sm" /> : <Search size={16} />}
            {searching ? 'Searching...' : 'Search Routes'}
          </button>
        </div>

        {/* Results / selected route info */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {selectedRoute && (
            <div className="bg-brand-blue/5 dark:bg-brand-blue/10 rounded-xl p-3 border border-brand-blue/20">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-brand-blue">SELECTED ROUTE</p>
                  <p className="font-semibold text-gray-800 dark:text-white text-sm">{selectedRoute.routeName}</p>
                  <p className="text-xs text-gray-500">{selectedRoute.totalDistance} km · ₹{selectedRoute.fare}</p>
                </div>
                <button onClick={handleClearRoute} className="text-gray-400 hover:text-gray-600 p-1">
                  <X size={16} />
                </button>
              </div>
              {loadingRoute && <div className="flex justify-center mt-2"><Spinner size="sm" /></div>}
            </div>
          )}

          {routes.map((route) => (
            <button
              key={route._id}
              onClick={() => handleSelectRoute(route)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                selectedRoute?._id === route._id
                  ? 'border-brand-blue bg-brand-blue/5 dark:bg-brand-blue/10'
                  : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-brand-blue/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-gray-800 dark:text-white">{route.routeNumber}</p>
                  <p className="text-xs text-gray-500 truncate max-w-[180px]">{route.routeName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{route.totalDistance} km · ₹{route.fare}</p>
                </div>
                <ChevronRight size={16} className="text-gray-400 shrink-0" />
              </div>
            </button>
          ))}

          {routes.length === 0 && !selectedRoute && (
            <div className="text-center py-8 text-gray-400">
              <Search size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Search for a route above</p>
            </div>
          )}
        </div>

        {/* Bus info panel (when a bus is selected) */}
        {selectedBus && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-2 animate-slide-in-right bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-1.5">
                <Bus size={14} className="text-brand-blue" /> {selectedBus.busNumber}
                {busLiveData?.isOffRoute && (
                  <span className="flex items-center gap-0.5 text-xs text-red-500">
                    <AlertTriangle size={11} /> Off Route
                  </span>
                )}
              </p>
              <button onClick={() => { setSelectedBus(null); setBusLiveData(null); }} className="text-gray-400">
                <X size={14} />
              </button>
            </div>
            <ETACard
              eta={busLiveData?.eta}
              speed={busLiveData?.speed ?? selectedBus.speed}
              remainingStops={busLiveData?.remainingStopsCount}
              nextStop={busLiveData?.nextStop}
              routeCompletion={busLiveData?.routeCompletionPercentage}
            />
            <OccupancyBadge
              occupancy={busLiveData?.occupancy ?? selectedBus.occupancy}
              capacity={selectedBus.capacity}
              showCount
            />
            <button
              onClick={() => navigate(`/buses/${selectedBus.id}`)}
              className="btn-secondary w-full text-sm"
            >
              Full Bus Details <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── Map Area ─────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        {/* Locate me button */}
        <button
          onClick={getUserLocation}
          className="absolute top-3 right-3 z-10 bg-white dark:bg-gray-800 shadow-md rounded-xl p-2.5 hover:shadow-lg transition-shadow"
          title="Center on my location"
        >
          <LocateFixed size={18} className="text-brand-blue" />
        </button>

        <LiveBusMap
          routeId={selectedRoute?._id}
          routePolyline={polyline}
          routeStops={routeDetails?.stops?.map((s) => s.stop)}
          onBusSelect={handleBusSelect}
          selectedBusId={selectedBus?.id}
          userLocation={userLocation}
          centerOnUser={centerOnUser}
          height="100%"
        />
      </div>
    </div>
  );
};

export default LiveMap;
