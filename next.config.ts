import type { NextConfig } from "next";

// Headers that protect every page. The first group is enforced now. The full script/style policy below
// is sent as REPORT-ONLY first: open the site, watch the browser console for "Content Security Policy"
// reports, and once nothing legitimate is blocked, move it to Content-Security-Policy.
const isProd = process.env.NODE_ENV === "production";

const enforced = [
  // Nobody may put this site in a frame (clickjacking), change what a page's links resolve to, or submit
  // its forms elsewhere; no plug-ins.
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const fullPolicy = [
  "default-src 'self'",
  // Next.js inlines small scripts; Google and Facebook sign-in load their own.
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://accounts.google.com https://connect.facebook.net`,
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://accounts.google.com https://graph.facebook.com https://www.facebook.com",
  "frame-src https://accounts.google.com https://www.facebook.com https://web.facebook.com",
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Do not announce which framework (and version) this is.
  poweredByHeader: false,
  // The compiled browser code is not shipped with its readable source.
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: enforced },
          { key: "Content-Security-Policy-Report-Only", value: fullPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
          ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
