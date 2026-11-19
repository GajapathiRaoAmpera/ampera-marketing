// The business the user is working in, sent to the backend as X-Business-Id.
// A team member's requests only reach the owner's channels, agents and
// contacts when the backend knows which shared business they mean. The
// BusinessProvider sets this whenever the active business changes.

let activeBusinessId: string | null = null;

export function setActiveBusinessHeader(id: string | null): void {
  activeBusinessId = id;
}

export function getActiveBusinessHeader(): string | null {
  return activeBusinessId;
}
