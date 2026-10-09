import request from 'supertest';
import app from '../../app';
import { ActivityLog } from '../../models/ActivityLog';
import { ActivityAction, UserRole, TicketPriority, TicketStatus } from '../../types';
import { connectTestDb, disconnectTestDb } from '../../testUtils/testDb';
import { ApiFixtures, dbIntegrationEnabled } from '../support/apiFixtures';

if (!dbIntegrationEnabled) {
  console.warn('SKIPPED ticket API integration suite: set TEST_MONGODB_URI to a dedicated *_test database.');
}
const integrationDescribe = dbIntegrationEnabled ? describe : describe.skip;

integrationDescribe('Ticket, comment, dashboard, and activity APIs', () => {
  let fixtures: ApiFixtures;

  beforeAll(async () => connectTestDb());
  afterAll(async () => disconnectTestDb());
  beforeEach(() => {
    fixtures = new ApiFixtures();
  });
  afterEach(async () => fixtures.cleanup());

  it('lists only the customer’s tickets and validates filters and pagination', async () => {
    const owner = await fixtures.createUser();
    const otherCustomer = await fixtures.createUser();
    const category = await fixtures.createCategory(owner._id);
    await fixtures.createTicket(owner._id, category._id, { subject: 'Owner ticket Alpha' });
    await fixtures.createTicket(otherCustomer._id, category._id, { subject: 'Other ticket Beta' });

    const response = await request(app).get('/api/tickets?page=1&limit=1&search=Alpha')
      .set('Authorization', fixtures.authorization(owner));
    const invalid = await request(app).get('/api/tickets?page=0')
      .set('Authorization', fixtures.authorization(owner));
    const missingAuth = await request(app).get('/api/tickets');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].subject).toBe('Owner ticket Alpha');
    expect(response.body.pagination).toMatchObject({ total: 1, page: 1, limit: 1 });
    expect(invalid.status).toBe(400);
    expect(missingAuth.status).toBe(401);
  });

  it('creates tickets for an active category and rejects invalid or inactive categories', async () => {
    const customer = await fixtures.createUser();
    const category = await fixtures.createCategory(customer._id);
    const inactive = await fixtures.createCategory(customer._id, false);
    const body = {
      subject: 'Cannot access my account',
      description: 'I cannot sign in after resetting my account password.',
      category: category._id.toString(),
      priority: TicketPriority.HIGH,
    };

    const response = await request(app).post('/api/tickets')
      .set('Authorization', fixtures.authorization(customer))
      .send(body);
    if (response.body.data?._id) fixtures.trackTicketId(response.body.data._id);
    const invalid = await request(app).post('/api/tickets')
      .set('Authorization', fixtures.authorization(customer))
      .send({ ...body, priority: 'URGENT' });
    const unavailable = await request(app).post('/api/tickets')
      .set('Authorization', fixtures.authorization(customer))
      .send({ ...body, category: inactive._id.toString() });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      subject: body.subject,
      status: TicketStatus.OPEN,
      priority: TicketPriority.HIGH,
    });
    expect(response.body.data.ticketId).toMatch(/^TKT-/);
    expect(invalid.status).toBe(400);
    expect(unavailable.status).toBe(400);
  });

  it('rejects unsupported uploaded file types before attempting a cloud upload', async () => {
    const customer = await fixtures.createUser();
    const response = await request(app).post('/api/tickets')
      .set('Authorization', fixtures.authorization(customer))
      .field('subject', 'Cannot access my account')
      .field('description', 'I cannot sign in after resetting my account password.')
      .field('category', '507f1f77bcf86cd799439011')
      .field('priority', TicketPriority.MEDIUM)
      .attach('attachments', Buffer.from('not a supported attachment'), {
        filename: 'payload.bin',
        contentType: 'application/x-test-payload',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/file type .* is not allowed/i);
  });

  it('returns a ticket to its owner, denies another customer, and reports missing tickets', async () => {
    const owner = await fixtures.createUser();
    const other = await fixtures.createUser();
    const category = await fixtures.createCategory(owner._id);
    const ticket = await fixtures.createTicket(owner._id, category._id);
    const ownerResponse = await request(app).get(`/api/tickets/${ticket._id}`)
      .set('Authorization', fixtures.authorization(owner));
    const forbidden = await request(app).get(`/api/tickets/${ticket._id}`)
      .set('Authorization', fixtures.authorization(other));
    const missing = await request(app).get('/api/tickets/TKT-NOT-FOUND')
      .set('Authorization', fixtures.authorization(owner));

    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.body.data._id).toBe(ticket._id.toString());
    expect(forbidden.status).toBe(403);
    expect(missing.status).toBe(404);
  });

  it('updates ticket details and enforces role-specific status transitions', async () => {
    const owner = await fixtures.createUser();
    const agent = await fixtures.createUser(UserRole.AGENT);
    const category = await fixtures.createCategory(owner._id);
    const ticket = await fixtures.createTicket(owner._id, category._id);

    const updated = await request(app).patch(`/api/tickets/${ticket._id}`)
      .set('Authorization', fixtures.authorization(owner))
      .send({ subject: 'Updated ticket subject', priority: TicketPriority.CRITICAL });
    const invalidTransition = await request(app).patch(`/api/tickets/${ticket._id}`)
      .set('Authorization', fixtures.authorization(owner))
      .send({ status: TicketStatus.CLOSED });
    const agentTransition = await request(app).patch(`/api/tickets/${ticket._id}`)
      .set('Authorization', fixtures.authorization(agent))
      .send({ status: TicketStatus.IN_PROGRESS });

    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      subject: 'Updated ticket subject',
      priority: TicketPriority.CRITICAL,
    });
    expect(invalidTransition.status).toBe(400);
    expect(agentTransition.status).toBe(200);
    expect(agentTransition.body.data.status).toBe(TicketStatus.IN_PROGRESS);
  });

  it('lets an agent accept an open ticket only for themselves', async () => {
    const customer = await fixtures.createUser();
    const agent = await fixtures.createUser(UserRole.AGENT);
    const otherAgent = await fixtures.createUser(UserRole.AGENT);
    const category = await fixtures.createCategory(customer._id);
    const ticket = await fixtures.createTicket(customer._id, category._id);

    const accepted = await request(app).patch(`/api/tickets/${ticket._id}/assign`)
      .set('Authorization', fixtures.authorization(agent))
      .send({ agentId: agent._id.toString() });
    const reassignmentDenied = await request(app).patch(`/api/tickets/${ticket._id}/assign`)
      .set('Authorization', fixtures.authorization(agent))
      .send({ agentId: otherAgent._id.toString() });
    const invalidId = await request(app).patch(`/api/tickets/${ticket._id}/assign`)
      .set('Authorization', fixtures.authorization(agent))
      .send({ agentId: 'invalid' });

    expect(accepted.status).toBe(200);
    expect(accepted.body.data.status).toBe(TicketStatus.ASSIGNED);
    expect(accepted.body.data.assignedAgent._id).toBe(agent._id.toString());
    expect(reassignmentDenied.status).toBe(403);
    expect(invalidId.status).toBe(400);
  });

  it('exposes available tickets to agents and admins only', async () => {
    const customer = await fixtures.createUser();
    const agent = await fixtures.createUser(UserRole.AGENT);
    const category = await fixtures.createCategory(customer._id);
    await fixtures.createTicket(customer._id, category._id);

    const available = await request(app).get('/api/tickets/available?limit=1')
      .set('Authorization', fixtures.authorization(agent));
    const forbidden = await request(app).get('/api/tickets/available')
      .set('Authorization', fixtures.authorization(customer));

    expect(available.status).toBe(200);
    expect(available.body.data).toHaveLength(1);
    expect(available.body.pagination.limit).toBe(1);
    expect(forbidden.status).toBe(403);
  });

  it('creates comments, hides internal comments from customers, and blocks non-owner access', async () => {
    const owner = await fixtures.createUser();
    const other = await fixtures.createUser();
    const agent = await fixtures.createUser(UserRole.AGENT);
    const category = await fixtures.createCategory(owner._id);
    const ticket = await fixtures.createTicket(owner._id, category._id);
    await fixtures.createComment(ticket._id, agent._id, true);

    const publicComment = await request(app).post(`/api/tickets/${ticket._id}/comments`)
      .set('Authorization', fixtures.authorization(owner))
      .send({ content: 'I can provide more information.' });
    if (publicComment.body.data?._id) fixtures.trackCommentId(publicComment.body.data._id);
    const comments = await request(app).get(`/api/tickets/${ticket._id}/comments`)
      .set('Authorization', fixtures.authorization(owner));
    const forbidden = await request(app).get(`/api/tickets/${ticket._id}/comments`)
      .set('Authorization', fixtures.authorization(other));
    const invalid = await request(app).post(`/api/tickets/${ticket._id}/comments`)
      .set('Authorization', fixtures.authorization(owner))
      .send({ content: ' ' });

    expect(publicComment.status).toBe(201);
    expect(publicComment.body.data.isInternal).toBe(false);
    expect(comments.status).toBe(200);
    expect(comments.body.data).toHaveLength(1);
    expect(comments.body.data[0].content).toBe('I can provide more information.');
    expect(forbidden.status).toBe(403);
    expect(invalid.status).toBe(400);
  });

  it('restricts comment edits to the author or admin and supports deletion', async () => {
    const owner = await fixtures.createUser();
    const anotherUser = await fixtures.createUser();
    const admin = await fixtures.createUser(UserRole.ADMIN);
    const category = await fixtures.createCategory(owner._id);
    const ticket = await fixtures.createTicket(owner._id, category._id);
    const comment = await fixtures.createComment(ticket._id, owner._id);

    const denied = await request(app).put(`/api/tickets/${ticket._id}/comments/${comment._id}`)
      .set('Authorization', fixtures.authorization(anotherUser))
      .send({ content: 'Unauthorized edit attempt' });
    const updated = await request(app).put(`/api/tickets/${ticket._id}/comments/${comment._id}`)
      .set('Authorization', fixtures.authorization(admin))
      .send({ content: 'Admin reviewed this update.' });
    const deleted = await request(app).delete(`/api/tickets/${ticket._id}/comments/${comment._id}`)
      .set('Authorization', fixtures.authorization(admin));

    expect(denied.status).toBe(403);
    expect(updated.status).toBe(200);
    expect(updated.body.data.content).toBe('Admin reviewed this update.');
    expect(deleted.status).toBe(200);
    expect(deleted.body.data).toBeNull();
  });

  it('returns ticket activity to the owner and rejects non-owner access', async () => {
    const owner = await fixtures.createUser();
    const other = await fixtures.createUser();
    const category = await fixtures.createCategory(owner._id);
    const ticket = await fixtures.createTicket(owner._id, category._id);
    await ActivityLog.create({
      ticket: ticket._id,
      actor: owner._id,
      action: ActivityAction.TICKET_CREATED,
      description: 'Test ticket activity',
    });

    const activity = await request(app).get(`/api/tickets/${ticket._id}/activity`)
      .set('Authorization', fixtures.authorization(owner));
    const denied = await request(app).get(`/api/tickets/${ticket._id}/activity`)
      .set('Authorization', fixtures.authorization(other));

    expect(activity.status).toBe(200);
    expect(activity.body.data).toHaveLength(1);
    expect(activity.body.data[0].description).toBe('Test ticket activity');
    expect(denied.status).toBe(403);
  });

  it('allows only admins to delete tickets and reports missing tickets', async () => {
    const customer = await fixtures.createUser();
    const admin = await fixtures.createUser(UserRole.ADMIN);
    const category = await fixtures.createCategory(customer._id);
    const ticket = await fixtures.createTicket(customer._id, category._id);
    const denied = await request(app).delete(`/api/tickets/${ticket._id}`)
      .set('Authorization', fixtures.authorization(customer));
    const deleted = await request(app).delete(`/api/tickets/${ticket._id}`)
      .set('Authorization', fixtures.authorization(admin));
    const missing = await request(app).delete(`/api/tickets/${ticket._id}`)
      .set('Authorization', fixtures.authorization(admin));

    expect(denied.status).toBe(403);
    expect(deleted.status).toBe(200);
    expect(missing.status).toBe(404);
  });

  it.each([
    [UserRole.CUSTOMER, '/api/dashboard/customer', 200],
    [UserRole.AGENT, '/api/dashboard/agent', 200],
    [UserRole.ADMIN, '/api/dashboard/admin', 200],
    [UserRole.CUSTOMER, '/api/dashboard/admin', 403],
  ])('enforces dashboard role access (%s %s)', async (role, path, expectedStatus) => {
    const user = await fixtures.createUser(role);
    const response = await request(app).get(path)
      .set('Authorization', fixtures.authorization(user));
    expect(response.status).toBe(expectedStatus);
    if (response.status === 200) expect(response.body.data.stats).toBeDefined();
  });
});
