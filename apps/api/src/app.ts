import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import healthRoutes from './routes/health';
import purchaseRoutes from './routes/purchases';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  if (config.env !== 'test') {
    app.use(morgan('dev'));
  }

  app.use('/api', purchaseRoutes);
  app.use('/api', healthRoutes);

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(error);

    const errorType = typeof error === 'object' && error !== null && 'type' in error
      ? error.type
      : undefined;

    if (errorType === 'entity.parse.failed') {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The request is invalid.',
        },
      });
    }

    console.error('Unhandled API error:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
  });

  return app;
}
