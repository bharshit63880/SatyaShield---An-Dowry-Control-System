import bcrypt from 'bcryptjs';

import { env } from '../config/env.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { signAccessToken } from '../utils/jwt.js';

export async function ensureAdminUser() {
  const existingAdmin = await User.findOne({ email: env.adminEmail });

  if (existingAdmin) {
    return existingAdmin;
  }

  const passwordHash = await bcrypt.hash(env.adminPassword, env.bcryptSaltRounds);

  return User.create({
    email: env.adminEmail,
    passwordHash,
    role: 'admin'
  });
}

export async function loginAdmin({ email, password }) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user || user.role !== 'admin') {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const token = signAccessToken({
    subject: user.id,
    role: user.role
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  };
}
