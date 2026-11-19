"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { messengerApi, type MessengerConnection } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { Button, EmptyState, Select, Skeleton } from "@/components/ui";
import { MessengerIcon } from "@/components/layout/icons";
import pageStyles from "@/app/(dashboard)/channels/whatsapp/page.module.scss";
import styles from "./Messenger.module.scss";

interface MessengerShellProps {
  title: string;
  subtitle: string;
  /** Rendered on the right of the header, e.g. a Save button. */
  action?: ReactNode;
  children: (page: MessengerConnection) => ReactNode;
}

/**
 * Shared frame for every Messenger page: header, the Page picker (only when
 * more than one Page is connected) and the "connect a Page first" state.
 */
export function MessengerShell({ title, subtitle, action, children }: MessengerShellProps) {
  const { data, isLoading } = useAsync(() => messengerApi.listConnections(), []);
  const [selected, setSelected] = useState("");
  const pages = (data ?? []).filter((item) => item.active);
  const page = pages.find((item) => item.page_id === selected) ?? pages[0];

  return (
    <div className={styles.shell}>
      <div className={pageStyles.header}>
        <div className={pageStyles.iconBadge} style={{ background: "var(--color-messenger)" }}>
          <MessengerIcon size={24} />
        </div>
        <div className={styles.headerText}>
          <div className={pageStyles.title}>{title}</div>
          <div className={pageStyles.subtitle}>{subtitle}</div>
        </div>
        {pages.length > 1 && (
          <Select value={page?.page_id ?? ""} onChange={(e) => setSelected(e.target.value)} aria-label="Facebook Page">
            {pages.map((item) => (
              <option key={item.page_id} value={item.page_id}>{item.page_name}</option>
            ))}
          </Select>
        )}
        {page && action}
      </div>

      {isLoading ? (
        <Skeleton height={280} />
      ) : !page ? (
        <EmptyState
          title="Connect a Facebook Page first"
          description="Once a Page is connected you can set up its chat here."
          action={
            <Link href="/channels/messenger">
              <Button>Go to connection setup</Button>
            </Link>
          }
        />
      ) : (
        // Remount on Page switch so each page's state never leaks into another.
        <div key={page.page_id} className={styles.body}>{children(page)}</div>
      )}
    </div>
  );
}

/** A titled block with an optional switch or button on the right. */
export function Section({ title, hint, right, children }: { title: string; hint?: string; right?: ReactNode; children?: ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <div>
          <h3>{title}</h3>
          {hint && <p>{hint}</p>}
        </div>
        {right}
      </div>
      {children && <div className={styles.sectionBody}>{children}</div>}
    </section>
  );
}
