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
  assignedToUsername: string | null;
  // ISO LocalDateTime, no zone (e.g. "2026-04-30T14:23:00") — when the incident actually happened.
  incidentTime: string;
  location: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export type AuditLogAction = 'INCIDENT_CREATED' | 'STATUS_CHANGED' | 'ASSIGNEE_CHANGED' | 'COMMENT_ADDED';

export interface AuditLog {
  id: number;
  actorUsername: string;
  action: AuditLogAction;
  incidentId: number;
  detail: string | null;
  occurredAt: string;
}

export interface Comment {
  id: number;
  body: string;
  authorUsername: string;
  incidentId: number;
  createdAt: string;
}

export interface IncidentFilters {
  status?: IncidentStatus;
  category?: IncidentCategory;
  severity?: IncidentSeverity;
}

/** Shape Spring returns for any paginated endpoint (Page<T> serialised by Jackson). */
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;   // 0-based current page index
  size: number;
}

export interface CreateIncidentRequest {
  title: string;
  description: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  // ISO LocalDateTime string accepted by Jackson, e.g. "2026-04-30T14:23:00".
  incidentTime: string;
  location?: string;
}

export const incidentsApi = {
  listAll: async (page = 0, size = 20, filters: IncidentFilters = {}): Promise<PageResponse<Incident>> =>
    (await apiClient.get('/incidents', { params: { page, size, ...filters } })).data,
  listMine: async (page = 0, size = 20, filters: IncidentFilters = {}): Promise<PageResponse<Incident>> =>
    (await apiClient.get('/incidents/mine', { params: { page, size, ...filters } })).data,
  get: async (id: number): Promise<Incident> => (await apiClient.get(`/incidents/${id}`)).data,
  create: async (req: CreateIncidentRequest): Promise<Incident> =>
    (await apiClient.post('/incidents', req)).data,
  updateStatus: async (id: number, status: IncidentStatus): Promise<Incident> =>
    (await apiClient.patch(`/incidents/${id}/status`, { status })).data,
  assign: async (id: number, assigneeUsername: string | null): Promise<Incident> =>
    (await apiClient.patch(`/incidents/${id}/assignee`, { assigneeUsername })).data,
  listAudit: async (incidentId: number): Promise<AuditLog[]> =>
    (await apiClient.get('/admin/audit', { params: { incidentId } })).data,
  addComment: async (incidentId: number, body: string): Promise<Comment> =>
    (await apiClient.post(`/incidents/${incidentId}/comments`, { body })).data,
  listComments: async (incidentId: number): Promise<Comment[]> =>
    (await apiClient.get(`/incidents/${incidentId}/comments`)).data,
  listAssigned: async (page = 0, size = 20, filters: IncidentFilters = {}): Promise<PageResponse<Incident>> =>
    (await apiClient.get('/incidents/assigned', { params: { page, size, ...filters } })).data,
};
