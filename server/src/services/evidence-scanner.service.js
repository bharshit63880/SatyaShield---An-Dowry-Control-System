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

export class HttpEvidenceScanner extends EvidenceScanner {
  constructor({ url = env.evidenceScannerUrl, token = env.evidenceScannerToken,
    timeoutMs = env.evidenceScannerTimeoutMs, fetchImpl = fetch } = {}) {
    super();
    this.url = url;
    this.token = token;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  async scan(buffer) {
    const response = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/octet-stream'
      },
      body: buffer,
      signal: AbortSignal.timeout(this.timeoutMs)
    });
    if (!response.ok) throw new Error('Evidence scanner request failed.');
    const result = await response.json();
    if (!['clean', 'infected'].includes(result?.status)) {
      throw new Error('Evidence scanner returned an invalid result.');
    }
    return {
      status: result.status,
      engine: String(result.engine || '').slice(0, 80) || null,
      engineVersion: String(result.engineVersion || '').slice(0, 80) || null
    };
  }
}

export function getEvidenceScanner() {
  if (env.evidenceScannerMode === 'development-bypass' && !isProduction) {
    return new DevelopmentBypassScanner();
  }
  if (env.evidenceScannerMode === 'http') return new HttpEvidenceScanner();
  return new EvidenceScanner();
}
