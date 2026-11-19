"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  instagramAutomationsApi,
  type CreateInstagramAutomation,
  type InstagramAction,
  type InstagramAutomation,
  type InstagramMedia,
  type InstagramScopeType,
  type InstagramSurface,
  type InstagramTriggerType,
} from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Button, InfoLabel, InfoTip, Input, Select, Skeleton, Switch, Textarea } from "@/components/ui";
import { StoryCountdown } from "./LiveStories";
import { MediaBrowser } from "./MediaBrowser";
import { MediaStage, MediaViewer } from "./MediaViewer";
import { EVENT_ICON, Icon, IconTile, type IconName } from "./icons";
import { KIND_LABEL, apiErrorMessage, mediaKind, mediaPreview } from "./media";
import styles from "./builder.module.scss";

// ── What can start an automation ────────────────────────────────────────────

interface Recipe {
  value: InstagramTriggerType;
  icon: IconName;
  label: string;
  detail: string;
}

const MAIN_RECIPES: Recipe[] = [
  { value: "comment", icon: "comment", label: "Comments on posts & reels", detail: "Someone comments (or uses a keyword) and gets a reply plus a DM." },
  { value: "dm", icon: "mail", label: "Direct messages", detail: "Reply when a DM, or a DM with a keyword, arrives." },
  { value: "story_reply", icon: "story", label: "Story replies", detail: "Reply when someone answers one of your Stories." },
];

const MORE_RECIPES: Recipe[] = [
  { value: "media_share", icon: "share", label: "Post shared in DM", detail: "Someone sends one of your posts or Reels to you in a DM." },
  { value: "story_mention", icon: "at", label: "Story mentions", detail: "You're mentioned in someone's Story." },
  { value: "story_reaction", icon: "heart", label: "Story reactions", detail: "Someone reacts to your Story with an emoji." },
  { value: "live_comment", icon: "live", label: "Live comments", detail: "Comments while you're live (private reply only)." },
  { value: "referral", icon: "link", label: "Link, QR code or ad", detail: "People who open a chat from your link, QR code or ad." },
];

const ALL_RECIPES = [...MAIN_RECIPES, ...MORE_RECIPES];

export function recipeLabel(type: InstagramTriggerType): string {
  return ALL_RECIPES.find((recipe) => recipe.value === type)?.label ?? type;
}

// ── Public reply wordings ───────────────────────────────────────────────────

export const MIN_PUBLIC_REPLIES = 5;

const DEFAULT_PUBLIC_REPLIES = [
  "Sent you a DM ✨",
  "Check your DMs 📩",
  "Just messaged you! 💌",
  "Details are in your inbox 🙌",
  "Sent! Take a look at your messages 👀",
];

const PUBLIC_REPLY_IDEAS = [
  "Replied in your DMs 💬",
  "Check your inbox for the link 🔗",
  "DM sent, enjoy! ✨",
  "Thanks! I've sent you the details 📬",
  "Look in your messages 😊",
  "Sent it over! 🚀",
  "All yours, check your DMs 🎁",
  "Done! The info is in your inbox 📥",
];

/** How many different wordings a list of replies can produce, counting {a|b} groups. */
function wordingCount(replies: string[]): number {
  const filled = Array.from(new Set(replies.map((item) => item.trim()).filter(Boolean)));
  if (filled.length !== 1) return filled.length;
  return Array.from(filled[0].matchAll(/\{([^{}]*\|[^{}]*)\}/g)).reduce(
    (count, match) => count * new Set(match[1].split("|").map((part) => part.trim())).size,
    1
  );
}

// ── Builder state ───────────────────────────────────────────────────────────

type ResponseFormat = "text" | "image" | "video" | "buttons";
type AfterReply = "end" | "ai" | "human";
type StepKey = "trigger" | "posts" | "keywords" | "replies" | "review";

const STEP_LABEL: Record<StepKey, string> = {
  trigger: "Trigger",
  posts: "Posts",
  keywords: "Keywords",
  replies: "Replies",
  review: "Review",
};

interface BranchDraft {
  id: string;
  keywords: string;
  message: string;
}

interface Draft {
  name: string;
  nameTouched: boolean;
  triggerType: InstagramTriggerType;
  surfaces: InstagramSurface[];
  scopeType: InstagramScopeType;
  selectedMedia: string[];
  anyInteraction: boolean;
  keywords: string[];
  matchMode: "any" | "all" | "exact" | "contains";
  exclusions: string;
  branches: BranchDraft[];
  publicReply: boolean;
  publicReplies: string[];
  privateReply: boolean;
  responseText: string;
  responseFormat: ResponseFormat;
  mediaUrl: string;
  buttonText: string;
  buttonUrl: string;
  reactToMention: boolean;
  afterReply: AfterReply;
  followerState: "any" | "follows" | "does_not_follow";
  contactState: "any" | "new" | "existing";
  cooldown: number;
  referralIds: string;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function splitList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function defaultName(type: InstagramTriggerType): string {
  return type === "comment" ? "Comment to DM" : recipeLabel(type);
}

function emptyDraft(aiAvailable: boolean, preset?: InstagramMedia | null): Draft {
  return {
    name: defaultName("comment"),
    nameTouched: false,
    triggerType: "comment",
    surfaces: ["post", "reel"],
    scopeType: preset ? "specific" : "all",
    selectedMedia: preset ? [preset.id] : [],
    anyInteraction: false,
    keywords: ["price", "link"],
    matchMode: "any",
    exclusions: "",
    branches: [],
    publicReply: true,
    publicReplies: [...DEFAULT_PUBLIC_REPLIES],
    privateReply: true,
    responseText: "Hey! Thanks for your interest 🙌 Here are the details you asked for:",
    responseFormat: "text",
    mediaUrl: "",
    buttonText: "Learn more",
    buttonUrl: "",
    reactToMention: false,
    afterReply: aiAvailable ? "ai" : "end",
    followerState: "any",
    contactState: "any",
    cooldown: 300,
    referralIds: "",
  };
}

/** Reads a saved automation back into the builder. */
function draftFrom(automation: InstagramAutomation): Draft {
  const actions = automation.actions;
  const find = (type: string) => actions.find((action) => action.type === type);
  const publicAction = find("public_reply");
  const privateAction = find("private_reply");
  const textAction = find("send_text");
  const mediaAction = find("send_media");
  const buttonsAction = find("send_buttons");
  const publicReplies = publicAction?.variations?.length
    ? publicAction.variations
    : publicAction?.text
      ? [publicAction.text]
      : [...DEFAULT_PUBLIC_REPLIES];
  let responseFormat: ResponseFormat = "text";
  if (mediaAction) responseFormat = mediaAction.media_type === "video" ? "video" : "image";
  else if (buttonsAction) responseFormat = "buttons";
  return {
    name: automation.name,
    nameTouched: true,
    triggerType: automation.trigger.type,
    surfaces: automation.scope.surfaces.length ? automation.scope.surfaces : ["post", "reel"],
    scopeType: automation.scope.type,
    selectedMedia: automation.scope.media_ids || [],
    anyInteraction: automation.trigger.keywords.length === 0,
    keywords: automation.trigger.keywords,
    matchMode: automation.trigger.match_mode,
    exclusions: automation.trigger.exclusions.join(", "),
    branches: automation.trigger.branches.map((branch) => {
      const override = branch.action_overrides.find((a) => ["private_reply", "send_text", "send_buttons"].includes(a.type));
      return { id: newId(), keywords: branch.keywords.join(", "), message: override?.text ?? "" };
    }),
    publicReply: Boolean(publicAction),
    publicReplies,
    privateReply: Boolean(privateAction) || automation.trigger.type !== "comment",
    responseText: privateAction?.text ?? buttonsAction?.text ?? textAction?.text ?? "",
    responseFormat,
    mediaUrl: mediaAction?.media_url ?? "",
    buttonText: buttonsAction?.buttons?.[0]?.title ?? "Learn more",
    buttonUrl: buttonsAction?.buttons?.[0]?.url ?? "",
    reactToMention: Boolean(find("react")),
    afterReply: actions.some((a) => a.type === "route_ai") ? "ai" : actions.some((a) => a.type === "human_handoff") ? "human" : "end",
    followerState: automation.conditions.follower_state,
    contactState: automation.conditions.contact_state,
    cooldown: automation.cooldown_seconds,
    referralIds: automation.trigger.referral_ids.join(", "),
  };
}

function needsPosts(type: InstagramTriggerType): boolean {
  return ["comment", "media_share", "story_reply", "story_reaction", "story_mention"].includes(type);
}

function isStory(type: InstagramTriggerType): boolean {
  return type === "story_reply" || type === "story_reaction" || type === "story_mention";
}

function isComment(type: InstagramTriggerType): boolean {
  return type === "comment" || type === "live_comment";
}

// ── Component ───────────────────────────────────────────────────────────────

interface AutomationBuilderProps {
  businessId: string;
  connectionId: string;
  username: string;
  avatarUrl?: string | null;
  /** AI replies are both allowed by the plan and switched on for this account. */
  aiAvailable: boolean;
  editing?: InstagramAutomation | null;
  presetMedia?: InstagramMedia | null;
  onClose: () => void;
  onSaved: () => void;
  onOpenSettings: () => void;
}

export function AutomationBuilder({
  businessId,
  connectionId,
  username,
  avatarUrl,
  aiAvailable,
  editing,
  presetMedia,
  onClose,
  onSaved,
  onOpenSettings,
}: AutomationBuilderProps) {
  const { show } = useToast();
  const [draft, setDraft] = useState<Draft>(() => (editing ? draftFrom(editing) : emptyDraft(aiAvailable, presetMedia)));
  const [step, setStep] = useState<StepKey>("trigger");
  const [showMore, setShowMore] = useState(() => MORE_RECIPES.some((recipe) => recipe.value === draft.triggerType));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<InstagramMedia | null>(null);
  const [mediaById, setMediaById] = useState<Record<string, InstagramMedia>>(() => (presetMedia ? { [presetMedia.id]: presetMedia } : {}));
  const [stories, setStories] = useState<InstagramMedia[] | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  const patch = useCallback((partial: Partial<Draft>) => setDraft((current) => ({ ...current, ...partial })), []);

  const steps = useMemo<StepKey[]>(
    () => (needsPosts(draft.triggerType) ? ["trigger", "posts", "keywords", "replies", "review"] : ["trigger", "keywords", "replies", "review"]),
    [draft.triggerType]
  );
  const stepIndex = Math.max(0, steps.indexOf(step));

  // Saved posts on an automation being edited: fetch the few we don't have yet.
  useEffect(() => {
    if (!isComment(draft.triggerType) && draft.triggerType !== "media_share") return;
    const missing = draft.selectedMedia.filter((id) => !mediaById[id]).slice(0, 12);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map((id) => instagramAutomationsApi.mediaItem(businessId, connectionId, id).catch(() => null))).then((items) => {
      if (cancelled) return;
      const found = items.filter((item): item is InstagramMedia => Boolean(item));
      if (found.length) setMediaById((all) => ({ ...all, ...Object.fromEntries(found.map((item) => [item.id, item])) }));
    });
    return () => {
      cancelled = true;
    };
    // Only when the selection changes, not on every cache update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, connectionId, draft.selectedMedia, draft.triggerType]);

  useEffect(() => {
    if (!isStory(draft.triggerType) || draft.scopeType !== "specific" || stories !== null) return;
    let cancelled = false;
    instagramAutomationsApi
      .stories(businessId, connectionId)
      .then((result) => !cancelled && setStories(result.data || []))
      .catch(() => !cancelled && setStories([]));
    return () => {
      cancelled = true;
    };
  }, [businessId, connectionId, draft.triggerType, draft.scopeType, stories]);

  const rememberPage = useCallback((items: InstagramMedia[]) => {
    setMediaById((all) => {
      const fresh = items.filter((item) => !all[item.id]);
      return fresh.length ? { ...all, ...Object.fromEntries(fresh.map((item) => [item.id, item])) } : all;
    });
  }, []);

  // ── Trigger ──

  function chooseTrigger(type: InstagramTriggerType) {
    if (type === draft.triggerType) return;
    patch({
      triggerType: type,
      name: draft.nameTouched ? draft.name : defaultName(type),
      scopeType: needsPosts(type) && draft.scopeType === "specific" && (isComment(type) || type === "media_share") ? "specific" : "all",
      selectedMedia: isComment(type) || type === "media_share" ? draft.selectedMedia : [],
      privateReply: true,
      anyInteraction: type === "story_reaction" || type === "story_mention" || type === "referral" ? true : draft.anyInteraction,
    });
  }

  // ── Posts ──

  function toggleMedia(id: string) {
    const selected = draft.selectedMedia.includes(id);
    patch({ selectedMedia: selected ? draft.selectedMedia.filter((item) => item !== id) : [...draft.selectedMedia, id] });
  }

  function toggleSurface(surface: InstagramSurface) {
    const has = draft.surfaces.includes(surface);
    if (has && draft.surfaces.length === 1) return;
    patch({ surfaces: has ? draft.surfaces.filter((item) => item !== surface) : [...draft.surfaces, surface] });
  }

  // ── Keywords ──

  function addKeywords(raw: string) {
    const words = splitList(raw).map((word) => word.toLowerCase());
    if (words.length === 0) return;
    patch({ keywords: Array.from(new Set([...draft.keywords, ...words])) });
    setKeywordInput("");
  }

  function onKeywordKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addKeywords(keywordInput);
    } else if (event.key === "Backspace" && !keywordInput && draft.keywords.length) {
      patch({ keywords: draft.keywords.slice(0, -1) });
    }
  }

  // ── Replies ──

  const filledReplies = draft.publicReplies.map((item) => item.trim()).filter(Boolean);
  const replyCount = wordingCount(draft.publicReplies);
  const usesPublicReply = draft.triggerType === "comment" && draft.publicReply;
  const sendsMessage = draft.triggerType !== "comment" || draft.privateReply;
  const unusedIdeas = PUBLIC_REPLY_IDEAS.filter((idea) => !filledReplies.includes(idea));

  function setReply(index: number, value: string) {
    patch({ publicReplies: draft.publicReplies.map((item, i) => (i === index ? value : item)) });
  }

  function addReply(value = "") {
    if (draft.publicReplies.length >= 20) return;
    patch({ publicReplies: [...draft.publicReplies, value] });
  }

  function removeReply(index: number) {
    patch({ publicReplies: draft.publicReplies.filter((_, i) => i !== index) });
  }

  // ── Validation per step ──

  const problems = useMemo((): Record<StepKey, string | null> => {
    const posts =
      draft.scopeType === "specific" && draft.selectedMedia.length === 0
        ? isStory(draft.triggerType)
          ? "Pick at least one Story, or choose “Any Story”."
          : "Pick at least one post, or choose “Any post or reel”."
        : null;
    const keywords = !draft.anyInteraction && draft.keywords.length === 0 ? "Add at least one keyword, or choose “Any comment”." : draft.branches.some((b) => Boolean(b.keywords.trim()) !== Boolean(b.message.trim())) ? "Each keyword reply needs both keywords and a message." : null;
    let replies: string[] = [];
    if (draft.triggerType === "comment" && !draft.publicReply && !draft.privateReply) replies.push("Turn on a public reply, a DM, or both.");
    if (usesPublicReply && replyCount < MIN_PUBLIC_REPLIES)
      replies.push(`Add ${MIN_PUBLIC_REPLIES - replyCount} more public ${MIN_PUBLIC_REPLIES - replyCount === 1 ? "reply" : "replies"} (at least ${MIN_PUBLIC_REPLIES}).`);
    if (sendsMessage && !draft.responseText.trim()) replies.push("Write the message to send.");
    if (sendsMessage && (draft.responseFormat === "image" || draft.responseFormat === "video") && !draft.mediaUrl.trim().startsWith("https://"))
      replies.push("Add an https:// link to the image or video.");
    if (sendsMessage && draft.responseFormat === "buttons" && !draft.buttonText.trim()) replies.push("Add the button text.");
    if (draft.responseFormat === "buttons" && draft.buttonUrl && !draft.buttonUrl.startsWith("https://")) replies.push("The button link must start with https://");
    replies = replies.slice(0, 1);
    const review = !draft.name.trim() ? "Give this automation a name." : null;
    return { trigger: null, posts, keywords, replies: replies[0] ?? null, review };
  }, [draft, replyCount, sendsMessage, usesPublicReply]);

  const firstProblem = steps.map((key) => problems[key]).find(Boolean) ?? null;

  // ── Payload ──

  function buildActions(text: string): InstagramAction[] {
    const actions: InstagramAction[] = [];
    const type = draft.triggerType;
    if (type === "comment" && draft.publicReply) {
      const variations = Array.from(new Set(filledReplies));
      actions.push({ type: "public_reply", text: variations[0], variations });
    }
    if (isComment(type)) {
      if (type === "live_comment" || draft.privateReply) actions.push({ type: "private_reply", text });
    } else if (draft.responseFormat === "image" || draft.responseFormat === "video") {
      if (text.trim()) actions.push({ type: "send_text", text: text.trim() });
      actions.push({ type: "send_media", media_url: draft.mediaUrl.trim(), media_type: draft.responseFormat });
    } else if (draft.responseFormat === "buttons") {
      actions.push({
        type: "send_buttons",
        text,
        buttons: [{ id: "primary_action", title: draft.buttonText.trim().slice(0, 20), ...(draft.buttonUrl ? { url: draft.buttonUrl.trim() } : {}) }],
      });
    } else {
      actions.push({ type: "send_text", text });
    }
    if (type === "story_mention" && draft.reactToMention) actions.push({ type: "react", emoji: "love" });
    const continues = type !== "comment" || draft.privateReply;
    if (continues && draft.afterReply === "ai" && aiAvailable) actions.push({ type: "route_ai" });
    if (continues && draft.afterReply === "human") actions.push({ type: "human_handoff" });
    return actions;
  }

  function buildPayload(): CreateInstagramAutomation {
    const type = draft.triggerType;
    return {
      connection_id: connectionId,
      name: draft.name.trim(),
      priority: 100,
      trigger: {
        type,
        keywords: draft.anyInteraction ? [] : draft.keywords,
        match_mode: draft.matchMode,
        exclusions: splitList(draft.exclusions),
        branches: draft.branches
          .filter((branch) => branch.keywords.trim() && branch.message.trim())
          .map((branch) => ({ keywords: splitList(branch.keywords), action_overrides: buildActions(branch.message.trim()) })),
        referral_sources: type === "referral" ? ["ads", "shortlink", "icebreaker"] : [],
        referral_ids: type === "referral" ? splitList(draft.referralIds) : [],
      },
      scope: {
        type: needsPosts(type) ? draft.scopeType : "all",
        media_ids: needsPosts(type) && draft.scopeType === "specific" ? draft.selectedMedia : [],
        media_types: [],
        surfaces: type === "comment" ? draft.surfaces : isStory(type) ? ["story"] : [],
      },
      conditions: { follower_state: draft.followerState, contact_state: draft.contactState, require_open_window: false },
      actions: buildActions(draft.responseText.trim()),
      cooldown_seconds: Math.max(0, Math.round(draft.cooldown || 0)),
    };
  }

  async function save(activate: boolean) {
    if (firstProblem) {
      const badStep = steps.find((key) => problems[key]);
      if (badStep) setStep(badStep);
      show(firstProblem, "warning");
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      const result = editing
        ? await instagramAutomationsApi.update(businessId, editing.id, payload)
        : await instagramAutomationsApi.create(businessId, payload);
      if (!result.validation.valid) {
        show(result.validation.errors[0] || "This automation needs a change before it can go live.", "warning");
        if (!editing) onSaved();
        return;
      }
      if (activate) {
        await instagramAutomationsApi.activate(businessId, result.automation.id);
        show(editing ? "Automation updated and live." : "Your automation is live 🎉", "success");
      } else {
        show("Saved as a draft. Turn it on whenever you're ready.", "success");
      }
      onSaved();
    } catch (error) {
      show(apiErrorMessage(error, "Couldn't save this automation. Please try again."), "error");
    } finally {
      setSaving(false);
    }
  }

  function goNext() {
    if (problems[step]) {
      show(problems[step]!, "warning");
      return;
    }
    const next = steps[stepIndex + 1];
    if (next) setStep(next);
  }

  function goBack() {
    const previous = steps[stepIndex - 1];
    if (previous) setStep(previous);
    else onClose();
  }

  const selectedItems = draft.selectedMedia.map((id) => mediaById[id]).filter((item): item is InstagramMedia => Boolean(item));
  const sampleReply = filledReplies.length ? filledReplies[previewIndex % filledReplies.length] : "";
  const sampleKeyword = draft.anyInteraction ? "Love this! 😍" : draft.keywords[0] ? `${draft.keywords[0].charAt(0).toUpperCase()}${draft.keywords[0].slice(1)}?` : "Price?";

  // ── Render ──

  return (
    <div className={styles.builder}>
      <header className={styles.top}>
        <div className={styles.topText}>
          <span className={styles.eyebrow}>{editing ? "Edit automation" : "New automation"}</span>
          <h2>{draft.name.trim() || defaultName(draft.triggerType)}</h2>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </header>

      <ol className={styles.progress} aria-label="Steps">
        {steps.map((key, index) => {
          const state = index < stepIndex ? styles.stepDone : index === stepIndex ? styles.stepCurrent : "";
          return (
            <li key={key} className={state}>
              <button type="button" onClick={() => (index <= stepIndex || !steps.slice(0, index).some((k) => problems[k])) && setStep(key)}>
                <span className={styles.stepDot}>{index < stepIndex ? <Icon name="check" size={13} style={{ strokeWidth: 3 }} /> : index + 1}</span>
                <span className={styles.stepName}>{STEP_LABEL[key]}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className={styles.body}>
        {step === "trigger" && (
          <section className={styles.section}>
            <h3>What should start this automation?</h3>
            <p className={styles.lead}>Most people start with comments: someone comments a keyword, and they get an instant reply and a DM.</p>
            <div className={styles.recipes}>
              {MAIN_RECIPES.map((recipe) => (
                <RecipeCard key={recipe.value} recipe={recipe} selected={draft.triggerType === recipe.value} onClick={() => chooseTrigger(recipe.value)} popular={recipe.value === "comment"} />
              ))}
            </div>
            <button type="button" className={styles.moreToggle} onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}>
              {showMore ? "Fewer options" : "More triggers"} <span className={showMore ? styles.chevOpen : styles.chev}>⌄</span>
            </button>
            {showMore && (
              <div className={styles.recipes}>
                {MORE_RECIPES.map((recipe) => (
                  <RecipeCard key={recipe.value} recipe={recipe} selected={draft.triggerType === recipe.value} onClick={() => chooseTrigger(recipe.value)} />
                ))}
              </div>
            )}
          </section>
        )}

        {step === "posts" && (
          <section className={styles.section}>
            <h3>{isStory(draft.triggerType) ? "Which Stories?" : draft.triggerType === "media_share" ? "Which shared posts?" : "Which posts and reels?"}</h3>
            <div className={styles.segmented} role="radiogroup">
              <Segment checked={draft.scopeType === "all"} onClick={() => patch({ scopeType: "all" })} title={isStory(draft.triggerType) ? "Any Story" : "Any post or reel"} detail="Including ones you post later" />
              <Segment checked={draft.scopeType === "specific"} onClick={() => patch({ scopeType: "specific" })} title={isStory(draft.triggerType) ? "Specific Stories" : "Specific posts"} detail="Only the ones you pick" />
              {draft.triggerType === "comment" && (
                <Segment checked={draft.scopeType === "next"} onClick={() => patch({ scopeType: "next" })} title="My next post" detail="Starts on whatever you post next" />
              )}
            </div>
            {draft.triggerType === "comment" && (
              <div className={styles.segmentHelp}>
                <span>What do these mean?</span>
                <InfoTip help="“Any post or reel” covers everything, including future posts. “Specific posts” only the ones you pick. “My next post” is handy before a launch: set it up now and it attaches itself to the first post or Reel you publish after turning it on." />
              </div>
            )}

            {draft.triggerType === "comment" && draft.scopeType !== "specific" && (
              <div className={styles.inlineRow}>
                <span className={styles.inlineLabel}>Work on</span>
                <Chip on={draft.surfaces.includes("post")} onClick={() => toggleSurface("post")}>Posts</Chip>
                <Chip on={draft.surfaces.includes("reel")} onClick={() => toggleSurface("reel")}>Reels</Chip>
              </div>
            )}

            {draft.scopeType === "specific" && !isStory(draft.triggerType) && (
              <>
                <div className={styles.selectedBar}>
                  <strong>
                    {draft.selectedMedia.length === 0 ? "Tap a post to preview and select it" : `${draft.selectedMedia.length} selected`}
                  </strong>
                  {selectedItems.length > 0 && (
                    <div className={styles.selectedStrip}>
                      {selectedItems.map((item) => (
                        <button key={item.id} type="button" className={styles.selectedThumb} onClick={() => setViewing(item)} title="Preview">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {mediaPreview(item) ? <img src={mediaPreview(item)} alt="" /> : <span>{KIND_LABEL[mediaKind(item)]}</span>}
                          <span
                            className={styles.removeThumb}
                            role="button"
                            aria-label="Remove"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleMedia(item.id);
                            }}
                          >
                            ×
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <MediaBrowser
                  businessId={businessId}
                  connectionId={connectionId}
                  selectedIds={draft.selectedMedia}
                  onOpen={setViewing}
                  onPage={rememberPage}
                />
              </>
            )}

            {draft.scopeType === "specific" && isStory(draft.triggerType) && (
              stories === null ? (
                <Skeleton height={200} />
              ) : stories.length === 0 ? (
                <p className={styles.hint}>You have no live Stories right now. Stories disappear after 24 hours, so choose “Any Story” to cover new ones.</p>
              ) : (
                <div className={styles.storyGrid}>
                  {stories.map((item) => (
                    <button key={item.id} type="button" className={`${styles.story} ${draft.selectedMedia.includes(item.id) ? styles.storySelected : ""}`} onClick={() => toggleMedia(item.id)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {mediaPreview(item) ? <img src={mediaPreview(item)} alt="" loading="lazy" /> : <span>Story</span>}
                      <span className={styles.storyLeft}>
                        <StoryCountdown item={item} />
                      </span>
                      {draft.selectedMedia.includes(item.id) && (
                        <span className={styles.storyCheck}>
                          <Icon name="check" size={14} style={{ strokeWidth: 3 }} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )
            )}
          </section>
        )}

        {step === "keywords" && (
          <section className={styles.section}>
            <h3>{draft.triggerType === "comment" ? "Which comments should it answer?" : "Which messages should it answer?"}</h3>
            <div className={styles.segmented} role="radiogroup">
              <Segment
                checked={!draft.anyInteraction}
                onClick={() => patch({ anyInteraction: false })}
                title="Only with keywords"
                detail={draft.triggerType === "comment" ? "e.g. someone comments “price”" : "e.g. a message saying “price”"}
              />
              <Segment checked={draft.anyInteraction} onClick={() => patch({ anyInteraction: true })} title={draft.triggerType === "comment" ? "Any comment" : "Anything"} detail="Answer everyone" />
            </div>

            {!draft.anyInteraction && (
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="ig-keywords">
                  <InfoLabel help="The automation only answers comments or messages containing one of these words. Press Enter after each word.">Keywords</InfoLabel>
                </label>
                <div className={styles.chipInput} onClick={() => document.getElementById("ig-keywords")?.focus()}>
                  {draft.keywords.map((word) => (
                    <span key={word} className={styles.keywordChip}>
                      {word}
                      <button type="button" aria-label={`Remove ${word}`} onClick={() => patch({ keywords: draft.keywords.filter((k) => k !== word) })}>
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    id="ig-keywords"
                    value={keywordInput}
                    onChange={(event) => setKeywordInput(event.target.value)}
                    onKeyDown={onKeywordKey}
                    onBlur={() => addKeywords(keywordInput)}
                    placeholder={draft.keywords.length ? "Add another…" : "Type a word and press Enter"}
                  />
                </div>
                <span className={styles.fieldHint}>Not case-sensitive. “price” also matches “PRICE?” but not “priceless”.</span>
              </div>
            )}

            <Disclosure open={showAdvanced} onToggle={() => setShowAdvanced((v) => !v)} label="Advanced matching">
              {!draft.anyInteraction && (
                <Select
                  label={<InfoLabel help="“Any one” answers if any keyword appears as a whole word. “All” needs every word. “Contains” also matches inside longer words. “Exactly” needs the whole message to be just the keyword.">How keywords match</InfoLabel>} value={draft.matchMode} onChange={(event) => patch({ matchMode: event.target.value as Draft["matchMode"] })}>
                  <option value="any">Any one of the words</option>
                  <option value="all">All of the words</option>
                  <option value="contains">Text contains the word anywhere</option>
                  <option value="exact">The whole message is exactly the word</option>
                </Select>
              )}
              <Input
                label={<InfoLabel help="Comments with any of these words are never answered, even when they contain a keyword. Useful for spam or giveaway entries.">Ignore messages containing (optional)</InfoLabel>} value={draft.exclusions} onChange={(event) => patch({ exclusions: event.target.value })} placeholder="giveaway, spam" />
              {draft.triggerType === "referral" && (
                <Input label="Only these referral codes (optional)" value={draft.referralIds} onChange={(event) => patch({ referralIds: event.target.value })} placeholder="summer-sale, ad-123" />
              )}
            </Disclosure>
          </section>
        )}

        {step === "replies" && (
          <section className={styles.section}>
            <h3>What should it reply?</h3>

            {draft.triggerType === "comment" && (
              <div className={styles.replyCard}>
                <div className={styles.replyHead}>
                  <div>
                    <strong>
                      <InfoLabel help="A short public reply under their comment, so others see you respond. Instagram flags accounts that post the same reply again and again, which is why at least 5 different wordings are needed.">Public reply under the comment</InfoLabel>
                    </strong>
                    <span>One is picked at random each time, so your replies never look copy-pasted.</span>
                  </div>
                  <Switch checked={draft.publicReply} onChange={(value) => patch({ publicReply: value })} aria-label="Public reply" />
                </div>
                {draft.publicReply && (
                  <>
                    <div className={styles.meter}>
                      <div className={styles.meterBar}>
                        <span style={{ width: `${Math.min(100, (replyCount / MIN_PUBLIC_REPLIES) * 100)}%` }} className={replyCount >= MIN_PUBLIC_REPLIES ? styles.meterOk : ""} />
                      </div>
                      <span className={replyCount >= MIN_PUBLIC_REPLIES ? styles.meterTextOk : styles.meterText}>
                        {replyCount >= MIN_PUBLIC_REPLIES ? `${replyCount} different replies` : `${replyCount} of ${MIN_PUBLIC_REPLIES} needed`}
                      </span>
                    </div>
                    <ol className={styles.variations}>
                      {draft.publicReplies.map((reply, index) => (
                        <li key={index}>
                          <span className={styles.variationNo}>{index + 1}</span>
                          <input value={reply} maxLength={300} onChange={(event) => setReply(index, event.target.value)} placeholder="Write a short reply…" aria-label={`Public reply ${index + 1}`} />
                          <button type="button" className={styles.iconBtn} onClick={() => removeReply(index)} aria-label="Remove reply" disabled={draft.publicReplies.length <= 1}>
                            ×
                          </button>
                        </li>
                      ))}
                    </ol>
                    <div className={styles.ideas}>
                      <Button size="sm" variant="secondary" onClick={() => addReply()} disabled={draft.publicReplies.length >= 20}>
                        + Add reply
                      </Button>
                      {unusedIdeas.slice(0, 4).map((idea) => (
                        <button key={idea} type="button" className={styles.idea} onClick={() => addReply(idea)} disabled={draft.publicReplies.length >= 20}>
                          + {idea}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className={styles.replyCard}>
              <div className={styles.replyHead}>
                <div>
                  <strong>{isComment(draft.triggerType) ? "Private DM to the commenter" : "Reply message"}</strong>
                  <span>
                    {isComment(draft.triggerType) ? "Sent to their inbox. Instagram allows one private reply per comment." : "Sent in the chat right away."}
                  </span>
                </div>
                {draft.triggerType === "comment" && <Switch checked={draft.privateReply} onChange={(value) => patch({ privateReply: value })} aria-label="Private DM" />}
              </div>
              {sendsMessage && (
                <>
                  {!isComment(draft.triggerType) && (
                    <div className={styles.inlineRow}>
                      {(["text", "image", "video", "buttons"] as ResponseFormat[]).map((format) => (
                        <Chip key={format} on={draft.responseFormat === format} onClick={() => patch({ responseFormat: format })}>
                          {format === "text" ? "Text" : format === "image" ? "+ Image" : format === "video" ? "+ Video" : "+ Button"}
                        </Chip>
                      ))}
                    </div>
                  )}
                  <Textarea value={draft.responseText} onChange={(event) => patch({ responseText: event.target.value })} rows={4} maxLength={1000} aria-label="Message" placeholder="Hey! Here's the link you asked for…" />
                  {(draft.responseFormat === "image" || draft.responseFormat === "video") && !isComment(draft.triggerType) && (
                    <Input label={`Link to the ${draft.responseFormat}`} value={draft.mediaUrl} onChange={(event) => patch({ mediaUrl: event.target.value })} placeholder="https://…" />
                  )}
                  {draft.responseFormat === "buttons" && !isComment(draft.triggerType) && (
                    <div className={styles.twoCol}>
                      <Input label="Button text" value={draft.buttonText} maxLength={20} onChange={(event) => patch({ buttonText: event.target.value })} />
                      <Input label="Button link (optional)" value={draft.buttonUrl} onChange={(event) => patch({ buttonUrl: event.target.value })} placeholder="https://…" />
                    </div>
                  )}
                  {draft.triggerType === "story_mention" && (
                    <Switch checked={draft.reactToMention} onChange={(value) => patch({ reactToMention: value })} label="Also react with a heart to the mention" />
                  )}

                  <div className={styles.field}>
                    <span className={styles.fieldLabel}>
                      <InfoLabel help="What happens when the person answers your DM. The AI agent can keep the chat going for you, your team can pick it up from the inbox, or nothing else happens.">When they reply back</InfoLabel>
                    </span>
                    <div className={styles.segmented} role="radiogroup">
                      <Segment
                        checked={draft.afterReply === "ai"}
                        onClick={() => aiAvailable && patch({ afterReply: "ai" })}
                        disabled={!aiAvailable}
                        title="AI agent continues"
                        icon="bot"
                        detail={aiAvailable ? "Answers their questions for you" : "AI agent is off"}
                      />
                      <Segment checked={draft.afterReply === "human"} onClick={() => patch({ afterReply: "human" })} title="My team replies"
                        icon="team" detail="Shows in your inbox" />
                      <Segment checked={draft.afterReply === "end"} onClick={() => patch({ afterReply: "end" })} title="Nothing else" icon="stop" detail="Just the automation" />
                    </div>
                    {!aiAvailable && (
                      <span className={styles.fieldHint}>
                        Want the AI to keep the conversation going?{" "}
                        <button type="button" className={styles.linkBtn} onClick={onOpenSettings}>
                          Turn on the AI agent in Settings
                        </button>
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            <Disclosure open={showAdvanced} onToggle={() => setShowAdvanced((v) => !v)} label="Advanced options">
              <div className={styles.twoCol}>
                <Select
                  label={<InfoLabel help="Limit the automation to people who follow you, or to those who don’t (e.g. to send a follow reminder). Instagram doesn’t always share this, in which case “Everyone” is safest.">Who it answers</InfoLabel>} value={draft.followerState} onChange={(event) => patch({ followerState: event.target.value as Draft["followerState"] })}>
                  <option value="any">Everyone</option>
                  <option value="follows">Only my followers</option>
                  <option value="does_not_follow">Only non-followers</option>
                </Select>
                <Select
                  label={<InfoLabel help="“New” means someone who has never messaged this account before.">New or returning</InfoLabel>} value={draft.contactState} onChange={(event) => patch({ contactState: event.target.value as Draft["contactState"] })}>
                  <option value="any">Both</option>
                  <option value="new">Only new people</option>
                  <option value="existing">Only people I&apos;ve talked to</option>
                </Select>
              </div>
              <Select
                label={<InfoLabel help="Stops one person from getting the same reply over and over if they comment many times. Your account settings may set a longer minimum.">Answer the same person again after</InfoLabel>} value={String(draft.cooldown)} onChange={(event) => patch({ cooldown: Number(event.target.value) })}>
                <option value="0">Every time</option>
                <option value="300">5 minutes</option>
                <option value="3600">1 hour</option>
                <option value="86400">1 day</option>
                <option value="604800">1 week</option>
                {![0, 300, 3600, 86400, 604800].includes(draft.cooldown) && <option value={String(draft.cooldown)}>{draft.cooldown} seconds</option>}
              </Select>
              {sendsMessage && (
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>
                    <InfoLabel help="Send a different DM depending on the word they used, e.g. “size” gets the size chart and “price” gets the price list. Anything else gets the main message.">Different DM for different keywords</InfoLabel>
                  </span>
                  {draft.branches.map((branch) => (
                    <div key={branch.id} className={styles.branch}>
                      <input value={branch.keywords} onChange={(event) => patch({ branches: draft.branches.map((b) => (b.id === branch.id ? { ...b, keywords: event.target.value } : b)) })} placeholder="If they say: size, fit" aria-label="Branch keywords" />
                      <input value={branch.message} onChange={(event) => patch({ branches: draft.branches.map((b) => (b.id === branch.id ? { ...b, message: event.target.value } : b)) })} placeholder="Send this DM instead" aria-label="Branch message" />
                      <button type="button" className={styles.iconBtn} onClick={() => patch({ branches: draft.branches.filter((b) => b.id !== branch.id) })} aria-label="Remove">
                        ×
                      </button>
                    </div>
                  ))}
                  <div>
                    <Button size="sm" variant="secondary" onClick={() => patch({ branches: [...draft.branches, { id: newId(), keywords: "", message: "" }] })}>
                      + Add keyword reply
                    </Button>
                  </div>
                </div>
              )}
            </Disclosure>
          </section>
        )}

        {step === "review" && (
          <section className={`${styles.section} ${styles.review}`}>
            <div className={styles.reviewMain}>
              <h3>Review and go live</h3>
              <Input label="Automation name" value={draft.name} maxLength={120} onChange={(event) => patch({ name: event.target.value, nameTouched: true })} />
              <dl className={styles.summary}>
                <div>
                  <dt>Starts when</dt>
                  <dd>{recipeLabel(draft.triggerType)}</dd>
                </div>
                {needsPosts(draft.triggerType) && (
                  <div>
                    <dt>On</dt>
                    <dd>
                      {draft.scopeType === "specific"
                        ? `${draft.selectedMedia.length} selected ${isStory(draft.triggerType) ? "Stories" : draft.selectedMedia.length === 1 ? "post" : "posts"}`
                        : draft.scopeType === "next"
                          ? "Your next post"
                          : isStory(draft.triggerType)
                            ? "Any Story"
                            : `All ${draft.triggerType === "comment" ? draft.surfaces.map((s) => (s === "post" ? "posts" : "reels")).join(" & ") : "posts"}`}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Matches</dt>
                  <dd>{draft.anyInteraction ? "Everything" : draft.keywords.map((k) => `“${k}”`).join(", ")}</dd>
                </div>
                {usesPublicReply && (
                  <div>
                    <dt>Public reply</dt>
                    <dd>{replyCount} variations, picked at random</dd>
                  </div>
                )}
                {sendsMessage && (
                  <div>
                    <dt>Then</dt>
                    <dd>{draft.afterReply === "ai" && aiAvailable ? "AI agent continues the chat" : draft.afterReply === "human" ? "Your team takes over" : "Automation ends"}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className={styles.phone} aria-label="Preview">
              <div className={styles.phoneTop}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {avatarUrl ? <img src={avatarUrl} alt="" className={styles.phoneAvatar} /> : <span className={styles.phoneAvatarFallback}>{username.slice(0, 1).toUpperCase()}</span>}
                <strong>{username}</strong>
              </div>
              {needsPosts(draft.triggerType) && !isStory(draft.triggerType) && selectedItems[0] ? (
                <MediaStage key={selectedItems[0].id} item={selectedItems[0]} compact />
              ) : (
                <div className={styles.phonePlaceholder}>{isStory(draft.triggerType) ? "Your Story" : draft.triggerType === "comment" ? "Any of your posts" : "Instagram chat"}</div>
              )}
              <div className={styles.thread}>
                <div className={styles.bubbleThem}>
                  <span className={styles.bubbleWho}>customer</span>
                  {sampleKeyword}
                </div>
                {usesPublicReply && sampleReply && (
                  <div className={styles.bubbleYou}>
                    <span className={styles.bubbleWho}>{username} · reply</span>
                    {sampleReply}
                    {filledReplies.length > 1 && (
                      <button type="button" className={styles.shuffle} onClick={() => setPreviewIndex((i) => i + 1)} aria-label="Show another variation">
                        <Icon name="shuffle" size={14} />
                      </button>
                    )}
                  </div>
                )}
                {sendsMessage && draft.responseText.trim() && (
                  <div className={styles.dm}>
                    <span className={styles.bubbleWho}>DM</span>
                    {draft.responseText.trim()}
                    {draft.responseFormat === "buttons" && !isComment(draft.triggerType) && <span className={styles.dmButton}>{draft.buttonText}</span>}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      <footer className={styles.footer}>
        <Button variant="secondary" onClick={goBack}>
          {stepIndex === 0 ? "Cancel" : "← Back"}
        </Button>
        {problems[step] && <span className={styles.footerProblem}>{problems[step]}</span>}
        {step === "review" ? (
          <div className={styles.footerSave}>
            <Button variant="secondary" isLoading={saving} onClick={() => void save(false)}>
              Save draft
            </Button>
            <Button isLoading={saving} onClick={() => void save(true)}>
              {editing ? "Save & go live" : "Go live"}
            </Button>
          </div>
        ) : (
          <Button onClick={goNext}>Continue →</Button>
        )}
      </footer>

      <MediaViewer
        item={viewing}
        onClose={() => setViewing(null)}
        username={username}
        avatarUrl={avatarUrl}
        actions={
          viewing && (
            <>
              <Button variant="secondary" onClick={() => setViewing(null)}>
                Back to posts
              </Button>
              {draft.selectedMedia.includes(viewing.id) ? (
                <Button
                  variant="outline-danger"
                  onClick={() => {
                    toggleMedia(viewing.id);
                    setViewing(null);
                  }}
                >
                  Remove
                </Button>
              ) : (
                <Button
                  leftIcon={<Icon name="check" size={16} style={{ strokeWidth: 2.6 }} />}
                  onClick={() => {
                    toggleMedia(viewing.id);
                    setViewing(null);
                  }}
                >
                  Use this post
                </Button>
              )}
            </>
          )
        }
      />
    </div>
  );
}

// ── Small pieces ────────────────────────────────────────────────────────────

function RecipeCard({ recipe, selected, onClick, popular }: { recipe: Recipe; selected: boolean; onClick: () => void; popular?: boolean }) {
  return (
    <button type="button" className={`${styles.recipe} ${selected ? styles.recipeSelected : ""}`} onClick={onClick} aria-pressed={selected}>
      <IconTile name={recipe.icon} tone={EVENT_ICON[recipe.value]?.tone ?? "pink"} />
      <span className={styles.recipeText}>
        <strong>
          {recipe.label}
          {popular && <em className={styles.popular}>Most used</em>}
        </strong>
        <span>{recipe.detail}</span>
      </span>
      <span className={styles.radio} aria-hidden />
    </button>
  );
}

function Segment({
  checked,
  onClick,
  title,
  detail,
  disabled,
  icon,
}: {
  checked: boolean;
  onClick: () => void;
  title: string;
  detail: string;
  disabled?: boolean;
  icon?: IconName;
}) {
  return (
    <button type="button" role="radio" aria-checked={checked} disabled={disabled} className={`${styles.segment} ${checked ? styles.segmentOn : ""}`} onClick={onClick}>
      <strong>
        {icon && <Icon name={icon} size={16} />}
        {title}
      </strong>
      <span>{detail}</span>
    </button>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={on ? styles.chipOn : styles.chip} onClick={onClick} aria-pressed={on}>
      {children}
    </button>
  );
}

function Disclosure({ open, onToggle, label, children }: { open: boolean; onToggle: () => void; label: string; children: React.ReactNode }) {
  return (
    <div className={styles.disclosure}>
      <button type="button" className={styles.disclosureToggle} onClick={onToggle} aria-expanded={open}>
        <span className={open ? styles.chevOpen : styles.chev}>⌄</span> {label}
      </button>
      {open && <div className={styles.disclosureBody}>{children}</div>}
    </div>
  );
}
