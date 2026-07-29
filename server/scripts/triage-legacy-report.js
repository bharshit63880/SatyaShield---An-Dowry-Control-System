import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Complaint } from '../src/models/complaint.model.js';

const dbName = env.mongoUri.match(/\/([^/?]+)(?:\?|$)/)?.[1] || '';
if (process.env.TRIAGE_REPORT_CONFIRM_DATABASE !== dbName || !/^ss_[a-z0-9_]+$/i.test(dbName)) {
  throw new Error('Read-only report refused: confirm the dedicated database.');
}
await mongoose.connect(env.mongoUri);
const [legacyCount, missingStructuredCount, activeAssessmentCount] = await Promise.all([
  Complaint.countDocuments({ $or: [
    { riskLevel: { $exists: true } }, { riskScore: { $exists: true } },
    { detectedKeywords: { $exists: true, $ne: [] } }, { threatSummary: { $nin: [null, ''] } }
  ] }),
  Complaint.countDocuments({ currentTriageAssessmentId: null }),
  Complaint.countDocuments({ currentTriageAssessmentId: { $ne: null } })
]);
console.log(JSON.stringify({
  report: 'triage-legacy-inventory', database: dbName, mutationsPerformed: 0,
  legacyValuesTrusted: false, legacyCount, missingStructuredCount,
  activeAssessmentCount, missingStructuredDisposition: 'human_review_required'
}, null, 2));
await mongoose.disconnect();
