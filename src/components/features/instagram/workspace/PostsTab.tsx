"use client";

import { useCallback, useState } from "react";
import { instagramAutomationsApi, type InstagramAutomation, type InstagramCommentMetrics, type InstagramMedia } from "@/lib/api";
import { Button } from "@/components/ui";
import { LiveStories, StoryCountdown } from "./LiveStories";
import { MediaBrowser } from "./MediaBrowser";
import { MediaViewer } from "./MediaViewer";
import { Icon } from "./icons";
import { mediaKind } from "./media";
import styles from "./workspace.module.scss";

/** Live comment automations that would answer a comment on this post. */
function automationsFor(item: InstagramMedia, automations: InstagramAutomation[]): InstagramAutomation[] {
  const surface = mediaKind(item) === "reel" ? "reel" : "post";
  return automations.filter((automation) => {
    if (automation.trigger.type !== "comment") return false;
    if (automation.scope.type === "specific") return automation.scope.media_ids.includes(item.id);
    if (automation.scope.type === "next") return automation.scope.bound_media_id === item.id;
    return automation.scope.surfaces.length === 0 || automation.scope.surfaces.includes(surface);
  });
}

interface PostsTabProps {
  businessId: string;
  connectionId: string;
  username: string;
  avatarUrl?: string | null;
  automations: InstagramAutomation[];
  canBuild: boolean;
  onAutomate: (item: InstagramMedia) => void;
  onEdit: (item: InstagramAutomation) => void;
}

export function PostsTab({ businessId, connectionId, username, avatarUrl, automations, canBuild, onAutomate, onEdit }: PostsTabProps) {
  const [stats, setStats] = useState<Record<string, InstagramCommentMetrics>>({});
  const [open, setOpen] = useState<InstagramMedia | null>(null);
  const [openStory, setOpenStory] = useState<InstagramMedia | null>(null);

  // Load the comment numbers for each page of posts as it is shown.
  const loadStats = useCallback(
    (items: InstagramMedia[]) => {
      const ids = items.map((item) => item.id);
      if (ids.length === 0) return;
      instagramAutomationsApi
        .mediaMetrics(businessId, connectionId, ids)
        .then((result) => setStats((all) => ({ ...all, ...result.media })))
        .catch(() => undefined);
    },
    [businessId, connectionId]
  );

  const current = open ? stats[open.id] : undefined;
  const covering = open ? automationsFor(open, automations) : [];
  const liveCovering = covering.filter((item) => item.status === "active");

  return (
    <div className={styles.panel}>
      <LiveStories businessId={businessId} connectionId={connectionId} onOpen={setOpenStory} />
      <div className={styles.sectionTitle}>
        <h3>Your posts</h3>
        <span className={styles.muted}>Tap a post to see how its comments were handled (last 90 days).</span>
      </div>
      <MediaBrowser
        businessId={businessId}
        connectionId={connectionId}
        onOpen={setOpen}
        onPage={loadStats}
        renderOverlay={(item) => {
          const row = stats[item.id];
          return (
            <span className={styles.tileStats}>
              <span title="Comments on Instagram" className={styles.tileStat}>
                <Icon name="comment" size={13} /> {item.comments_count ?? 0}
              </span>
              {row && row.comments_received > 0 && (
                <span title="Answered by automations" className={styles.tileStat}>
                  <Icon name="check" size={13} style={{ strokeWidth: 2.6 }} /> {row.replied}
                </span>
              )}
              {row && row.missed > 0 && (
                <span title="Failed" className={styles.tileStat}>
                  <Icon name="alert" size={13} /> {row.missed}
                </span>
              )}
            </span>
          );
        }}
      />

      <MediaViewer item={openStory} onClose={() => setOpenStory(null)} username={username} avatarUrl={avatarUrl}>
        {openStory && <StoryCountdown item={openStory} />}
      </MediaViewer>

      <MediaViewer
        item={open}
        onClose={() => setOpen(null)}
        username={username}
        avatarUrl={avatarUrl}
        actions={
          open &&
          canBuild && (
            <Button
              leftIcon={<Icon name="bolt" size={16} />}
              onClick={() => {
                const item = open;
                setOpen(null);
                onAutomate(item);
              }}
            >
              Automate this post
            </Button>
          )
        }
      >
        {open && (
          <>
            <div className={styles.postStats}>
              <div>
                <strong>{current?.comments_received ?? 0}</strong>
                <span>Received</span>
              </div>
              <div>
                <strong>{current?.triggered ?? 0}</strong>
                <span>Triggered</span>
              </div>
              <div>
                <strong style={{ color: "var(--color-success-600)" }}>{current?.replied ?? 0}</strong>
                <span>Answered</span>
              </div>
              <div>
                <strong style={{ color: current?.missed ? "var(--color-danger-600)" : undefined }}>{current?.missed ?? 0}</strong>
                <span>Failed</span>
              </div>
              <div>
                <strong>{current?.not_matched ?? 0}</strong>
                <span>No match</span>
              </div>
              <div>
                <strong>{current?.removed ?? 0}</strong>
                <span>Removed</span>
              </div>
            </div>
            {current && current.pending > 0 && <p className={styles.muted}>{current.pending} still being answered.</p>}
            <div>
              <strong style={{ fontSize: "var(--font-size-sm)" }}>Automations on this post</strong>
              {covering.length === 0 ? (
                <p className={styles.muted}>None yet. Comments on this post aren&apos;t answered automatically.</p>
              ) : (
                <ul className={styles.miniList} style={{ marginTop: "var(--space-2)" }}>
                  {covering.map((automation) => (
                    <li key={automation.id}>
                      <span>{automation.name}</span>
                      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span className={automation.status === "active" ? styles.live : styles.draft} style={{ fontSize: "var(--font-size-xs)", fontWeight: 600 }}>
                          {automation.status === "active" ? "Live" : "Off"}
                        </span>
                        {canBuild && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setOpen(null);
                              onEdit(automation);
                            }}
                          >
                            Edit
                          </Button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {covering.length > 0 && liveCovering.length === 0 && <p className={styles.muted}>All of them are turned off.</p>}
            </div>
          </>
        )}
      </MediaViewer>
    </div>
  );
}
