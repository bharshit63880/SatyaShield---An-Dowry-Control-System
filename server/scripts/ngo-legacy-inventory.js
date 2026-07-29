import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { NGO } from '../src/models/ngo.model.js';

const dbName = env.mongoUri.match(/\/([^/?]+)(?:\?|$)/)?.[1] || '';
if (process.env.NGO_REPORT_CONFIRM_DATABASE !== dbName || !/^ss_[a-z0-9_]+$/i.test(dbName)) {
  throw new Error('Read-only report refused: confirm the dedicated database with NGO_REPORT_CONFIRM_DATABASE.');
}
await mongoose.connect(env.mongoUri);
const records = await NGO.find({
  $or: [{ status: { $exists: true } }, { servedCities: { $exists: true } }, { servedDistricts: { $exists: true } }]
}).select('+status +servedCities +servedDistricts').lean();
console.log(JSON.stringify({
  report: 'ngo-legacy-inventory', database: dbName, mutationsPerformed: 0,
  count: records.length,
  states: records.reduce((out, item) => {
    const key = item.status || 'unset'; out[key] = (out[key] || 0) + 1; return out;
  }, {})
}, null, 2));
await mongoose.disconnect();
