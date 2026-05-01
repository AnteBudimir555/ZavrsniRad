import { apiClient } from './client';

export interface UserSummary {
  id: number;
  username: string;
  role: string;
}

export const usersApi = {
  listAll: async (): Promise<UserSummary[]> => (await apiClient.get('/admin/users')).data,
};
