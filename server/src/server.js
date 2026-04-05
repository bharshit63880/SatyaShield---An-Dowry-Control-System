import http from 'http';

import app from './app.js';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { ensureRuntimeDirectories } from './config/paths.js';
import { ensureAdminUser } from './services/auth.service.js';

async function bootstrap() {
  await connectDatabase();
  await ensureRuntimeDirectories();
  await ensureAdminUser();

  const server = http.createServer(app);
  const listenHost = env.host;
  const publicOrigin = env.serverPublicUrl || `http://${listenHost}:${env.port}`;

  server.listen(env.port, listenHost, () => {
    console.log(`Server listening on ${publicOrigin}`);
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
