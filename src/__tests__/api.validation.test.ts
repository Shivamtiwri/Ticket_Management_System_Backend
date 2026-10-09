import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';

describe('Unauthenticated API behavior and request validation', () => {
  it('returns the public health response and a structured 404 for unknown routes', async () => {
    const health = await request(app).get('/health');
    const missing = await request(app).get('/api/not-a-real-endpoint');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');
    expect(Number.isNaN(Date.parse(health.body.timestamp))).toBe(false);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ success: false, message: 'Route not found' });
  });

  it.each([
    ['GET', '/api/tickets'],
    ['GET', '/api/dashboard/customer'],
    ['GET', '/api/users'],
    ['GET', '/api/categories'],
    ['GET', '/api/activity'],
    ['POST', '/api/auth/logout'],
  ])('%s %s rejects requests without a bearer token', async (method, path) => {
    const response = await request(app)[method.toLowerCase() as 'get' | 'post'](path);
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, message: 'Authentication required' });
  });

  it('rejects invalid registration, login, and password-change payloads before persistence', async () => {
    const registration = await request(app).post('/api/auth/register').send({
      name: '',
      email: 'invalid',
      password: 'short',
    });
    const login = await request(app).post('/api/auth/login').send({});
    const password = await request(app).patch('/api/auth/change-password')
      .set('Authorization', 'Bearer malformed-token')
      .send({});

    expect(registration.status).toBe(400);
    expect(registration.body.errors.length).toBeGreaterThan(0);
    expect(login.status).toBe(400);
    expect(login.body.errors.length).toBeGreaterThan(0);
    expect(password.status).toBe(401);
  });

  it('rejects an expired access token without reaching protected handlers', async () => {
    const token = jwt.sign(
      { id: '507f1f77bcf86cd799439011', email: 'expired@example.test', role: 'CUSTOMER', name: 'Expired' },
      process.env.JWT_SECRET as string,
      { expiresIn: -1 }
    );
    const response = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Token expired');
  });
});
