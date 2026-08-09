import mongoose from 'mongoose';

import { env, isProduction } from '../config/env.js';

export function buildReadinessSnapshot(checks) {
  const normalized = Object.fromEntries(
    Object.entries(checks).map(([name, ready]) => [name, ready === true])
  );
  return {
    ready: Object.values(normalized).every(Boolean),
    checks: normalized
  };
}

export function getReadinessSnapshot() {
  return buildReadinessSnapshot({
    database: mongoose.connection.readyState === 1,
    evidenceStorage: !isProduction || env.evidenceStorageProvider === 'object',
    evidenceScanner: !isProduction || env.evidenceScannerMode === 'http',
    realtime: env.socketSingleInstanceMode || env.socketAdapter !== 'memory',
    externalAiDisabled: env.aiProcessingEnabled === false && env.triageAiEnabled === false,
    externalSosDisabled: env.sosExternalDeliveryEnabled === false
  });
}
