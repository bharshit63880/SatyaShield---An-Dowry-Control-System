import dotenv from 'dotenv';
import { normalizeAllowedOrigin } from '../utils/cors-origin.js';

dotenv.config();

const requiredVariables = [
  'MONGODB_URI',
  'JWT_SECRET',
  'REPORTER_ACCESS_HMAC_KEY',
  'CASE_INTEGRITY_HMAC_KEY',
  'REPORTER_TOKEN_SECRET',
  'STAFF_ACCESS_TOKEN_SECRET',
  'REFRESH_TOKEN_PEPPER',
  'VERIFICATION_TOKEN_PEPPER',
  'PASSWORD_RESET_TOKEN_PEPPER',
  'MFA_CHALLENGE_TOKEN_PEPPER',
  'RECOVERY_CODE_PEPPER',
  'MFA_ENCRYPTION_KEY',
  'LOCATION_ENCRYPTION_KEY',
  'EVIDENCE_ENCRYPTION_KEY',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD'
];

for (const variable of requiredVariables) {
  if (!process.env[variable]) {
    throw new Error(`Missing required environment variable: ${variable}`);
  }
}

if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long.');
}

if (process.env.REPORTER_ACCESS_HMAC_KEY.length < 32) {
  throw new Error('REPORTER_ACCESS_HMAC_KEY must be at least 32 characters long.');
}

if (process.env.CASE_INTEGRITY_HMAC_KEY.length < 32) {
  throw new Error('CASE_INTEGRITY_HMAC_KEY must be at least 32 characters long.');
}

if (process.env.REPORTER_TOKEN_SECRET.length < 32) {
  throw new Error('REPORTER_TOKEN_SECRET must be at least 32 characters long.');
}
for (const variable of [
  'STAFF_ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_PEPPER', 'VERIFICATION_TOKEN_PEPPER',
  'PASSWORD_RESET_TOKEN_PEPPER', 'MFA_CHALLENGE_TOKEN_PEPPER', 'RECOVERY_CODE_PEPPER'
]) {
  if (process.env[variable].length < 32) throw new Error(`${variable} must be at least 32 characters long.`);
}
if (!/^[a-f0-9]{64}$/i.test(process.env.MFA_ENCRYPTION_KEY)) {
  throw new Error('MFA_ENCRYPTION_KEY must be exactly 64 hexadecimal characters.');
}

if (process.env.LOCATION_ENCRYPTION_KEY.length < 16) {
  throw new Error('LOCATION_ENCRYPTION_KEY must be at least 16 characters long.');
}

if (process.env.EVIDENCE_ENCRYPTION_KEY && !/^[a-f0-9]{64}$/i.test(process.env.EVIDENCE_ENCRYPTION_KEY)) {
  throw new Error('EVIDENCE_ENCRYPTION_KEY must be exactly 64 hexadecimal characters.');
}

if ((process.env.SUPERADMIN_EMAIL && !process.env.SUPERADMIN_PASSWORD) || (!process.env.SUPERADMIN_EMAIL && process.env.SUPERADMIN_PASSWORD)) {
  throw new Error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be configured together.');
}

if (process.env.SUPERADMIN_PASSWORD && process.env.SUPERADMIN_PASSWORD.length < 12) {
  throw new Error('SUPERADMIN_PASSWORD must be at least 12 characters long.');
}

function parseNumber(value, fallback, name) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a valid number.`);
  }

  return parsed;
}

function parseUrlList(value, fallback) {
  const urls = (value ?? fallback)
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
    .map(normalizeAllowedOrigin);

  if (!urls.length) {
    throw new Error('CLIENT_URL must contain at least one allowed origin.');
  }

  return urls;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('Boolean environment values must be true or false.');
}

export const env = {
  appName: process.env.APP_NAME?.trim() || 'SatyaShield',
  apiVersion: process.env.API_VERSION?.trim() || 'v1',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  logLevel: process.env.LOG_LEVEL?.trim() || 'info',
  trustProxyMode: process.env.TRUST_PROXY_MODE?.trim() || 'none',
  host: process.env.HOST?.trim() || '0.0.0.0',
  port: parseNumber(process.env.PORT, 5000, 'PORT'),
  mongoUri: process.env.MONGODB_URI,
  serverPublicUrl: process.env.SERVER_PUBLIC_URL?.trim() || '',
  uploadsDir: process.env.UPLOADS_DIR?.trim() || 'uploads',
  jwtSecret: process.env.JWT_SECRET,
  jwtIssuer: process.env.JWT_ISSUER?.trim() || 'dahej-control-system',
  jwtAudience: process.env.JWT_AUDIENCE?.trim() || 'dahej-control-system-admin',
  reporterAccessHmacKey: process.env.REPORTER_ACCESS_HMAC_KEY,
  caseIntegrityHmacKey: process.env.CASE_INTEGRITY_HMAC_KEY,
  reporterTokenSecret: process.env.REPORTER_TOKEN_SECRET,
  reporterTokenAudience:
    process.env.REPORTER_TOKEN_AUDIENCE?.trim() || 'satyashield-reporter-case',
  reporterTokenExpiresIn: process.env.REPORTER_TOKEN_EXPIRES_IN?.trim() || '15m',
  staffAccessTokenSecret: process.env.STAFF_ACCESS_TOKEN_SECRET,
  staffAccessTokenExpiresIn: process.env.STAFF_ACCESS_TOKEN_EXPIRES_IN?.trim() || '10m',
  staffTokenKeyId: process.env.STAFF_TOKEN_KEY_ID?.trim() || 'staff-v1',
  refreshTokenPepper: process.env.REFRESH_TOKEN_PEPPER,
  verificationTokenPepper: process.env.VERIFICATION_TOKEN_PEPPER,
  passwordResetTokenPepper: process.env.PASSWORD_RESET_TOKEN_PEPPER,
  mfaChallengeTokenPepper: process.env.MFA_CHALLENGE_TOKEN_PEPPER,
  recoveryCodePepper: process.env.RECOVERY_CODE_PEPPER,
  mfaEncryptionKey: process.env.MFA_ENCRYPTION_KEY,
  refreshTokenExpiresDays: parseNumber(process.env.REFRESH_TOKEN_EXPIRES_DAYS, 7, 'REFRESH_TOKEN_EXPIRES_DAYS'),
  verificationTokenExpiresMinutes: parseNumber(process.env.VERIFICATION_TOKEN_EXPIRES_MINUTES, 60, 'VERIFICATION_TOKEN_EXPIRES_MINUTES'),
  passwordResetTokenExpiresMinutes: parseNumber(process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES, 30, 'PASSWORD_RESET_TOKEN_EXPIRES_MINUTES'),
  mfaChallengeExpiresMinutes: parseNumber(process.env.MFA_CHALLENGE_EXPIRES_MINUTES, 5, 'MFA_CHALLENGE_EXPIRES_MINUTES'),
  authCookieName: process.env.AUTH_COOKIE_NAME?.trim() || 'ss_refresh',
  csrfCookieName: process.env.CSRF_COOKIE_NAME?.trim() || 'ss_csrf',
  locationEncryptionKey: process.env.LOCATION_ENCRYPTION_KEY,
  evidenceEncryptionKey: process.env.EVIDENCE_ENCRYPTION_KEY,
  evidenceEncryptionVersion: parseNumber(
    process.env.EVIDENCE_ENCRYPTION_VERSION,
    1,
    'EVIDENCE_ENCRYPTION_VERSION'
  ),
  evidenceStorageDir: process.env.EVIDENCE_STORAGE_DIR?.trim() || 'private-data/evidence',
  evidenceMaxFileSize: parseNumber(
    process.env.EVIDENCE_MAX_FILE_SIZE,
    30 * 1024 * 1024,
    'EVIDENCE_MAX_FILE_SIZE'
  ),
  evidenceScannerMode: process.env.EVIDENCE_SCANNER_MODE?.trim() || (
    process.env.NODE_ENV === 'production' ? 'required' : 'development-bypass'
  ),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  adminEmail: process.env.ADMIN_EMAIL.toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD,
  superAdminEmail: process.env.SUPERADMIN_EMAIL?.toLowerCase() || '',
  superAdminPassword: process.env.SUPERADMIN_PASSWORD || '',
  clientUrls: parseUrlList(process.env.CLIENT_URL, 'http://localhost:5173'),
  bcryptSaltRounds: parseNumber(process.env.BCRYPT_SALT_ROUNDS, 10, 'BCRYPT_SALT_ROUNDS'),
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() ?? '',
  openaiModel: process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini',
  aiProcessingEnabled: parseBoolean(process.env.AI_PROCESSING_ENABLED, false),
  aiDisclosureVersion: process.env.AI_DISCLOSURE_VERSION?.trim() || 'ai-2026-07-v1',
  privacyNoticeVersion: process.env.PRIVACY_NOTICE_VERSION?.trim() || 'privacy-2026-07-v1',
  consentVersion: process.env.CONSENT_VERSION?.trim() || 'consent-2026-07-v1',
  retentionPolicyVersion: process.env.RETENTION_POLICY_VERSION?.trim() || 'retention-2026-07-v1',
  retentionEnforcementEnabled: parseBoolean(process.env.RETENTION_ENFORCEMENT_ENABLED, false),
  complaintRetentionDays: parseNumber(process.env.COMPLAINT_RETENTION_DAYS, 730, 'COMPLAINT_RETENTION_DAYS'),
  evidenceRetentionDays: parseNumber(process.env.EVIDENCE_RETENTION_DAYS, 730, 'EVIDENCE_RETENTION_DAYS'),
  auditRetentionDays: parseNumber(process.env.AUDIT_RETENTION_DAYS, 365, 'AUDIT_RETENTION_DAYS')
  ,caseIntegrityPolicyVersion:
    process.env.CASE_INTEGRITY_POLICY_VERSION?.trim() || 'case-integrity-v1'
  ,caseIntegrityFingerprintVersion:
    process.env.CASE_INTEGRITY_FINGERPRINT_VERSION?.trim() || 'narrative-hmac-v1'
  ,caseIntegrityDuplicateWindowDays: parseNumber(
    process.env.CASE_INTEGRITY_DUPLICATE_WINDOW_DAYS,
    90,
    'CASE_INTEGRITY_DUPLICATE_WINDOW_DAYS'
  )
  ,ngoRoutingPolicyVersion: process.env.NGO_ROUTING_POLICY_VERSION?.trim() || 'ngo-routing-v1',
  ngoAssignmentOfferMinutes: parseNumber(process.env.NGO_ASSIGNMENT_OFFER_MINUTES, 60, 'NGO_ASSIGNMENT_OFFER_MINUTES'),
  ngoDefaultMaxActiveCases: parseNumber(process.env.NGO_DEFAULT_MAX_ACTIVE_CASES, 20, 'NGO_DEFAULT_MAX_ACTIVE_CASES'),
  ngoCapacityEnforcementEnabled: parseBoolean(process.env.NGO_CAPACITY_ENFORCEMENT_ENABLED, true),
  ngoRemoteCoverageEnabled: parseBoolean(process.env.NGO_REMOTE_COVERAGE_ENABLED, true),
  ngoReviewVersion: process.env.NGO_REVIEW_VERSION?.trim() || 'ngo-review-v1',
  ngoLegacyAssignmentsAllowed: parseBoolean(process.env.NGO_LEGACY_ASSIGNMENTS_ALLOWED, false),
  triagePolicyVersion: process.env.TRIAGE_POLICY_VERSION?.trim() || 'triage-policy-v1',
  triageInputSchemaVersion: process.env.TRIAGE_INPUT_SCHEMA_VERSION?.trim() || 'triage-input-v1',
  triageCriticalRulesetVersion: process.env.TRIAGE_CRITICAL_RULESET_VERSION?.trim() || 'triage-critical-v1',
  triageAiEnabled: parseBoolean(process.env.TRIAGE_AI_ENABLED, false),
  triageAiProvider: process.env.TRIAGE_AI_PROVIDER?.trim() || '',
  triageAiModel: process.env.TRIAGE_AI_MODEL?.trim() || '',
  triageAiPolicyVersion: process.env.TRIAGE_AI_POLICY_VERSION?.trim() || '',
  triageAiDisclosureVersion: process.env.TRIAGE_AI_DISCLOSURE_VERSION?.trim() || '',
  triageHumanReviewRequiredForCritical:
    parseBoolean(process.env.TRIAGE_HUMAN_REVIEW_REQUIRED_FOR_CRITICAL, true),
  triageLegacyValuesTrusted: parseBoolean(process.env.TRIAGE_LEGACY_VALUES_TRUSTED, false),
  escalationPolicyVersion: process.env.ESCALATION_POLICY_VERSION?.trim() || 'escalation-policy-v1',
  escalationSchedulerEnabled: parseBoolean(process.env.ESCALATION_SCHEDULER_ENABLED, false),
  escalationSchedulerDatabase: process.env.ESCALATION_SCHEDULER_DATABASE?.trim() || '',
  escalationSchedulerIntervalSeconds: parseNumber(
    process.env.ESCALATION_SCHEDULER_INTERVAL_SECONDS, 30,
    'ESCALATION_SCHEDULER_INTERVAL_SECONDS'
  ),
  escalationBatchSize: parseNumber(process.env.ESCALATION_BATCH_SIZE, 50, 'ESCALATION_BATCH_SIZE'),
  escalationLeaseSeconds: parseNumber(process.env.ESCALATION_LEASE_SECONDS, 60, 'ESCALATION_LEASE_SECONDS'),
  criticalReviewTargetMinutes: parseNumber(
    process.env.CRITICAL_REVIEW_TARGET_MINUTES, 15, 'CRITICAL_REVIEW_TARGET_MINUTES'
  ),
  highReviewTargetMinutes: parseNumber(
    process.env.HIGH_REVIEW_TARGET_MINUTES, 120, 'HIGH_REVIEW_TARGET_MINUTES'
  ),
  ngoOfferResponseTargetMinutes: parseNumber(
    process.env.NGO_OFFER_RESPONSE_TARGET_MINUTES, 60, 'NGO_OFFER_RESPONSE_TARGET_MINUTES'
  ),
  noMatchReviewTargetMinutes: parseNumber(
    process.env.NO_MATCH_REVIEW_TARGET_MINUTES, 60, 'NO_MATCH_REVIEW_TARGET_MINUTES'
  ),
  escalationTimezone: process.env.ESCALATION_TIMEZONE?.trim() || 'UTC',
  escalationMaxAttempts: parseNumber(
    process.env.ESCALATION_MAX_ATTEMPTS, 5, 'ESCALATION_MAX_ATTEMPTS'
  ),
  socketIoEnabled: parseBoolean(process.env.SOCKET_IO_ENABLED, false),
  socketSingleInstanceMode: parseBoolean(process.env.SOCKET_SINGLE_INSTANCE_MODE, true),
  socketAdapter: process.env.SOCKET_ADAPTER?.trim() || 'memory',
  socketMessageMaxLength: parseNumber(
    process.env.SOCKET_MESSAGE_MAX_LENGTH, 2000, 'SOCKET_MESSAGE_MAX_LENGTH'
  ),
  socketMessageRateLimit: parseNumber(
    process.env.SOCKET_MESSAGE_RATE_LIMIT, 20, 'SOCKET_MESSAGE_RATE_LIMIT'
  ),
  socketHistoryPageSize: parseNumber(
    process.env.SOCKET_HISTORY_PAGE_SIZE, 50, 'SOCKET_HISTORY_PAGE_SIZE'
  ),
  socketAuthRecheckSeconds: parseNumber(
    process.env.SOCKET_AUTH_RECHECK_SECONDS, 30, 'SOCKET_AUTH_RECHECK_SECONDS'
  ),
  sosPolicyVersion: process.env.SOS_POLICY_VERSION?.trim() || 'sos-policy-v1',
  sosEnabled: parseBoolean(process.env.SOS_ENABLED, false),
  sosConfirmationSeconds: parseNumber(
    process.env.SOS_CONFIRMATION_SECONDS, 5, 'SOS_CONFIRMATION_SECONDS'
  ),
  sosActiveExpiryMinutes: parseNumber(
    process.env.SOS_ACTIVE_EXPIRY_MINUTES, 1440, 'SOS_ACTIVE_EXPIRY_MINUTES'
  ),
  sosLocationEnabled: parseBoolean(process.env.SOS_LOCATION_ENABLED, false),
  sosInternalRoutingEnabled: parseBoolean(
    process.env.SOS_INTERNAL_ROUTING_ENABLED, true
  ),
  sosExternalDeliveryEnabled: parseBoolean(
    process.env.SOS_EXTERNAL_DELIVERY_ENABLED, false
  ),
  helplineDirectoryVersion:
    process.env.HELPLINE_DIRECTORY_VERSION?.trim() || 'helpline-directory-v1',
  helplineMaxReviewAgeDays: parseNumber(
    process.env.HELPLINE_MAX_REVIEW_AGE_DAYS, 180, 'HELPLINE_MAX_REVIEW_AGE_DAYS'
  )
};

if (!['none', 'loopback', 'single'].includes(env.trustProxyMode)) {
  throw new Error('TRUST_PROXY_MODE must be none, loopback, or single.');
}
if (env.nodeEnv === 'production' && env.trustProxyMode === 'single') {
  throw new Error('TRUST_PROXY_MODE=single is not permitted in production.');
}
if (env.aiProcessingEnabled) {
  throw new Error('AI_PROCESSING_ENABLED must remain false through Phase 7.');
}
if (env.ngoDefaultMaxActiveCases < 1 || env.ngoDefaultMaxActiveCases > 10000) {
  throw new Error('NGO_DEFAULT_MAX_ACTIVE_CASES must be between 1 and 10000.');
}
if (env.caseIntegrityDuplicateWindowDays < 1 || env.caseIntegrityDuplicateWindowDays > 365) {
  throw new Error('CASE_INTEGRITY_DUPLICATE_WINDOW_DAYS must be between 1 and 365.');
}
if (env.ngoAssignmentOfferMinutes < 5 || env.ngoAssignmentOfferMinutes > 10080) {
  throw new Error('NGO_ASSIGNMENT_OFFER_MINUTES must be between 5 and 10080.');
}
if (env.nodeEnv === 'production' && (!env.ngoRoutingPolicyVersion || !env.ngoReviewVersion)) {
  throw new Error('NGO routing and review versions are required in production.');
}
if (env.ngoLegacyAssignmentsAllowed) {
  throw new Error('NGO_LEGACY_ASSIGNMENTS_ALLOWED must remain false in Phase 6.');
}
if (!env.triagePolicyVersion || !env.triageInputSchemaVersion || !env.triageCriticalRulesetVersion) {
  throw new Error('Versioned triage policy, input schema, and Critical ruleset are required.');
}
if (env.triageLegacyValuesTrusted) {
  throw new Error('TRIAGE_LEGACY_VALUES_TRUSTED must remain false.');
}
if (env.triageAiEnabled) {
  throw new Error('External triage AI is unavailable in Phase 7 and TRIAGE_AI_ENABLED must remain false.');
}
if (!env.escalationPolicyVersion) {
  throw new Error('ESCALATION_POLICY_VERSION is required.');
}
if (!Number.isInteger(env.escalationBatchSize) ||
    env.escalationBatchSize < 1 || env.escalationBatchSize > 500) {
  throw new Error('ESCALATION_BATCH_SIZE must be an integer between 1 and 500.');
}
if (!Number.isInteger(env.escalationLeaseSeconds) ||
    env.escalationLeaseSeconds < 5 || env.escalationLeaseSeconds > 3600) {
  throw new Error('ESCALATION_LEASE_SECONDS must be an integer between 5 and 3600.');
}
if (env.escalationSchedulerEnabled && !env.escalationSchedulerDatabase) {
  throw new Error('ESCALATION_SCHEDULER_DATABASE is required when the scheduler is enabled.');
}
for (const [name, value] of Object.entries({
  CRITICAL_REVIEW_TARGET_MINUTES: env.criticalReviewTargetMinutes,
  HIGH_REVIEW_TARGET_MINUTES: env.highReviewTargetMinutes,
  NGO_OFFER_RESPONSE_TARGET_MINUTES: env.ngoOfferResponseTargetMinutes,
  NO_MATCH_REVIEW_TARGET_MINUTES: env.noMatchReviewTargetMinutes
})) {
  if (value < 1 || value > 10080) throw new Error(`${name} must be between 1 and 10080.`);
}
try {
  new Intl.DateTimeFormat('en', { timeZone: env.escalationTimezone }).format();
} catch {
  throw new Error('ESCALATION_TIMEZONE must be a valid IANA timezone.');
}
if (!Number.isInteger(env.socketMessageMaxLength) ||
    env.socketMessageMaxLength < 1 || env.socketMessageMaxLength > 10000) {
  throw new Error('SOCKET_MESSAGE_MAX_LENGTH must be an integer between 1 and 10000.');
}
if (!Number.isInteger(env.socketHistoryPageSize) ||
    env.socketHistoryPageSize < 1 || env.socketHistoryPageSize > 200) {
  throw new Error('SOCKET_HISTORY_PAGE_SIZE must be an integer between 1 and 200.');
}
if (!env.socketSingleInstanceMode && env.socketAdapter === 'memory') {
  throw new Error('Multi-instance Socket.IO requires a configured scaling adapter.');
}
if (env.socketAdapter !== 'memory') {
  throw new Error('Only the explicit single-instance memory Socket.IO adapter is available in Phase 9.');
}
if (!env.sosPolicyVersion || !env.helplineDirectoryVersion) {
  throw new Error('SOS and helpline policy versions are required.');
}
if (env.sosExternalDeliveryEnabled) {
  throw new Error('SOS_EXTERNAL_DELIVERY_ENABLED must remain false through Phase 10.');
}
if (!Number.isInteger(env.sosConfirmationSeconds) ||
    env.sosConfirmationSeconds < 1 || env.sosConfirmationSeconds > 60) {
  throw new Error('SOS_CONFIRMATION_SECONDS must be an integer between 1 and 60.');
}
if (env.sosActiveExpiryMinutes < 5 || env.sosActiveExpiryMinutes > 10080) {
  throw new Error('SOS_ACTIVE_EXPIRY_MINUTES must be between 5 and 10080.');
}

export const isProduction = env.nodeEnv === 'production';
