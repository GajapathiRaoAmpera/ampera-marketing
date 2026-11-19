"use client";

import { useState } from "react";
import { instagramAutomationsApi, type InstagramAutomation } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Button, Modal, Switch } from "@/components/ui";
import { recipeLabel } from "./AutomationBuilder";
import { EVENT_ICON, IconTile } from "./icons";
import { apiErrorMessage } from "./media";
import styles from "./workspace.module.scss";


function where(item: InstagramAutomation): string {
  if (item.scope.type === "specific") return `${item.scope.media_ids.length} selected ${item.scope.media_ids.length === 1 ? "post" : "posts"}`;
  if (item.scope.type === "next") return item.scope.bound_media_id ? "Your latest post" : "Waiting for your next post";
  if (item.trigger.type === "comment") return `All ${item.scope.surfaces.map((s) => (s === "post" ? "posts" : "reels")).join(" & ")}`;
  return "Everywhere";
}

interface AutomationsTabProps {
  businessId: string;
  automations: InstagramAutomation[];
  canBuild: boolean;
  onNew: () => void;
  onEdit: (item: InstagramAutomation) => void;
  onChanged: () => void;
}

export function AutomationsTab({ businessId, automations, canBuild, onNew, onEdit, onChanged }: AutomationsTabProps) {
  const { show } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<InstagramAutomation | null>(null);

  async function run(item: InstagramAutomation, action: "activate" | "pause" | "duplicate" | "delete") {
    setBusy(`${item.id}:${action}`);
    try {
      if (action === "activate") await instagramAutomationsApi.activate(businessId, item.id);
      if (action === "pause") await instagramAutomationsApi.pause(businessId, item.id);
      if (action === "duplicate") await instagramAutomationsApi.duplicate(businessId, item.id);
      if (action === "delete") await instagramAutomationsApi.remove(businessId, item.id);
      show(
        action === "activate" ? `“${item.name}” is live.` : action === "pause" ? `“${item.name}” is turned off.` : action === "duplicate" ? "Copy created as a draft." : "Automation deleted.",
        "success"
      );
      onChanged();
    } catch (error) {
      show(apiErrorMessage(error, "Couldn't update this automation."), "error");
    } finally {
      setBusy(null);
      setDeleting(null);
    }
  }

  if (automations.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <IconTile name="bot" tone="violet" size="lg" />
          <h3>No automations yet</h3>
          <p>Automations reply to comments and messages for you, around the clock, without any AI if you don&apos;t want it.</p>
          {canBuild && (
            <Button size="lg" onClick={onNew}>
              + New automation
            </Button>
          )}
        </div>
      </div>
    );
  }

  const live = automations.filter((item) => item.status === "active");
  const sorted = [...live, ...automations.filter((item) => item.status !== "active")];

  return (
    <div className={styles.panel}>
      <div className={styles.sectionTitle}>
        <h3>
          Your automations <span className={styles.muted}>· {live.length} live</span>
        </h3>
        {canBuild && (
          <Button variant="secondary" size="sm" onClick={onNew}>
            + New
          </Button>
        )}
      </div>
      <div className={styles.list}>
        {sorted.map((item) => {
          const isLive = item.status === "active";
          const publicReply = item.actions.find((action) => action.type === "public_reply");
          const variations = publicReply?.variations?.length ?? (publicReply ? 1 : 0);
          return (
            <div key={item.id} className={styles.automation}>
              <IconTile {...(EVENT_ICON[item.trigger.type] ?? EVENT_ICON.comment)} />
              <div className={styles.automationText}>
                <strong title={item.name}>{item.name}</strong>
                <div className={styles.automationMeta}>
                  <span>{recipeLabel(item.trigger.type)}</span>
                  <span>· {where(item)}</span>
                  <span>· {item.trigger.keywords.length ? item.trigger.keywords.map((k) => `“${k}”`).join(", ") : "Any message"}</span>
                  {variations > 0 && <span>· {variations} reply variations</span>}
                  {item.actions.some((action) => action.type === "route_ai") && <span>· AI continues</span>}
                </div>
              </div>
              <div className={styles.automationActions}>
                <label className={`${styles.statusSwitch} ${isLive ? styles.live : styles.draft}`}>
                  <Switch
                    checked={isLive}
                    disabled={!canBuild || Boolean(busy)}
                    onChange={(checked) => void run(item, checked ? "activate" : "pause")}
                    aria-label={isLive ? "Turn off" : "Turn on"}
                  />
                  {isLive ? "Live" : item.status === "draft" ? "Draft" : "Off"}
                </label>
                {canBuild && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => onEdit(item)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" isLoading={busy === `${item.id}:duplicate`} onClick={() => void run(item, "duplicate")}>
                      Duplicate
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(item)}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this automation?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button variant="danger" isLoading={Boolean(busy)} onClick={() => deleting && void run(deleting, "delete")}>
              Delete
            </Button>
          </>
        }
      >
        <p className={styles.muted}>“{deleting?.name}” will stop replying immediately. Its past activity stays in your numbers.</p>
      </Modal>
    </div>
  );
}
