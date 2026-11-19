"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi, type AccountStatusFilter } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { Button, EmptyState, Input, Skeleton, Tabs } from "@/components/ui";
import { AccountStatusPill, Identity, PageHeader, TierPill, formatDate } from "@/components/features/admin/AdminUi";
import styles from "./page.module.scss";

const PAGE_SIZE = 25;
type Filter = "all" | AccountStatusFilter;

export default function AccountsPage() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);

  // Search as you type, but not on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const list = useAsync(
    () => adminApi.listUsers(page * PAGE_SIZE, PAGE_SIZE, search || undefined, filter === "all" ? undefined : filter),
    [search, filter, page]
  );
  const users = list.data?.users ?? [];
  const total = list.data?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <>
      <PageHeader title="Accounts" description="Everyone who has signed up. Open an account to approve it, change its plan or switch features on and off." />

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Input
            type="search"
            placeholder="Search by name or email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search accounts"
          />
        </div>
        <div className={styles.tabs}>
          <Tabs<Filter>
            value={filter}
            onChange={(next) => {
              setFilter(next);
              setPage(0);
            }}
            options={[
              { value: "all", label: "All" },
              { value: "pending", label: "Awaiting approval" },
              { value: "approved", label: "Active" },
              { value: "disabled", label: "Paused" },
            ]}
          />
        </div>
      </div>

      {list.isLoading ? (
        <Skeleton height={320} />
      ) : users.length === 0 ? (
        <div className={styles.empty}>
          <EmptyState
            title={search || filter !== "all" ? "No accounts match" : "No accounts yet"}
            description={search || filter !== "all" ? "Try a different search or filter." : undefined}
          />
        </div>
      ) : (
        <div className={styles.table} role="table" aria-label="Accounts">
          <div className={styles.head} role="row">
            <span role="columnheader">Account</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Plan</span>
            <span role="columnheader">Businesses</span>
            <span role="columnheader">Joined</span>
          </div>
          {users.map((user) => (
            <Link key={user.id} href={`/admin/users/${user.id}`} className={styles.row} role="row">
              <span className={styles.account} role="cell">
                <Identity name={user.name} email={user.email} />
              </span>
              <span className={styles.cell} role="cell" data-label="Status">
                <AccountStatusPill user={user} />
              </span>
              <span className={styles.cell} role="cell" data-label="Plan">
                <TierPill tier={user.plan_id} />
                {user.countdown && (
                  <span className={styles.timeLeft}>
                    {user.countdown.expired ? "ended" : `${user.countdown.days_remaining}d left`}
                  </span>
                )}
              </span>
              <span className={styles.cell} role="cell" data-label="Businesses">
                {user.business_count}
              </span>
              <span className={styles.cell} role="cell" data-label="Joined">
                {formatDate(user.created_at)}
              </span>
            </Link>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className={styles.pager}>
          <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className={styles.pageInfo}>
            {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of {total.toLocaleString()}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </>
  );
}
