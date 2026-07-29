import { env } from '../config/env.js';

export const TRIAGE_ANSWER_VALUES = ['yes', 'no', 'unknown', 'prefer_not_to_say'];
const FIELDS = [
  ['dangerHappeningNow', 'danger_happening_now'],
  ['immediateThreatToLife', 'immediate_threat_to_life'],
  ['weaponInvolved', 'weapon_reported'],
  ['seriousInjuryPresent', 'serious_injury_reported'],
  ['currentlyConfined', 'confinement_reported'],
  ['threatEscalating', 'escalating_threat'],
  ['stalkingOrRepeatedContact', 'repeated_stalking'],
  ['vulnerablePersonAtRisk', 'vulnerable_person_risk'],
  ['urgentMedicalHelpNeeded', 'urgent_medical_concern']
];

export function evaluateDeterministicTriage(input) {
  if (!input || typeof input !== 'object') return invalidAssessment();
  for (const [field] of FIELDS) {
    if (!TRIAGE_ANSWER_VALUES.includes(input[field])) return invalidAssessment();
  }
  if (!TRIAGE_ANSWER_VALUES.includes(input.canSafelyContinue)) return invalidAssessment();

  const indicatorCodes = FIELDS.filter(([field]) => input[field] === 'yes').map(([, code]) => code);
  if (input.canSafelyContinue === 'no') indicatorCodes.push('reporter_cannot_continue_safely');
  const unknownCount = [...FIELDS.map(([field]) => input[field]), input.canSafelyContinue]
    .filter((value) => ['unknown', 'prefer_not_to_say'].includes(value)).length;
  const conflicting = input.dangerHappeningNow === 'no' && input.immediateThreatToLife === 'yes';

  const critical =
    input.immediateThreatToLife === 'yes' ||
    (input.dangerHappeningNow === 'yes' && input.weaponInvolved === 'yes') ||
    (input.seriousInjuryPresent === 'yes' && input.urgentMedicalHelpNeeded === 'yes') ||
    (input.currentlyConfined === 'yes' && input.dangerHappeningNow === 'yes');
  let severity = 'low';
  if (critical) severity = 'critical';
  else if (
    input.dangerHappeningNow === 'yes' || input.weaponInvolved === 'yes' ||
    input.seriousInjuryPresent === 'yes' || input.currentlyConfined === 'yes' ||
    input.threatEscalating === 'yes' || input.stalkingOrRepeatedContact === 'yes' ||
    input.vulnerablePersonAtRisk === 'yes' || input.urgentMedicalHelpNeeded === 'yes' ||
    input.canSafelyContinue === 'no' || input.reporterUrgency === 'urgent'
  ) severity = 'high';
  else if (indicatorCodes.length || input.reporterUrgency === 'concerned') severity = 'moderate';

  const uncertaintyState = conflicting ? 'conflicting' : unknownCount >= 5 ? 'incomplete' : 'none';
  if (conflicting) indicatorCodes.push('conflicting_answers');
  if (unknownCount >= 5) indicatorCodes.push('insufficient_information');
  const reviewRequired = critical || uncertaintyState !== 'none';
  if (reviewRequired) indicatorCodes.push('manual_review_required');
  return {
    severity,
    indicatorCodes: [...new Set(indicatorCodes)],
    uncertaintyState,
    reviewState: reviewRequired ? 'review_required' : 'auto_assessed',
    recommendationCodes: [
      critical ? 'priority_human_review' : 'authorized_human_review',
      ...(uncertaintyState !== 'none' ? ['clarification_may_be_needed'] : [])
    ],
    triagePolicyVersion: env.triagePolicyVersion,
    inputSchemaVersion: env.triageInputSchemaVersion,
    criticalRulesetVersion: env.triageCriticalRulesetVersion
  };
}

function invalidAssessment() {
  return {
    severity: 'moderate',
    indicatorCodes: ['insufficient_information', 'manual_review_required'],
    uncertaintyState: 'invalid',
    reviewState: 'review_required',
    recommendationCodes: ['authorized_human_review'],
    triagePolicyVersion: env.triagePolicyVersion,
    inputSchemaVersion: env.triageInputSchemaVersion,
    criticalRulesetVersion: env.triageCriticalRulesetVersion
  };
}

// Legacy API deliberately ignores narrative and returns a review-required compatibility result.
export function analyzeComplaintRiskLocal() {
  return {
    detectedKeywords: [], riskScore: 0, riskLevel: 'medium',
    indicators: { dowryHarassment: false, suicideRisk: false, domesticViolence: false },
    escalationRecommendation: null, threatSummary: null
  };
}

export async function analyzeComplaintRisk() {
  return {
    ...analyzeComplaintRiskLocal(),
    processingMetadata: {
      used: false, provider: 'disabled', model: null, disclosureVersion: null,
      consentVersion: null, consentedAt: null, resultValidationState: 'local'
    }
  };
}
