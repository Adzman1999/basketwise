import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

describe('GET /api/health', () => {
  it('returns the documented liveness response', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(Object.keys(response.body).sort()).toEqual(['app', 'status', 'timestamp']);
    expect(response.body.status).toBe('healthy');
    expect(response.body.app).toBe('Basketwise API');
    expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/);
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  });
});
