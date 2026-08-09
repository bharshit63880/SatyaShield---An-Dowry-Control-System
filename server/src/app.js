import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import { globalApiLimiter } from './config/rate-limit.js';
import { apiAuditLogger } from './middlewares/audit.middleware.js';
import { noStore } from './middlewares/cache.middleware.js';
import { requestContext } from './middlewares/request-context.middleware.js';
import { apiResponse } from './middlewares/response.middleware.js';
import { sanitizeRequest } from './middlewares/sanitize.middleware.js';
import { ApiError } from './utils/ApiError.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import apiRoutes from './routes/index.js';
import { operationalRequestLogger } from './services/logger.service.js';
import { isAllowedOrigin } from './utils/cors-origin.js';

const app = express();

app.set(
  'trust proxy',
  env.trustProxyMode === 'loopback'
    ? 'loopback'
    : env.trustProxyMode === 'single'
      ? 1
      : false
);
app.disable('x-powered-by');
app.disable('etag');

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);
app.use(requestContext);
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin, env.clientUrls)) {
        callback(null, true);
        return;
      }

      callback(new ApiError(403, 'Request origin is not allowed by CORS.'));
    },
    credentials: true
  })
);
app.use(globalApiLimiter);
app.use(compression());
app.use(express.json({ limit: '1mb', strict: true }));
app.use(express.urlencoded({ extended: true }));
app.use(operationalRequestLogger);
app.use(sanitizeRequest);
app.use(apiResponse);
app.use(`/api/${env.apiVersion}`, noStore, apiAuditLogger, apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
