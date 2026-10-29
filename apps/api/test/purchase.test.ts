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
  await query('TRUNCATE TABLE purchase_items, purchases, grocery_items RESTART IDENTITY CASCADE');
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
    expect(response.body.items[0].groceryItemId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(response.body.items[0].id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('normalizes exact item names and returns comparable unit price history', async () => {
    const firstPurchase = await request(app)
      .post('/api/purchases')
      .send(validPurchase);
    const riceId = firstPurchase.body.items[0].groceryItemId;

    const secondPurchase = await request(app)
      .post('/api/purchases')
      .send({
        ...validPurchase,
        purchasedOn: '2026-10-30',
        items: [{
          itemName: '  rice  ',
          quantity: 1,
          unit: 'KG',
          amountPaidCentavos: 6000,
        }],
      });

    expect(secondPurchase.status).toBe(201);
    expect(secondPurchase.body.items[0].groceryItemId).toBe(riceId);

    const catalog = await request(app).get('/api/grocery-items?page=1&pageSize=20');
    expect(catalog.status).toBe(200);
    expect(catalog.body.total).toBe(2);
    expect(catalog.body.items.map((item: { name: string }) => item.name))
      .toEqual(['Bananas', 'Rice']);

    const history = await request(app)
      .get(`/api/grocery-items/${riceId}/price-history?unit=kg`);
    expect(history.status).toBe(200);
    expect(history.body.groceryItem).toMatchObject({ id: riceId, name: 'Rice' });
    expect(history.body.total).toBe(2);
    expect(history.body.items.map((item: { unitPriceCentavos: number }) => item.unitPriceCentavos))
      .toEqual([6000, 5500]);
    expect(history.body.items.every((item: { unit: string }) => item.unit === 'kg' || item.unit === 'KG'))
      .toBe(true);
  });

  it('returns 404 for an unknown grocery item and 400 for a malformed ID', async () => {
    const unknownItem = await request(app)
      .get('/api/grocery-items/7ef38c55-13ec-4e49-9b50-7d97eb8f5001/price-history');
    expect(unknownItem.status).toBe(404);
    expect(unknownItem.body.error.code).toBe('NOT_FOUND');

    const malformedItem = await request(app)
      .get('/api/grocery-items/not-a-uuid/price-history');
    expect(malformedItem.status).toBe(400);
    expect(malformedItem.body.error.code).toBe('VALIDATION_ERROR');
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
