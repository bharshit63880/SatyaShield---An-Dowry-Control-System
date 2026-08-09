import { env } from '../../config/env.js';
import { localPrivateStorageProvider } from './local-private-storage.provider.js';
import { ObjectPrivateStorageProvider } from './object-private-storage.provider.js';

let configuredProvider;

export function getEvidenceStorageProvider() {
  if (configuredProvider) return configuredProvider;
  configuredProvider = env.evidenceStorageProvider === 'object'
    ? new ObjectPrivateStorageProvider()
    : localPrivateStorageProvider;
  return configuredProvider;
}
