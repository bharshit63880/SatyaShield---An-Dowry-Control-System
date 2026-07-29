import { env } from '../config/env.js';

const SAFE_SEVERITIES = ['low', 'moderate', 'high', 'critical'];

export function buildMinimizedAdvisoryPayload(assessment) {
  return Object.freeze({
    severity: assessment.severity,
    indicatorCodes: [...assessment.indicatorCodes],
    uncertaintyState: assessment.uncertaintyState,
    policyVersion: assessment.triagePolicyVersion
  });
}

export function validateAdvisoryOutput(value, authoritativeSeverity) {
  if (!value || typeof value !== 'object' ||
      !SAFE_SEVERITIES.includes(value.suggestedSeverity) ||
      !Array.isArray(value.advisoryCodes) ||
      value.advisoryCodes.some((item) => !/^[a-z0-9_]{1,60}$/.test(item))) return null;
  if (authoritativeSeverity === 'critical' && value.suggestedSeverity !== 'critical') return null;
  return {
    suggestedSeverity: value.suggestedSeverity,
    advisoryCodes: value.advisoryCodes.slice(0, 10)
  };
}

export async function runLocalAdvisoryTestDouble({ assessment, consent, adapter }) {
  if (env.nodeEnv !== 'test' || env.triageAiEnabled || !consent?.explicit ||
      consent.disclosureVersion !== 'test-only-disclosure' || typeof adapter !== 'function') {
    return { used: false, result: null, outcome: 'blocked' };
  }
  try {
    const raw = await adapter(buildMinimizedAdvisoryPayload(assessment));
    const result = validateAdvisoryOutput(raw, assessment.severity);
    return { used: Boolean(result), result, outcome: result ? 'validated_test_only' : 'rejected' };
  } catch {
    return { used: false, result: null, outcome: 'unavailable' };
  }
}
