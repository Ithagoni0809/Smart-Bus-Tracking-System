/**
 * utils/geoUtils.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   Centralizes every distance/ETA/geo calculation used across the
 *   app: Bus Management (search by proximity), Route Management
 *   (route distance, nearest stop), and Live Tracking (ETA, speed,
 *   route deviation). One tested implementation, reused everywhere.
 * ─────────────────────────────────────────────────────────────
 */

const EARTH_RADIUS_KM = 6371;

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/**
 * haversineDistance — great-circle distance between two GPS points.
 * @returns {number} distance in kilometres
 *
 * WHY HAVERSINE AND NOT PYTHAGORAS?
 *   The Earth is a sphere, not a flat plane. Over even a few kilometres,
 *   simple Pythagorean distance on raw lat/lng is measurably wrong because
 *   degrees of longitude shrink in real distance as you move away from the
 *   equator. Haversine accounts for the sphere's curvature correctly.
 */
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

/**
 * calculateBearing — compass direction (0-360°) from point 1 to point 2.
 * Used to set the `heading` field so the bus marker icon rotates to face
 * its direction of travel on the frontend map.
 */
const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360; // Normalize to 0-360
};

/**
 * calculateSpeed — derives speed (km/h) from two GPS points and a time delta.
 * Used server-side as a sanity-check/fallback when the device doesn't report
 * its own GPS speed, or to smooth out noisy device-reported values.
 *
 * @param {number} distanceKm - distance travelled between the two points
 * @param {number} timeSeconds - time elapsed between the two points
 */
const calculateSpeed = (distanceKm, timeSeconds) => {
  if (timeSeconds <= 0) return 0;
  const timeHours = timeSeconds / 3600;
  const speed = distanceKm / timeHours;
  // Cap unrealistic spikes (GPS jitter when stationary can imply >200 km/h over 5s)
  return speed > 150 ? 0 : Math.round(speed * 10) / 10;
};

/**
 * calculateETA — minutes until the bus reaches a target point, given its
 * current position and current speed.
 *
 * @returns {{ distanceKm: number, etaMinutes: number }}
 */
const calculateETA = (busLat, busLng, targetLat, targetLng, speedKmh) => {
  const distance = haversineDistance(busLat, busLng, targetLat, targetLng);
  // If the bus is stationary (traffic, signal, stop), assume a conservative
  // average city speed instead of dividing by ~0 and returning Infinity.
  const effectiveSpeed = speedKmh < 5 ? 20 : speedKmh;
  const etaMinutes = Math.ceil((distance / effectiveSpeed) * 60);
  return { distanceKm: Math.round(distance * 100) / 100, etaMinutes };
};

/**
 * findNearestPointOnRoute — given a bus's current GPS position and a route's
 * ordered list of stops (each with lat/lng), finds which stop is closest
 * AND how far off the route's general path the bus currently is.
 *
 * Used for:
 *   - "Remaining stops" calculation (everything after the nearest/last-passed stop)
 *   - Route deviation detection (distance to nearest route stop > threshold)
 *
 * @param {number} lat - bus latitude
 * @param {number} lng - bus longitude
 * @param {Array} stops - array of { sequence, latitude, longitude } in route order
 * @returns {{ nearestStop, distanceToNearestStop, nearestSequence }}
 */
const findNearestStop = (lat, lng, stops) => {
  let nearestStop = null;
  let minDistance = Infinity;

  for (const stop of stops) {
    const d = haversineDistance(lat, lng, stop.latitude, stop.longitude);
    if (d < minDistance) {
      minDistance = d;
      nearestStop = stop;
    }
  }

  return {
    nearestStop,
    distanceToNearestStop: Math.round(minDistance * 1000) / 1000, // km, 3 decimal places
    nearestSequence: nearestStop ? nearestStop.sequence : null,
  };
};

/**
 * isOffRoute — checks if a GPS point is further than `thresholdKm` from
 * EVERY stop on the route's path. A simple but effective deviation check:
 * if the bus isn't reasonably close to ANY known point on its route, it has
 * likely taken a wrong turn or gone off-route.
 *
 * @param {number} thresholdKm - default 0.5km (500m), matches FR-D08 in the SRS
 */
const isOffRoute = (lat, lng, stops, thresholdKm = 0.5) => {
  const { distanceToNearestStop } = findNearestStop(lat, lng, stops);
  return distanceToNearestStop > thresholdKm;
};

/**
 * calculateRouteCompletionPercentage — how far along the route the bus has
 * travelled, based on the distance-from-start value of the last stop it passed.
 *
 * @param {number} lastPassedDistanceFromStart - km from route start to last passed stop
 * @param {number} totalRouteDistance - total route length in km
 */
const calculateRouteCompletion = (lastPassedDistanceFromStart, totalRouteDistance) => {
  if (!totalRouteDistance) return 0;
  const pct = (lastPassedDistanceFromStart / totalRouteDistance) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
};

module.exports = {
  haversineDistance,
  calculateBearing,
  calculateSpeed,
  calculateETA,
  findNearestStop,
  isOffRoute,
  calculateRouteCompletion,
};
