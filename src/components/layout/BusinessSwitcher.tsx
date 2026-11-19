"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useBusiness } from "@/context/BusinessContext";
import { ROLE_LABELS } from "@/lib/permissions";
import { BuildingIcon, ChevronDownIcon, PlusIcon } from "./icons";
import styles from "./Topbar.module.scss";
import Link from "next/link";

export function BusinessSwitcher() {
  const { businesses, activeBusiness, setActiveBusinessId, isLoading, can } = useBusiness();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (isLoading) {
    return <div className={styles.switcherButton}>Loading businesses…</div>;
  }

  return (
    <div className={styles.switcher} ref={ref}>
      <button type="button" className={styles.switcherButton} onClick={() => setIsOpen((v) => !v)}>
        <span className={styles.switcherLabel}>{activeBusiness?.name ?? "Select a business"}</span>
        <span className={styles.switcherIcon}>
          <ChevronDownIcon />
        </span>
      </button>
      {isOpen && (
        <div className={styles.dropdown}>
          {businesses.map((b) => (
            <button
              key={b.id}
              type="button"
              className={clsx(styles.dropdownItem, b.id === activeBusiness?.id && styles.dropdownItemActive)}
              onClick={() => {
                setActiveBusinessId(b.id);
                setIsOpen(false);
              }}
            >
              {b.name}
              {b.is_owner === false && b.team_role && (
                <span style={{ marginLeft: "auto", fontSize: "var(--font-size-xs)", color: "var(--color-text-tertiary)" }}>
                  Shared · {ROLE_LABELS[b.team_role]}
                </span>
              )}
            </button>
          ))}
          <div className={styles.dropdownDivider} />
          {activeBusiness && can("admin") && (
            <Link href="/business-profile" className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
              <BuildingIcon /> Edit business profile
            </Link>
          )}
          <Link href="/onboarding" className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
            <PlusIcon /> Add business
          </Link>
        </div>
      )}
    </div>
  );
}
