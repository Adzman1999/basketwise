export type HealthResponse = {
  status: 'healthy';
  app: 'Basketwise API';
  timestamp: string;
};

export type CreatePurchaseItem = {
  itemName: string;
  quantity: number;
  unit: string;
  amountPaidCentavos: number;
};

export type CreatePurchaseRequest = {
  purchasedOn: string;
  storeName?: string;
  totalPaidCentavos: number;
  items: CreatePurchaseItem[];
};

export type PurchaseItem = CreatePurchaseItem & {
  id: string;
  groceryItemId: string;
};

export type Purchase = {
  id: string;
  purchasedOn: string;
  storeName?: string;
  currency: 'PHP';
  totalPaidCentavos: number;
  unallocatedAmountCentavos: number;
  items: PurchaseItem[];
  createdAt: string;
};

export type PurchasePage = {
  items: Purchase[];
  page: number;
  pageSize: number;
  total: number;
};

type ApiErrorResponse = {
  error?: {
    message?: unknown;
  };
};

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    if (typeof body.error?.message === 'string') return body.error.message;
  } catch {
    // Use the HTTP status when the response is not JSON.
  }

  return `The API responded with HTTP ${response.status}.`;
}

async function sendRequest<T>(url: string, init: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new Error('Could not reach the API. Check that the backend is running.');
  }

  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as T;
}

export async function fetchHealthStatus(signal: AbortSignal): Promise<HealthResponse> {
  return sendRequest<HealthResponse>('/api/health', {
    headers: { Accept: 'application/json' },
    signal,
  });
}

export async function fetchPurchases(
  page: number,
  pageSize: number,
  signal: AbortSignal
): Promise<PurchasePage> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return sendRequest<PurchasePage>(`/api/purchases?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
}

export async function createPurchase(input: CreatePurchaseRequest): Promise<Purchase> {
  return sendRequest<Purchase>('/api/purchases', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}
