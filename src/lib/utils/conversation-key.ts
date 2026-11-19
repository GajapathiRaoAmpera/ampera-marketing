// conversation_key is shaped `{agent_id}:{channel}:{user_key}` and contains
// colons, so it MUST be percent-encoded whenever used as a path segment.
// Centralized here so every call site (detail/status/messages/control/feedback)
// gets it right by construction instead of remembering to do it inline.
export function encodeConversationKey(conversationKey: string): string {
  return encodeURIComponent(conversationKey);
}
