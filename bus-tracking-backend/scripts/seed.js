// scripts/seed.js
// Run with: node scripts/seed.js
// Creates an admin account and sample stops/routes for development.

require('dotenv').config();
const mongoose = require('mongoose');
const Admin    = require('../models/Admin');
const Stop     = require('../models/Stop');
const Route    = require('../models/Route');
const Bus      = require('../models/Bus');
const Driver   = require('../models/Driver');

const connectDB = require('../config/db');

const seed = async () => {
  await connectDB();
  console.log('🌱 Seeding database...\n');

  // ── Admin ───────────────────────────────────────────────────────────────
  const existingAdmin = await Admin.findOne({ email: 'admin@bustrack.com' });
  let admin;
  if (!existingAdmin) {
    admin = await Admin.create({
      name: 'System Admin',
      email: 'admin@bustrack.com',
      phone: '9000000001',
      password: 'Admin@1234',
      role: 'admin',
    });
    console.log('✅ Admin created: admin@bustrack.com / Admin@1234');
  } else {
    admin = existingAdmin;
    console.log('ℹ️  Admin already exists, skipping.');
  }

  // ── Stops (Hyderabad sample) ────────────────────────────────────────────
  const stopData = [
    { stopCode: 'HYD-001', stopName: 'Secunderabad Railway Station', city: 'Hyderabad', lat: 17.4344, lng: 78.5013 },
    { stopCode: 'HYD-002', stopName: 'Paradise Circle',              city: 'Hyderabad', lat: 17.4380, lng: 78.4982 },
    { stopCode: 'HYD-003', stopName: 'Begumpet',                     city: 'Hyderabad', lat: 17.4438, lng: 78.4649 },
    { stopCode: 'HYD-004', stopName: 'Ameerpet X Roads',             city: 'Hyderabad', lat: 17.4374, lng: 78.4487 },
    { stopCode: 'HYD-005', stopName: 'SR Nagar',                     city: 'Hyderabad', lat: 17.4445, lng: 78.4316 },
    { stopCode: 'HYD-006', stopName: 'Erragadda',                    city: 'Hyderabad', lat: 17.4502, lng: 78.4118 },
    { stopCode: 'HYD-007', stopName: 'Hitech City Bus Stop',         city: 'Hyderabad', lat: 17.4435, lng: 78.3772 },
  ];

  const stops = [];
  for (const s of stopData) {
    const exists = await Stop.findOne({ stopCode: s.stopCode });
    if (!exists) {
      const stop = await Stop.create({
        stopCode: s.stopCode,
        stopName: s.stopName,
        city: s.city,
        location: { type: 'Point', coordinates: [s.lng, s.lat] },
        createdBy: admin._id,
      });
      stops.push(stop);
      console.log(`📍 Stop created: ${stop.stopName}`);
    } else {
      stops.push(exists);
      console.log(`ℹ️  Stop exists: ${exists.stopName}`);
    }
  }

  // ── Route ───────────────────────────────────────────────────────────────
  const existingRoute = await Route.findOne({ routeNumber: '216K' });
  let route;
  if (!existingRoute) {
    route = await Route.create({
      routeNumber: '216K',
      routeName: 'Secunderabad to Hitech City',
      source: 'Secunderabad',
      destination: 'Hitech City',
      fare: 35,
      routeType: 'city',
      totalDistance: 18.5,
      expectedDuration: 55,
      createdBy: admin._id,
      stops: stops.map((s, i) => ({
        stop: s._id,
        sequence: i + 1,
        expectedTimeFromStart: i * 8,
        distanceFromStart: parseFloat((i * 2.8).toFixed(1)),
      })),
    });
    console.log(`\n🗺️  Route created: ${route.routeNumber} — ${route.routeName}`);
  } else {
    route = existingRoute;
    console.log(`\nℹ️  Route 216K already exists.`);
  }

  // ── Bus ─────────────────────────────────────────────────────────────────
  const existingBus = await Bus.findOne({ busNumber: 'TS216K-001' });
  if (!existingBus) {
    await Bus.create({
      busNumber: 'TS216K-001',
      vehicleNumber: 'TS09EA1001',
      capacity: 52,
      busType: 'ordinary',
      assignedRoute: route._id,
      createdBy: admin._id,
    });
    console.log('🚌 Sample bus created: TS216K-001');
  } else {
    console.log('ℹ️  Sample bus already exists.');
  }

  // ── Driver ──────────────────────────────────────────────────────────────
  const existingDriver = await Driver.findOne({ email: 'driver@bustrack.com' });
  if (!existingDriver) {
    await Driver.create({
      name: 'Raju Kumar',
      email: 'driver@bustrack.com',
      phone: '9000000002',
      password: 'Driver@1234',
      employeeId: 'EMP001',
      licenseNumber: 'TS0120230001234',
      licenseExpiry: new Date('2028-12-31'),
      assignedRoute: route._id,
      createdBy: admin._id,
    });
    console.log('👤 Driver created: driver@bustrack.com / Driver@1234');
  } else {
    console.log('ℹ️  Sample driver already exists.');
  }

  console.log('\n🎉 Seed complete!\n');
  console.log('Login credentials:');
  console.log('  Admin:  admin@bustrack.com  / Admin@1234');
  console.log('  Driver: driver@bustrack.com / Driver@1234');
  console.log('  (Register a passenger account via the app)\n');

  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
