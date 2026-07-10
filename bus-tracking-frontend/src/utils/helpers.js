// src/utils/helpers.js
// Shared utility functions used across components.

/**
 * Format minutes into "X hr Y min" string.
 * e.g. 75 → "1 hr 15 min"
 */
export const formatDuration = (minutes) => {
  if (!minutes) return '–';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
};

/**
 * Format a distance number to a human-readable string.
 * e.g. 0.35 → "350 m", 1.2 → "1.2 km"
 */
export const formatDistance = (km) => {
  if (km == null) return '–';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
};

/**
 * Return Tailwind color classes for a bus status string.
 */
export const statusBadgeClass = (status) => {
  const map = {
    active:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    idle:        'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    delayed:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    breakdown:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    maintenance: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  };
  return map[status] || map.idle;
};

/**
 * Truncate a string to maxLen characters.
 */
export const truncate = (str, maxLen = 40) =>
  str && str.length > maxLen ? `${str.slice(0, maxLen)}…` : str;

/**
 * Capitalize first letter.
 */
export const capitalize = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
