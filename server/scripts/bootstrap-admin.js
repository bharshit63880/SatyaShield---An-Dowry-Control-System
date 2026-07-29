import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';
import { User } from '../src/models/user.model.js';
import { hashPassword } from '../src/services/password.service.js';
import { createAuditLog } from '../src/services/audit.service.js';

if (process.env.BOOTSTRAP_ADMIN_CONFIRM !== 'CREATE_ONE_TIME_ADMIN') {
  throw new Error('Set BOOTSTRAP_ADMIN_CONFIRM=CREATE_ONE_TIME_ADMIN explicitly.');
}
const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Exact bootstrap email is required.');

await connectDatabase();
try {
  if (await User.exists({ role: { $in: ['admin', 'superadmin'] } })) {
    throw new Error('Bootstrap refused because a privileged account already exists.');
  }
  const user = await User.create({
    name: 'Bootstrap Administrator',
    email,
    passwordHash: await hashPassword(password),
    role: 'admin',
    isVerified: true,
    accountState: 'active'
  });
  await createAuditLog({
    userId: user.id, role: 'system', action: 'bootstrap_admin_created',
    resourceType: 'account', resourceRef: user.id, outcome: 'allowed'
  });
  process.stdout.write('One-time administrator bootstrap completed. Remove bootstrap environment values now.\n');
} finally {
  await mongoose.disconnect();
}
