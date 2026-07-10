// tests/auth.test.js
// Unit + Integration tests for Authentication module
// Run: npm test

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../app');
const User     = require('../models/User');

// ── Test database setup ────────────────────────────────────────────────────
beforeAll(async () => {
  const testUri = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/bus_tracking_test';
  await mongoose.connect(testUri);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

afterEach(async () => {
  await User.deleteMany({});
});

// ── Test Data ──────────────────────────────────────────────────────────────
const validUser = {
  name: 'Test User',
  email: 'test@example.com',
  phone: '9876543210',
  password: 'Test@1234',
  confirmPassword: 'Test@1234',
};

// ═══════════════════════════════════════════════════════════════════════════
// REGISTER TESTS
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/register', () => {
  // TC-AUTH-001: Successful registration
  test('TC-AUTH-001: should register a new passenger and return 201 with access token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(validUser.email);
    expect(res.body.user.role).toBe('passenger');
    // Password must never be returned
    expect(res.body.user.password).toBeUndefined();
  });

  // TC-AUTH-002: Duplicate email rejection
  test('TC-AUTH-002: should reject registration with duplicate email (409)', async () => {
    await request(app).post('/api/auth/register').send(validUser);
    const res = await request(app).post('/api/auth/register').send(validUser);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  // TC-AUTH-003: Missing required fields
  test('TC-AUTH-003: should reject registration with missing name (400)', async () => {
    const { name, ...noName } = validUser;
    const res = await request(app).post('/api/auth/register').send(noName);
    expect(res.status).toBe(400);
  });

  // TC-AUTH-004: Weak password rejected
  test('TC-AUTH-004: should reject weak password without uppercase/number (400)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      ...validUser, password: 'weakpassword', confirmPassword: 'weakpassword',
    });
    expect(res.status).toBe(400);
  });

  // TC-AUTH-005: Password mismatch
  test('TC-AUTH-005: should reject mismatched passwords (400)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      ...validUser, confirmPassword: 'Different@123',
    });
    expect(res.status).toBe(400);
  });

  // TC-AUTH-006: Invalid phone number
  test('TC-AUTH-006: should reject invalid Indian phone number (400)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      ...validUser, phone: '1234567890', // starts with 1, invalid
    });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN TESTS
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(validUser);
  });

  // TC-AUTH-007: Successful login
  test('TC-AUTH-007: should login with correct credentials and return 200 with token', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: validUser.email, password: validUser.password,
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(validUser.email);
  });

  // TC-AUTH-008: Wrong password
  test('TC-AUTH-008: should return 401 for wrong password (same message for security)', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: validUser.email, password: 'Wrong@1234',
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password.');
  });

  // TC-AUTH-009: Non-existent email — same error message (prevents enumeration)
  test('TC-AUTH-009: should return 401 for non-existent email with identical error message', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com', password: 'Test@1234',
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password.');
  });

  // TC-AUTH-010: Missing email field
  test('TC-AUTH-010: should return 400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'Test@1234' });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PROTECTED ROUTE TESTS
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /api/auth/me', () => {
  let token;

  beforeEach(async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);
    token = res.body.accessToken;
  });

  // TC-AUTH-011: Access protected route with valid token
  test('TC-AUTH-011: should return user profile with valid JWT', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(validUser.email);
  });

  // TC-AUTH-012: Reject request without token
  test('TC-AUTH-012: should return 401 with no Authorization header', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  // TC-AUTH-013: Reject tampered token
  test('TC-AUTH-013: should return 401 with tampered JWT', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.payload');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FORGOT / RESET PASSWORD TESTS
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/forgot-password', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(validUser);
  });

  // TC-AUTH-014: Forgot password always returns 200 (prevents email enumeration)
  test('TC-AUTH-014: should always return 200 regardless of email existence', async () => {
    const res1 = await request(app).post('/api/auth/forgot-password').send({ email: validUser.email });
    const res2 = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@x.com' });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    // Both responses must look identical to the client
    expect(res1.body.message).toBe(res2.body.message);
  });

  // TC-AUTH-015: Invalid email format rejected
  test('TC-AUTH-015: should reject invalid email format (400)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'notanemail' });
    expect(res.status).toBe(400);
  });
});
