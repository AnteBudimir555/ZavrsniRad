// WHY THIS FILE EXISTS
// --------------------
// Typed wrapper around /api/admin/users. Used by the user-management page
// and (for the username list only) by the assign-incident dialog.

import { apiClient } from './client';

export interface UserSummary {
  id: number;
  username: string;
  role: string;
  active: boolean;
  createdAt: string;
}

export const usersApi = {
  listAll: async (): Promise<UserSummary[]> =>
    (await apiClient.get('/admin/users')).data,

  setActive: async (id: number, active: boolean): Promise<UserSummary> =>
    (await apiClient.patch(`/admin/users/${id}`, { active })).data,
};
