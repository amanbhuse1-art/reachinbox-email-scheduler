export interface ApiHealthResponse {
  status: 'ok' | 'error';
  service: string;
  database: 'connected' | 'disconnected';
}