// WHY THIS FILE EXISTS
// --------------------
// Typed wrappers around the incident REST endpoints. Having one place where
// the shape of the backend responses is declared means TypeScript catches
// mismatches everywhere a field is consumed.

import { apiClient } from './client';

export type IncidentCategory = 'SAFETY' | 'IT' | 'FACILITY' | 'OTHER';
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export interface Incident {
  id: number;
  title: string;
  description: string | null;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  reporterUsername: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface CreateIncidentRequest {
  title: string;
  description: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
}

export const incidentsApi = {
  listAll: async (): Promise<Incident[]> => (await apiClient.get('/incidents')).data,
  listMine: async (): Promise<Incident[]> => (await apiClient.get('/incidents/mine')).data,
  get: async (id: number): Promise<Incident> => (await apiClient.get(`/incidents/${id}`)).data,
  create: async (req: CreateIncidentRequest): Promise<Incident> =>
    (await apiClient.post('/incidents', req)).data,
  updateStatus: async (id: number, status: IncidentStatus): Promise<Incident> =>
    (await apiClient.patch(`/incidents/${id}/status`, { status })).data,
};
