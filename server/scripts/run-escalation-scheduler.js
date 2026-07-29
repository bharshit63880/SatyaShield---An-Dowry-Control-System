import mongoose from 'mongoose';

import { connectDatabase } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { runSchedulerBatch } from '../src/services/escalation-workflow.service.js';

const dryRun = !process.argv.includes('--execute');
const confirmedDatabase = process.env.ESCALATION_RUN_CONFIRM_DATABASE?.trim();

await connectDatabase();
try {
  if (!confirmedDatabase || mongoose.connection.name !== confirmedDatabase) {
    throw new Error('Scheduler command database guard refused execution.');
  }
  if (!dryRun && process.env.ESCALATION_RUN_CONFIRM_MUTATION !== 'true') {
    throw new Error('Set ESCALATION_RUN_CONFIRM_MUTATION=true for guarded execution.');
  }
  const result = await runSchedulerBatch({
    dryRun,
    batchSize: env.escalationBatchSize
  });
  process.stdout.write(`${JSON.stringify({
    database: mongoose.connection.name,
    policyVersion: env.escalationPolicyVersion,
    ...result
  }, null, 2)}\n`);
} finally {
  await mongoose.disconnect();
}
