import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { connectDatabase } from '../src/config/db.js';
import { buildRetentionDryRunReport } from '../src/services/retention.service.js';

await connectDatabase();
try {
  const report = await buildRetentionDryRunReport();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await mongoose.disconnect();
}
