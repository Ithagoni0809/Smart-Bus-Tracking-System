// src/pages/passenger/RouteDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Navigation, Bus, ChevronRight } from 'lucide-react';
import { routeAPI, busAPI } from '../../services/api';
import Spinner from '../../components/common/Spinner';
import toast from 'react-hot-toast';

const RouteDetails = () => {
  const { id } = useParams();
  const [route, setRoute] = useState(null);
  const [activeBuses, setActiveBuses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [routeRes, busRes] = await Promise.all([
          routeAPI.getById(id),
          busAPI.getLive({ routeId: id }),
        ]);
        setRoute(routeRes.data.route);
        setActiveBuses(busRes.data.buses);
      } catch {
        toast.error('Failed to load route details');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner size="lg" /></div>;
  if (!route) return <div className="text-center py-20 text-gray-500">Route not found.</div>;

  const sortedStops = [...route.stops].sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 animate-fade-in">
      <Link to="/live-map" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-blue">
        <ArrowLeft size={16} /> Back
      </Link>

      {/* Route Header */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
            <Navigation size={22} className="text-brand-blue" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold bg-brand-navy text-white px-2 py-0.5 rounded-full">{route.routeNumber}</span>
              <span className="text-xs capitalize text-gray-500 border border-gray-200 dark:border-gray-600 px-2 py-0.5 rounded-full">{route.routeType}</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{route.routeName}</h1>
            <p className="text-sm text-gray-500 mt-1">{route.source} → {route.destination}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          {[
            ['Distance', `${route.totalDistance} km`, Navigation],
            ['Duration', `${route.expectedDuration} min`, Clock],
            ['Fare',     `₹${route.fare}`,             Bus],
          ].map(([label, value, Icon]) => (
            <div key={label} className="text-center">
              <Icon size={16} className="text-brand-blue mx-auto mb-1" />
              <p className="text-base font-bold text-gray-800 dark:text-white">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Active Buses on this route */}
      {activeBuses.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {activeBuses.length} Bus{activeBuses.length !== 1 ? 'es' : ''} Live on This Route
          </h2>
          <div className="space-y-2">
            {activeBuses.map((bus) => (
              <Link key={bus._id} to={`/buses/${bus._id}`}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-center gap-2">
                  <Bus size={14} className="text-brand-blue" />
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">{bus.busNumber}</span>
                  <span className="text-xs text-gray-500">{bus.currentSpeed ?? 0} km/h</span>
                </div>
                <ChevronRight size={14} className="text-gray-400" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stops Timeline */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
          <MapPin size={14} className="text-brand-blue" /> All Stops ({sortedStops.length})
        </h2>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-gray-200 dark:bg-gray-700" />

          <div className="space-y-4">
            {sortedStops.map((routeStop, i) => {
              const stop = routeStop.stop;
              const isFirst = i === 0;
              const isLast = i === sortedStops.length - 1;
              return (
                <div key={stop._id || i} className="flex items-start gap-4 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                    isFirst || isLast
                      ? 'bg-brand-navy text-white'
                      : 'bg-white dark:bg-gray-800 border-2 border-brand-blue'
                  }`}>
                    {isFirst ? '🚀' : isLast ? '🏁' : (
                      <span className="text-xs font-bold text-brand-blue">{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <p className={`font-medium text-sm ${isFirst || isLast ? 'text-brand-navy dark:text-brand-blue' : 'text-gray-800 dark:text-white'}`}>
                      {stop?.stopName || `Stop ${i + 1}`}
                    </p>
                    <div className="flex gap-4 text-xs text-gray-500 mt-0.5">
                      <span className="flex items-center gap-1"><Clock size={10} /> +{routeStop.expectedTimeFromStart} min</span>
                      <span className="flex items-center gap-1"><Navigation size={10} /> {routeStop.distanceFromStart} km</span>
                    </div>
                    {stop?.landmark && <p className="text-xs text-gray-400 mt-0.5">Near {stop.landmark}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteDetails;
