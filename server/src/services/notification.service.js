import crypto from 'node:crypto';

import { Notification } from '../models/notification.model.js';

const templates = Object.freeze({
  'case.created': {
    version: 1,
    variables: [],
    en: { subject: 'A case requires review', text: 'Sign in to SatyaShield to review an authorized case.' },
    hi: { subject: 'एक केस की समीक्षा आवश्यक है', text: 'अधिकृत केस की समीक्षा के लिए SatyaShield में साइन इन करें।' }
  },
  'case.status_changed': {
    version: 1,
    variables: ['statusLabel'],
    en: { subject: 'Case status updated', text: 'An authorized case status changed to {statusLabel}.' },
    hi: { subject: 'केस की स्थिति अपडेट हुई', text: 'अधिकृत केस की स्थिति अब {statusLabel} है।' }
  },
  'auth.action': {
    version: 1,
    variables: ['actionLink'],
    en: { subject: 'Complete your SatyaShield account action', text: 'Use this one-time link: {actionLink}' },
    hi: { subject: 'SatyaShield खाते की कार्रवाई पूरी करें', text: 'इस एक-बार उपयोग वाले लिंक का इस्तेमाल करें: {actionLink}' }
  }
});

let adapter = null;
const digest = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

export function setNotificationAdapter(nextAdapter) { adapter = nextAdapter; }
export function resetNotificationAdapter() { adapter = null; }

export function renderNotificationTemplate({ templateKey, language = 'en', variables = {} }) {
  const template = templates[templateKey];
  if (!template) throw new Error('Notification template is not allowlisted.');
  const supplied = Object.keys(variables).sort();
  const allowed = [...template.variables].sort();
  if (JSON.stringify(supplied) !== JSON.stringify(allowed)) {
    throw new Error('Notification template variables do not match the allowlist.');
  }
  const copy = template[language] || template.en;
  const interpolate = (value) => value.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => String(variables[key]));
  return { version: template.version, subject: interpolate(copy.subject), text: interpolate(copy.text) };
}

export async function queueNotification({
  type, title, eventClass, severity = 'info', resourceId, recipient, channel = 'email',
  language = 'en', templateKey, variables = {}, idempotencyKey
}) {
  const rendered = renderNotificationTemplate({ templateKey, language, variables });
  const record = await Notification.findOneAndUpdate(
    { idempotencyKey: digest(idempotencyKey) },
    { $setOnInsert: {
      type, title: title || rendered.subject, eventClass, severity, resourceRef: digest(resourceId).slice(0, 24),
      recipientRef: digest(recipient).slice(0, 24), channel, language, templateKey,
      templateVersion: rendered.version, templateVariables: variables,
      state: adapter ? 'queued' : 'skipped_not_configured',
      deliveryState: adapter ? 'queued' : 'skipped_not_configured', provider: adapter?.name || 'none',
      idempotencyKey: digest(idempotencyKey)
    } },
    { upsert: true, new: true }
  );
  return { record, recipient, rendered };
}

export async function processNotification({ record, recipient, rendered, now = new Date() }) {
  if (!adapter || record.state === 'skipped_not_configured') return record;
  if (!['queued', 'retry_scheduled'].includes(record.state)) return record;
  record.state = 'processing';
  record.deliveryState = 'processing';
  record.attemptCount += 1;
  await record.save();
  try {
    const result = await Promise.race([
      adapter.deliver({ recipient, channel: record.channel, ...rendered }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('provider_timeout')), 10_000))
    ]);
    record.state = result?.accepted ? 'provider_accepted' : 'failed';
    record.deliveryState = record.state;
    record.attempts.push({
      number: record.attemptCount, state: record.state,
      failureCategory: result?.accepted ? '' : 'provider_rejected',
      providerReferenceDigest: result?.reference ? digest(result.reference).slice(0, 24) : '',
      attemptedAt: now
    });
  } catch (error) {
    const terminal = record.attemptCount >= record.maxAttempts;
    record.state = terminal ? 'permanently_failed' : 'retry_scheduled';
    record.deliveryState = record.state;
    record.nextAttemptAt = terminal ? null : new Date(now.getTime() + (2 ** record.attemptCount) * 30_000);
    record.attempts.push({
      number: record.attemptCount, state: record.state,
      failureCategory: error?.message === 'provider_timeout' ? 'timeout' : 'provider_error',
      attemptedAt: now
    });
  }
  await record.save();
  return record;
}

export function createFakeNotificationAdapter({ fail = false } = {}) {
  const calls = [];
  return {
    name: 'deterministic-fake', calls,
    async deliver(payload) {
      calls.push({ ...payload });
      if (fail) throw new Error('fake_provider_failure');
      return { accepted: true, reference: `fake-${calls.length}` };
    }
  };
}

export function verifyProviderWebhook({ rawBody, signature, timestamp, nonce, secret, seenNonces, now = Date.now() }) {
  if (!rawBody || !signature || !timestamp || !nonce || !secret) return false;
  if (Math.abs(now - Number(timestamp)) > 5 * 60_000 || seenNonces.has(nonce)) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${nonce}.${rawBody}`).digest('hex');
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(signature, 'hex');
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return false;
  seenNonces.add(nonce);
  return true;
}

export async function sendNotification({ type, title, eventClass, severity = 'info', complaintAnonymousId }) {
  const templateKey = eventClass === 'case-created' ? 'case.created' : 'case.status_changed';
  const variables = templateKey === 'case.status_changed' ? { statusLabel: title } : {};
  const { record } = await queueNotification({
    type, title, eventClass, severity, resourceId: complaintAnonymousId,
    recipient: 'internal-dashboard', channel: 'none', templateKey, variables,
    idempotencyKey: `${eventClass}:${complaintAnonymousId}:${title}`
  });
  return record;
}

export const createNewComplaintNotification = (complaint) => sendNotification({
  type: 'new-complaint', title: 'New case requires review', eventClass: 'case-created',
  severity: 'info', complaintAnonymousId: complaint.anonymousId
});
export const sendStatusUpdateNotification = (complaint) => sendNotification({
  type: 'status-change', title: complaint.status, eventClass: 'case-status-changed',
  complaintAnonymousId: complaint.anonymousId
});
export const listRecentNotifications = (limit = 15) => Notification.find().sort({ createdAt: -1 }).limit(limit).lean();
export const countUnreadNotifications = () => Notification.countDocuments({ isRead: false });
export const markNotificationAsRead = (id) => Notification.findByIdAndUpdate(id, { isRead: true }, { new: true });
