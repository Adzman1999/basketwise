import { createApp } from './app';
import { config } from './config';

const app = createApp();

app.listen(config.port, () => {
  console.log(`Basketwise API listening on http://localhost:${config.port}`);
  console.log(`Environment: ${config.env}`);
});
