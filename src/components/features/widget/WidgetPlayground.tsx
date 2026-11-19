"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui";
import styles from "./WidgetPlayground.module.scss";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/** Unsaved settings to show in the preview, in the widget script's own config names. */
export type WidgetPreviewConfig = Record<string, unknown>;

interface WidgetPlaygroundProps {
  agentId: string;
  /** Applied on top of the saved settings, so edits show before they are saved. */
  preview?: WidgetPreviewConfig;
  reloadKey?: number;
}

// Loads the SAME embed script real websites use (GET /widget/script/{agentId})
// inside a sandboxed iframe, so this playground is a live test of the exact
// production code path, not a re-implementation that could drift from it.
// The settings being edited are handed to it through window.AIChatConfig,
// the same override a website can use.
export function WidgetPlayground({ agentId, preview, reloadKey = 0 }: WidgetPlaygroundProps) {
  const [isLoading, setIsLoading] = useState(true);
  const incoming = JSON.stringify(preview ?? {});
  // Rebuilding the frame on every keystroke would flicker; wait for a pause in typing.
  const [settled, setSettled] = useState(incoming);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(incoming), 450);
    return () => window.clearTimeout(timer);
  }, [incoming]);

  const srcDoc = useMemo(() => {
    const scriptUrl = `${API_BASE}/widget/script/${agentId}?_r=${reloadKey}`;
    // "</" must not appear inside an inline script, or it could end the tag early.
    const config = settled.replace(/<\//g, "<\\/");
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html, body { margin: 0; height: 100%; }
  body { background: linear-gradient(180deg, #f7f6f2, #eeece6); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; overflow: hidden; }
  .site { padding: 22px 24px; }
  .bar { display: flex; align-items: center; gap: 8px; margin-bottom: 26px; }
  .dot { width: 26px; height: 26px; border-radius: 8px; background: #d9d5ca; }
  .line { height: 10px; border-radius: 5px; background: #e2ded4; }
  .nav { margin-left: auto; display: flex; gap: 10px; }
  .hero { height: 22px; width: 62%; border-radius: 7px; background: #d3cec2; margin-bottom: 14px; }
  .p { margin-bottom: 9px; }
  .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 22px; }
  .card { height: 74px; border-radius: 12px; background: #e6e2d8; }
  .hint { position: absolute; left: 0; right: 0; bottom: 8px; text-align: center; color: #a39d8f; font-size: 11px; }
</style>
</head>
<body>
  <div class="site" aria-hidden="true">
    <div class="bar"><div class="dot"></div><div class="line" style="width:90px"></div><div class="nav"><div class="line" style="width:44px"></div><div class="line" style="width:44px"></div><div class="line" style="width:44px"></div></div></div>
    <div class="hero"></div>
    <div class="line p" style="width:88%"></div><div class="line p" style="width:74%"></div><div class="line p" style="width:52%"></div>
    <div class="cards"><div class="card"></div><div class="card"></div><div class="card"></div></div>
  </div>
  <script>window.AIChatConfig = Object.assign(${config}, { startOpen: true });</script>
  <script src="${scriptUrl}" async></script>
</body>
</html>`;
  }, [agentId, reloadKey, settled]);

  return (
    <div className={styles.frameWrap}>
      {isLoading && <div className={styles.loadingOverlay}>Loading live preview…</div>}
      <iframe
        key={srcDoc}
        srcDoc={srcDoc}
        className={styles.frame}
        sandbox="allow-scripts"
        title="Widget live preview"
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
}

export function WidgetPlaygroundCard({ agentId, preview }: { agentId: string; preview?: WidgetPreviewConfig }) {
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>Live preview</div>
          <div className={styles.cardSubtitle}>
            Your real widget, updating as you edit. Chat with it here; nothing is saved until you press Save.
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
          Restart
        </Button>
      </div>
      <WidgetPlayground agentId={agentId} preview={preview} reloadKey={reloadKey} />
    </div>
  );
}
