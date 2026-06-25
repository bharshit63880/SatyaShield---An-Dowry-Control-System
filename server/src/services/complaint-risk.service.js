import { OpenAI } from 'openai';
import { env } from '../config/env.js';

const openai = env.openaiApiKey ? new OpenAI({ apiKey: env.openaiApiKey }) : null;

const KEYWORD_WEIGHTS = [
  { keyword: 'dowry', weight: 18, category: 'dowry' },
  { keyword: 'dahej', weight: 18, category: 'dowry' },
  { keyword: 'harassment', weight: 10, category: 'harassment' },
  { keyword: 'mental torture', weight: 12, category: 'harassment' },
  { keyword: 'abuse', weight: 12, category: 'violence' },
  { keyword: 'violence', weight: 16, category: 'violence' },
  { keyword: 'beating', weight: 16, category: 'violence' },
  { keyword: 'threat', weight: 14, category: 'harassment' },
  { keyword: 'threatening', weight: 14, category: 'harassment' },
  { keyword: 'kill', weight: 24, category: 'violence' },
  { keyword: 'murder', weight: 28, category: 'violence' },
  { keyword: 'burn', weight: 20, category: 'violence' },
  { keyword: 'suicide', weight: 24, category: 'suicide' },
  { keyword: 'forced', weight: 10, category: 'harassment' },
  { keyword: 'pressure', weight: 8, category: 'harassment' },
  { keyword: 'demand', weight: 10, category: 'dowry' },
  { keyword: 'money', weight: 6, category: 'dowry' },
  { keyword: 'cash', weight: 6, category: 'dowry' },
  { keyword: 'car', weight: 6, category: 'dowry' },
  { keyword: 'gold', weight: 8, category: 'dowry' },
  { keyword: 'jewellery', weight: 8, category: 'dowry' },
  { keyword: 'bride', weight: 6, category: 'dowry' },
  { keyword: 'marriage', weight: 6, category: 'dowry' },
  { keyword: 'sasural', weight: 8, category: 'harassment' },
  { keyword: 'in-laws', weight: 8, category: 'harassment' },
  { keyword: 'husband', weight: 8, category: 'harassment' },
  { keyword: 'stridhan', weight: 10, category: 'dowry' },
  { keyword: '498a', weight: 16, category: 'harassment' },
  { keyword: 'domestic violence', weight: 16, category: 'violence' },
  { keyword: 'police', weight: 6, category: 'harassment' },
  { keyword: 'helpline', weight: 6, category: 'harassment' }
];

const HIGH_RISK_ESCALATION_TERMS = ['kill', 'murder', 'burn', 'suicide', 'violence', 'beating'];

function normalizeText(text) {
  return String(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Local Fallback Algorithm
export function analyzeComplaintRiskLocal(text) {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return {
      detectedKeywords: [],
      riskScore: 0,
      riskLevel: 'low',
      indicators: {
        dowryHarassment: false,
        suicideRisk: false,
        domesticViolence: false
      },
      escalationRecommendation: 'None. Complete description first.',
      threatSummary: 'No description text provided.'
    };
  }

  const detectedKeywords = [];
  let riskScore = 0;

  let hasDowry = false;
  let hasSuicide = false;
  let hasViolence = false;

  for (const { keyword, weight, category } of KEYWORD_WEIGHTS) {
    if (normalizedText.includes(keyword)) {
      detectedKeywords.push(keyword);
      riskScore += weight;

      if (category === 'dowry') hasDowry = true;
      if (category === 'suicide') hasSuicide = true;
      if (category === 'violence') hasViolence = true;
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

  let escalationRecommendation = 'Routine NGO assignment and operator review.';
  if (riskLevel === 'high') {
    escalationRecommendation = 'Immediate escalation to designated investigators and local NGO coordinators due to high-risk keywords.';
  } else if (hasSuicide) {
    escalationRecommendation = 'Urgent crisis helpline support recommendation and mental health NGO dispatch.';
  }

  return {
    detectedKeywords,
    riskScore: boundedScore,
    riskLevel,
    indicators: {
      dowryHarassment: hasDowry || normalizedText.includes('dowry') || normalizedText.includes('dahej'),
      suicideRisk: hasSuicide || normalizedText.includes('suicide') || normalizedText.includes('kill myself'),
      domesticViolence: hasViolence || normalizedText.includes('abuse') || normalizedText.includes('beat') || normalizedText.includes('violence')
    },
    escalationRecommendation,
    threatSummary: `Local engine scanned ${detectedKeywords.length} keywords. Level: ${riskLevel}.`
  };
}

// AI-based Risk Analysis with Fallback
export async function analyzeComplaintRisk(text) {
  if (!openai) {
    console.log('[AI RISK ENGINE] OpenAI not configured. Using local rule fallback.');
    return analyzeComplaintRiskLocal(text);
  }

  try {
    const response = await openai.chat.completions.create({
      model: env.openaiModel || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert Anti-Dowry triage AI. Analyze the complaint description text for security operations and return a JSON object ONLY matching this schema:
{
  "detectedKeywords": ["list", "of", "related", "terms"],
  "riskScore": 75, // 0 to 100 integer
  "riskLevel": "high", // "low", "medium", or "high"
  "indicators": {
    "dowryHarassment": true, // boolean
    "suicideRisk": false, // boolean
    "domesticViolence": true // boolean
  },
  "escalationRecommendation": "text suggestion details",
  "threatSummary": "brief single line overview"
}`
        },
        {
          role: 'user',
          content: text || 'No description provided.'
        }
      ],
      response_format: { type: 'json_object' }
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    return {
      detectedKeywords: parsed.detectedKeywords || [],
      riskScore: typeof parsed.riskScore === 'number' ? parsed.riskScore : 0,
      riskLevel: ['low', 'medium', 'high'].includes(parsed.riskLevel) ? parsed.riskLevel : 'low',
      indicators: {
        dowryHarassment: !!parsed.indicators?.dowryHarassment,
        suicideRisk: !!parsed.indicators?.suicideRisk,
        domesticViolence: !!parsed.indicators?.domesticViolence
      },
      escalationRecommendation: parsed.escalationRecommendation || 'Review case timeline.',
      threatSummary: parsed.threatSummary || 'AI analysis completed.'
    };
  } catch (error) {
    console.error('[AI RISK ENGINE] OpenAI API error, falling back to local analyzer:', error.message);
    return analyzeComplaintRiskLocal(text);
  }
}
