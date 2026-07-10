# 🚌 Smart Public Bus Tracking System

> Real-time GPS tracking for state transport buses — TSRTC / APSRTC / KSRTC  
> B.Tech Final Year Major Project | Full-Stack Web Application

[![CI/CD](https://github.com/yourusername/smart-bus-tracking/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/yourusername/smart-bus-tracking/actions)
[![Node.js](https://img.shields.io/badge/Node.js-v20-green)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)](https://mongodb.com/atlas)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-v4-black)](https://socket.io)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 📸 Features

| Passenger | Driver | Admin |
|-----------|--------|-------|
| 🗺️ Live bus map (Leaflet + OpenStreetMap) | 📍 GPS sharing every 5 seconds | 📊 Fleet analytics dashboard |
| ⏱️ Real-time ETA to next stop | 🚀 One-tap trip start/end | 🚌 Manage buses, routes, stops |
| 🚶 Remaining stops count | 👥 Passenger count update | 👤 Manage drivers and users |
| 🟢 Occupancy indicator | 🚨 Emergency alert button | 📡 Live fleet monitoring |
| ⭐ Save favourite routes | 🔧 Breakdown reporting | 📈 Trip history & reports |
| 🔔 Real-time delay alerts | ⚠️ Off-route deviation alerts | 📥 CSV export |
| 🌙 Dark mode | 📜 Trip history | 🔔 Emergency notifications |

---

## 🏗️ Architecture

```
React (Vercel CDN)
       │
       │ HTTPS + WSS
       ▼
Node.js + Express + Socket.IO (Render)
       │
       │ Mongoose
       ▼
MongoDB Atlas (Mumbai region)
```

**Real-time flow:** Driver GPS → Socket.IO → ETA calc → Broadcast → Passenger map  
**GPS update interval:** Every 5 seconds  
**Average latency:** < 500ms end-to-end

---

## 🛠️ Tech Stack

```
Frontend:  React 18 · Vite · Tailwind CSS · React Router v6
Maps:      Leaflet.js + OpenStreetMap (free, no API key)
Real-time: Socket.IO v4 (WebSocket)
Backend:   Node.js · Express.js · Socket.IO Server
Database:  MongoDB Atlas · Mongoose ODM
Auth:      JWT (access + refresh tokens) · bcrypt
Deploy:    Vercel (frontend) · Render (backend) · MongoDB Atlas
CI/CD:     GitHub Actions
```

---

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/yourusername/smart-bus-tracking.git
cd smart-bus-tracking

# 2. Backend
cd bus-tracking-backend
npm install
cp .env.example .env   # Fill in MongoDB URI + JWT secrets
npm run seed           # Creates admin, sample route, bus, driver
npm run dev            # Starts on http://localhost:5000

# 3. Frontend (new terminal)
cd bus-tracking-frontend
npm install
npm run dev            # Starts on http://localhost:5173
```

### 🔑 Default Login Credentials (after seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@bustrack.com | Admin@1234 |
| Driver | driver@bustrack.com | Driver@1234 |
| Passenger | Register at /register | — |

---

## 📁 Project Structure

```
smart-bus-tracking/
├── bus-tracking-backend/
│   ├── controllers/        # Business logic (auth, bus, route, trip, admin...)
│   ├── models/             # Mongoose schemas (11 collections)
│   ├── routes/             # Express routers
│   ├── middleware/         # JWT auth, RBAC, error handler, rate limiter
│   ├── socket/             # Socket.IO event handlers (live GPS core)
│   ├── utils/              # geoUtils, jwt, email, logger, AppError
│   ├── validators/         # express-validator rules
│   ├── scripts/seed.js     # Database seeder
│   ├── tests/              # Jest test suites (49 test cases)
│   └── server.js           # Entry point
│
├── bus-tracking-frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── passenger/  # Home, Dashboard, LiveMap, SearchBus, BusDetails,
│   │   │   │               # RouteDetails, Favorites, Notifications, Profile
│   │   │   ├── driver/     # DriverDashboard (GPS sharing, trip lifecycle)
│   │   │   └── admin/      # AdminDashboard, ManageBuses, ManageRoutes,
│   │   │                   # ManageDrivers, ManageStops, ManageUsers, Analytics
│   │   ├── components/
│   │   │   ├── common/     # Navbar, Spinner, OccupancyBadge, ETACard, EmptyState
│   │   │   └── map/        # LiveBusMap (Leaflet + animated markers)
│   │   ├── context/        # AuthContext, ThemeContext, SocketContext
│   │   ├── services/       # api.js (Axios + JWT interceptor), socket.js (singleton)
│   │   └── hooks/          # useGeolocation, useBusTracking, useLocalStorage
│   └── vercel.json
│
├── postman/                # API collection (25 endpoints)
├── docs/                   # Complete documentation
├── .github/workflows/      # CI/CD pipeline
└── render.yaml             # Render deployment blueprint
```

---

## 🔌 Socket.IO Events

| Event (Client → Server) | Who Sends | Description |
|--------------------------|-----------|-------------|
| `join-route` | Passenger | Subscribe to route's live updates |
| `driver-join` | Driver | Open GPS sharing pipe for a trip |
| `gps-update` | Driver | GPS ping (every 5s) |
| `emergency-alert` | Driver | Trigger emergency broadcast |
| `breakdown-report` | Driver | Report mechanical failure |

| Event (Server → Client) | Who Receives | Description |
|--------------------------|--------------|-------------|
| `bus-position` | Passengers + Admin | Live GPS with ETA, occupancy, remaining stops |
| `trip-started` | Admin | Fleet notification |
| `trip-ended` | Passengers + Admin | Bus goes offline |
| `emergency-alert` | All on route + Admin | Emergency broadcast |
| `route-deviation` | Driver + Admin | Bus >500m off route |

---

## 🧪 Tests

```bash
cd bus-tracking-backend
npm test                    # Run all 49 test cases
npm test -- --coverage      # With coverage report
npm test -- tests/auth.test.js    # Auth tests only
npm test -- tests/geoUtils.test.js # Geo utility tests
```

**Coverage:** Auth (15 cases) · Bus API (14 cases) · Geo Utils (20 cases)

---

## 🌐 Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | https://your-app.vercel.app |
| Backend | Render | https://your-api.onrender.com |
| Database | MongoDB Atlas | Mumbai cluster (ap-south-1) |

See `docs/DOCUMENTATION.md` → Section 6 for step-by-step deployment instructions.

---

## 🗄️ Database Collections

| Collection | Purpose | Special |
|------------|---------|---------|
| users | Passenger accounts | — |
| drivers | Driver accounts | Created by admin only |
| admins | Admin accounts | Seeded directly |
| buses | Vehicle records | Denormalized `currentLocation` for fast map queries |
| routes | Bus paths with stops | Text index for source/destination search |
| stops | Physical bus stops | 2dsphere index for `$near` geospatial queries |
| trips | Journey records | Links bus + driver + route + time window |
| gpslogs | GPS ping history | TTL index — auto-deleted after 30 days |
| notifications | User alerts | TTL index — auto-deleted after 90 days |
| favorites | Saved routes/buses | Unique compound index prevents duplicates |

---

## 📋 API Summary

```
POST   /api/auth/register         Create passenger account
POST   /api/auth/login            Login → access token + refresh cookie
GET    /api/buses/live            All active buses with GPS (for map initial load)
GET    /api/buses/search?q=216K   Search buses
GET    /api/routes/search?from=X&to=Y  Search routes
GET    /api/routes/stops/nearest?lat=&lng=  Stops near me
GET    /api/routes/:id/remaining-stops?currentSequence=N  Remaining stops
POST   /api/trips/start           Driver starts trip (opens GPS pipe)
PATCH  /api/trips/:id/end         Driver ends trip
GET    /api/admin/analytics       Fleet analytics (admin only)
```

Full API docs in `docs/DOCUMENTATION.md` or import `postman/Smart_Bus_Tracking_API.postman_collection.json`

---

## 🎓 B.Tech Project Info

- **Domain:** Full-Stack Web Development + Real-Time Systems
- **Technologies:** 12 major technologies used
- **Lines of Code:** ~6,000 lines across 107 source files
- **Test Cases:** 49 automated test cases
- **Database Collections:** 10 MongoDB collections
- **API Endpoints:** 30+ REST endpoints + 8 Socket.IO events

---

## 📄 License

MIT License — Free to use for academic and personal projects.

---

*Built with ❤️ for B.Tech Final Year Project — Smart Public Bus Tracking System*
