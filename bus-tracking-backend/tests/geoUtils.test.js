// tests/geoUtils.test.js
// Unit tests for all geospatial calculation functions
// These are pure functions with no database dependency — fast and deterministic.

const {
  haversineDistance,
  calculateBearing,
  calculateSpeed,
  calculateETA,
  findNearestStop,
  isOffRoute,
  calculateRouteCompletion,
} = require('../utils/geoUtils');

// Known reference points (Hyderabad)
const SECUNDERABAD = { lat: 17.4344, lng: 78.5013 };
const AMEERPET    = { lat: 17.4374, lng: 78.4487 };
const HITECH_CITY = { lat: 17.4435, lng: 78.3772 };

// ═══════════════════════════════════════════════════════════════════════════
// HAVERSINE DISTANCE
// ═══════════════════════════════════════════════════════════════════════════
describe('haversineDistance()', () => {
  // TC-GEO-001
  test('TC-GEO-001: same point returns 0 distance', () => {
    const d = haversineDistance(17.4344, 78.5013, 17.4344, 78.5013);
    expect(d).toBe(0);
  });

  // TC-GEO-002
  test('TC-GEO-002: Secunderabad to Ameerpet ~4.5km', () => {
    const d = haversineDistance(SECUNDERABAD.lat, SECUNDERABAD.lng, AMEERPET.lat, AMEERPET.lng);
    expect(d).toBeGreaterThan(4);
    expect(d).toBeLessThan(6);
  });

  // TC-GEO-003
  test('TC-GEO-003: is symmetric — A→B equals B→A', () => {
    const ab = haversineDistance(SECUNDERABAD.lat, SECUNDERABAD.lng, HITECH_CITY.lat, HITECH_CITY.lng);
    const ba = haversineDistance(HITECH_CITY.lat, HITECH_CITY.lng, SECUNDERABAD.lat, SECUNDERABAD.lng);
    expect(ab).toBeCloseTo(ba, 5);
  });

  // TC-GEO-004
  test('TC-GEO-004: full route Secunderabad→Hitech City ~11-14km', () => {
    const d = haversineDistance(SECUNDERABAD.lat, SECUNDERABAD.lng, HITECH_CITY.lat, HITECH_CITY.lng);
    expect(d).toBeGreaterThan(10);
    expect(d).toBeLessThan(16);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CALCULATE SPEED
// ═══════════════════════════════════════════════════════════════════════════
describe('calculateSpeed()', () => {
  // TC-GEO-005
  test('TC-GEO-005: 1km in 60s → 60 km/h', () => {
    const speed = calculateSpeed(1, 60);
    expect(speed).toBe(60);
  });

  // TC-GEO-006
  test('TC-GEO-006: 0 time returns 0 speed (avoids division by zero)', () => {
    const speed = calculateSpeed(1, 0);
    expect(speed).toBe(0);
  });

  // TC-GEO-007
  test('TC-GEO-007: GPS jitter spike (200+ km/h) capped at 0', () => {
    // 1km in 1 second = 3600 km/h — clearly GPS noise
    const speed = calculateSpeed(1, 1);
    expect(speed).toBe(0);
  });

  // TC-GEO-008
  test('TC-GEO-008: typical bus (0.15km in 30s) → ~18 km/h', () => {
    const speed = calculateSpeed(0.15, 30);
    expect(speed).toBeGreaterThan(15);
    expect(speed).toBeLessThan(22);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CALCULATE ETA
// ═══════════════════════════════════════════════════════════════════════════
describe('calculateETA()', () => {
  // TC-GEO-009
  test('TC-GEO-009: stationary bus (speed=0) uses 20 km/h default', () => {
    const { etaMinutes } = calculateETA(17.4344, 78.5013, 17.4374, 78.4487, 0);
    expect(etaMinutes).toBeGreaterThan(0);
    expect(etaMinutes).toBeLessThan(60); // Reasonable ETA
  });

  // TC-GEO-010
  test('TC-GEO-010: fast bus at 60km/h reaches close stop in <10 min', () => {
    const { etaMinutes } = calculateETA(17.4344, 78.5013, 17.4374, 78.4487, 60);
    expect(etaMinutes).toBeLessThan(10);
  });

  // TC-GEO-011
  test('TC-GEO-011: returns distanceKm and etaMinutes', () => {
    const result = calculateETA(17.4344, 78.5013, 17.4374, 78.4487, 30);
    expect(result).toHaveProperty('distanceKm');
    expect(result).toHaveProperty('etaMinutes');
    expect(result.distanceKm).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FIND NEAREST STOP
// ═══════════════════════════════════════════════════════════════════════════
describe('findNearestStop()', () => {
  const stops = [
    { sequence: 1, latitude: 17.4344, longitude: 78.5013, stopId: 'stop1', stopName: 'Secunderabad' },
    { sequence: 2, latitude: 17.4374, longitude: 78.4487, stopId: 'stop2', stopName: 'Ameerpet' },
    { sequence: 3, latitude: 17.4435, longitude: 78.3772, stopId: 'stop3', stopName: 'Hitech City' },
  ];

  // TC-GEO-012
  test('TC-GEO-012: bus at Ameerpet coordinates returns Ameerpet as nearest', () => {
    const { nearestStop } = findNearestStop(17.4374, 78.4487, stops);
    expect(nearestStop.stopName).toBe('Ameerpet');
  });

  // TC-GEO-013
  test('TC-GEO-013: bus between stops returns one of them as nearest', () => {
    const { nearestStop, distanceToNearestStop } = findNearestStop(17.4360, 78.4700, stops);
    expect(nearestStop).not.toBeNull();
    expect(distanceToNearestStop).toBeGreaterThan(0);
  });

  // TC-GEO-014
  test('TC-GEO-014: empty stops array returns null nearestStop', () => {
    const { nearestStop } = findNearestStop(17.4344, 78.5013, []);
    expect(nearestStop).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUTE DEVIATION
// ═══════════════════════════════════════════════════════════════════════════
describe('isOffRoute()', () => {
  const stops = [
    { sequence: 1, latitude: 17.4344, longitude: 78.5013 },
    { sequence: 2, latitude: 17.4374, longitude: 78.4487 },
  ];

  // TC-GEO-015
  test('TC-GEO-015: bus at stop location is NOT off-route', () => {
    const offRoute = isOffRoute(17.4344, 78.5013, stops, 0.5);
    expect(offRoute).toBe(false);
  });

  // TC-GEO-016
  test('TC-GEO-016: bus far from all stops IS off-route', () => {
    // Bengaluru coordinates — nowhere near the Hyderabad route
    const offRoute = isOffRoute(12.9716, 77.5946, stops, 0.5);
    expect(offRoute).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUTE COMPLETION
// ═══════════════════════════════════════════════════════════════════════════
describe('calculateRouteCompletion()', () => {
  // TC-GEO-017
  test('TC-GEO-017: 0km covered = 0%', () => {
    expect(calculateRouteCompletion(0, 18)).toBe(0);
  });

  // TC-GEO-018
  test('TC-GEO-018: full distance covered = 100%', () => {
    expect(calculateRouteCompletion(18, 18)).toBe(100);
  });

  // TC-GEO-019
  test('TC-GEO-019: half distance covered = 50%', () => {
    expect(calculateRouteCompletion(9, 18)).toBe(50);
  });

  // TC-GEO-020
  test('TC-GEO-020: totalDistance=0 returns 0 (no division by zero)', () => {
    expect(calculateRouteCompletion(5, 0)).toBe(0);
  });
});
