import { api } from "./client";
import type { TeamMember, TeamRole, TeamRoleInfo } from "@/types/api";

export interface TeamOwner {
  user_id: string;
  name?: string | null;
  email?: string | null;
}

interface TeamListResponse {
  members: TeamMember[];
  total: number;
  owner: TeamOwner | null;
}

interface TeamMemberResponse {
  success: boolean;
  member: TeamMember;
}

export const teamApi = {
  list: async (businessId: string): Promise<TeamMember[]> => {
    const res = await api.get<TeamListResponse>(`/businesses/${businessId}/team`);
    return res.members;
  },

  /** Members plus the business owner (who isn't a team row). */
  overview: async (businessId: string): Promise<{ members: TeamMember[]; owner: TeamOwner | null }> => {
    const res = await api.get<TeamListResponse>(`/businesses/${businessId}/team`);
    return { members: res.members, owner: res.owner };
  },

  /** The roles a member can hold and what each may and may not do, straight from the backend. */
  roles: async (businessId: string): Promise<TeamRoleInfo[]> => {
    const res = await api.get<{ roles: TeamRoleInfo[] }>(`/businesses/${businessId}/team/roles`);
    return res.roles;
  },

  add: async (businessId: string, input: { email?: string; user_id?: string; role: TeamRole }): Promise<TeamMember> => {
    const res = await api.post<TeamMemberResponse>(`/businesses/${businessId}/team`, input);
    return res.member;
  },

  updateRole: async (businessId: string, userId: string, role: TeamRole): Promise<TeamMember> => {
    const res = await api.patch<TeamMemberResponse>(`/businesses/${businessId}/team/${userId}`, { role });
    return res.member;
  },

  remove: (businessId: string, userId: string) => api.delete<void>(`/businesses/${businessId}/team/${userId}`),
};
