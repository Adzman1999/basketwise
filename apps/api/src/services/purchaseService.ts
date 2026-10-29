import {
  createPurchaseRecord,
  listPurchaseRecords,
  type PurchaseRecord,
} from '../repositories/purchaseRepository';
import type { CreatePurchaseInput, PurchaseListQuery } from '../schemas/purchase';

function toPurchaseResponse(purchase: PurchaseRecord) {
  const { storeName, ...purchaseFields } = purchase;
  const items = purchase.items.map((item) => ({
    ...item,
    quantity: Number(item.quantity),
  }));
  const lineItemsTotalCentavos = items.reduce(
    (total, item) => total + item.amountPaidCentavos,
    0
  );

  return {
    ...purchaseFields,
    ...(storeName === null ? {} : { storeName }),
    currency: 'PHP' as const,
    unallocatedAmountCentavos: purchase.totalPaidCentavos - lineItemsTotalCentavos,
    items,
  };
}

export async function createPurchase(input: CreatePurchaseInput) {
  return toPurchaseResponse(await createPurchaseRecord(input));
}

export async function listPurchases(input: PurchaseListQuery) {
  const result = await listPurchaseRecords(input);

  return {
    items: result.purchases.map(toPurchaseResponse),
    page: input.page,
    pageSize: input.pageSize,
    total: result.total,
  };
}
