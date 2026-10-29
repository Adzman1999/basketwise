import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number.parseInt(process.env.PORT || '4000', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
