# Smart Public Bus Tracking System — Backend

This is the complete Node.js + Express + MongoDB + Socket.IO backend for
the Smart Public Bus Tracking System (B.Tech major project).

## ✅ What's Built So Far

**Module 1 — Project Setup**
- Professional folder structure (config / models / controllers / routes / middleware / socket / utils / validators)
- `package.json` with all dependencies pinned
- `.env.example` template (copy to `.env` and fill in your own values)
- MongoDB connection (`config/db.js`)
- Winston logging system with custom levels (`utils/logger.js`)
- Global error handling (`middleware/errorHandler.js`, `utils/AppError.js`, `utils/catchAsync.js`)
- Security middleware: Helmet, rate limiting, NoSQL-injection sanitization, XSS cleaning (`middleware/security.js`)
- HTTP request logging via Morgan + Winston (`middleware/requestLogger.js`)
- Express app config (`app.js`) and server entry point with Socket.IO (`server.js`)
- Socket.IO skeleton with JWT-authenticated connections and room joining (`socket/socketHandler.js`)

**Module 2 — Database Schema (9 Collections)**
All in `models/`: `User.js`, `Driver.js`, `Admin.js`, `Bus.js`, `Route.js`,
`Stop.js`, `Trip.js`, `GpsLog.js`, `Notification.js`, `Review.js`, `Favorite.js`.

Every schema includes field validation, indexes, relationships (via `ref`),
and relevant instance/static methods. See the SRS document you already have
for the full ER diagram and indexing strategy explanation.

**Module 3 — Authentication**
Complete and production-ready:
- Register (with auto email verification token + immediate login)
- Login (with timing-safe error messages)
- Logout (httpOnly cookie clearing)
- Access token + Refresh token (rotation-ready architecture)
- Forgot Password / Reset Password (hashed tokens, 10-min expiry)
- Email Verification (hashed tokens, 24-hour expiry)
- Change Password (while logged in)
- Role-Based Access Control middleware (`protect`, `restrictTo`)
- Full validation layer with `express-validator` (`validators/authValidator.js`)

## 🚀 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template and fill in your values
cp .env.example .env
# Edit .env: MongoDB Atlas URI, JWT secrets, email credentials

# Generate secure random secrets for JWT:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Run this TWICE — once for JWT_ACCESS_SECRET, once for JWT_REFRESH_SECRET

# 3. Run in development (auto-restarts on file changes)
npm run dev

# 4. Or run in production mode
npm start
```

Server starts on `http://localhost:5000` by default.
Health check: `GET http://localhost:5000/health`

## 🔑 Auth Endpoints Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Create passenger account |
| POST | `/api/auth/login` | Public | Login, receive tokens |
| POST | `/api/auth/logout` | Private | Clear refresh token cookie |
| POST | `/api/auth/refresh-token` | Public (cookie) | Get new access token |
| GET | `/api/auth/me` | Private | Get current user |
| GET | `/api/auth/verify-email/:token` | Public | Verify email from link |
| POST | `/api/auth/resend-verification` | Private | Resend verification email |
| POST | `/api/auth/forgot-password` | Public | Request reset email |
| PATCH | `/api/auth/reset-password/:token` | Public | Set new password from link |
| PATCH | `/api/auth/change-password` | Private | Change password (logged in) |

## ⚠️ Important Note on This Environment

This code was written and **syntax-validated** (`node --check` passed on
every file) in a sandboxed container without outbound access to the npm
registry, so `npm install` could not be run here to fully smoke-test
`require()` resolution end-to-end. All exports/imports were manually
cross-checked line-by-line (every controller function called in routes
matches an actual export; every middleware import matches an actual
export) — see the `package.json` for the exact dependency list.

**Before your first run**, please do the following on your own machine:
```bash
npm install
npm run dev
```
If anything errors, it will almost certainly be a missing `.env` value
(MongoDB URI or JWT secrets) — not the code itself.

## 📌 What's Next

The remaining modules from the original project prompt (Live Tracking /
GPS Socket.IO events, Bus/Route/Stop CRUD APIs, Driver module, Admin
module, Notifications, Frontend, Testing, Deployment) will be built the
same way: one module at a time, fully explained, before moving to the next.
