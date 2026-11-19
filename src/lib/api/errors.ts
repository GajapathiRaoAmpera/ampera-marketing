// Error shapes per FRONTEND_INTEGRATION.md §5:
// - 404: not found OR not yours. Never distinguish in the UI.
// - 422: FastAPI/Pydantic validation, `detail` is an array of {loc, msg, type}.
// - 400: `{ detail: "<human sentence>" }` - safe to show directly.
// - 500: `{ error, type, detail, path }` - never show detail/type to end users.
// - 502/503/504: raised deliberately when an upstream provider (Meta, Shopify,
//   Razorpay, etc.) rejected or failed a call. `detail` is always a curated
//   human-readable string here, never internal trace data, so it's safe and
//   more useful to show than the generic 500 copy.

export interface ValidationErrorItem {
  loc: Array<string | number>;
  msg: string;
  type: string;
}

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }

  /** A message safe to render directly in the UI. */
  get userMessage(): string {
    if (this.status === 404) {
      return "We couldn't find that - it may not exist or you may not have access to it.";
    }

    if (this.status === 422 && Array.isArray(this.detail)) {
      const items = this.detail as ValidationErrorItem[];
      const first = items[0];
      if (first) {
        const field = first.loc[first.loc.length - 1];
        return `${field}: ${first.msg}`;
      }
      return "Some fields need your attention.";
    }

    // 400/401/409 etc. commonly carry a human-readable sentence as `detail`
    // (e.g. "Invalid email or password", "Email already registered") -
    // prefer that over generic copy whenever it's present and safe to show.
    // 502/503/504 get the same treatment: those statuses are only ever raised
    // deliberately for upstream-provider failures with a curated safe string.
    const isUpstreamStatus = this.status < 500 || [502, 503, 504].includes(this.status);

    if (typeof this.detail === "string" && isUpstreamStatus) {
      return this.detail;
    }

    if (this.detail && typeof this.detail === "object" && "detail" in this.detail && isUpstreamStatus) {
      const inner = (this.detail as { detail?: unknown }).detail;
      if (typeof inner === "string") return inner;
    }

    if (this.status >= 500) {
      return "Something went wrong on our end. Please try again in a moment.";
    }

    if (this.status === 401) {
      return "Your session has expired. Please log in again.";
    }

    if (this.status === 403) {
      return "You don't have permission to do that.";
    }

    return "Something went wrong. Please try again.";
  }
}
