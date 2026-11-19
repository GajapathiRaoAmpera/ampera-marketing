import clsx from "clsx";
import { Avatar, Badge } from "@/components/ui";
import { getChannelMeta } from "@/lib/utils/channel-meta";
import { formatRelativeTime } from "@/lib/utils/date";
import type { ConversationListItem as ConversationListItemType } from "@/types/api";
import styles from "../../../app/(dashboard)/inbox/page.module.scss";

export function ConversationListItem({
  conversation,
  isActive,
  isFlashing,
  onClick,
}: {
  conversation: ConversationListItemType;
  isActive: boolean;
  isFlashing?: boolean;
  onClick: () => void;
}) {
  const name = conversation.customer?.name ?? conversation.customer?.phone ?? "Unknown";
  const channelMeta = getChannelMeta(conversation.channel);

  return (
    <button
      type="button"
      className={clsx(
        styles.conversationItem,
        isActive && styles.conversationItemActive,
        isFlashing && styles.conversationItemFlash
      )}
      onClick={onClick}
    >
      <div className={styles.avatarWrap}>
        <Avatar name={name} src={conversation.customer?.avatar_url} size="md" />
        <span className={styles.channelDot} style={{ background: channelMeta.color }} title={channelMeta.label}>
          {channelMeta.icon}
        </span>
      </div>
      <div className={styles.conversationBody}>
        <div className={styles.conversationTopRow}>
          <span className={styles.conversationName}>{name}</span>
          <span className={styles.conversationTime}>{formatRelativeTime(conversation.last_activity)}</span>
        </div>
        <div className={styles.conversationPreview}>{conversation.last_message || conversation.intent || "No activity yet"}</div>
        <div className={styles.conversationMeta}>
          {conversation.ai_enabled && conversation.account_ai_enabled === false ? (
            // The chat is set to AI, but the account's AI switch is off: nothing will answer.
            <Badge variant="warning" dot>AI off</Badge>
          ) : (
            <Badge variant={conversation.ai_enabled ? "brand" : "info"} dot>
              {conversation.ai_enabled ? "AI" : "Human"}
            </Badge>
          )}
          {conversation.agent_name && <Badge variant="neutral">{conversation.agent_name}</Badge>}
          {conversation.lead_score > 0 && <Badge variant="warning">Lead score: {conversation.lead_score}</Badge>}
        </div>
      </div>
    </button>
  );
}
