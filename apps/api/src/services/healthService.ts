export type HealthResponse = {
  status: 'healthy';
  app: 'Basketwise API';
  timestamp: string;
};

export function getHealthStatus(): HealthResponse {
  return {
    status: 'healthy',
    app: 'Basketwise API',
    timestamp: new Date().toISOString(),
  };
}
