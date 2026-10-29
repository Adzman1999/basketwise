import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { closePool, query } from '../src/db';
import { createApp } from '../src/app';

const app = createApp();

const validPurchase = {
  purchasedOn: '2026-10-29',
  storeName: 'Neighborhood Market',
  totalPaidCentavos: 12550,
  items: [
    { itemName: 'Rice', quantity: 2, unit: 'kg', amountPaidCentavos: 11000 },
    { itemName: 'Bananas', quantity: 1, unit: 'pack', amountPaidCentavos: 1300 },
  ],
};

beforeEach(async () => {
  await query('TRUNCATE TABLE purchase_items, purchases RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await closePool();
});

describe('grocery purchases', () => {
  it('creates a purchase and reports the unallocated receipt amount', async () => {
    const response = await request(app)
      .post('/api/purchases')
      .send(validPurchase);

    expect(response.status).toBe(201);
    expect(response.body.currency).toBe('PHP');
    expect(response.body.totalPaidCentavos).toBe(12550);
    expect(response.body.unallocatedAmountCentavos).toBe(250);
    expect(response.body.purchasedOn).toBe('2026-10-29');
    expect(response.body.storeName).toBe('Neighborhood Market');
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items[0]).toMatchObject({
      itemName: 'Rice',
      quantity: 2,
      unit: 'kg',
      amountPaidCentavos: 11000,
    });
    expect(response.body.items[0].id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('lists purchases newest first and applies page size', async () => {
    for (const purchasedOn of ['2026-10-27', '2026-10-28', '2026-10-29']) {
      const response = await request(app)
        .post('/api/purchases')
        .send({
          ...validPurchase,
          purchasedOn,
        });
      expect(response.status).toBe(201);
    }

    const firstPage = await request(app).get('/api/purchases?page=1&pageSize=2');
    expect(firstPage.status).toBe(200);
    expect(firstPage.body).toMatchObject({ page: 1, pageSize: 2, total: 3 });
    expect(firstPage.body.items.map((purchase: { purchasedOn: string }) => purchase.purchasedOn))
      .toEqual(['2026-10-29', '2026-10-28']);

    const secondPage = await request(app).get('/api/purchases?page=2&pageSize=2');
    expect(secondPage.status).toBe(200);
    expect(secondPage.body.items.map((purchase: { purchasedOn: string }) => purchase.purchasedOn))
      .toEqual(['2026-10-27']);
  });

  it('rejects invalid purchase input without storing it', async () => {
    const response = await request(app)
      .post('/api/purchases')
      .send({
        ...validPurchase,
        purchasedOn: '2026-02-30',
        items: [{
          itemName: 'Rice',
          quantity: 0,
          unit: 'kg',
          amountPaidCentavos: 11000,
        }],
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The request is invalid.',
      },
    });

    const listResponse = await request(app).get('/api/purchases');
    expect(listResponse.body.total).toBe(0);
  });

  it('rejects out-of-range pagination values', async () => {
    const response = await request(app).get('/api/purchases?page=0');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns the contract error shape for malformed JSON', async () => {
    const response = await request(app)
      .post('/api/purchases')
      .set('Content-Type', 'application/json')
      .send('{"items":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The request is invalid.',
      },
    });
  });
});
