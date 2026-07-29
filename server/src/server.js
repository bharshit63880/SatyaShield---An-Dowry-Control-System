import http from 'http';

import app from './app.js';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { ensureRuntimeDirectories } from './config/paths.js';
import { logEvent } from './services/logger.service.js';
import { createEscalationScheduler } from './services/escalation-scheduler.service.js';
import { createSocketChatServer } from './services/socket-chat.service.js';

async function bootstrap() {
  await connectDatabase();
  await ensureRuntimeDirectories();

  const server = http.createServer(app);
  const socketServer = createSocketChatServer(server);
  const escalationScheduler = createEscalationScheduler();
  await escalationScheduler.start();
  const listenHost = env.host;
  server.listen(env.port, listenHost, () => {
    logEvent('info', 'server_started', { port: env.port });
  });

  const shutdown = async () => {
    await escalationScheduler.stop();
    await socketServer?.close();
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch(() => {
  logEvent('error', 'server_start_failed');
  process.exit(1);
});
