"use client";

import { useState } from "react";
import { teamApi, ApiError } from "@/lib/api";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { useAsync } from "@/lib/hooks/useAsync";
import { useBusiness } from "@/context/BusinessContext";
import { useToast } from "@/context/ToastContext";
import { ROLE_LABELS } from "@/lib/permissions";
import { Avatar, Badge, Button, Card, EmptyState, Input, Select, Skeleton, Table } from "@/components/ui";
import { UsersIcon } from "@/components/layout/icons";
import type { TeamMember, TeamRole, TeamRoleInfo } from "@/types/api";
import styles from "@/app/(dashboard)/team/page.module.scss";
import { useEmbedded } from "@/components/layout/Embedded";

type Row = { kind: "owner"; user_id: string; name: string; email: string } | ({ kind: "member" } & TeamMember);

export default function TeamPage() {
  const embedded = useEmbedded();
  const { businessId, isLoading: businessLoading, hasNoBusinesses } = useActiveBusiness();
  const { role: myRole, can } = useBusiness();
  const { show } = useToast();

  const canManage = can("admin");
  const isOwner = myRole === "owner";

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("agent");
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { data: team, isLoading, refresh } = useAsync(
    () => (businessId ? teamApi.overview(businessId) : Promise.resolve({ members: [], owner: null })),
    [businessId]
  );
  const { data: roles } = useAsync(
    () => (businessId ? teamApi.roles(businessId) : Promise.resolve([] as TeamRoleInfo[])),
    [businessId]
  );

  // Only the owner can hand out, change or remove the Admin role (the backend
  // enforces it too), so everyone else isn't offered it.
  const assignable = (roles ?? []).filter((r) => isOwner || r.value !== "admin");
  const selectedInfo = (roles ?? []).find((r) => r.value === role);

  async function handleAdd() {
    if (!businessId || !email) return;
    setIsAdding(true);
    try {
      await teamApi.add(businessId, { email: email.trim(), role });
      show("Team member added.", "success");
      setEmail("");
      refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        show("No account found for that email. Ask them to register first.", "error");
      } else {
        show(err instanceof ApiError ? err.userMessage : "Couldn't add that team member.", "error");
      }
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: TeamRole) {
    if (!businessId) return;
    try {
      await teamApi.updateRole(businessId, userId, newRole);
      show("Role updated.", "success");
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't update role. Please try again.", "error");
    } finally {
      refresh();
    }
  }

  async function handleRemove(userId: string) {
    if (!businessId) return;
    setRemovingId(userId);
    try {
      await teamApi.remove(businessId, userId);
      show("Team member removed.", "default");
      refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't remove that team member.", "error");
    } finally {
      setRemovingId(null);
    }
  }

  if (businessLoading) return <Skeleton height={300} />;
  if (hasNoBusinesses || !businessId) {
    return <EmptyState title="Create a business first" description="Set up a business before inviting your team." />;
  }

  const rows: Row[] = [
    ...(team?.owner
      ? [{ kind: "owner" as const, user_id: team.owner.user_id, name: team.owner.name ?? "Owner", email: team.owner.email ?? "" }]
      : []),
    ...(team?.members ?? []).map((m) => ({ kind: "member" as const, ...m })),
  ];

  // A row's role can be edited by someone who manages the team, except that
  // an Admin's role is the owner's to change.
  const canEdit = (m: TeamMember) => canManage && (isOwner || m.role !== "admin");

  return (
    <div>
      {!embedded && <div className={styles.header}>
        <div>
          <div className={styles.title}>Team</div>
          <div className={styles.subtitle}>
            {canManage
              ? "Choose who can access this business and what they can do."
              : "Who works in this business and what each person can do."}
            {myRole && (
              <>
                {" "}
                Your role: <strong>{ROLE_LABELS[myRole]}</strong>.
              </>
            )}
          </div>
        </div>
      </div>}

      {canManage && (
        <Card style={{ marginBottom: "var(--space-5)" }}>
          <div className={styles.addForm}>
            <Input
              label="Email"
              placeholder="teammate@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ minWidth: 240 }}
            />
            <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as TeamRole)} style={{ minWidth: 180 }}>
              {assignable.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
            <Button onClick={handleAdd} isLoading={isAdding} disabled={!email}>
              Add member
            </Button>
          </div>
          {selectedInfo && (
            <p className={styles.roleHint}>
              <strong>{selectedInfo.label}:</strong> {selectedInfo.summary}
            </p>
          )}
          <p className={styles.roleHint}>They need an Ampera account already. Ask them to register with this email first.</p>
        </Card>
      )}

      <Card padding="none">
        {isLoading ? (
          <Skeleton height={200} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<UsersIcon size={24} />} title="No team members yet" description="Add teammates above to give them access." />
        ) : (
          <Table<Row>
            rows={rows}
            rowKey={(m) => m.user_id}
            columns={[
              {
                key: "member",
                header: "Member",
                render: (m) => (
                  <div className={styles.memberCell}>
                    <Avatar name={m.name} size="sm" />
                    <div>
                      <div className={styles.memberName}>{m.name}</div>
                      <div className={styles.memberEmail}>{m.email}</div>
                    </div>
                  </div>
                ),
              },
              {
                key: "role",
                header: "Role",
                width: "200px",
                render: (m) =>
                  m.kind === "owner" ? (
                    <Badge variant="brand">Owner</Badge>
                  ) : canEdit(m) ? (
                    <Select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.user_id, e.target.value as TeamRole)}
                      style={{ height: 32, fontSize: "var(--font-size-xs)" }}
                    >
                      {assignable.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Badge>{ROLE_LABELS[m.role]}</Badge>
                  ),
              },
              {
                key: "actions",
                header: "",
                width: "60px",
                render: (m) =>
                  m.kind === "owner" || !canEdit(m) ? null : (
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => handleRemove(m.user_id)}
                      disabled={removingId === m.user_id}
                      aria-label={`Remove ${m.name}`}
                    >
                      <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                        <path d="M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ),
              },
            ]}
          />
        )}
      </Card>

      {roles && roles.length > 0 && (
        <section className={styles.guide} aria-label="What each role can do">
          <h2 className={styles.guideTitle}>What each role can do</h2>
          <div className={styles.guideGrid}>
            {roles.map((r) => (
              <Card key={r.value}>
                <div className={styles.guideName}>{r.label}</div>
                <p className={styles.guideSummary}>{r.summary}</p>
                <ul className={styles.guideList}>
                  {r.can.map((line) => (
                    <li key={line} className={styles.guideCan}>
                      {line}
                    </li>
                  ))}
                  {r.cannot.map((line) => (
                    <li key={line} className={styles.guideCannot}>
                      {line}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
