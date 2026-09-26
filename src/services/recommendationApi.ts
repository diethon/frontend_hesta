import { featureRequest } from './featureApi';
import type { Recommendation } from '../types/recommendation';

const path = (homeId: string) => `/homes/${homeId}/recommendations`;

export const getRecommendations = (homeId: string) =>
  featureRequest<Recommendation[]>(path(homeId));

export const generateRecommendations = (homeId: string, from: string, to: string) =>
  featureRequest<Recommendation[]>(`${path(homeId)}/generate?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { method: 'POST' });

export const resolveRecommendation = (homeId: string, recommendationId: string, action: 'approve' | 'reject') =>
  featureRequest<Recommendation>(`${path(homeId)}/${recommendationId}/${action}`, { method: 'POST' });
