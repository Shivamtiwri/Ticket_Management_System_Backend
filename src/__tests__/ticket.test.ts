import request from 'supertest';
import app from '../app';

describe('Removed ticketing endpoints', () => {
  it.each(['/api/tickets', '/api/users', '/api/categories', '/api/activity'])(
    'returns 404 for %s',
    async (path) => {
      const res = await request(app).get(path);
      expect(res.status).toBe(404);
    }
  );
});
