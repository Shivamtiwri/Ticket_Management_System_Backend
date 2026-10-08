import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app';
import { User } from '../models/User';
import { connectTestDb } from '../testUtils/testDb';

const OWNED_EMAILS = [
  'test@example.com',
  'exists@example.com',
  'login@example.com',
  'authtest@example.com',
];

let dbAvailable = false;

beforeAll(async () => {
  dbAvailable = await connectTestDb();
});

afterAll(async () => {
  if (!dbAvailable) return;
  await User.deleteMany({ email: { $in: OWNED_EMAILS } });
  await mongoose.connection.close();
});

beforeEach(async () => {
  if (!dbAvailable) return;
  await User.deleteMany({ email: { $in: OWNED_EMAILS } });
});

const itDb = (name: string, fn: () => Promise<void>): void => {
  it(name, async () => {
    if (!dbAvailable) {
      console.warn(`skipped (no database): ${name}`);
      return;
    }
    await fn();
  });
};

describe('Auth API', () => {
  describe('POST /api/auth/register', () => {
    itDb('should register a new user', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test@1234',
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('test@example.com');
    });

    itDb('should reject duplicate email', async () => {
      await User.create({ name: 'Existing', email: 'exists@example.com', password: 'Test@1234' });
      const res = await request(app).post('/api/auth/register').send({
        name: 'Test User',
        email: 'exists@example.com',
        password: 'Test@1234',
      });
      expect(res.status).toBe(409);
    });

    it('should reject weak password', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'weak',
      });
      expect(res.status).toBe(400);
    });

    it('should reject missing fields', async () => {
      const res = await request(app).post('/api/auth/register').send({ name: 'Test User' });
      expect(res.status).toBe(400);
      expect(res.body.errors?.length).toBeGreaterThan(0);
    });

    it('should reject an invalid email format', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Test User',
        email: 'not-an-email',
        password: 'Test@1234',
      });
      expect(res.status).toBe(400);
      expect(res.body.errors?.[0]?.message).toMatch(/valid email/i);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      if (!dbAvailable) return;
      await User.create({ name: 'Test User', email: 'login@example.com', password: 'Test@1234' });
    });

    itDb('should login with valid credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'login@example.com',
        password: 'Test@1234',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
    });

    itDb('should reject invalid password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'login@example.com',
        password: 'Wrong@1234',
      });
      expect(res.status).toBe(401);
    });

    itDb('should reject non-existent email', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'nobody@example.com',
        password: 'Test@1234',
      });
      expect(res.status).toBe(401);
    });

    it('should reject missing credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
      expect(res.body.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/auth/me', () => {
    itDb('should return current user with valid token', async () => {
      const registerRes = await request(app).post('/api/auth/register').send({
        name: 'Auth Test',
        email: 'authtest@example.com',
        password: 'Test@1234',
      });
      const token = registerRes.body.data.token;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('authtest@example.com');
    });

    it('should reject request without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });
});
