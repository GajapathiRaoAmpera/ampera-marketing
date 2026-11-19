"use client";

import type { TemplateComponent } from "@/lib/api/whatsapp-templates";
import styles from "./TemplatePreview.module.scss";

// Fills {{1}}, {{2}}... placeholders with the given sample values (or leaves
// them visibly as-is if no sample was provided). Purely cosmetic, matches
// how the message will actually look once Meta approves and it's sent.
function fillPlaceholders(text: string, samples: string[]): string {
  return text.replace(/\{\{(\d+)\}\}/g, (match, indexStr) => {
    const idx = parseInt(indexStr, 10) - 1;
    return samples[idx] ?? match;
  });
}

export function TemplatePreview({ components }: { components: TemplateComponent[] }) {
  const header = components.find((c) => c.type === "HEADER");
  const body = components.find((c) => c.type === "BODY");
  const footer = components.find((c) => c.type === "FOOTER");
  const buttons = components.find((c) => c.type === "BUTTONS");
  const carousel = components.find((c) => c.type === "CAROUSEL");
  const isAuthentication = buttons?.buttons?.some((b) => b.type === "OTP") ?? false;

  const headerSamples = header?.example?.header_text ?? [];
  const bodySamples = body?.example?.body_text?.[0] ?? [];

  // AUTHENTICATION templates don't carry free-form text: Meta generates the
  // wording from add_security_recommendation / code_expiration_minutes, so we
  // mirror that fixed copy here rather than showing an empty bubble.
  const authBodyText = isAuthentication
    ? `*123456* is your verification code.${body?.add_security_recommendation ? " For your security, do not share this code." : ""}`
    : null;
  const authFooterText = isAuthentication && footer?.code_expiration_minutes
    ? `This code expires in ${footer.code_expiration_minutes} minutes.`
    : footer?.text;

  return (
    <div className={styles.phoneFrame}>
      <div className={styles.chatBackground}>
        <div className={styles.bubble}>
          {header?.text && (
            <div className={styles.headerText}>{fillPlaceholders(header.text, headerSamples)}</div>
          )}
          {header?.format && header.format !== "TEXT" && (
            <div className={styles.mediaPlaceholder}>
              {header.format === "IMAGE" && "🖼️ Image header"}
              {header.format === "VIDEO" && "🎬 Video header"}
              {header.format === "DOCUMENT" && "📄 Document header"}
            </div>
          )}
          <div className={styles.bodyText}>
            {authBodyText || body?.text
              ? fillPlaceholders(authBodyText ?? body?.text ?? "", bodySamples)
              : <span className={styles.placeholder}>Body text appears here…</span>}
          </div>
          {authFooterText && <div className={styles.footerText}>{authFooterText}</div>}
          <div className={styles.timestamp}>12:00 PM</div>
        </div>
        {buttons?.buttons && buttons.buttons.length > 0 && (
          <div className={styles.buttonStack}>
            {buttons.buttons.map((b, i) => (
              <div key={i} className={styles.buttonRow}>
                {b.type === "URL" && "🔗 "}
                {b.type === "PHONE_NUMBER" && "📞 "}
                {b.type === "FLOW" && "▣ "}
                {b.type === "OTP" && "🔑 "}
                {b.text || "Button"}
              </div>
            ))}
          </div>
        )}
        {carousel?.cards && (
          <div className={styles.carouselTrack}>
            {carousel.cards.map((card, index) => {
              const cardBody = card.components.find((component) => component.type === "BODY");
              const cardButtons = card.components.find((component) => component.type === "BUTTONS");
              return <div className={styles.carouselCard} key={index}>
                <div className={styles.mediaPlaceholder}>Card {index + 1} image</div>
                <div className={styles.bodyText}>{cardBody?.text || "Card text"}</div>
                <div className={styles.buttonRow}>{cardButtons?.buttons?.[0]?.text || "View item"}</div>
              </div>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
