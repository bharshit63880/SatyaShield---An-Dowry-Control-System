import mongoose from 'mongoose';
import dns from 'node:dns';

import { env } from './env.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(env.mongoUri);
  } catch (error) {
    const isSrvDnsRefusal =
      env.mongoUri.startsWith('mongodb+srv://') &&
      error?.code === 'ECONNREFUSED' &&
      String(error?.syscall || '').toLowerCase() === 'querysrv';

    if (!isSrvDnsRefusal) throw error;

    // Some Windows/network DNS configurations reject SRV lookups even though
    // ordinary DNS works. Retry only that failure through trusted resolvers;
    // MongoDB TLS certificate and credential verification remain unchanged.
    dns.setServers(['1.1.1.1', '8.8.8.8']);
    await mongoose.connect(env.mongoUri);
  }
}
