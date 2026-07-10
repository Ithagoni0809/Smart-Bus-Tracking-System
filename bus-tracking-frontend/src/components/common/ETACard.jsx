// src/components/common/ETACard.jsx
// ─────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS:
//   The passenger's most-needed info panel: when is my bus arriving?
//   Shows ETA in minutes, distance, remaining stops, and bus speed.
//   Used in both LiveMap (as a floating overlay) and BusDetails page.
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { Clock, MapPin, Navigation, Gauge, RotateCw } from 'lucide-react';

const ETACard = ({ eta, speed, remainingStops, nextStop, routeCompletion, isLoading }) => {
  if (isLoading) {
    return (
      <div className="card animate-pulse space-y-3">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
      </div>
    );
  }

  return (
    <div className="card animate-fade-in">
      {/* ETA headline */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
          <Clock className="text-brand-blue" size={24} />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Arriving in</p>
          {eta ? (
            <p className="text-2xl font-bold text-brand-navy dark:text-white">
              {eta.etaMinutes} <span className="text-sm font-medium text-gray-500">min</span>
            </p>
          ) : (
            <p className="text-sm text-gray-500">–</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        {/* Distance */}
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <Navigation size={14} className="text-brand-blue shrink-0" />
          <span>{eta?.distanceKm != null ? `${eta.distanceKm} km` : '–'}</span>
        </div>

        {/* Speed */}
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <Gauge size={14} className="text-brand-blue shrink-0" />
          <span>{speed != null ? `${speed} km/h` : '–'}</span>
        </div>

        {/* Remaining stops */}
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <MapPin size={14} className="text-brand-blue shrink-0" />
          <span>
            {remainingStops != null
              ? `${remainingStops} stop${remainingStops !== 1 ? 's' : ''} left`
              : '–'}
          </span>
        </div>

        {/* Next stop name */}
        {nextStop && (
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 col-span-2">
            <MapPin size={14} className="text-amber-500 shrink-0" />
            <span className="truncate">Next: {nextStop.stopName}</span>
          </div>
        )}
      </div>

      {/* Route completion progress bar */}
      {routeCompletion != null && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span className="flex items-center gap-1"><RotateCw size={11} /> Route progress</span>
            <span>{routeCompletion}%</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-blue to-brand-amber rounded-full transition-all duration-700"
              style={{ width: `${routeCompletion}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ETACard;
