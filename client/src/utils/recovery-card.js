export function buildRecoveryCardContent({ caseId, accessSecret, createdAt }) {
  return [
    'SATYASHIELD REPORTER RECOVERY CARD',
    '',
    `Case ID: ${caseId}`,
    `Reporter access secret: ${accessSecret}`,
    `Created: ${new Date(createdAt).toLocaleString()}`,
    '',
    'Keep this card somewhere private and safe.',
    'You need both values to unlock your case.',
    'Do not share this card or send it through an untrusted channel.',
    'SatyaShield cannot automatically recover this access secret.'
  ].join('\n');
}
