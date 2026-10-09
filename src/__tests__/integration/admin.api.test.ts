import request from 'supertest';
import app from '../../app';
import { ActivityLog } from '../../models/ActivityLog';
import { ActivityAction, UserRole } from '../../types';
import { connectTestDb, disconnectTestDb } from '../../testUtils/testDb';
import { ApiFixtures, dbIntegrationEnabled } from '../support/apiFixtures';

if (!dbIntegrationEnabled) {
  console.warn('SKIPPED admin API integration suite: set TEST_MONGODB_URI to a dedicated *_test database.');
}
const integrationDescribe = dbIntegrationEnabled ? describe : describe.skip;

integrationDescribe('Category, user, and activity APIs', () => {
  let fixtures: ApiFixtures;

  beforeAll(async () => connectTestDb());
  afterAll(async () => disconnectTestDb());
  beforeEach(() => {
    fixtures = new ApiFixtures();
  });
  afterEach(async () => fixtures.cleanup());

  it('lists active categories publicly and restricts category administration', async () => {
    const admin = await fixtures.createUser(UserRole.ADMIN);
    const active = await fixtures.createCategory(admin._id);
    await fixtures.createCategory(admin._id, false);

    const publicList = await request(app).get('/api/categories/active');
    const adminList = await request(app).get('/api/categories')
      .set('Authorization', fixtures.authorization(admin));
    const denied = await request(app).get('/api/categories')
      .set('Authorization', fixtures.authorization(await fixtures.createUser()));

    expect(publicList.status).toBe(200);
    expect(publicList.body.data.map((item: { _id: string }) => item._id)).toContain(active._id.toString());
    expect(publicList.body.data.every((item: { isActive: boolean }) => item.isActive)).toBe(true);
    expect(adminList.status).toBe(200);
    expect(adminList.body.data).toHaveLength(2);
    expect(denied.status).toBe(403);
  });

  it('creates categories, rejects duplicate names, and validates required fields', async () => {
    const admin = await fixtures.createUser(UserRole.ADMIN);
    const name = `QA category ${Date.now()}`;
    const created = await request(app).post('/api/categories')
      .set('Authorization', fixtures.authorization(admin))
      .send({ name, description: 'Integration test category' });
    if (created.body.data?._id) fixtures.trackCategoryId(created.body.data._id);
    const duplicate = await request(app).post('/api/categories')
      .set('Authorization', fixtures.authorization(admin))
      .send({ name: name.toUpperCase() });
    const invalid = await request(app).post('/api/categories')
      .set('Authorization', fixtures.authorization(admin))
      .send({ name: 'x' });

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ name, isActive: true });
    expect(duplicate.status).toBe(409);
    expect(invalid.status).toBe(400);
  });

  it('updates and toggles category state and rejects malformed or missing IDs', async () => {
    const admin = await fixtures.createUser(UserRole.ADMIN);
    const category = await fixtures.createCategory(admin._id);
    const updated = await request(app).put(`/api/categories/${category._id}`)
      .set('Authorization', fixtures.authorization(admin))
      .send({ description: 'Updated by test', isActive: false });
    const toggled = await request(app).patch(`/api/categories/${category._id}/toggle-status`)
      .set('Authorization', fixtures.authorization(admin));
    const invalid = await request(app).put('/api/categories/not-an-id')
      .set('Authorization', fixtures.authorization(admin))
      .send({ name: 'New valid name' });
    const missing = await request(app).patch('/api/categories/507f1f77bcf86cd799439011/toggle-status')
      .set('Authorization', fixtures.authorization(admin));

    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ description: 'Updated by test', isActive: false });
    expect(toggled.status).toBe(200);
    expect(toggled.body.data.isActive).toBe(true);
    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
  });

  it('filters and paginates users and returns active agents to admins', async () => {
    const admin = await fixtures.createUser(UserRole.ADMIN);
    const agent = await fixtures.createUser(UserRole.AGENT);
    const customer = await fixtures.createUser();
    const listed = await request(app).get('/api/users?role=CUSTOMER&page=1&limit=1')
      .set('Authorization', fixtures.authorization(admin));
    const agents = await request(app).get('/api/users/agents')
      .set('Authorization', fixtures.authorization(admin));
    const invalid = await request(app).get('/api/users?role=ROOT')
      .set('Authorization', fixtures.authorization(admin));
    const denied = await request(app).get('/api/users')
      .set('Authorization', fixtures.authorization(customer));

    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].role).toBe(UserRole.CUSTOMER);
    expect(listed.body.pagination).toMatchObject({ total: 1, page: 1, limit: 1 });
    expect(agents.body.data.map((user: { _id: string }) => user._id)).toContain(agent._id.toString());
    expect(invalid.status).toBe(400);
    expect(denied.status).toBe(403);
  });

  it('gets users, updates a profile, and rejects invalid phone values', async () => {
    const admin = await fixtures.createUser(UserRole.ADMIN);
    const customer = await fixtures.createUser();
    const found = await request(app).get(`/api/users/${customer._id}`)
      .set('Authorization', fixtures.authorization(admin));
    const updated = await request(app).put('/api/users/profile')
      .set('Authorization', fixtures.authorization(customer))
      .send({ name: 'Updated customer', phone: '+1 555 123 4567' });
    const invalidPhone = await request(app).put('/api/users/profile')
      .set('Authorization', fixtures.authorization(customer))
      .send({ phone: 'not-a-phone' });
    const missing = await request(app).get('/api/users/507f1f77bcf86cd799439011')
      .set('Authorization', fixtures.authorization(admin));

    expect(found.status).toBe(200);
    expect(found.body.data.email).toBe(customer.email);
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ name: 'Updated customer', phone: '+1 555 123 4567' });
    expect(updated.body.data.password).toBeUndefined();
    expect(invalidPhone.status).toBe(400);
    expect(missing.status).toBe(404);
  });

  it('allows admin role and status updates while blocking self changes', async () => {
    const admin = await fixtures.createUser(UserRole.ADMIN);
    const customer = await fixtures.createUser();
    const changedRole = await request(app).patch(`/api/users/${customer._id}/role`)
      .set('Authorization', fixtures.authorization(admin))
      .send({ role: UserRole.AGENT });
    const invalidRole = await request(app).patch(`/api/users/${customer._id}/role`)
      .set('Authorization', fixtures.authorization(admin))
      .send({ role: 'SUPERUSER' });
    const selfRole = await request(app).patch(`/api/users/${admin._id}/role`)
      .set('Authorization', fixtures.authorization(admin))
      .send({ role: UserRole.CUSTOMER });
    const selfStatus = await request(app).patch(`/api/users/${admin._id}/toggle-status`)
      .set('Authorization', fixtures.authorization(admin));
    const disabled = await request(app).patch(`/api/users/${customer._id}/toggle-status`)
      .set('Authorization', fixtures.authorization(admin));

    expect(changedRole.status).toBe(200);
    expect(changedRole.body.data.role).toBe(UserRole.AGENT);
    expect(invalidRole.status).toBe(400);
    expect(selfRole.status).toBe(400);
    expect(selfStatus.status).toBe(400);
    expect(disabled.status).toBe(200);
    expect(disabled.body.data.isActive).toBe(false);
  });

  it('returns admin activity logs with pagination and validates filters', async () => {
    const admin = await fixtures.createUser(UserRole.ADMIN);
    const customer = await fixtures.createUser();
    const category = await fixtures.createCategory(admin._id);
    const ticket = await fixtures.createTicket(customer._id, category._id);
    await ActivityLog.create({
      actor: admin._id,
      ticket: ticket._id,
      action: ActivityAction.TICKET_CREATED,
      description: 'QA activity log search marker',
      metadata: { ticketId: ticket.ticketId },
    });

    const found = await request(app).get('/api/activity?action=TICKET_CREATED&search=search%20marker&page=1&limit=1')
      .set('Authorization', fixtures.authorization(admin));
    const invalid = await request(app).get('/api/activity?limit=500')
      .set('Authorization', fixtures.authorization(admin));
    const denied = await request(app).get('/api/activity')
      .set('Authorization', fixtures.authorization(customer));

    expect(found.status).toBe(200);
    expect(found.body.data).toHaveLength(1);
    expect(found.body.data[0].description).toBe('QA activity log search marker');
    expect(found.body.pagination).toMatchObject({ total: 1, limit: 1 });
    expect(invalid.status).toBe(400);
    expect(denied.status).toBe(403);
  });

});
