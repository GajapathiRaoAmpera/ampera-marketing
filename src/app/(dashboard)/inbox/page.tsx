"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { conversationsApi, teamApi, ApiError } from "@/lib/api";
import { whatsappStudioApi } from "@/lib/api/whatsapp-studio";
import { useBusiness } from "@/context/BusinessContext";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { Avatar, Button, EmptyState, Input, Skeleton, Switch } from "@/components/ui";
import { ConversationListItem } from "@/components/features/inbox/ConversationListItem";
import { MessageBubble } from "@/components/features/inbox/MessageBubble";
import { TemplateReplyBox } from "@/components/features/inbox/TemplateReplyBox";
import { FilterDropdown, type FilterDropdownOption } from "@/components/features/inbox/FilterDropdown";
import { TagsNotesPopover } from "@/components/features/inbox/TagsNotesPopover";
import { getChannelMeta, CHANNEL_FILTER_OPTIONS } from "@/lib/utils/channel-meta";
import { formatDateLabel } from "@/lib/utils/date";
import { playNewMessageChime } from "@/lib/utils/notification-sound";
import { InboxIllustration } from "@/components/features/inbox/InboxIllustration";
import type { ConversationListItem as ConversationListItemType, Message } from "@/types/api";
import styles from "./page.module.scss";

// Polling intervals, not a real push channel (there's no WebSocket/SSE
// backend yet) - tuned short enough that new messages/conversations feel
// live without hammering the API. The messages poll is the one the user is
// actively staring at, so it runs faster than the conversation list poll.
const LIST_POLL_MS = 4000;
const MESSAGES_POLL_MS = 1500;
const CONVERSATIONS_PER_PAGE = 20;
const FLASH_DURATION_MS = 1600;
// Caps how many conversations' message history stays cached in memory at
// once (see messageCacheRef) - unbounded growth over a long session
// browsing many conversations would otherwise never release memory.
const MESSAGE_CACHE_LIMIT = 15;

type MessageCacheEntry = { messages: Message[]; hasOlder: boolean; cursors: { oldest: string | null; latest: string | null } };

function cacheMessages(cache: Map<string, MessageCacheEntry>, key: string, entry: MessageCacheEntry) {
  cache.delete(key); // re-insert to mark as most-recently-used
  cache.set(key, entry);
  if (cache.size > MESSAGE_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
}

type WhatsAppMediaType = "image" | "video" | "audio" | "document";

function mediaTypeForFile(file: File): WhatsAppMediaType | null {
  if (["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "image";
  if (["video/mp4", "video/3gpp"].includes(file.type)) return "video";
  if (["audio/mpeg", "audio/mp4", "audio/ogg", "audio/aac", "audio/amr"].includes(file.type)) return "audio";
  if (["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(file.type)) return "document";
  return null;
}

function supportedRecordingType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return ["audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "ai_active", label: "AI active" },
  { value: "human_active", label: "Human active" },
  { value: "waiting_for_customer", label: "Waiting" },
  { value: "closed", label: "Closed" },
];

/** What a human can still send on Messenger, given when the customer last wrote. */
function messengerWindowHint(replyWindow: ConversationListItemType["reply_window"]): string {
  if (!replyWindow || replyWindow.state === "closed") {
    return "Messenger's reply window is closed: this person last wrote more than 7 days ago. They need to message you again first.";
  }
  const closesAt = replyWindow.state === "open" ? replyWindow.standard_closes_at : replyWindow.human_closes_at;
  const hoursLeft = closesAt ? Math.max(0, Math.round((new Date(closesAt).getTime() - Date.now()) / 3_600_000)) : 0;
  const left = hoursLeft >= 48 ? `${Math.round(hoursLeft / 24)} days` : `${hoursLeft} hours`;
  return replyWindow.state === "open"
    ? `AI is paused. You can reply freely for about ${left} more.`
    : `AI is paused. The 24-hour window has passed, so this goes out as a human-agent reply (about ${left} left).`;
}

// useSearchParams needs a Suspense boundary above it.
export default function InboxPage() {
  return (
    <Suspense fallback={<Skeleton height={480} />}>
      <Inbox />
    </Suspense>
  );
}

function Inbox() {
  const searchParams = useSearchParams();
  const { businesses, isLoading: businessesLoading, can } = useBusiness();
  // Replying, taking over from the AI and assigning need the Support agent role; Viewers only read.
  const canReply = can("agent");
  const { show } = useToast();
  const { user } = useAuth();

  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [conversationPage, setConversationPage] = useState(1);
  // ?c=<conversation_key> opens that conversation (links from Knowledge Gaps, notifications).
  const [activeKey, setActiveKey] = useState<string | null>(() => searchParams.get("c"));
  const [selectedConversation, setSelectedConversation] = useState<ConversationListItemType | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasOlderMessages, setHasOlderMessagesState] = useState(false);
  // loadMessages is a stable useCallback (empty deps, so the setInterval
  // polling it doesn't need to be re-armed every render) - it reads this
  // ref instead of the hasOlderMessages state directly to avoid capturing a
  // stale value from whatever render created the closure.
  const hasOlderMessagesRef = useRef(false);
  const setHasOlderMessages = useCallback((value: boolean) => {
    hasOlderMessagesRef.current = value;
    setHasOlderMessagesState(value);
  }, []);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isTogglingAi, setIsTogglingAi] = useState(false);
  const [attachment, setAttachment] = useState<{ file: File; type: WhatsAppMediaType } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [quickReplyLabel, setQuickReplyLabel] = useState("");
  const [showQuickReplyEditor, setShowQuickReplyEditor] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const discardRecordingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const wasNearBottomRef = useRef(true);
  const messageRequestInFlightRef = useRef(false);
  const messageCursorsRef = useRef<{ oldest: string | null; latest: string | null }>({ oldest: null, latest: null });
  const activeKeyRef = useRef<string | null>(null);
  // Per-conversation cache so re-opening a conversation you were just in
  // (or already fetched once this session) renders instantly from memory
  // instead of blanking to a skeleton while the network round-trip repeats -
  // that "goes blank every time you switch" feeling was the main complaint.
  // Fresh data still fetches in the background and replaces the cache.
  const messageCacheRef = useRef<Map<string, MessageCacheEntry>>(new Map());
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Every business has exactly one backing agent, this maps agent_id back to
  // its business so status/tag updates (which are business-scoped endpoints)
  // work transparently from an inbox that's no longer scoped to one business.
  const businessByAgentId = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of businesses) {
      if (b.agent_id) map.set(b.agent_id, b.id);
    }
    return map;
  }, [businesses]);

  // WhatsApp/Telegram-style day dividers: insert one before the first
  // message of each calendar day (in the viewer's timezone), so a thread
  // spanning multiple days doesn't read as one undifferentiated stream of
  // timestamps. A message with no created_at never gets its own divider,
  // it just renders under whichever day group came before it.
  const messagesWithDividers = useMemo(() => {
    const items: Array<{ type: "divider"; key: string; label: string } | { type: "message"; message: Message }> = [];
    let lastDayLabel: string | null = null;
    for (const message of messages) {
      const label = message.created_at ? formatDateLabel(message.created_at, user?.timezone) : null;
      if (label && label !== lastDayLabel) {
        items.push({ type: "divider", key: `divider-${message.id}`, label });
        lastDayLabel = label;
      }
      items.push({ type: "message", message });
    }
    return items;
  }, [messages, user?.timezone]);

  const agentFilterOptions: FilterDropdownOption[] = useMemo(
    () => [
      { value: "", label: "All agents" },
      ...businesses
        .filter((b) => b.agent_id)
        .map((b) => ({ value: b.agent_id as string, label: b.agent_name || b.name })),
    ],
    [businesses]
  );

  const channelFilterOptions: FilterDropdownOption[] = useMemo(
    () =>
      CHANNEL_FILTER_OPTIONS.map((c) => {
        if (!c.value) return { value: c.value, label: c.label };
        const meta = getChannelMeta(c.value);
        return { value: c.value, label: c.label, icon: meta.icon, color: meta.color };
      }),
    []
  );

  const {
    data: conversationResult,
    isLoading: listLoading,
    refresh: refreshList,
  } = useAsync(
    () =>
      conversationsApi.listAccountWide({
        channel: channelFilter || undefined,
        agentId: agentFilter || undefined,
        status: statusFilter || undefined,
        page: conversationPage,
        pageSize: CONVERSATIONS_PER_PAGE,
      }),
    [channelFilter, agentFilter, statusFilter, conversationPage]
  );

  const conversations = conversationResult?.conversations;

  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) refreshList();
    }, LIST_POLL_MS);
    return () => clearInterval(timer);
  }, [refreshList]);

  // New-activity detection for the conversation list: a chime + toast +
  // brief row highlight whenever a poll reveals a conversation's
  // last_activity moved forward since the previous snapshot. Keyed by
  // conversation_key in a ref (not state) since this is pure bookkeeping
  // between polls, not something that should itself trigger a re-render.
  const lastActivitySnapshotRef = useRef<Map<string, string>>(new Map());
  const hasSeenFirstListLoadRef = useRef(false);
  const [flashingKeys, setFlashingKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!conversations) return;
    const snapshot = lastActivitySnapshotRef.current;
    const isFirstLoad = !hasSeenFirstListLoadRef.current;
    const newlyActive: string[] = [];

    for (const conversation of conversations) {
      const key = conversation.conversation_key;
      const activity = conversation.last_activity ?? "";
      const previous = snapshot.get(key);
      // A brand-new key on the very first load isn't "new activity" (it's
      // just the inbox opening); a brand-new key on a LATER poll is a
      // genuinely new conversation and should still notify.
      const isNew = previous === undefined && !isFirstLoad;
      const isAdvanced = previous !== undefined && activity !== "" && activity !== previous;
      if ((isNew || isAdvanced) && key !== activeKeyRef.current) {
        newlyActive.push(key);
      }
      snapshot.set(key, activity);
    }
    hasSeenFirstListLoadRef.current = true;

    if (isFirstLoad || newlyActive.length === 0) return;

    playNewMessageChime();
    const first = conversations.find((c) => c.conversation_key === newlyActive[0]);
    const name = first?.customer?.name ?? first?.customer?.phone ?? "Someone";
    show(
      newlyActive.length === 1 ? `New message from ${name}` : `${newlyActive.length} conversations have new activity`,
      "default"
    );
    setFlashingKeys((current) => {
      const next = new Set(current);
      newlyActive.forEach((key) => next.add(key));
      return next;
    });
    const timer = setTimeout(() => {
      setFlashingKeys((current) => {
        const next = new Set(current);
        newlyActive.forEach((key) => next.delete(key));
        return next;
      });
    }, FLASH_DURATION_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  const visibleConversations = conversations;

  const conversationPageCount = Math.max(
    1,
    conversationResult?.totalPages ?? 0
  );
  const effectiveConversationPage = Math.min(conversationPage, conversationPageCount);

  /* A removed last page must move the user to the new final page. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (conversationPage > conversationPageCount) setConversationPage(conversationPageCount);
  }, [conversationPage, conversationPageCount]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const activeConversation: ConversationListItemType | undefined =
    visibleConversations?.find((c) => c.conversation_key === activeKey)
    ?? (selectedConversation?.conversation_key === activeKey ? selectedConversation : undefined);
  const activeBusinessId = activeConversation?.agent_id ? businessByAgentId.get(activeConversation.agent_id) : undefined;

  const { data: activeTeam, refresh: refreshTeam } = useAsync(
    () => (activeBusinessId ? teamApi.list(activeBusinessId) : Promise.resolve([])),
    [activeBusinessId]
  );
  const { data: quickReplies, refresh: refreshQuickReplies } = useAsync(
    () => (activeBusinessId ? conversationsApi.listQuickReplies(activeBusinessId) : Promise.resolve([])),
    [activeBusinessId]
  );
  const { data: inboxProducts } = useAsync(
    () => (activeBusinessId ? whatsappStudioApi.products(activeBusinessId) : Promise.resolve([])),
    [activeBusinessId]
  );
  // Customer tags/notes aren't part of the account-wide conversation list
  // (see ConversationCustomer's comment in types/api.ts) - fetched here,
  // scoped to whichever conversation is actually open, instead of bloating
  // every row of the list endpoint with a field only the open one needs.
  const { data: activeCustomerDetail, refresh: refreshActiveCustomerDetail } = useAsync(
    () => (activeBusinessId && activeKey ? conversationsApi.detail(activeBusinessId, activeKey) : Promise.resolve(null)),
    [activeBusinessId, activeKey]
  );

  const loadMessages = useCallback(async (initial = false) => {
    const key = activeKeyRef.current;
    if (!key || messageRequestInFlightRef.current || document.hidden) return;
    messageRequestInFlightRef.current = true;
    try {
      const result = await conversationsApi.messages(
        key,
        initial || !messageCursorsRef.current.latest ? undefined : { after: messageCursorsRef.current.latest }
      );
      if (activeKeyRef.current !== key) return;
      if (initial) {
        setMessages(result.messages);
        setHasOlderMessages(result.hasMore);
        setIsLoadingMessages(false);
        messageCursorsRef.current = { oldest: result.oldestCursor, latest: result.latestCursor };
        cacheMessages(messageCacheRef.current, key, {
          messages: result.messages,
          hasOlder: result.hasMore,
          cursors: messageCursorsRef.current,
        });
      } else if (result.messages.length) {
        // A real customer reply landing while this conversation is already
        // open still deserves the same chime the list gets, since the list
        // poll skips the currently-open conversation (see the newlyActive
        // filter above) to avoid flashing the row the user is already
        // looking at.
        if (result.messages.some((message) => message.role === "user")) {
          playNewMessageChime();
        }
        setMessages((current) => {
          // Drop any optimistic placeholder(s) now confirmed by a real
          // message from the server (matched by content, since the
          // placeholder has no real id yet), then append whatever's left.
          const confirmedContents = new Set(
            result.messages.filter((m) => m.role !== "user").map((m) => m.content)
          );
          const withoutReconciled = current.filter(
            (m) => !(m.metadata?._pending && confirmedContents.has(m.content))
          );
          const existing = new Set(withoutReconciled.map((message) => message.id));
          const next = [...withoutReconciled, ...result.messages.filter((message) => !existing.has(message.id))];
          cacheMessages(messageCacheRef.current, key, {
            messages: next,
            hasOlder: hasOlderMessagesRef.current,
            cursors: messageCursorsRef.current,
          });
          return next;
        });
        messageCursorsRef.current.latest = result.latestCursor ?? messageCursorsRef.current.latest;
      }
    } catch {
      // Keep last-known messages on transient failure. Polling will retry.
      setIsLoadingMessages(false);
    } finally {
      messageRequestInFlightRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOlderMessages = useCallback(async () => {
    const key = activeKeyRef.current;
    const before = messageCursorsRef.current.oldest;
    const element = messageListRef.current;
    if (!key || !before || !hasOlderMessages || isLoadingOlder || !element || messageRequestInFlightRef.current) return;
    messageRequestInFlightRef.current = true;
    setIsLoadingOlder(true);
    const previousHeight = element.scrollHeight;
    try {
      const result = await conversationsApi.messages(key, { before });
      if (activeKeyRef.current !== key) return;
      setMessages((current) => {
        const existing = new Set(current.map((message) => message.id));
        const next = [...result.messages.filter((message) => !existing.has(message.id)), ...current];
        cacheMessages(messageCacheRef.current, key, {
          messages: next,
          hasOlder: result.hasMore,
          cursors: { ...messageCursorsRef.current, oldest: result.oldestCursor ?? before },
        });
        return next;
      });
      setHasOlderMessages(result.hasMore);
      messageCursorsRef.current.oldest = result.oldestCursor ?? before;
      requestAnimationFrame(() => {
        const current = messageListRef.current;
        if (current) current.scrollTop = current.scrollHeight - previousHeight;
      });
    } finally {
      messageRequestInFlightRef.current = false;
      setIsLoadingOlder(false);
    }
  }, [hasOlderMessages, isLoadingOlder, setHasOlderMessages]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!activeKey) return;
    activeKeyRef.current = activeKey;
    const cached = messageCacheRef.current.get(activeKey);
    messageCursorsRef.current = cached?.cursors ?? { oldest: null, latest: null };
    // loadMessages(true) always does a full re-fetch even when a cache hit
    // renders instantly, so a stale cache (e.g. the customer replied while
    // this conversation wasn't open) still gets corrected within one poll
    // tick rather than staying wrong until the next unrelated re-render.
    const initialTimer = window.setTimeout(() => {
      setHasOlderMessages(cached?.hasOlder ?? false);
      void loadMessages(true);
    }, 0);
    const timer = setInterval(() => void loadMessages(false), MESSAGES_POLL_MS);
    return () => {
      activeKeyRef.current = null;
      window.clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, [activeKey, loadMessages, setHasOlderMessages]);

  function handleSelectConversation(key: string) {
    if (recorderRef.current?.state === "recording") {
      discardRecordingRef.current = true;
      recorderRef.current.stop();
    }
    if (key === activeKey) return;
    const cached = messageCacheRef.current.get(key);
    // Render from cache instantly (previous conversation view or an earlier
    // visit to this same one) instead of blanking to empty/skeleton while
    // the network round-trip for the fresh copy is still in flight.
    setMessages(cached?.messages ?? []);
    setIsLoadingMessages(!cached);
    setReplyText("");
    setAttachment(null);
    setSelectedConversation(visibleConversations?.find((conversation) => conversation.conversation_key === key) ?? null);
    setActiveKey(key);
  }

  // Only auto-scroll to the newest message if the reader was already near
  // the bottom before this update, otherwise polling (every 4s) would keep
  // yanking someone back down while they're reading older history.
  const NEAR_BOTTOM_THRESHOLD_PX = 80;

  function handleMessageListScroll() {
    const el = messageListRef.current;
    if (!el) return;
    wasNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD_PX;
    if (el.scrollTop < 80) void loadOlderMessages();
  }

  useEffect(() => {
    if (wasNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  useEffect(() => {
    // A freshly opened conversation should always land on its latest message.
    wasNearBottomRef.current = true;
  }, [activeKey]);

  async function handleToggleAi(enabled: boolean) {
    if (!activeKey || isTogglingAi) return;
    setIsTogglingAi(true);
    try {
      // This endpoint returns a flat ack, not an updated conversation object,
      // refresh the list afterward so the Switch reflects the real state.
      await conversationsApi.updateControl(activeKey, { ai_enabled: enabled });
      refreshList();
      show(enabled ? "AI resumed for this conversation." : "AI paused, you're in control.", "default");
    } catch {
      show("Couldn't update AI control. Please try again.", "error");
    } finally {
      setIsTogglingAi(false);
    }
  }

  async function handleSendReply() {
    if (!activeKey || (!replyText.trim() && !attachment)) return;
    const key = activeKey;
    const text = replyText.trim();
    setIsSendingReply(true);

    // Optimistic bubble: text-only sends (the common case) appear instantly
    // instead of waiting on the network round-trip. Media sends skip this -
    // building a preview from a File object before upload is meaningfully
    // more complex and the attachment composer already shows a preview of
    // what's about to be sent, so the wait is less noticeable there.
    let optimisticId: string | null = null;
    if (!attachment && text) {
      optimisticId = `optimistic-${Date.now()}`;
      const optimisticMessage: Message = {
        id: optimisticId,
        role: "human_agent",
        content: text,
        created_at: new Date().toISOString(),
        metadata: { _pending: true },
      };
      setMessages((current) => [...current, optimisticMessage]);
      wasNearBottomRef.current = true;
    }

    try {
      if (attachment) {
        await conversationsApi.sendManualMediaReply(key, attachment.file, attachment.type, text);
      } else {
        await conversationsApi.sendManualReply(key, text);
      }
      setReplyText("");
      setAttachment(null);
      void loadMessages();
    } catch (err) {
      if (optimisticId) {
        setMessages((current) => current.filter((m) => m.id !== optimisticId));
      }
      const message = err instanceof ApiError ? err.userMessage : "Couldn't send message. Please try again.";
      show(message, "error");
    } finally {
      setIsSendingReply(false);
    }
  }

  function handleAttachmentFile(file?: File) {
    if (!file) return;
    const type = mediaTypeForFile(file);
    if (!type) {
      show("That format is not supported by WhatsApp. Use JPG/PNG/WebP, MP4, MP3/M4A/OGG, PDF, TXT, or DOCX.", "error");
      return;
    }
    setAttachment({ file, type });
  }

  async function handleVoiceRecord() {
    if (isRecording) {
      recorderRef.current?.stop();
      return;
    }
    const mimeType = supportedRecordingType();
    if (!mimeType) {
      show("This browser records WebM, which WhatsApp does not accept here. Choose an MP3, M4A, OGG, AAC, or AMR file instead.", "default");
      audioInputRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      recordingStreamRef.current = stream;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        const baseType = mimeType.split(";")[0];
        const extension = baseType === "audio/mp4" ? "m4a" : "ogg";
        const file = new File(chunks, `voice-${Date.now()}.${extension}`, { type: baseType });
        if (!discardRecordingRef.current) setAttachment({ file, type: "audio" });
        discardRecordingRef.current = false;
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        recorderRef.current = null;
        setIsRecording(false);
      };
      recorder.start();
      setIsRecording(true);
    } catch {
      show("Microphone access was unavailable. You can still attach an audio file.", "error");
    }
  }

  async function handleStatusChange(status: string) {
    if (!activeBusinessId || !activeKey) return;
    try {
      await conversationsApi.updateStatus(activeBusinessId, activeKey, { status });
      refreshList();
    } catch {
      show("Couldn't update status. Please try again.", "error");
    }
  }

  async function handleCustomerTagsNotesSave(input: { tags?: string[]; notes?: string }) {
    if (!activeBusinessId || !activeKey) return;
    try {
      await conversationsApi.updateCustomer(activeBusinessId, activeKey, input);
      refreshActiveCustomerDetail();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't save. Please try again.", "error");
    }
  }

  async function handleAssignmentChange(userId: string) {
    if (!activeBusinessId || !activeKey) return;
    try {
      await conversationsApi.updateStatus(activeBusinessId, activeKey, { assigned_team_member: userId });
      refreshList();
      refreshTeam();
      show(userId ? "Conversation assigned." : "Conversation unassigned.", "default");
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't update assignment.";
      show(message, "error");
    }
  }

  async function handleSaveQuickReply() {
    if (!activeBusinessId || !quickReplyLabel.trim() || !replyText.trim()) return;
    try {
      await conversationsApi.saveQuickReply(activeBusinessId, quickReplyLabel.trim(), replyText.trim());
      setQuickReplyLabel("");
      setShowQuickReplyEditor(false);
      refreshQuickReplies();
      show("Quick reply saved for the team.", "default");
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't save quick reply.", "error");
    }
  }

  async function handleDeleteQuickReply(id: string) {
    if (!activeBusinessId) return;
    try {
      await conversationsApi.deleteQuickReply(activeBusinessId, id);
      refreshQuickReplies();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't delete quick reply.", "error");
    }
  }

  async function handleShareProduct() {
    if (!activeBusinessId || !activeKey || !selectedProductId) return;
    setIsSendingReply(true);
    try {
      await whatsappStudioApi.shareProduct(activeBusinessId, selectedProductId, activeKey, replyText.trim() || undefined);
      setSelectedProductId("");
      setReplyText("");
      await loadMessages();
      show("Product sent from the linked Meta catalog.", "default");
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't share this product.", "error");
    } finally {
      setIsSendingReply(false);
    }
  }

  if (!businessesLoading && businesses.length === 0) {
    return <EmptyState title="No business connected yet" description="Create a business to start receiving conversations across every channel." />;
  }

  const customerName = activeConversation?.customer?.name ?? activeConversation?.customer?.phone ?? "Unknown";

  return (
    <div className={styles.shell} data-layout="fill">
      <div className={clsx(styles.listPane, activeKey && styles.hiddenOnMobile)}>
        <div className={styles.listHeader}>
          <div className={styles.listTitleRow}>
            <span className={styles.listTitle}>Inbox</span>
            {typeof conversations?.length === "number" && (
              <span className={styles.listCount}>{conversationResult?.total ?? 0}</span>
            )}
          </div>
          <div className={styles.filterRow}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={clsx(styles.filterChip, statusFilter === f.value && styles.filterChipActive)}
                onClick={() => {
                  setStatusFilter(f.value);
                  setConversationPage(1);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className={styles.dropdownRow}>
            <FilterDropdown
              options={channelFilterOptions}
              value={channelFilter}
              onChange={(value) => {
                setChannelFilter(value);
                setConversationPage(1);
              }}
              placeholder="All channels"
            />
            <FilterDropdown
              options={agentFilterOptions}
              value={agentFilter}
              onChange={(value) => {
                setAgentFilter(value);
                setConversationPage(1);
              }}
              placeholder="All agents"
            />
          </div>
        </div>
        <div className={styles.list}>
          {listLoading ? (
            <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <Skeleton height={64} />
              <Skeleton height={64} />
              <Skeleton height={64} />
            </div>
          ) : !visibleConversations || visibleConversations.length === 0 ? (
            <EmptyState title="No conversations" description="New conversations will appear here as customers message you on any channel." />
          ) : (
            <>
              {visibleConversations?.map((c) => (
                <ConversationListItem
                  key={c.conversation_key}
                  conversation={c}
                  isActive={c.conversation_key === activeKey}
                  isFlashing={flashingKeys.has(c.conversation_key)}
                  onClick={() => handleSelectConversation(c.conversation_key)}
                />
              ))}
              {conversationPageCount > 1 && (
                <nav className={styles.pagination} aria-label="Conversation pages">
                  <button
                    type="button"
                    onClick={() => setConversationPage(Math.max(1, effectiveConversationPage - 1))}
                    disabled={effectiveConversationPage === 1}
                    aria-label="Previous conversation page"
                  >
                    Previous
                  </button>
                  <span>
                    {effectiveConversationPage} / {conversationPageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setConversationPage(Math.min(conversationPageCount, effectiveConversationPage + 1))}
                    disabled={effectiveConversationPage === conversationPageCount}
                    aria-label="Next conversation page"
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>

      <div className={styles.detailPane}>
        {!activeConversation ? (
          <div className={styles.emptyDetail}>
            <InboxIllustration className={styles.emptyIllustration} />
            <div className={styles.emptyDetailTitle}>Select a conversation</div>
            <div className={styles.emptyDetailDescription}>
              Choose a conversation from the list to view the full message history and reply.
            </div>
            <div className={styles.emptyDetailChannels}>
              {CHANNEL_FILTER_OPTIONS.filter((c) => c.value).map((c) => {
                const meta = getChannelMeta(c.value);
                return (
                  <div key={c.value} className={styles.emptyDetailChannel}>
                    <span className={styles.emptyDetailChannelIcon} style={{ color: meta.color }}>
                      {meta.icon}
                    </span>
                    {meta.label}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <div className={styles.detailHeader}>
              <div className={styles.detailHeaderInfo}>
                <button type="button" className={styles.backButton} onClick={() => setActiveKey(null)} aria-label="Back to list">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <Avatar name={customerName} src={activeConversation.customer?.avatar_url} />
                <div>
                  <div className={styles.detailName}>{customerName}</div>
                  {activeConversation.customer?.name && (
                    <div className={styles.detailSubline}>
                      {[activeConversation.customer.handle !== activeConversation.customer.name ? activeConversation.customer.handle : null, activeConversation.channel.startsWith("whatsapp") || activeConversation.channel === "sms" ? activeConversation.customer.phone : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  )}
                  <div className={styles.detailMetaRow}>
                    {activeConversation.agent_name && <span className={styles.detailAgent}>{activeConversation.agent_name}</span>}
                    <span
                      className={styles.detailChannelBadge}
                      style={{ color: getChannelMeta(activeConversation.channel).color }}
                    >
                      {getChannelMeta(activeConversation.channel).icon}
                      {getChannelMeta(activeConversation.channel).label}
                    </span>
                  </div>
                </div>
              </div>
              <div className={styles.detailActions}>
                {activeBusinessId && (
                  <TagsNotesPopover
                    tags={activeCustomerDetail?.customer?.tags ?? []}
                    notes={activeCustomerDetail?.customer?.notes}
                    onSave={handleCustomerTagsNotesSave}
                  />
                )}
                {activeBusinessId && (
                  <FilterDropdown
                    options={[
                      { value: "ai_active", label: "AI active" },
                      { value: "human_active", label: "Human active" },
                      { value: "waiting_for_customer", label: "Waiting for customer" },
                      { value: "closed", label: "Closed" },
                      { value: "archived", label: "Archived" },
                    ]}
                    value={activeConversation.status}
                    onChange={handleStatusChange}
                    placeholder="Status"
                  />
                )}
                {canReply && activeBusinessId && activeTeam && (
                  <FilterDropdown
                    options={[
                      { value: "", label: "Unassigned" },
                      ...(user && !activeTeam.some((member) => member.user_id === user.user_id)
                        ? [{ value: user.user_id, label: `${user.name} (you)` }]
                        : []),
                      ...activeTeam.map((member) => ({ value: member.user_id, label: member.name || member.email })),
                    ]}
                    value={activeConversation.assigned_team_member ?? ""}
                    onChange={handleAssignmentChange}
                    placeholder="Assign"
                  />
                )}
                <span className={styles.aiToggleLabel}>AI replies</span>
                <Switch checked={activeConversation.ai_enabled} onChange={handleToggleAi} disabled={isTogglingAi || !canReply} />
              </div>
            </div>

            {activeConversation.ai_enabled && activeConversation.account_ai_enabled === false && (
              // Without this the header said "AI replies: on" while nothing answered: the account/number
              // switch (Instagram or WhatsApp settings) silences the AI for every chat on it.
              <div className={styles.accountAiNotice} role="status">
                AI replies are switched off for this {activeConversation.channel === "whatsapp" ? "WhatsApp number" : "Instagram account"}, so new messages are saved here but not answered.{" "}
                <Link href={activeConversation.channel === "whatsapp" ? "/channels/whatsapp?tab=settings" : "/channels/instagram?tab=settings"}>
                  Turn them on in {activeConversation.channel === "whatsapp" ? "WhatsApp" : "Instagram"} settings
                </Link>
              </div>
            )}
            <div className={styles.messageList} ref={messageListRef} onScroll={handleMessageListScroll}>
              {isLoadingOlder && <div className={styles.loadingOlder}>Loading earlier messages…</div>}
              {isLoadingMessages ? (
                <div className={styles.messageSkeletonGroup}>
                  <Skeleton height={40} width="55%" />
                  <Skeleton height={40} width="40%" />
                  <Skeleton height={40} width="60%" />
                </div>
              ) : messages.length === 0 ? (
                <div className={styles.emptyMessages}>No messages yet.</div>
              ) : (
                messagesWithDividers.map((item) =>
                  item.type === "divider" ? (
                    <div key={item.key} className={styles.dateDivider}>
                      {item.label}
                    </div>
                  ) : (
                    <MessageBubble key={item.message.id} message={item.message} />
                  )
                )
              )}
              <div ref={messagesEndRef} />
            </div>

            {canReply && !activeConversation.ai_enabled && activeConversation.channel === "whatsapp" && activeConversation.reply_window?.state === "closed" && activeBusinessId && (
              <TemplateReplyBox
                businessId={activeBusinessId}
                conversationKey={activeConversation.conversation_key}
                customerName={activeConversation.customer?.name}
                onSent={() => void loadMessages()}
              />
            )}

            {canReply && !activeConversation.ai_enabled && activeConversation.channel === "whatsapp" && !(activeConversation.reply_window?.state === "closed" && activeBusinessId) && (
              <>
                <div className={styles.composerHint}>
                  AI is paused for this conversation. Messages you send below go directly to the customer on
                  WhatsApp.
                </div>
                <div className={styles.quickReplies}>
                  {quickReplies?.map((quickReply) => (
                    <div className={styles.quickReplyGroup} key={quickReply.id}>
                      <button type="button" onClick={() => setReplyText(quickReply.body)} title={quickReply.body}>
                        {quickReply.label}
                      </button>
                      <button type="button" onClick={() => handleDeleteQuickReply(quickReply.id)} aria-label={`Delete ${quickReply.label}`}>
                        ×
                      </button>
                    </div>
                  ))}
                  <button type="button" className={styles.saveQuickReplyButton} onClick={() => setShowQuickReplyEditor((shown) => !shown)}>
                    + Save current reply
                  </button>
                </div>
                {showQuickReplyEditor && (
                  <div className={styles.quickReplyEditor}>
                    <Input
                      placeholder="Short label, e.g. Opening hours"
                      value={quickReplyLabel}
                      onChange={(event) => setQuickReplyLabel(event.target.value)}
                    />
                    <Button onClick={handleSaveQuickReply} disabled={!quickReplyLabel.trim() || !replyText.trim()}>
                      Save for team
                    </Button>
                  </div>
                )}
                {inboxProducts?.some((product) => product.active) && (
                  <div className={styles.productShareBar}>
                    <FilterDropdown
                      options={[
                        { value: "", label: "Choose catalog product" },
                        ...inboxProducts.filter((product) => product.active).map((product) => ({ value: product.id, label: `${product.name} · ${product.sku}` })),
                      ]}
                      value={selectedProductId}
                      onChange={setSelectedProductId}
                      placeholder="Choose catalog product"
                    />
                    <Button variant="secondary" onClick={handleShareProduct} disabled={!selectedProductId} isLoading={isSendingReply}>
                      Share product
                    </Button>
                  </div>
                )}
                {attachment && (
                  <div className={styles.attachmentPreview}>
                    <span>
                      {attachment.type.toUpperCase()} · {attachment.file.name} · {(attachment.file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                    <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment">
                      Remove
                    </button>
                  </div>
                )}
                <div className={styles.composer}>
                  <input
                    ref={fileInputRef}
                    className={styles.hiddenInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/3gpp,audio/mpeg,audio/mp4,audio/ogg,audio/aac,audio/amr,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(event) => {
                      handleAttachmentFile(event.target.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                  <input
                    ref={audioInputRef}
                    className={styles.hiddenInput}
                    type="file"
                    accept="audio/mpeg,audio/mp4,audio/ogg,audio/aac,audio/amr"
                    onChange={(event) => {
                      handleAttachmentFile(event.target.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className={styles.composerIconButton}
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach a WhatsApp file"
                    title="Attach image, video, audio, or document"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M8 12.5l6.6-6.6a3 3 0 114.2 4.2l-8.5 8.5a5 5 0 01-7.1-7.1l8.2-8.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={clsx(styles.composerIconButton, isRecording && styles.recordingButton)}
                    onClick={handleVoiceRecord}
                    aria-label={isRecording ? "Stop voice recording" : "Record a voice message"}
                    title={isRecording ? "Stop recording" : "Record voice message"}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21M9 21h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                  <Input
                    placeholder={attachment ? "Add an optional caption…" : "Type a reply…"}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSendReply();
                    }}
                  />
                  <Button onClick={handleSendReply} isLoading={isSendingReply} disabled={!replyText.trim() && !attachment}>
                    Send
                  </Button>
                </div>
              </>
            )}

            {canReply && !activeConversation.ai_enabled && activeConversation.channel === "instagram" && (
              <>
                <div className={styles.composerHint}>
                  AI is paused. This human reply will use Instagram&apos;s active 24-hour window or Human Agent window.
                </div>
                <div className={styles.composer}>
                  <Input
                    placeholder="Type an Instagram reply…"
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleSendReply();
                    }}
                  />
                  <Button onClick={handleSendReply} isLoading={isSendingReply} disabled={!replyText.trim()}>
                    Send
                  </Button>
                </div>
              </>
            )}

            {canReply && !activeConversation.ai_enabled && activeConversation.channel === "messenger" && (
              <>
                <div className={styles.composerHint}>{messengerWindowHint(activeConversation.reply_window)}</div>
                {activeConversation.reply_window?.state !== "closed" && (
                  <div className={styles.composer}>
                    <Input
                      placeholder="Type a Messenger reply…"
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleSendReply();
                      }}
                    />
                    <Button onClick={handleSendReply} isLoading={isSendingReply} disabled={!replyText.trim()}>
                      Send
                    </Button>
                  </div>
                )}
              </>
            )}

            {canReply && !activeConversation.ai_enabled && ["telegram", "sms", "discord", "twitter", "widget"].includes(activeConversation.channel) && (
              <>
                <div className={styles.composerHint}>
                  {activeConversation.channel === "widget"
                    ? "AI is paused. Your reply appears in the visitor's chat while they still have the page open."
                    : "AI is paused. Your reply is sent to the customer as-is."}
                </div>
                <div className={styles.composer}>
                  <Input
                    placeholder={`Type a ${getChannelMeta(activeConversation.channel).label} reply…`}
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleSendReply();
                    }}
                  />
                  <Button onClick={handleSendReply} isLoading={isSendingReply} disabled={!replyText.trim()}>
                    Send
                  </Button>
                </div>
              </>
            )}

            {canReply && !activeConversation.ai_enabled &&
              !["whatsapp", "instagram", "messenger", "telegram", "sms", "discord", "twitter", "widget"].includes(activeConversation.channel) && (
              <div className={styles.composerHint}>
                AI is paused for this conversation. Manual replies aren&apos;t available on this channel.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
