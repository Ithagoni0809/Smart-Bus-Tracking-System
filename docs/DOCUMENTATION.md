# Smart Public Bus Tracking System
## Complete Project Documentation

---

## TABLE OF CONTENTS

1. Project Overview
2. System Architecture
3. Database Design (ER Diagram)
4. API Documentation
5. Installation Guide
6. Deployment Guide
7. User Manual — Passenger
8. User Manual — Driver
9. User Manual — Admin
10. Testing Guide
11. Viva Questions & Answers
12. Interview Questions
13. Future Improvements

---

## 1. PROJECT OVERVIEW

### Problem Statement
Millions of passengers using state transport buses (TSRTC, APSRTC, KSRTC) have no way to know where their bus is, when it will arrive, or whether it is delayed. They stand at bus stops for 20–40 minutes with zero information. This system solves that.

### Solution
A full-stack real-time bus tracking web application with three interfaces:
- **Passenger**: Track buses live on a map, get ETA, save favourite routes
- **Driver**: Share GPS every 5 seconds, report emergencies, manage trips
- **Admin**: Monitor entire fleet, manage buses/routes/drivers, view analytics

### Tech Stack
| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 + Vite | Fast HMR, component-based, industry standard |
| Styling | Tailwind CSS | Rapid UI without custom CSS |
| Maps | Leaflet + OpenStreetMap | 100% free, no API key needed |
| Real-time | Socket.IO | Persistent WebSocket connection, <1s GPS updates |
| Backend | Node.js + Express.js | Non-blocking I/O, perfect for real-time |
| Database | MongoDB + Mongoose | Flexible schema for GPS time-series data |
| Auth | JWT + bcrypt | Stateless, scalable, secure |

---

## 2. SYSTEM ARCHITECTURE

### High-Level Architecture (3-Tier)

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│   React SPA (Vercel CDN)                                     │
│   Passenger UI | Driver App | Admin Dashboard                │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS (REST) + WSS (Socket.IO)
┌──────────────────────▼──────────────────────────────────────┐
│                   APPLICATION LAYER                          │
│   Node.js + Express.js (Render)                             │
│   REST APIs | Socket.IO Server | JWT Auth | Business Logic  │
└──────────────────────┬──────────────────────────────────────┘
                       │ Mongoose ODM
┌──────────────────────▼──────────────────────────────────────┐
│                     DATA LAYER                               │
│   MongoDB Atlas (Cloud) — 9 Collections                     │
│   users | drivers | buses | routes | stops | trips           │
│   gpslogs (TTL 30d) | notifications | favorites              │
└─────────────────────────────────────────────────────────────┘
```

### Real-Time GPS Flow (Core Loop)

```
Driver Phone Browser
      │
      │ navigator.geolocation.getCurrentPosition()
      │ every 5 seconds
      ▼
socket.emit('gps-update', { lat, lng, speed, occupancy })
      │
      ▼
Server socketHandler.js
      ├── Calculate speed (Haversine formula)
      ├── Calculate bearing (direction)
      ├── Find nearest stop
      ├── Calculate remaining stops
      ├── Calculate ETA to next stop
      ├── Detect route deviation (>500m threshold)
      ├── Save GpsLog to MongoDB (permanent history)
      ├── Update Bus.currentLocation (live cache)
      └── Broadcast 'bus-position' to:
              route:<routeId> room → all passengers on this route
              bus:<busId> room    → passenger viewing this bus
              admin room          → admin dashboard
                    │
                    ▼
Passenger Browser receives 'bus-position' event
      ├── Leaflet marker.setLatLng() — animates bus on map
      ├── Updates ETACard component
      ├── Updates remaining stops count
      └── Updates occupancy badge
```

### Authentication Flow

```
Register/Login
      │
      ▼
Server verifies credentials (bcrypt.compare)
      │
      ├── Signs ACCESS TOKEN (JWT, 24h, stored in JS memory)
      └── Signs REFRESH TOKEN (JWT, 30d, stored in httpOnly cookie)
             │
             ▼
Axios interceptor attaches access token to every API request
             │
If access token expires (401):
      ▼
Axios interceptor auto-calls POST /auth/refresh-token
      │   (httpOnly cookie sent automatically by browser)
      ▼
Server verifies refresh token, issues new access token
      │
      ▼
Original failed request retried with new token
(User never sees the expiry — seamless experience)
```

---

## 3. DATABASE DESIGN

### ER Diagram (Text Representation)

```
USER ──────────────────────── FAVORITE ──────── ROUTE
  │  (1 user has many favs)    │ (fav links to     │
  │                            │  route OR bus)    │
  │                         FAVORITE ──────── BUS │
  │                                               │
  └── NOTIFICATION (1:many)                       │
                                                  │
ADMIN ─── creates ─── DRIVER ─── assigned to ─── BUS
  │                     │                         │
  │                     └── drives ─── TRIP ──────┘
  │                                    │
  │                                    └── GPSLOG (1:many, TTL 30d)
  │
  └── creates ─── STOP ◄── (referenced by ROUTE.stops array)
                    │
              ROUTE.stops [{ stop: ObjectId, sequence, distance, eta }]
```

### Collections Summary

| Collection | Documents | Key Indexes | TTL |
|------------|-----------|-------------|-----|
| users | Passengers | email(unique), isActive | — |
| drivers | Bus drivers | email(unique), employeeId(unique), isOnTrip | — |
| admins | System admins | email(unique) | — |
| buses | Vehicles | busNumber(unique), assignedRoute+isActive(compound) | — |
| routes | Bus paths | routeNumber(unique), source+destination, text index | — |
| stops | Physical stops | location(2dsphere), stopCode(unique) | — |
| trips | Journey records | bus+createdAt, driver+createdAt, status | — |
| gpslogs | GPS pings | bus+capturedAt, trip+capturedAt, createdAt(TTL) | 30 days |
| notifications | User alerts | recipient+isRead+createdAt, createdAt(TTL) | 90 days |
| favorites | Saved routes/buses | user+route(unique), user+bus(unique) | — |

### Key Schema Decisions

**Why TTL on GpsLog?**
A bus running 12 hours/day generates 8,640 GPS pings per day. Without TTL, the collection grows by ~260,000 docs/month. The 30-day TTL index auto-deletes old pings — MongoDB runs a background job every 60 seconds — keeping storage bounded without any application code.

**Why GeoJSON on Stop?**
MongoDB's `$near` operator requires GeoJSON format and a `2dsphere` index. This lets us query "stops within 2km of the user" entirely inside the database engine — orders of magnitude faster than fetching all stops and computing distances in JavaScript.

**Why denormalize currentLocation onto Bus?**
The live map page needs the latest position of all active buses immediately. Scanning the GpsLog collection (potentially millions of docs) to find the most recent ping per bus on every map load would be slow. Storing `currentLocation` directly on Bus gives O(1) lookup. GpsLog keeps the full history for analytics and replay.

---

## 4. API DOCUMENTATION

### Base URL
- Development: `http://localhost:5000/api`
- Production: `https://your-api.onrender.com/api`

### Authentication
All protected endpoints require: `Authorization: Bearer <accessToken>`

### Response Format
```json
{
  "success": true,
  "data": { ... }
}
```
```json
{
  "success": false,
  "message": "Error description"
}
```

### Auth Endpoints

| Method | Endpoint | Auth | Body | Response |
|--------|----------|------|------|----------|
| POST | /auth/register | No | name, email, phone, password, confirmPassword | 201: { accessToken, user } |
| POST | /auth/login | No | email, password | 200: { accessToken, user } |
| POST | /auth/logout | JWT | — | 200: { message } |
| GET | /auth/me | JWT | — | 200: { user } |
| POST | /auth/refresh-token | Cookie | — | 200: { accessToken } |
| POST | /auth/forgot-password | No | email | 200: { message } |
| PATCH | /auth/reset-password/:token | No | password, confirmPassword | 200: { accessToken, user } |
| GET | /auth/verify-email/:token | No | — | 200: { message } |
| PATCH | /auth/change-password | JWT | currentPassword, newPassword | 200: { accessToken, user } |

### Bus Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /buses | JWT | List all buses (paginated) |
| GET | /buses/live | JWT | Only active buses with GPS |
| GET | /buses/search?q=216K | JWT | Search by number/type/status |
| GET | /buses/:id | JWT | Full bus details |
| POST | /buses | Admin | Create bus |
| PUT | /buses/:id | Admin | Update bus |
| DELETE | /buses/:id | Admin | Delete bus (not if active) |
| PATCH | /buses/:id/assign-driver | Admin | { driverId } |
| PATCH | /buses/:id/assign-route | Admin | { routeId } |

### Route Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /routes | JWT | All active routes |
| GET | /routes/search?from=X&to=Y | JWT | Search routes |
| GET | /routes/stops/nearest?lat=&lng= | JWT | Stops near GPS position |
| GET | /routes/:id | JWT | Route with all stop details |
| GET | /routes/:id/remaining-stops?currentSequence=N | JWT | Remaining stops calculation |
| POST | /routes | Admin | Create route |
| PUT | /routes/:id | Admin | Update route metadata |
| DELETE | /routes/:id | Admin | Delete route (if no buses) |
| POST | /routes/:id/stops | Admin | Add stop to route |
| DELETE | /routes/:id/stops/:stopId | Admin | Remove stop |

### Socket.IO Events

**Client → Server:**
```
join-route    { routeId }                         → subscribe to route updates
leave-route   { routeId }                         → unsubscribe
join-bus      { busId }                           → subscribe to bus updates
driver-join   { busId, routeId, tripId }          → start GPS sharing (driver)
gps-update    { latitude, longitude, speed,       → send GPS ping (driver, every 5s)
                heading, accuracy, occupancy }
emergency-alert { message }                       → trigger emergency (driver)
breakdown-report { description }                  → report breakdown (driver)
join-admin    —                                   → subscribe to all fleet data (admin)
```

**Server → Client:**
```
bus-position       { busId, latitude, longitude, speed, heading,
                     occupancy, remainingStopsCount, eta,
                     routeCompletionPercentage, nextStop, isOffRoute }
trip-started       { busId, busNumber, driverName, routeId }
trip-ended         { busId }
emergency-alert    { busId, busNumber, driverName, message, location }
breakdown-report   { busId, description }
route-deviation    { busId, distanceFromRoute }
error-message      { message }
driver-join-ack    { success: true }
```

---

## 5. INSTALLATION GUIDE

### Prerequisites
- Node.js v18 or higher (check: `node --version`)
- npm v9 or higher (check: `npm --version`)
- Git (check: `git --version`)
- MongoDB Atlas account (free at mongodb.com/atlas)

### Step 1: Clone the Project
```bash
git clone https://github.com/yourusername/smart-bus-tracking.git
cd smart-bus-tracking
```

### Step 2: Backend Setup
```bash
cd bus-tracking-backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Now edit `.env` with your values:
```bash
# Generate JWT secrets (run this command TWICE - once for each secret)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Set in .env:
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/smart_bus_tracking
JWT_ACCESS_SECRET=<paste first generated secret>
JWT_REFRESH_SECRET=<paste second generated secret>
CLIENT_URL=http://localhost:5173
```

```bash
# Seed the database with sample data
npm run seed

# Start development server
npm run dev
```

Backend runs on: http://localhost:5000
Test: `curl http://localhost:5000/health`

### Step 3: Frontend Setup
```bash
# Open a new terminal
cd bus-tracking-frontend

npm install

cp .env.example .env
# .env file is already configured for localhost, no changes needed for dev

npm run dev
```

Frontend runs on: http://localhost:5173

### Step 4: First Login
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@bustrack.com | Admin@1234 |
| Driver | driver@bustrack.com | Driver@1234 |
| Passenger | Register at /register | — |

---

## 6. DEPLOYMENT GUIDE

### MongoDB Atlas Setup
1. Go to https://mongodb.com/atlas → Create free account
2. Create cluster → Choose M0 Free → Region: Mumbai (ap-south-1)
3. Database Access → Add database user → Username + password
4. Network Access → Add IP → `0.0.0.0/0` (allows all — fine for dev)
5. Connect → Drivers → Node.js → Copy connection string
6. Replace `<password>` in the string with your DB user password

### Backend → Render
1. Push `bus-tracking-backend/` to GitHub
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Settings:
   - Root Directory: `bus-tracking-backend`
   - Build Command: `npm install`
   - Start Command: `node server.js`
5. Environment Variables → Add all from `.env.example`
   - `MONGODB_URI` → your Atlas connection string
   - `JWT_ACCESS_SECRET` → generate with `crypto.randomBytes(64).toString('hex')`
   - `JWT_REFRESH_SECRET` → generate again (different value)
   - `CLIENT_URL` → your Vercel URL (add after frontend is deployed)
6. Deploy!

### Frontend → Vercel
1. Push `bus-tracking-frontend/` to GitHub
2. Go to https://vercel.com → New Project → Import
3. Framework: Vite (auto-detected)
4. Environment Variables:
   - `VITE_API_URL` → `https://your-api.onrender.com/api`
   - `VITE_SOCKET_URL` → `https://your-api.onrender.com`
5. Deploy!

### SSL/HTTPS
Both Render and Vercel provide free SSL certificates automatically. No configuration needed — your app is HTTPS by default.

### Keeping Render Awake (Free Tier)
Render's free tier sleeps after 15 minutes of inactivity. Options:
- Use UptimeRobot (free) to ping `/health` every 10 minutes
- Upgrade to Render's paid plan ($7/month) for always-on

### GitHub Actions CI/CD Setup
Add these secrets in GitHub → Settings → Secrets → Actions:
```
RENDER_DEPLOY_HOOK_URL   → Render dashboard → your service → Settings → Deploy Hook
VERCEL_TOKEN             → vercel.com → Settings → Tokens
VERCEL_ORG_ID            → vercel.com → Settings → General → Team ID
VERCEL_PROJECT_ID        → vercel.com → your project → Settings → General
VITE_API_URL             → https://your-api.onrender.com/api
VITE_SOCKET_URL          → https://your-api.onrender.com
```

After this setup, every push to `main` branch automatically:
1. Runs Jest tests (backend)
2. Builds Vite bundle (frontend)
3. Deploys backend to Render
4. Deploys frontend to Vercel

---

## 7. USER MANUAL — PASSENGER

### Getting Started
1. Go to the app URL → Click **Register**
2. Fill in name, email, 10-digit phone, password (min 8 chars, 1 uppercase, 1 number)
3. Click **Create Account** — you're immediately logged in

### Tracking a Bus Live
1. Click **Live Map** in the navigation bar
2. Enter your source (e.g. "Secunderabad") and destination (e.g. "Hitech City")
3. Click **Search Routes**
4. Click any route from the results — the map shows all active buses on that route
5. Click a bus marker on the map — a panel slides in showing:
   - ETA to next stop
   - Current speed
   - Remaining stops
   - Occupancy level (Low/Medium/High/Full)
6. Click **Full Bus Details** for the complete bus information page

### Saving Favourite Routes
1. Open the **Live Map**
2. Search for your daily commute route
3. Click the ⭐ button on the route
4. Access all saved routes from **Saved** in the navigation

### Receiving Notifications
Notifications appear automatically when:
- Your bus is arriving at your stop
- Your bus is delayed
- An emergency is reported on your route
- Check all notifications in the **Alerts** page

### Dark Mode
Click the 🌙 moon icon in the navigation bar to switch to dark mode. Your preference is saved automatically.

---

## 8. USER MANUAL — DRIVER

### Prerequisites
Your admin must create your driver account and assign you to a bus and route before you can use the driver panel.

### Starting a Trip
1. Log in with your credentials (provided by admin)
2. You are redirected to the **Driver Panel**
3. Click **Start Trip**
4. When your browser asks "Allow location access" → Click **Allow**
5. The GPS indicator turns green: **GPS Live (every 5s)**
6. Your bus now appears on the passenger live map

### During a Trip
- **Passenger Count**: Use the +/− buttons to update how many passengers are on board. This updates passengers' occupancy view automatically.
- **Emergency Button**: Press **SEND EMERGENCY ALERT** if there is an accident, medical emergency, or safety threat. This immediately notifies the admin and all passengers on your route.
- **Breakdown Button**: Press **Report Breakdown** if the bus has mechanical failure.

### Ending a Trip
1. When you reach the final stop, click **End Trip**
2. GPS sharing stops immediately
3. The bus disappears from the passenger live map
4. The trip is recorded in your history

### Important Notes
- Keep the browser tab open while driving — closing it pauses GPS sharing
- If network drops temporarily (tunnel, poor signal), GPS auto-resumes when connectivity returns
- You will see a red **Off Route!** warning if you deviate more than 500m from your assigned route

---

## 9. USER MANUAL — ADMIN

### Accessing the Admin Dashboard
1. Log in with admin credentials
2. You are automatically redirected to `/admin`
3. The dashboard shows: live buses, fleet stats, and real-time alerts

### Managing Buses
- **Add Bus**: Admin → Manage Buses → Add Bus → fill bus number, vehicle number, capacity, type
- **Assign Driver**: In the bus list, use the assign-driver endpoint (or directly in the database via seed script for now)
- **Assign Route**: Same — assign-route endpoint
- **Delete Bus**: Only possible if the bus is not currently on an active trip

### Managing Routes
- **Add Route**: Admin → Manage Routes → Add Route
  - Route must reference existing stops (add stops first!)
  - Distance and duration are auto-calculated from stop coordinates
- **Add Stops to Route**: Use the route detail page → Add Stop section

### Managing Drivers
- **Create Driver**: Admin → Manage Drivers → Add Driver
  - Set a temporary password — ask the driver to change it after first login
- **Deactivate Driver**: Click the toggle — they cannot log in until reactivated

### Live Monitoring
- The Admin Dashboard shows a live table of all active buses with speed, occupancy, and status
- Emergency and breakdown alerts appear as real-time toast notifications
- All alerts are also listed in the Recent Alerts panel

### Analytics
- Go to **Analytics** to see: trips today, this week, on-time rate, average delay
- Click **Export CSV** to download a report for your project documentation

---

## 10. TESTING GUIDE

### Running Tests
```bash
cd bus-tracking-backend

# Run all tests
npm test

# Run with coverage report
npm test -- --coverage

# Run specific test file
npm test -- tests/auth.test.js

# Run in watch mode (re-runs on file change)
npm test -- --watch
```

### Test Cases Summary

#### Auth Tests (auth.test.js) — 15 test cases
| ID | Test Case | Type |
|----|-----------|------|
| TC-AUTH-001 | Register new passenger → 201 + token | Happy path |
| TC-AUTH-002 | Duplicate email → 409 | Negative |
| TC-AUTH-003 | Missing name → 400 | Validation |
| TC-AUTH-004 | Weak password → 400 | Validation |
| TC-AUTH-005 | Password mismatch → 400 | Validation |
| TC-AUTH-006 | Invalid phone → 400 | Validation |
| TC-AUTH-007 | Login correct credentials → 200 + token | Happy path |
| TC-AUTH-008 | Login wrong password → 401 | Security |
| TC-AUTH-009 | Login unknown email → 401 (same message) | Security/Enumeration prevention |
| TC-AUTH-010 | Login missing email → 400 | Validation |
| TC-AUTH-011 | GET /me with valid JWT → 200 + profile | Happy path |
| TC-AUTH-012 | GET /me without token → 401 | Security |
| TC-AUTH-013 | GET /me with tampered JWT → 401 | Security |
| TC-AUTH-014 | Forgot password returns 200 always | Security/Enumeration prevention |
| TC-AUTH-015 | Forgot password invalid email format → 400 | Validation |

#### Bus Tests (bus.test.js) — 14 test cases
| ID | Test Case | Type |
|----|-----------|------|
| TC-BUS-001 | Admin creates bus → 201 | Happy path |
| TC-BUS-002 | Passenger creates bus → 403 | Authorization |
| TC-BUS-003 | Duplicate bus number → 409 | Negative |
| TC-BUS-004 | Missing capacity → 400 | Validation |
| TC-BUS-005 | Get all buses authenticated → 200 | Happy path |
| TC-BUS-006 | Get buses unauthenticated → 401 | Security |
| TC-BUS-007 | Get bus by valid ID → 200 | Happy path |
| TC-BUS-008 | Invalid ObjectId → 400 | Validation |
| TC-BUS-009 | Non-existent bus ID → 404 | Negative |
| TC-BUS-010 | Search by partial number → results | Happy path |
| TC-BUS-011 | Search no match → empty array | Edge case |
| TC-BUS-012 | Admin updates capacity → 200 | Happy path |
| TC-BUS-013 | Passenger updates bus → 403 | Authorization |
| TC-BUS-014 | Admin deletes inactive bus → 200 | Happy path |

#### Geo Utility Tests (geoUtils.test.js) — 20 test cases
Pure unit tests — no database, run instantly.
Covers: haversine distance, speed calculation, ETA, nearest stop, route deviation, route completion percentage.

### Manual API Testing with Postman
1. Import `postman/Smart_Bus_Tracking_API.postman_collection.json`
2. Set collection variables: `baseUrl`, `adminAccessToken`, `driverAccessToken`
3. Run requests in order: Register → Login → create bus → create route → start trip → check live buses

---

## 11. VIVA QUESTIONS & ANSWERS

**Q1: What is the core technology that enables live bus tracking?**
A: Socket.IO, which implements the WebSocket protocol. Unlike HTTP which requires a new request for every update, WebSocket maintains a persistent two-way connection. The driver app emits a `gps-update` event every 5 seconds; the server receives it, processes the data, and immediately broadcasts a `bus-position` event to all passengers watching that route. The entire round-trip takes under 500 milliseconds.

**Q2: Explain the ETA calculation algorithm.**
A: We use the Haversine formula, which calculates the shortest distance between two GPS coordinates on the surface of the Earth (great-circle distance). The formula uses trigonometric functions to account for the Earth's curvature — a flat Pythagorean calculation would be inaccurate because degrees of longitude get shorter in real distance as you move away from the equator. Once we have the distance in kilometres, we divide by the bus's current speed to get time: ETA (minutes) = (distance / speed) × 60. If the bus is stationary (speed < 5 km/h), we use a default 20 km/h average city speed to avoid division by near-zero.

**Q3: Why is MongoDB used instead of MySQL for this project?**
A: Three reasons. First, GPS logs are time-series data — each ping is a document with a timestamp. MongoDB handles high-volume inserts efficiently. Second, the TTL (Time-To-Live) index lets MongoDB automatically delete old logs without any application code — MySQL would require a scheduled job. Third, embedding route stops as an array inside the Route document is natural in MongoDB; in MySQL you'd need a separate RouteStops table with foreign keys and JOINs for every route query.

**Q4: How does JWT authentication work in this system?**
A: When a user logs in, the server creates two tokens: a short-lived access token (24 hours) signed with a secret key, and a long-lived refresh token (30 days). The access token is sent in the response body; the frontend stores it in JavaScript memory. The refresh token is set as an `httpOnly` cookie — JavaScript cannot read it, preventing XSS attacks from stealing it. On every API request, Axios attaches the access token in the `Authorization: Bearer` header. When the access token expires, the Axios interceptor automatically calls the refresh endpoint (the browser sends the httpOnly cookie automatically), gets a new access token, and retries the original request — the user never notices.

**Q5: What is the Singleton pattern and where is it used?**
A: A Singleton ensures only ONE instance of something exists throughout the application. We use it for the Socket.IO client in `services/socket.js`. Without it, every component that imports socket.io-client would create its own WebSocket connection — a passenger map page might create 5 connections. The singleton creates the connection once and returns the same instance every time `getSocket()` is called.

**Q6: Explain route deviation detection.**
A: The `isOffRoute()` function in `geoUtils.js` takes the bus's current GPS coordinates and the array of all stops on its route. For each stop, it calculates the Haversine distance from the bus's position to that stop. If the bus is further than 500 metres from EVERY stop on the route, it is considered off-route. The 500m threshold matches Functional Requirement FR-D08 from the SRS. When off-route is detected, the server emits both a `bus-position` event (with `isOffRoute: true`) and a separate `route-deviation` event to the driver and admin.

**Q7: What is the TTL index and why is it important?**
A: TTL (Time-To-Live) is a MongoDB index that automatically deletes documents after a specified duration. In `models/GpsLog.js`, we define: `gpsLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 })` — that's 30 days. Every 60 seconds, MongoDB's background task scans for documents where `(current_time - createdAt) > 30 days` and deletes them. Without this, a fleet of 50 buses running 12 hours/day would generate ~15 million GPS pings per month, quickly exhausting MongoDB Atlas's free 512MB tier.

**Q8: How does the system handle a driver going through a tunnel (GPS lost)?**
A: Socket.IO has built-in reconnection logic with exponential backoff. If the WebSocket connection drops (no GPS signal, network loss), the client automatically tries to reconnect at 1s, 2s, 4s, 8s... up to 10 seconds between attempts, for up to 10 attempts. During this time, the bus marker stays at its last known position on passengers' maps — it doesn't disappear. When connectivity returns, the driver's app reconnects and GPS updates resume automatically. The trip only ends when the driver explicitly clicks "End Trip" — not due to connection drops.

**Q9: What is RBAC and how is it implemented?**
A: Role-Based Access Control means different users can only access endpoints appropriate for their role. Implementation: the JWT payload includes the user's role (`passenger`, `driver`, `admin`). The `authMiddleware.js` `protect` function verifies the token and attaches `req.user` with the role. The `restrictTo(...roles)` middleware then checks if `req.user.role` is in the allowed roles array. Example: `router.post('/buses', protect, restrictTo('admin'), busController.createBus)` — only admins can add buses. Passengers hitting this endpoint get a 403 Forbidden response.

**Q10: Explain the 2dsphere geospatial index on the Stop model.**
A: MongoDB's `2dsphere` index enables geospatial queries on GeoJSON data. Stops store their location as: `{ type: 'Point', coordinates: [longitude, latitude] }`. The index is created with: `stopSchema.index({ location: '2dsphere' })`. This enables the `$near` operator: "give me all stops within 2km of [78.4487, 17.4374]". MongoDB uses the index to efficiently find nearby documents without scanning the entire collection — it's similar to how a book index lets you jump to the right page instead of reading every page.

---

## 12. INTERVIEW QUESTIONS

**Q: How would you scale this system to 10,000 concurrent buses?**
A: Current single-server Socket.IO won't work. Solution: Socket.IO with Redis adapter (`@socket.io/redis-adapter`) — multiple Node.js instances share one Redis pub/sub channel. When server A receives a GPS update from a driver, it publishes to Redis; Redis broadcasts to all server instances; the instance whose room contains the passenger sockets broadcasts to them. The REST API scales horizontally behind a load balancer (Nginx or AWS ALB). MongoDB Atlas can be scaled vertically (bigger cluster) or with sharding (partition GpsLog by busId).

**Q: What are the security vulnerabilities you've addressed?**
A: (1) XSS — access token in JS memory (not localStorage), httpOnly cookies for refresh tokens, `xss-clean` middleware sanitizes inputs. (2) NoSQL Injection — `express-mongo-sanitize` strips `$` operators from inputs. (3) Brute Force — `express-rate-limit` with strict limits on auth endpoints (10 req/15min). (4) User Enumeration — forgot-password always returns the same response. (5) JWT tampering — `jsonwebtoken` verifies signature on every request. (6) HTTP header attacks — `helmet` sets secure headers (X-Frame-Options, HSTS, etc.).

**Q: How would you add AI-based ETA prediction?**
A: Collect historical GPS data with timestamps and traffic conditions. Train a regression model (e.g., XGBoost or LSTM neural network) on features: time of day, day of week, weather, distance remaining, historical average speed on each road segment. The model predicts ETA more accurately than simple distance/speed, especially during peak hours. Deploy as a Python microservice (FastAPI); the Node.js backend calls it via HTTP when calculating ETA. Store predictions in Redis for caching.

---

## 13. FUTURE IMPROVEMENTS

| Feature | Priority | Effort |
|---------|----------|--------|
| React Native driver app (better GPS accuracy, background tracking) | High | 4 weeks |
| ML-based ETA prediction using historical traffic | High | 3 weeks |
| Multi-language support (Telugu, Kannada, Tamil, Hindi) | Medium | 1 week |
| Digital fare payment via UPI/PhonePe | Medium | 2 weeks |
| IoT GPS devices on buses (replace phone GPS) | High | Hardware needed |
| Passenger demand prediction for route planning | Medium | 2 weeks |
| Bus stop digital display boards integration | Low | Hardware needed |
| Multi-corporation support (TSRTC + APSRTC in one app) | High | 3 weeks |
| Offline mode for passengers (service worker + cached routes) | Low | 1 week |
| AI chatbot for natural language queries | Low | 2 weeks |
| Bus maintenance tracking and predictive alerts | Medium | 2 weeks |
| Carbon footprint tracking per trip | Low | 1 week |
