const KEYWORD_WEIGHTS = [
  { keyword: 'dowry', weight: 18 },
  { keyword: 'dahej', weight: 18 },
  { keyword: 'harassment', weight: 10 },
  { keyword: 'mental torture', weight: 12 },
  { keyword: 'abuse', weight: 12 },
  { keyword: 'violence', weight: 16 },
  { keyword: 'beating', weight: 16 },
  { keyword: 'threat', weight: 14 },
  { keyword: 'threatening', weight: 14 },
  { keyword: 'kill', weight: 24 },
  { keyword: 'murder', weight: 28 },
  { keyword: 'burn', weight: 20 },
  { keyword: 'suicide', weight: 24 },
  { keyword: 'forced', weight: 10 },
  { keyword: 'pressure', weight: 8 },
  { keyword: 'demand', weight: 10 },
  { keyword: 'money', weight: 6 },
  { keyword: 'cash', weight: 6 },
  { keyword: 'car', weight: 6 },
  { keyword: 'gold', weight: 8 },
  { keyword: 'jewellery', weight: 8 },
  { keyword: 'bride', weight: 6 },
  { keyword: 'marriage', weight: 6 },
  { keyword: 'sasural', weight: 8 },
  { keyword: 'in-laws', weight: 8 },
  { keyword: 'husband', weight: 8 },
  { keyword: 'stridhan', weight: 10 },
  { keyword: '498a', weight: 16 },
  { keyword: 'domestic violence', weight: 16 },
  { keyword: 'police', weight: 6 },
  { keyword: 'helpline', weight: 6 }
];

const HIGH_RISK_ESCALATION_TERMS = ['kill', 'murder', 'burn', 'suicide', 'violence', 'beating'];

function normalizeText(text) {
  return String(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function analyzeComplaintRisk(text) {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return {
      detectedKeywords: [],
      riskScore: 0,
      riskLevel: 'low'
    };
  }

  const detectedKeywords = [];
  let riskScore = 0;

  for (const { keyword, weight } of KEYWORD_WEIGHTS) {
    if (normalizedText.includes(keyword)) {
      detectedKeywords.push(keyword);
      riskScore += weight;
    }
  }

  if (detectedKeywords.length >= 4) {
    riskScore += 10;
  }

  if (HIGH_RISK_ESCALATION_TERMS.some((term) => normalizedText.includes(term))) {
    riskScore += 12;
  }

  const boundedScore = Math.min(riskScore, 100);

  let riskLevel = 'low';
  if (boundedScore >= 60) {
    riskLevel = 'high';
  } else if (boundedScore >= 25) {
    riskLevel = 'medium';
  }

  return {
    detectedKeywords,
    riskScore: boundedScore,
    riskLevel
  };
}

