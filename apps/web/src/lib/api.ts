export type HealthResponse = {
  status: 'healthy';
  app: 'Basketwise API';
  timestamp: string;
};

export async function fetchHealthStatus(signal: AbortSignal): Promise<HealthResponse> {
  let response: Response;

  try {
    response = await fetch('/api/health', {
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error('Could not reach the API. Check that the backend is running.');
  }

  if (!response.ok) {
    throw new Error(`The API responded with HTTP ${response.status}.`);
  }

  return (await response.json()) as HealthResponse;
}
