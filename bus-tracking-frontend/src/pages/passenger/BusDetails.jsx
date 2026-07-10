// src/pages/passenger/BusDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Bus, MapPin, Gauge, User, Phone, Star, ArrowLeft, Map, AlertTriangle, CheckCircle } from 'lucide-react';
import { busAPI } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import ETACard from '../../components/common/ETACard';
import OccupancyBadge from '../../components/common/OccupancyBadge';
import Spinner from '../../components/common/Spinner';
import toast from 'react-hot-toast';

const BusDetails = () => {
  const { id } = useParams();
  const { socket } = useSocket();
  const [bus, setBus] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBus = async () => {
      try {
        const res = await busAPI.getById(id);
        setBus(res.data.bus);
      } catch {
        toast.error('Bus not found');
      } finally {
        setLoading(false);
      }
    };
    loadBus();
  }, [id]);

  // Subscribe to live updates for this specific bus
  useEffect(() => {
    if (!socket) return;
    socket.emit('join-bus', { busId: id });
    const handlePosition = (data) => { if (data.busId === id) setLiveData(data); };
    socket.on('bus-position', handlePosition);
    return () => {
      socket.off('bus-position', handlePosition);
      socket.emit('leave-bus', { busId: id });
    };
  }, [socket, id]);

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner size="lg" /></div>;
  if (!bus) return <div className="text-center py-20 text-gray-500">Bus not found.</div>;

  const statusColor = { active: 'bg-green-500', idle: 'bg-gray-400', delayed: 'bg-yellow-500', breakdown: 'bg-red-500', maintenance: 'bg-orange-500' };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 animate-fade-in">
      {/* Back */}
      <Link to="/live-map" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-blue">
        <ArrowLeft size={16} /> Back to Live Map
      </Link>

      {/* Header Card */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-blue/10 flex items-center justify-center">
              <Bus size={28} className="text-brand-blue" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{bus.busNumber}</h1>
              <p className="text-sm text-gray-500">{bus.vehicleNumber} · {bus.busType}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${statusColor[bus.status] || 'bg-gray-400'}`} />
                <span className="text-xs font-medium capitalize text-gray-600 dark:text-gray-400">{bus.status}</span>
                {liveData?.isOffRoute && (
                  <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                    <AlertTriangle size={11} /> Off Route
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm text-yellow-500 font-semibold">
            <Star size={14} fill="currentColor" /> {bus.averageRating?.toFixed(1) || '–'}
            <span className="text-gray-400 text-xs font-normal">({bus.totalRatings})</span>
          </div>
        </div>
      </div>

      {/* Live Info (if active) */}
      {bus.isActive && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-semibold text-green-600 dark:text-green-400">Live Tracking Active</span>
          </div>
          <ETACard
            eta={liveData?.eta}
            speed={liveData?.speed ?? bus.currentSpeed}
            remainingStops={liveData?.remainingStopsCount}
            nextStop={liveData?.nextStop}
            routeCompletion={liveData?.routeCompletionPercentage}
          />
          <OccupancyBadge
            occupancy={liveData?.occupancy ?? bus.currentOccupancy}
            capacity={bus.capacity}
            showCount
          />
        </div>
      )}

      {/* Route Info */}
      {bus.assignedRoute && (
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <MapPin size={14} className="text-brand-blue" /> Route Information
          </h2>
          <p className="text-base font-semibold text-gray-900 dark:text-white">
            {bus.assignedRoute.routeNumber} — {bus.assignedRoute.routeName}
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
            <div><span className="font-medium">From:</span> {bus.assignedRoute.source}</div>
            <div><span className="font-medium">To:</span> {bus.assignedRoute.destination}</div>
            <div><span className="font-medium">Distance:</span> {bus.assignedRoute.totalDistance} km</div>
            <div><span className="font-medium">Fare:</span> ₹{bus.assignedRoute.fare}</div>
          </div>
          <Link to={`/routes/${bus.assignedRoute._id}`} className="btn-secondary w-full text-sm mt-2">
            <Map size={14} /> View Full Route Details
          </Link>
        </div>
      )}

      {/* Driver Info */}
      {bus.assignedDriver && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <User size={14} className="text-brand-blue" /> Driver
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <User size={22} className="text-gray-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 dark:text-white">{bus.assignedDriver.name}</p>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Phone size={12} /> {bus.assignedDriver.phone}
              </div>
              <div className="flex items-center gap-1 text-sm text-yellow-500">
                <Star size={12} fill="currentColor" /> {bus.assignedDriver.averageRating?.toFixed(1) || 'No rating yet'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bus Stats */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <Gauge size={14} className="text-brand-blue" /> Vehicle Info
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['Capacity',    `${bus.capacity} passengers`],
            ['Type',        bus.busType],
            ['Total Trips', bus.totalTrips],
            ['Rating',      `${bus.averageRating?.toFixed(1) || '–'} / 5`],
          ].map(([label, value]) => (
            <div key={label} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              <p className="font-semibold text-gray-800 dark:text-white capitalize mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BusDetails;
