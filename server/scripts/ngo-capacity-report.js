import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { capacityDryRunReport } from '../src/services/ngo-assignment.service.js';

const dbName = env.mongoUri.match(/\/([^/?]+)(?:\?|$)/)?.[1] || '';
if (process.env.NGO_REPORT_CONFIRM_DATABASE !== dbName || !/^ss_[a-z0-9_]+$/i.test(dbName)) {
  throw new Error('Read-only report refused: confirm the dedicated database with NGO_REPORT_CONFIRM_DATABASE.');
}
await mongoose.connect(env.mongoUri);
console.log(JSON.stringify({ database: dbName, ...(await capacityDryRunReport()) }, null, 2));
await mongoose.disconnect();
