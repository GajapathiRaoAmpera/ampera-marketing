"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  instagramAutomationsApi,
  ApiError,
  type InstagramConnection,
  type InstagramPost,
  type InstagramPublishOverview,
} from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { EmptyState, Select, Skeleton, Tabs } from "@/components/ui";
import { PublishComposer } from "./publish/PublishComposer";
import { PostCalendar, PostList } from "./publish/PostViews";
import styles from "./InstagramPublishPanel.module.scss";

type TabKey = "create" | "scheduled" | "drafts" | "posted" | "calendar";

const REFRESH_INTERVAL_MS = 20000;

export function InstagramPublishPanel({ businessId }: { businessId: string }) {
  const { show } = useToast();
  const [connections, setConnections] = useState<InstagramConnection[]>([]);
  const [connectionId, setConnectionId] = useState<string>("");
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);

  const [tab, setTab] = useState<TabKey>("create");
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [overview, setOverview] = useState<InstagramPublishOverview | null>(null);
  const [editing, setEditing] = useState<InstagramPost | null>(null);
  // Bumped to remount the composer with a clean slate.
  const [composerKey, setComposerKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Deferred so the first setState doesn't run synchronously in the effect body.
    const timer = window.setTimeout(() => {
      setIsLoadingConnections(true);
      instagramAutomationsApi
        .connections(businessId)
        .then((list) => {
          if (cancelled) return;
          setConnections(list);
          setConnectionId((current) => current || list[0]?.id || "");
        })
        .catch(() => {
          if (!cancelled) setConnections([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoadingConnections(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [businessId]);

  const refreshPosts = useCallback(() => {
    instagramAutomationsApi
      .posts(businessId)
      .then(setPosts)
      .catch(() => undefined);
  }, [businessId]);

  useEffect(() => {
    if (!connectionId) return;
    let cancelled = false;
    const timer = window.setTimeout(refreshPosts, 0);
    instagramAutomationsApi
      .publishOverview(businessId, connectionId)
      .then((result) => {
        if (!cancelled) setOverview(result);
      })
      .catch(() => {
        if (!cancelled) setOverview(null);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [businessId, connectionId, refreshPosts]);

  const accountPosts = useMemo(() => posts.filter((post) => post.connection_id === connectionId), [posts, connectionId]);
  const scheduled = useMemo(
    () => accountPosts.filter((post) => post.status === "scheduled").sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? "")),
    [accountPosts]
  );
  const drafts = useMemo(() => accountPosts.filter((post) => post.status === "draft"), [accountPosts]);
  const posted = useMemo(() => accountPosts.filter((post) => ["published", "failed", "publishing"].includes(post.status)), [accountPosts]);

  // Scheduled and in-flight posts change on the server, keep the lists current.
  const hasPending = scheduled.length > 0 || posted.some((post) => post.status === "publishing");
  useEffect(() => {
    if (!hasPending) return;
    const timer = window.setInterval(refreshPosts, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [hasPending, refreshPosts]);

  function resetComposer() {
    setEditing(null);
    setComposerKey((key) => key + 1);
  }

  function handleEdit(post: InstagramPost) {
    setEditing(post);
    setComposerKey((key) => key + 1);
    setTab("create");
  }

  async function handlePublishNow(post: InstagramPost) {
    setBusyId(post.id);
    try {
      await instagramAutomationsApi.publishPostNow(businessId, post.id);
      show("Publishing now. It will show as published in a moment.", "success");
      setTab("posted");
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't publish this post.", "error");
    } finally {
      setBusyId(null);
      refreshPosts();
    }
  }

  async function handleDelete(post: InstagramPost) {
    const question =
      post.status === "scheduled"
        ? "Cancel this scheduled post? It will not be published."
        : post.status === "published"
          ? "Hide this post from the list? It stays live on Instagram."
          : "Delete this post?";
    if (!window.confirm(question)) return;
    setBusyId(post.id);
    try {
      await instagramAutomationsApi.deletePost(businessId, post.id);
      if (editing?.id === post.id) resetComposer();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't remove this post.", "error");
    } finally {
      setBusyId(null);
      refreshPosts();
    }
  }

  function handleSaved(_post: InstagramPost, action: "draft" | "schedule") {
    show(action === "draft" ? "Draft saved." : "Post scheduled.", "success");
    resetComposer();
    refreshPosts();
    setTab(action === "draft" ? "drafts" : "scheduled");
  }

  if (isLoadingConnections) {
    return <Skeleton height={320} />;
  }

  const connection = connections.find((item) => item.id === connectionId);
  if (!connection) {
    return (
      <EmptyState
        title="Connect Instagram first"
        description="You'll need a connected Instagram Professional account before you can publish."
      />
    );
  }

  const withCount = (label: string, count: number) => (count > 0 ? `${label} (${count})` : label);
  const listProps = { busyId, onEdit: handleEdit, onPublishNow: handlePublishNow, onDelete: handleDelete };

  return (
    <div className={styles.wrap}>
      <div className={styles.topBar}>
        <Tabs<TabKey>
          variant="underline"
          value={tab}
          onChange={setTab}
          options={[
            { value: "create", label: editing ? "Edit post" : "Create" },
            { value: "scheduled", label: withCount("Scheduled", scheduled.length) },
            { value: "drafts", label: withCount("Drafts", drafts.length) },
            { value: "posted", label: "Posted" },
            { value: "calendar", label: "Calendar" },
          ]}
        />
        {connections.length > 1 && (
          <Select
            aria-label="Publish as"
            value={connectionId}
            onChange={(e) => {
              setConnectionId(e.target.value);
              resetComposer();
            }}
            className={styles.connectionSelect}
          >
            {connections.map((conn) => (
              <option key={conn.id} value={conn.id}>@{conn.instagram_username}</option>
            ))}
          </Select>
        )}
      </div>

      {/* Kept mounted so switching tabs never loses a post in progress. */}
      <div hidden={tab !== "create"}>
        <PublishComposer
          key={`${connectionId}-${composerKey}`}
          businessId={businessId}
          connection={connection}
          overview={overview}
          editing={editing}
          onSaved={handleSaved}
          onPostsChanged={refreshPosts}
          onReset={resetComposer}
        />
      </div>

      {tab === "scheduled" && (
        <PostList posts={scheduled} emptyTitle="Nothing scheduled" emptyDescription="Create a post and choose Schedule to queue it for later." {...listProps} />
      )}
      {tab === "drafts" && (
        <PostList posts={drafts} emptyTitle="No drafts" emptyDescription="Save a post as a draft to finish it later." {...listProps} />
      )}
      {tab === "posted" && (
        <PostList posts={posted} emptyTitle="Nothing posted yet" emptyDescription="Posts you publish from here show up in this list." {...listProps} />
      )}
      {tab === "calendar" && <PostCalendar posts={accountPosts} onEdit={handleEdit} />}
    </div>
  );
}
