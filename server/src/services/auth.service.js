import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { User } from '../models/user.model.js';
import { Session } from '../models/session.model.js';
import { ApiError } from '../utils/ApiError.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { generateBase32Secret, verifyTOTP } from '../utils/totp.js'; // Wait: totp.js is in utils directory or source?
// Ah! We wrote totp.js to: server/src/utils/totp.js. Let's make sure we import it correctly:
// '../utils/totp.js'
import { createAuditLog } from './audit.service.js';

// Setup default users
export async function ensureAdminUser() {
  // Admin user
  const adminEmail = env.adminEmail || 'admin@satyashield.gov.in';
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(env.adminPassword || 'AdminPass123!', env.bcryptSaltRounds);
    await User.create({
      name: 'System Administrator',
      email: adminEmail,
      passwordHash,
      role: 'admin',
      isVerified: true
    });
  }

  // SuperAdmin user
  const superAdminEmail = 'superadmin@satyashield.gov.in';
  const existingSuper = await User.findOne({ email: superAdminEmail });
  if (!existingSuper) {
    const passwordHash = await bcrypt.hash('SuperAdminPass123!', env.bcryptSaltRounds);
    await User.create({
      name: 'Super Administrator',
      email: superAdminEmail,
      passwordHash,
      role: 'superadmin',
      isVerified: true
    });
  }
}

// User Registration
export async function registerUser({ name, email, password, role = 'user' }, req) {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new ApiError(400, 'An account with this email address already exists.');
  }

  const passwordHash = await bcrypt.hash(password, env.bcryptSaltRounds);
  const emailVerificationToken = crypto.randomBytes(32).toString('hex');
  const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const user = await User.create({
    name,
    email: normalizedEmail,
    passwordHash,
    role,
    isVerified: false,
    emailVerificationToken,
    emailVerificationExpires
  });

  await createAuditLog({
    userId: user.id,
    userEmail: user.email,
    role: user.role,
    action: 'admin_action',
    details: { msg: 'User registered', targetRole: role },
    req
  });

  // Verification link logging (for demonstration/mock email)
  console.log(`[EMAIL SEND] Verification link: ${env.clientUrls[0]}/verify-email?token=${emailVerificationToken}`);

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified
  };
}

// Email Verification
export async function verifyEmail(token, req) {
  const user = await User.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: new Date() }
  });

  if (!user) {
    throw new ApiError(400, 'Verification token is invalid or has expired.');
  }

  user.isVerified = true;
  user.emailVerificationToken = null;
  user.emailVerificationExpires = null;
  await user.save();

  await createAuditLog({
    userId: user.id,
    userEmail: user.email,
    role: user.role,
    action: 'admin_action',
    details: { msg: 'Email verified' },
    req
  });

  return { success: true, message: 'Email verified successfully.' };
}

// User Login
export async function loginUser({ email, password }, req) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  // Check lockout
  if (user.accountLocked && user.lockUntil && user.lockUntil > new Date()) {
    throw new ApiError(423, `Account is temporarily locked. Please try again after ${user.lockUntil.toLocaleTimeString()}`);
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= 5) {
      user.accountLocked = true;
      user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes lockout
      await createAuditLog({
        userId: user.id,
        userEmail: user.email,
        role: user.role,
        action: 'login_failure',
        details: { msg: 'Account locked due to consecutive failures' },
        req
      });
      await user.save();
      throw new ApiError(423, 'Account locked. Too many failed login attempts.');
    }
    await user.save();
    await createAuditLog({
      userId: user.id,
      userEmail: user.email,
      role: user.role,
      action: 'login_failure',
      details: { msg: 'Invalid password attempt' },
      req
    });
    throw new ApiError(401, 'Invalid email or password.');
  }

  // Reset failed attempts upon successful authentication
  user.failedLoginAttempts = 0;
  user.accountLocked = false;
  user.lockUntil = null;
  
  // Track device
  const ip = req ? (req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress) : 'unknown';
  const ua = req ? req.headers['user-agent'] : 'unknown';
  const existingDevice = user.devices.find((d) => d.ip === ip && d.userAgent === ua);
  if (!existingDevice) {
    user.devices.push({ ip, userAgent: ua });
  } else {
    existingDevice.lastLoginAt = new Date();
  }
  user.lastLoginAt = new Date();
  await user.save();

  // If MFA is enabled, return a partial success payload
  if (user.mfaEnabled) {
    const mfaToken = crypto.randomBytes(32).toString('hex');
    // Store temporary MFA token in user's reset token or temporary slot
    user.passwordResetToken = `mfa-temp:${mfaToken}`;
    user.passwordResetExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry
    await user.save();

    return {
      mfaRequired: true,
      mfaToken,
      userId: user.id
    };
  }

  // Otherwise create full session
  const session = await createSession(user.id, req);

  await createAuditLog({
    userId: user.id,
    userEmail: user.email,
    role: user.role,
    action: 'login',
    details: { sessionId: session.id },
    req
  });

  return {
    accessToken: signAccessToken({ subject: user.id, role: user.role }),
    refreshToken: session.refreshToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      mfaEnabled: user.mfaEnabled
    }
  };
}

// Complete MFA Verification during login
export async function verifyLoginMfa({ userId, mfaToken, code }, req) {
  const user = await User.findById(userId);
  if (!user || user.passwordResetToken !== `mfa-temp:${mfaToken}`) {
    throw new ApiError(401, 'Invalid MFA session.');
  }

  if (user.passwordResetExpires < new Date()) {
    throw new ApiError(401, 'MFA verification session expired.');
  }

  // Validate TOTP
  const isValid = verifyTOTP(code, user.mfaSecret);
  if (!isValid) {
    await createAuditLog({
      userId: user.id,
      userEmail: user.email,
      role: user.role,
      action: 'login_failure',
      details: { msg: 'MFA token failed' },
      req
    });
    throw new ApiError(401, 'Invalid MFA code.');
  }

  // Reset temp slots
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  await user.save();

  const session = await createSession(user.id, req);

  await createAuditLog({
    userId: user.id,
    userEmail: user.email,
    role: user.role,
    action: 'mfa_verified',
    details: { sessionId: session.id },
    req
  });

  return {
    accessToken: signAccessToken({ subject: user.id, role: user.role }),
    refreshToken: session.refreshToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      mfaEnabled: user.mfaEnabled
    }
  };
}

// Session Creation helper
async function createSession(userId, req) {
  const ipAddress = req ? (req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress) : 'unknown';
  const userAgent = req ? req.headers['user-agent'] : 'unknown';

  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  return Session.create({
    userId,
    refreshToken,
    ipAddress,
    userAgent,
    expiresAt
  });
}

// Refresh Token System (Token Rotation)
export async function rotateRefreshToken(token, req) {
  const session = await Session.findOne({ refreshToken: token, isValid: true });

  if (!session) {
    // If a refresh token is used but not found or not valid, reuse detection triggers:
    // Revoke all sessions for the user to be safe.
    try {
      const decoded = verifyRefreshToken(token);
      await Session.updateMany({ userId: decoded.sub }, { isValid: false });
      console.warn(`[REUSE DETECTION] Revoked all sessions for user ${decoded.sub}`);
    } catch {}
    throw new ApiError(401, 'Session invalid or expired.');
  }

  if (session.expiresAt < new Date()) {
    session.isValid = false;
    await session.save();
    throw new ApiError(401, 'Session expired.');
  }

  // Rotate token
  const newRefreshToken = crypto.randomBytes(40).toString('hex');
  session.refreshToken = newRefreshToken;
  session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await session.save();

  const user = await User.findById(session.userId);
  if (!user) {
    throw new ApiError(401, 'User not found.');
  }

  return {
    accessToken: signAccessToken({ subject: user.id, role: user.role }),
    refreshToken: newRefreshToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    }
  };
}

// Logout / Destroy Session
export async function logoutSession(token, req) {
  const session = await Session.findOneAndUpdate({ refreshToken: token }, { isValid: false }, { new: true });
  if (session) {
    const user = await User.findById(session.userId);
    await createAuditLog({
      userId: session.userId,
      userEmail: user?.email,
      role: user?.role,
      action: 'logout',
      details: { sessionId: session.id },
      req
    });
  }
  return { success: true };
}

// Forgot Password
export async function requestPasswordReset(email, req) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    // Return success to prevent enumeration attacks
    return { success: true, message: 'Password reset link sent if account exists.' };
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  user.passwordResetToken = resetToken;
  user.passwordResetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour
  await user.save();

  await createAuditLog({
    userId: user.id,
    userEmail: user.email,
    role: user.role,
    action: 'password_reset_request',
    details: {},
    req
  });

  console.log(`[EMAIL SEND] Reset password: ${env.clientUrls[0]}/reset-password?token=${resetToken}`);
  return { success: true, message: 'Password reset link sent if account exists.' };
}

// Reset Password
export async function resetPassword({ token, newPassword }, req) {
  const user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: new Date() }
  });

  if (!user) {
    throw new ApiError(400, 'Password reset token is invalid or has expired.');
  }

  user.passwordHash = await bcrypt.hash(newPassword, env.bcryptSaltRounds);
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  user.failedLoginAttempts = 0; // Unlock if locked
  user.accountLocked = false;
  user.lockUntil = null;
  await user.save();

  await createAuditLog({
    userId: user.id,
    userEmail: user.email,
    role: user.role,
    action: 'password_reset_success',
    details: {},
    req
  });

  return { success: true, message: 'Password reset successfully.' };
}

// MFA Setup: Generate secret
export async function setupMfa(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  const secret = generateBase32Secret();
  user.mfaTempSecret = secret;
  await user.save();

  // Create standard otpauth URL for Google Authenticator
  const otpauthUrl = `otpauth://totp/SatyaShield:${user.email}?secret=${secret}&issuer=SatyaShield`;

  return {
    secret,
    otpauthUrl
  };
}

// MFA Setup: Verify and Enable
export async function enableMfa(userId, code, req) {
  const user = await User.findById(userId);
  if (!user || !user.mfaTempSecret) {
    throw new ApiError(400, 'MFA setup is not initialized.');
  }

  const isValid = verifyTOTP(code, user.mfaTempSecret);
  if (!isValid) {
    throw new ApiError(400, 'Verification code is incorrect.');
  }

  user.mfaSecret = user.mfaTempSecret;
  user.mfaEnabled = true;
  user.mfaTempSecret = null;
  await user.save();

  await createAuditLog({
    userId: user.id,
    userEmail: user.email,
    role: user.role,
    action: 'mfa_enabled',
    details: {},
    req
  });

  return { success: true, message: 'Multi-Factor Authentication enabled.' };
}

// List user sessions
export async function listUserSessions(userId) {
  return Session.find({ userId, isValid: true }).sort({ createdAt: -1 });
}

// Revoke specific session
export async function revokeUserSession(userId, sessionId) {
  await Session.findOneAndUpdate({ _id: sessionId, userId }, { isValid: false });
  return { success: true };
}
