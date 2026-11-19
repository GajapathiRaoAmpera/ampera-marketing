import type { BusinessRole, TeamRole } from "@/types/api";

// Mirrors app/core/roles.py on the backend: viewer < agent < manager < admin < owner.
// The backend enforces these; the UI uses them only to hide what a person
// can't use, so nobody lands on a page full of actions that will be refused.
const RANK: Record<BusinessRole, number> = { viewer: 1, agent: 2, manager: 3, admin: 4, owner: 5 };

export const ROLE_LABELS: Record<BusinessRole, string> = {
  viewer: "Viewer",
  agent: "Support agent",
  manager: "Manager",
  admin: "Admin",
  owner: "Owner",
};

export function roleAtLeast(role: BusinessRole | null | undefined, min: BusinessRole): boolean {
  return role ? RANK[role] >= RANK[min] : false;
}

export const ASSIGNABLE_ROLES: TeamRole[] = ["viewer", "agent", "manager", "admin"];
