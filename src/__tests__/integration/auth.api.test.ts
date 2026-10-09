import request from 'supertest';
import app from '../../app';
import { User } from '../../models/User';
import { UserRole } from '../../types';
import { connectTestDb, disconnectTestDb } from '../../testUtils/testDb';
import { ApiFixtures, dbIntegrationEnabled } from '../support/apiFixtures';

if (!dbIntegrationEnabled) {
  console.warn('SKIPPED auth API integration suite: set TEST_MONGODB_URI to a dedicated *_test database.');
}

const integrationDescribe = dbIntegrationEnabled ? describe : describe.skip;

integrationDescribe('Auth API', () => {
  let fixtures: ApiFixtures;

  beforeAll(async () => connectTestDb());
  afterAll(async () => disconnectTestDb());
  beforeEach(() => {
    fixtures = new ApiFixtures();
  });
  afterEach(async () => fixtures.cleanup());

  it('registers a customer and returns a refresh cookie and access token', async () => {
    const email = `register-${Date.now()}@example.test`;
    const response = await request(app).post('/api/auth/register').send({
      name: 'QA Customer',
      email,
      password: 'TestPassword123',
    });
    if (response.body.data?.user?.id) fixtures.trackUserId(response.body.data.user.id);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Registration successful',
      data: { user: { name: 'QA Customer', email, role: UserRole.CUSTOMER } },
    });
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.headers['set-cookie'][0]).toMatch(/refreshToken=/);
  });

  it.each([
    [{ name: 'QA', email: 'bad-email', password: 'TestPassword123' }, /valid email/i],
    [{ name: 'QA Customer', email: 'bad@example.test', password: 'weak' }, /at least 8 characters/i],
    [{ name: 'QA Customer' }, /email|required/i],
  ])('rejects invalid registration input %#', async (body, expectedMessage) => {
    const response = await request(app).post('/api/auth/register').send(body);
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.errors.map((error: { message: string }) => error.message).join(' ')).toMatch(expectedMessage);
  });

  it('rejects a duplicate email', async () => {
    const existing = await fixtures.createUser();
    const response = await request(app).post('/api/auth/register').send({
      name: 'Another Customer',
      email: existing.email,
      password: 'TestPassword123',
    });
    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already registered/i);
  });

  it('logs in with valid credentials and rejects incorrect credentials', async () => {
    const user = await fixtures.createUser();
    const success = await request(app).post('/api/auth/login').send({
      email: user.email,
      password: 'TestPassword123',
    });
    expect(success.status).toBe(200);
    expect(success.body.data.user.email).toBe(user.email);
    expect(success.body.data.token).toEqual(expect.any(String));

    const failure = await request(app).post('/api/auth/login').send({
      email: user.email,
      password: 'IncorrectPassword123',
    });
    expect(failure.status).toBe(401);
    expect(failure.body.message).toBe('Invalid email or password');
  });

  it('requires authentication, rejects invalid tokens, and returns the authenticated user', async () => {
    const user = await fixtures.createUser();
    const missing = await request(app).get('/api/auth/me');
    const invalid = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-jwt');
    const success = await request(app).get('/api/auth/me')
      .set('Authorization', fixtures.authorization(user));

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(success.status).toBe(200);
    expect(success.body.data).toMatchObject({ email: user.email, role: UserRole.CUSTOMER });
    expect(success.body.data.password).toBeUndefined();
  });

  it('refreshes a session only when its refresh cookie is valid', async () => {
    const user = await fixtures.createUser();
    const login = await request(app).post('/api/auth/login').send({
      email: user.email,
      password: 'TestPassword123',
    });
    const refreshed = await request(app).post('/api/auth/refresh')
      .set('Cookie', login.headers['set-cookie']);
    const missing = await request(app).post('/api/auth/refresh');

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.token).toEqual(expect.any(String));
    expect(refreshed.headers['set-cookie'][0]).toMatch(/refreshToken=/);
    expect(missing.status).toBe(401);
  });

  it('logs out and changes password only when the current password matches', async () => {
    const user = await fixtures.createUser();
    const login = await request(app).post('/api/auth/login').send({
      email: user.email,
      password: 'TestPassword123',
    });
    const cookie = login.headers['set-cookie'];
    const auth = fixtures.authorization(user);

    const wrongPassword = await request(app).patch('/api/auth/change-password')
      .set('Authorization', auth)
      .send({ currentPassword: 'WrongPassword123', newPassword: 'NewPassword123' });
    expect(wrongPassword.status).toBe(400);

    const changed = await request(app).patch('/api/auth/change-password')
      .set('Authorization', auth)
      .send({ currentPassword: 'TestPassword123', newPassword: 'NewPassword123' });
    expect(changed.status).toBe(200);

    const logout = await request(app).post('/api/auth/logout')
      .set('Authorization', auth)
      .set('Cookie', cookie);
    expect(logout.status).toBe(200);
    expect(logout.body).toMatchObject({ success: true, data: null });

    const newLogin = await request(app).post('/api/auth/login').send({
      email: user.email,
      password: 'NewPassword123',
    });
    expect(newLogin.status).toBe(200);
  });

  it('rejects unauthenticated logout and malformed password changes', async () => {
    const logout = await request(app).post('/api/auth/logout');
    const change = await request(app).patch('/api/auth/change-password')
      .set('Authorization', fixtures.authorization(await fixtures.createUser()))
      .send({ currentPassword: 'short', newPassword: 'weak' });
    expect(logout.status).toBe(401);
    expect(change.status).toBe(400);
  });

  it('rejects login for an inactive account', async () => {
    const user = await fixtures.createUser();
    user.isActive = false;
    await user.save();
    const response = await request(app).post('/api/auth/login').send({
      email: user.email,
      password: 'TestPassword123',
    });
    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/deactivated/i);
  });
});
