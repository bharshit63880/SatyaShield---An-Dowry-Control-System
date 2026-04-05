import { mockNgoDirectory } from '../data/mock-ngos.js';

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function scoreNgoMatch(ngo, approximateLocation) {
  if (!approximateLocation) {
    return 0;
  }

  const city = normalize(approximateLocation.city);
  const district = normalize(approximateLocation.district);

  let score = 0;

  if (city && ngo.servedCities.some((entry) => normalize(entry) === city)) {
    score += 70;
  }

  if (district && ngo.servedDistricts.some((entry) => normalize(entry) === district)) {
    score += 80;
  }

  if (city && normalize(ngo.city) === city) {
    score += 15;
  }

  if (district && normalize(ngo.district) === district) {
    score += 20;
  }

  return score;
}

function serializeAssignedNgo(ngo, matchedOn) {
  return {
    ngoId: ngo.ngoId,
    name: ngo.name,
    city: ngo.city,
    district: ngo.district,
    coverageLabel: ngo.coverageLabel,
    contactPhone: ngo.contactPhone,
    contactEmail: ngo.contactEmail,
    assignmentSource: 'mock-directory',
    matchedOn,
    assignedAt: new Date()
  };
}

export async function assignNgoForComplaint({ approximateLocation }) {
  const scoredNgos = mockNgoDirectory
    .slice(0, -1)
    .map((ngo) => ({
      ngo,
      score: scoreNgoMatch(ngo, approximateLocation)
    }))
    .sort((left, right) => right.score - left.score);

  const bestMatch = scoredNgos[0];

  if (bestMatch && bestMatch.score > 0) {
    const matchedOn =
      bestMatch.score >= 80
        ? 'district'
        : bestMatch.score >= 70
          ? 'city'
          : 'regional';

    return serializeAssignedNgo(bestMatch.ngo, matchedOn);
  }

  const fallbackNgo = mockNgoDirectory[mockNgoDirectory.length - 1];
  return serializeAssignedNgo(fallbackNgo, 'fallback');
}

