import { ApiError } from './ApiError.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parsePagination(query = {}) {
  const page = toPositiveInteger(query.page, DEFAULT_PAGE);
  const requestedLimit = toPositiveInteger(query.limit, DEFAULT_LIMIT);
  const limit = Math.min(requestedLimit, MAX_LIMIT);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

export function buildPaginationMeta({ total, page, limit }) {
  const pages = Math.ceil(total / limit) || 1;

  return {
    total,
    page,
    limit,
    pages,
    hasNextPage: page < pages,
    hasPreviousPage: page > 1
  };
}

export function parseSearch(query = {}, maxLength = 120) {
  return String(query.search ?? query.q ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

export function parseSort(query = {}, allowedSorts = {}, fallback = '-createdAt') {
  const rawSort = String(query.sort ?? fallback).trim() || fallback;
  const direction = rawSort.startsWith('-') ? -1 : 1;
  const requestedField = rawSort.replace(/^-/, '');
  const mappedField = allowedSorts[requestedField];

  if (!mappedField) {
    throw new ApiError(400, `Unsupported sort field: ${requestedField}`, {
      code: 'INVALID_SORT_FIELD',
      details: {
        allowed: Object.keys(allowedSorts)
      }
    });
  }

  return { [mappedField]: direction };
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

