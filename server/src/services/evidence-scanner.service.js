import { env, isProduction } from '../config/env.js';

export class EvidenceScanner {
  async scan() {
    throw new Error('Evidence scanner adapter is not configured.');
  }
}

export class DevelopmentBypassScanner extends EvidenceScanner {
  async scan() {
    return {
      status: 'not_configured',
      engine: null,
      engineVersion: null
    };
  }
}

export function getEvidenceScanner() {
  if (env.evidenceScannerMode === 'development-bypass' && !isProduction) {
    return new DevelopmentBypassScanner();
  }
  return new EvidenceScanner();
}
