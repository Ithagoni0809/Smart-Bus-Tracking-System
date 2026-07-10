// src/components/common/OccupancyBadge.jsx
// ─────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS:
//   Shows a color-coded badge indicating how full a bus is.
//   Used on BusDetails, LiveMap popups, and Dashboard cards.
//   Colors: Green (Low) → Yellow (Medium) → Orange (High) → Red (Full)
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { Users } from 'lucide-react';

const OccupancyBadge = ({ occupancy, capacity, level, showCount = false }) => {
  // `level` can be provided directly ('low','medium','high','full')
  // or computed from occupancy/capacity
  const computedLevel = level || (() => {
    if (!capacity) return 'low';
    const pct = (occupancy / capacity) * 100;
    if (pct >= 100) return 'full';
    if (pct >= 75)  return 'high';
    if (pct >= 40)  return 'medium';
    return 'low';
  })();

  const config = {
    low:    { label: 'Low',    classes: 'badge-low',    bar: 'bg-green-500',  width: '25%' },
    medium: { label: 'Medium', classes: 'badge-medium', bar: 'bg-yellow-500', width: '60%' },
    high:   { label: 'High',   classes: 'badge-high',   bar: 'bg-orange-500', width: '85%' },
    full:   { label: 'Full',   classes: 'badge-full',   bar: 'bg-red-500',    width: '100%' },
  };
  const { label, classes, bar, width } = config[computedLevel] || config.low;

  return (
    <div className="flex flex-col gap-1">
      <div className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${classes}`}>
        <Users size={11} />
        {label}
        {showCount && capacity && ` · ${occupancy ?? '?'}/${capacity}`}
      </div>
      {/* Mini progress bar */}
      {capacity && (
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden w-full">
          <div className={`h-full rounded-full transition-all duration-500 ${bar}`} style={{ width }} />
        </div>
      )}
    </div>
  );
};

export default OccupancyBadge;
