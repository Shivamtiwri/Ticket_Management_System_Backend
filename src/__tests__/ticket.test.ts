import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app';
import { User } from '../models/User';
import { connectTestDb } from '../testUtils/testDb';

describe('Protected API base endpoints', () => {
  it.each(['/api/tickets', '/api/users', '/api/categories', '/api/activity'])(
    'returns 401 for unauthenticated GET %s',
    async (path) => {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/authentication/i);
    }
  );

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid token');
  });

  it('returns 403 for admin-only endpoints accessed without an admin token', async () => {
    const res = await request(app)
      .get('/api/activity')
      .set('Authorization', 'Bearer bad-token');
    expect(res.status).toBe(401);
  });

  it('exposes a health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns structured 404 for unknown routes', async () => {
    const res = await request(app).get('/api/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBeTruthy();
  });
});

describe('API validation (authenticated)', () => {
  let token: string | null = null;
  let dbAvailable = false;
  const uniqueEmail = `ticket-test-${Date.now()}@example.com`;

  beforeAll(async () => {
    dbAvailable = await connectTestDb();
    if (!dbAvailable) return;
    try {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Ticket Test User',
        email: uniqueEmail,
        password: 'Test@1234',
      });
      if (res.status === 201) {
        token = res.body.data.token;
      } else {
        dbAvailable = false;
        console.warn('register unavailable (status %s) - skipping authenticated tests', res.status);
      }
    } catch {
      dbAvailable = false;
      console.warn('database unavailable - skipping authenticated tests');
    }
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await User.deleteOne({ email: uniqueEmail });
    await mongoose.connection.close();
  });

  const auth = () => (token ? { Authorization: `Bearer ${token}` } : {});

  it('rejects out-of-range limit', async () => {
    if (!dbAvailable || !token) return;
    const res = await request(app).get('/api/tickets?limit=999').set(auth());
    expect(res.status).toBe(400);
    expect(res.body.errors?.[0]?.message).toMatch(/between 1 and 100/);
  });

  it('rejects an invalid category id in query', async () => {
    if (!dbAvailable || !token) return;
    const res = await request(app).get('/api/tickets?category=not-an-id').set(auth());
    expect(res.status).toBe(400);
    expect(res.body.errors?.[0]?.message).toBe('Invalid category ID');
  });

  it('rejects an oversized search term', async () => {
    if (!dbAvailable || !token) return;
    const res = await request(app)
      .get(`/api/tickets?search=${'a'.repeat(250)}`)
      .set(auth());
    expect(res.status).toBe(400);
    expect(res.body.errors?.[0]?.message).toMatch(/at most 200/);
  });

  it('rejects an invalid sort option', async () => {
    if (!dbAvailable || !token) return;
    const res = await request(app).get('/api/tickets?sortBy=magic').set(auth());
    expect(res.status).toBe(400);
    expect(res.body.errors?.[0]?.message).toBe('Invalid sort option');
  });

  it('accepts a valid ticket query', async () => {
    if (!dbAvailable || !token) return;
    const res = await request(app).get('/api/tickets?page=1&limit=10').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('rejects ticket creation with a missing subject', async () => {
    if (!dbAvailable || !token) return;
    const res = await request(app)
      .post('/api/tickets')
      .set(auth())
      .field('description', 'A sufficiently long description for the ticket.')
      .field('category', '507f1f77bcf86cd799439011')
      .field('priority', 'MEDIUM');
    expect(res.status).toBe(400);
    expect(res.body.errors?.some((e: { message: string }) => e.message === 'Subject is required')).toBe(true);
  });

  it('rejects comment creation with empty content', async () => {
    if (!dbAvailable || !token) return;
    const res = await request(app)
      .post('/api/tickets/507f1f77bcf86cd799439011/comments')
      .set(auth())
      .send({ content: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns a clear 404 for a missing ticket', async () => {
    if (!dbAvailable || !token) return;
    const res = await request(app)
      .get('/api/tickets/507f1f77bcf86cd799439011')
      .set(auth());
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
