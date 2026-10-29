import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import healthRoutes from './routes/health';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  if (config.env !== 'test') {
    app.use(morgan('dev'));
  }

  app.use('/api', healthRoutes);

  return app;
}
