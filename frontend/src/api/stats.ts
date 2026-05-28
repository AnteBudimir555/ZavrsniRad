import { apiClient } from './client';

export interface StatsResponse {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
}

export const statsApi = {
  get: async (): Promise<StatsResponse> => (await apiClient.get('/admin/stats')).data,
};
