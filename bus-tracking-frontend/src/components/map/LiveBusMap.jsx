// src/components/map/LiveBusMap.jsx
// ─────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS:
//   The main interactive map component. Renders the Leaflet map,
//   draws bus markers, animates their movement when GPS updates
//   arrive via Socket.IO, draws route polylines, and shows stop markers.
//
// HOW BUS ANIMATION WORKS:
//   When a 'bus-position' socket event arrives, we update the marker's
//   position using Leaflet's marker.setLatLng() which smoothly
//   transitions the marker to its new GPS coordinates.
//   React state would cause a full re-render and flicker — so we
//   keep a ref to each Leaflet marker object and mutate it directly.
//   This is the correct approach when performance matters more than
//   React purity (map animations are one of those cases).
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useSocket } from '../../context/SocketContext';
import { busAPI } from '../../services/api';
import OccupancyBadge from '../common/OccupancyBadge';
import { Bus, Gauge, MapPin, Navigation } from 'lucide-react';

// ── Custom Bus Marker Icon ──────────────────────────────────────────────────
// We create an SVG bus icon that we can rotate based on the bus's heading
const createBusIcon = (heading = 0, status = 'active') => {
  const colors = {
    active:      '#2E86AB',
    delayed:     '#F5A623',
    breakdown:   '#EF4444',
    idle:        '#9CA3AF',
    maintenance: '#9CA3AF',
  };
  const color = colors[status] || colors.active;

  return L.divIcon({
    className: 'bus-marker-icon',
    html: `
      <div style="
        transform: rotate(${heading}deg);
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        transition: transform 0.5s ease;
      ">
        <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
          <circle cx="18" cy="18" r="17" fill="${color}" stroke="white" stroke-width="2"/>
          <text x="18" y="23" text-anchor="middle" font-size="16" fill="white">🚌</text>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

// ── Stop Marker Icon ────────────────────────────────────────────────────────
const stopIcon = L.divIcon({
  className: 'bus-marker-icon',
  html: `<div class="w-3 h-3 rounded-full bg-brand-amber border-2 border-white shadow-md"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// ── UserLocation Icon ───────────────────────────────────────────────────────
const userLocationIcon = L.divIcon({
  className: 'bus-marker-icon',
  html: `
    <div class="relative">
      <div class="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg"></div>
      <div class="absolute inset-0 rounded-full bg-blue-500 opacity-30 animate-ping"></div>
    </div>
  `,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// ── MapCenterController — imperatively pans the map when needed ─────────────
const MapCenterController = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom(), { animate: true, duration: 0.5 });
    }
  }, [center, map]);
  return null;
};

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
const LiveBusMap = ({
  routeId,         // If set, filter to only show buses on this route + draw route polyline
  routePolyline,   // Array of [lat, lng] pairs for the route path
  routeStops,      // Array of stop objects for stop markers
  onBusSelect,     // Callback when user clicks a bus marker
  selectedBusId,   // Highlights the selected bus
  userLocation,    // { lat, lng } for blue dot
  centerOnUser,    // Boolean: pan map to user's location
  height = '100%', // CSS height for the map container
}) => {
  const { socket } = useSocket();
  const [buses, setBuses] = useState({}); // { busId: { lat, lng, speed, heading, status, ... } }
  const markerRefs = useRef({}); // { busId: Leaflet Marker instance } — direct DOM access for animation

  // ── Load initial bus positions via REST (before socket kicks in) ─────────
  useEffect(() => {
    const loadLiveBuses = async () => {
      try {
        const params = routeId ? { routeId } : {};
        const res = await busAPI.getLive(params);
        const busMap = {};
        res.data.buses.forEach((bus) => {
          if (bus.currentLocation?.latitude) {
            busMap[bus._id] = {
              lat:       bus.currentLocation.latitude,
              lng:       bus.currentLocation.longitude,
              speed:     bus.currentSpeed,
              heading:   bus.heading,
              status:    bus.status,
              busNumber: bus.busNumber,
              occupancy: bus.currentOccupancy,
              capacity:  bus.capacity,
              routeNumber: bus.assignedRoute?.routeNumber,
              routeName:   bus.assignedRoute?.routeName,
              driverName:  bus.assignedDriver?.name,
            };
          }
        });
        setBuses(busMap);
      } catch (err) {
        console.error('Failed to load live buses:', err);
      }
    };
    loadLiveBuses();
  }, [routeId]);

  // ── Join the correct Socket.IO room(s) ──────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    if (routeId) {
      socket.emit('join-route', { routeId });
    }

    return () => {
      if (routeId) socket.emit('leave-route', { routeId });
    };
  }, [socket, routeId]);

  // ── Handle real-time GPS updates from Socket.IO ──────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleBusPosition = (data) => {
      const { busId, latitude, longitude, speed, heading, occupancy,
              occupancyPercentage, status, remainingStopsCount, eta,
              routeCompletionPercentage, isOffRoute, nextStop } = data;

      // Update React state (for popup content)
      setBuses((prev) => ({
        ...prev,
        [busId]: {
          ...prev[busId],
          lat: latitude, lng: longitude,
          speed, heading, occupancy, occupancyPercentage, status,
          remainingStops: remainingStopsCount,
          eta, routeCompletion: routeCompletionPercentage,
          isOffRoute, nextStop,
        },
      }));

      // Imperatively animate the Leaflet marker — no React re-render needed
      const marker = markerRefs.current[busId];
      if (marker) {
        marker.setLatLng([latitude, longitude]);
        // Update icon rotation to match new heading
        const busData = { ...buses[busId], heading, status };
        marker.setIcon(createBusIcon(heading, busData.status || 'active'));
      }
    };

    socket.on('bus-position', handleBusPosition);
    return () => socket.off('bus-position', handleBusPosition);
  }, [socket, buses]);

  // ── Handle bus going offline (trip ended) ───────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handleTripEnded = ({ busId }) => {
      setBuses((prev) => {
        const updated = { ...prev };
        delete updated[busId];
        return updated;
      });
      delete markerRefs.current[busId];
    };
    socket.on('trip-ended', handleTripEnded);
    return () => socket.off('trip-ended', handleTripEnded);
  }, [socket]);

  return (
    <div style={{ height }} className="w-full">
      <MapContainer
        center={userLocation ? [userLocation.lat, userLocation.lng] : [17.3850, 78.4867]} // Default: Hyderabad
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        {/* ── OpenStreetMap Tiles ─────────────────────────────── */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* ── Route Polyline ───────────────────────────────────── */}
        {routePolyline && routePolyline.length > 0 && (
          <Polyline
            positions={routePolyline}
            color="#2E86AB"
            weight={4}
            opacity={0.7}
            dashArray="8 4"
          />
        )}

        {/* ── Stop Markers ─────────────────────────────────────── */}
        {routeStops?.map((stop, i) => (
          <Marker
            key={stop._id || i}
            position={[stop.location.coordinates[1], stop.location.coordinates[0]]}
            icon={stopIcon}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{stop.stopName}</p>
                <p className="text-gray-500 text-xs">Stop {i + 1}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* ── Live Bus Markers ─────────────────────────────────── */}
        {Object.entries(buses).map(([busId, bus]) => (
          <Marker
            key={busId}
            position={[bus.lat, bus.lng]}
            icon={createBusIcon(bus.heading, bus.status)}
            ref={(markerInstance) => {
              if (markerInstance) markerRefs.current[busId] = markerInstance;
            }}
            eventHandlers={{
              click: () => onBusSelect && onBusSelect(busId, bus),
            }}
          >
            <Popup>
              <div className="min-w-[180px]">
                <div className="flex items-center gap-2 mb-2">
                  <Bus size={16} className="text-brand-blue" />
                  <span className="font-bold text-brand-navy">{bus.busNumber}</span>
                  {bus.isOffRoute && (
                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Off Route</span>
                  )}
                </div>
                {bus.routeName && <p className="text-xs text-gray-500 mb-2">{bus.routeName}</p>}
                <div className="grid grid-cols-2 gap-1 text-xs text-gray-600 mb-2">
                  <div className="flex items-center gap-1">
                    <Gauge size={12} /> {bus.speed ?? 0} km/h
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin size={12} /> {bus.remainingStops ?? '?'} stops left
                  </div>
                  {bus.eta && (
                    <div className="col-span-2 flex items-center gap-1 text-brand-blue font-semibold">
                      ⏱ ETA: {bus.eta.etaMinutes} min ({bus.eta.distanceKm} km)
                    </div>
                  )}
                </div>
                {bus.occupancy != null && bus.capacity && (
                  <OccupancyBadge occupancy={bus.occupancy} capacity={bus.capacity} />
                )}
                {bus.driverName && (
                  <p className="text-xs text-gray-400 mt-1">Driver: {bus.driverName}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* ── User Location Dot ────────────────────────────────── */}
        {userLocation && (
          <>
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}>
              <Popup><p className="text-sm font-medium">Your location</p></Popup>
            </Marker>
            {/* Accuracy circle */}
            {userLocation.accuracy && (
              <Circle
                center={[userLocation.lat, userLocation.lng]}
                radius={userLocation.accuracy}
                color="#3B82F6"
                fillColor="#3B82F6"
                fillOpacity={0.1}
                weight={1}
              />
            )}
          </>
        )}

        {/* ── Programmatic map panning ─────────────────────────── */}
        {centerOnUser && userLocation && (
          <MapCenterController center={[userLocation.lat, userLocation.lng]} />
        )}
      </MapContainer>
    </div>
  );
};

export default LiveBusMap;
