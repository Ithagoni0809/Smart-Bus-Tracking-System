// tests/bus.test.js
// Integration tests for Bus Management APIs

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../app');
const User     = require('../models/User');
const Admin    = require('../models/Admin');
const Bus      = require('../models/Bus');

let adminToken;
let passengerToken;
let testBusId;

beforeAll(async () => {
  const testUri = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/bus_tracking_test';
  await mongoose.connect(testUri);

  // Create admin
  const admin = await Admin.create({
    name: 'Test Admin', email: 'admin@test.com', phone: '9000000001',
    password: 'Admin@1234', role: 'admin',
  });
  const adminRes = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'Admin@1234' });
  // Admin login would need a separate endpoint in production; for tests we generate token directly
  const { generateAccessToken } = require('../utils/jwt');
  adminToken = generateAccessToken(admin._id, 'admin');

  // Create passenger
  const passRes = await request(app).post('/api/auth/register').send({
    name: 'Test Passenger', email: 'pass@test.com', phone: '9876543210',
    password: 'Pass@1234', confirmPassword: 'Pass@1234',
  });
  passengerToken = passRes.body.accessToken;
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

// ═══════════════════════════════════════════════════════════════════════════
// CREATE BUS
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /api/buses', () => {
  const validBus = { busNumber: 'TS216K-001', vehicleNumber: 'TS09EA1001', capacity: 52, busType: 'ordinary' };

  // TC-BUS-001
  test('TC-BUS-001: admin can create a bus (201)', async () => {
    const res = await request(app)
      .post('/api/buses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validBus);

    expect(res.status).toBe(201);
    expect(res.body.bus.busNumber).toBe('TS216K-001');
    testBusId = res.body.bus._id;
  });

  // TC-BUS-002
  test('TC-BUS-002: passenger cannot create a bus (403)', async () => {
    const res = await request(app)
      .post('/api/buses')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send(validBus);
    expect(res.status).toBe(403);
  });

  // TC-BUS-003
  test('TC-BUS-003: duplicate bus number rejected (409)', async () => {
    const res = await request(app)
      .post('/api/buses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validBus);
    expect(res.status).toBe(409);
  });

  // TC-BUS-004
  test('TC-BUS-004: missing capacity rejected (400)', async () => {
    const { capacity, ...noCapacity } = validBus;
    const res = await request(app)
      .post('/api/buses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...noCapacity, busNumber: 'TS-NEW-001', vehicleNumber: 'TS09EA2222' });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET BUSES
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /api/buses', () => {
  // TC-BUS-005
  test('TC-BUS-005: authenticated user can get all buses (200)', async () => {
    const res = await request(app)
      .get('/api/buses')
      .set('Authorization', `Bearer ${passengerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.buses)).toBe(true);
  });

  // TC-BUS-006
  test('TC-BUS-006: unauthenticated request is rejected (401)', async () => {
    const res = await request(app).get('/api/buses');
    expect(res.status).toBe(401);
  });

  // TC-BUS-007
  test('TC-BUS-007: get single bus by ID returns full details (200)', async () => {
    const res = await request(app)
      .get(`/api/buses/${testBusId}`)
      .set('Authorization', `Bearer ${passengerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.bus._id).toBe(testBusId);
  });

  // TC-BUS-008
  test('TC-BUS-008: invalid ObjectId returns 400', async () => {
    const res = await request(app)
      .get('/api/buses/notavalidid')
      .set('Authorization', `Bearer ${passengerToken}`);
    expect(res.status).toBe(400);
  });

  // TC-BUS-009
  test('TC-BUS-009: non-existent bus ID returns 404', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/buses/${fakeId}`)
      .set('Authorization', `Bearer ${passengerToken}`);
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH BUSES
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /api/buses/search', () => {
  // TC-BUS-010
  test('TC-BUS-010: search by bus number partial match returns results', async () => {
    const res = await request(app)
      .get('/api/buses/search?q=216K')
      .set('Authorization', `Bearer ${passengerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.buses.length).toBeGreaterThan(0);
  });

  // TC-BUS-011
  test('TC-BUS-011: search with no matches returns empty array with count 0', async () => {
    const res = await request(app)
      .get('/api/buses/search?q=XXXNOTEXIST')
      .set('Authorization', `Bearer ${passengerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.buses).toHaveLength(0);
    expect(res.body.count).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE / DELETE BUS
// ═══════════════════════════════════════════════════════════════════════════
describe('PUT/DELETE /api/buses/:id', () => {
  // TC-BUS-012
  test('TC-BUS-012: admin can update bus capacity (200)', async () => {
    const res = await request(app)
      .put(`/api/buses/${testBusId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ capacity: 60 });
    expect(res.status).toBe(200);
    expect(res.body.bus.capacity).toBe(60);
  });

  // TC-BUS-013
  test('TC-BUS-013: passenger cannot update bus (403)', async () => {
    const res = await request(app)
      .put(`/api/buses/${testBusId}`)
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ capacity: 60 });
    expect(res.status).toBe(403);
  });

  // TC-BUS-014
  test('TC-BUS-014: admin can delete inactive bus (200)', async () => {
    const res = await request(app)
      .delete(`/api/buses/${testBusId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
