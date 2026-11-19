"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authApi, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useBusiness } from "@/context/BusinessContext";
import { useEntitlements } from "@/context/EntitlementsContext";
import { useToast } from "@/context/ToastContext";
import { Avatar, Button, Icon, IconTile, InfoLabel, Input, Modal, Select, Switch, type IconName, type Tone } from "@/components/ui";
import { SOUND_PREFERENCE_KEY, isChimeEnabled, playNewMessageChime } from "@/lib/utils/notification-sound";
import styles from "./page.module.scss";

const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "India Standard Time (IST)" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (US)" },
  { value: "America/Chicago", label: "Central Time (US)" },
  { value: "America/Denver", label: "Mountain Time (US)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US)" },
  { value: "America/Sao_Paulo", label: "Brasília Time" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Central European Time" },
  { value: "Europe/Moscow", label: "Moscow" },
  { value: "Africa/Lagos", label: "West Africa Time" },
  { value: "Africa/Johannesburg", label: "South Africa Time" },
  { value: "Asia/Dubai", label: "Gulf Standard Time" },
  { value: "Asia/Karachi", label: "Pakistan Standard Time" },
  { value: "Asia/Dhaka", label: "Bangladesh Standard Time" },
  { value: "Asia/Bangkok", label: "Indochina Time" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Shanghai", label: "China Standard Time" },
  { value: "Asia/Tokyo", label: "Japan Standard Time" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "Pacific/Auckland", label: "New Zealand Time" },
];

type Section = "profile" | "security" | "preferences" | "plan" | "account";

const SECTIONS: Array<{ value: Section; label: string; hint: string; icon: IconName; tone: Tone }> = [
  { value: "profile", label: "Profile", hint: "Name, photo and time zone", icon: "user", tone: "violet" },
  { value: "security", label: "Password & security", hint: "Change your password", icon: "lock", tone: "blue" },
  { value: "preferences", label: "Preferences", hint: "Theme and sounds", icon: "palette", tone: "pink" },
  { value: "plan", label: "Plan & usage", hint: "What your plan includes", icon: "gauge", tone: "amber" },
  { value: "account", label: "Sign out & delete", hint: "Leave or close your account", icon: "logout", tone: "red" },
];

type Theme = "system" | "light" | "dark";

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem("theme");
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

function applyTheme(theme: Theme) {
  try {
    if (theme === "system") {
      localStorage.removeItem("theme");
      delete document.documentElement.dataset.theme;
    } else {
      localStorage.setItem("theme", theme);
      document.documentElement.dataset.theme = theme;
    }
  } catch {
    // Storage off: the choice still applies until the page reloads.
    if (theme !== "system") document.documentElement.dataset.theme = theme;
  }
}

/** 0–4: how strong a new password is, for the meter under it. */
function passwordStrength(value: string): number {
  if (!value) return 0;
  let score = value.length >= 8 ? 1 : 0;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(4, score);
}

const STRENGTH_LABEL = ["Too short", "Weak", "Okay", "Strong", "Very strong"];

export default function SettingsPage() {
  const { user, logout, updateUser } = useAuth();
  const { activeBusiness, role } = useBusiness();
  const { entitlements } = useEntitlements();
  const { show } = useToast();
  const [section, setSection] = useState<Section>("profile");

  const [name, setName] = useState(user?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [timezone, setTimezone] = useState(user?.timezone ?? "Asia/Kolkata");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [theme, setTheme] = useState<Theme>("system");
  const [sound, setSound] = useState(true);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((me) => !cancelled && setAvatarUrl(me.avatar_url ?? ""))
      .catch(() => undefined);
    // Browser-only preferences, read once the page is on screen.
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setTheme(readTheme());
      setSound(isChimeEnabled());
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const profileChanged = name.trim() !== (user?.name ?? "") || timezone !== (user?.timezone ?? "Asia/Kolkata") || avatarUrl !== "";

  async function handleSaveProfile() {
    if (!name.trim()) {
      show("Your name can't be empty.", "error");
      return;
    }
    setIsSavingProfile(true);
    try {
      await authApi.updateMe({ name: name.trim(), avatar_url: avatarUrl || undefined, timezone });
      updateUser({ name: name.trim(), timezone });
      show("Profile saved.", "success");
    } catch {
      show("Couldn't save your profile. Please try again.", "error");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    if (!passwordForm.current || !passwordForm.next) {
      show("Fill in your current and new password.", "error");
      return;
    }
    if (passwordForm.next.length < 10) {
      show("Your new password needs at least 10 characters.", "error");
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      show("The new password and its confirmation don't match.", "error");
      return;
    }
    setIsChangingPassword(true);
    try {
      const result = await authApi.changePassword({ current_password: passwordForm.current, new_password: passwordForm.next });
      setPasswordForm({ current: "", next: "", confirm: "" });
      if (result.signed_out) {
        // Every session ends when the password changes, this one included.
        show("Password changed. Please sign in again.", "success");
        await logout();
        return;
      }
      show("Password changed.", "success");
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't change your password. Please try again.", "error");
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== "DELETE") return;
    setIsDeletingAccount(true);
    try {
      await authApi.deleteAccount();
      show("Your account has been deleted.", "default");
      await logout();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't delete your account. Please try again.", "error");
      setIsDeletingAccount(false);
    }
  }

  function chooseTheme(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  function chooseSound(on: boolean) {
    setSound(on);
    try {
      if (on) localStorage.removeItem(SOUND_PREFERENCE_KEY);
      else localStorage.setItem(SOUND_PREFERENCE_KEY, "off");
    } catch {
      // Nothing to save to; applies for this visit only.
    }
    if (on) playNewMessageChime();
  }

  const strength = passwordStrength(passwordForm.next);
  const mismatch = passwordForm.confirm.length > 0 && passwordForm.confirm !== passwordForm.next;
  const current = SECTIONS.find((item) => item.value === section) ?? SECTIONS[0];

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <Avatar name={user?.name ?? "?"} src={avatarUrl || undefined} size="lg" />
        <div className={styles.heroText}>
          <h1>{user?.name || "Your account"}</h1>
          <span>{user?.email}</span>
          <div className={styles.heroPills}>
            {entitlements?.plan_name && (
              <span className={styles.pill}>
                <Icon name="sparkle" size={13} /> {entitlements.plan_name} plan
              </span>
            )}
            {activeBusiness && role && (
              <span className={styles.pill}>
                <Icon name="team" size={13} /> {role.charAt(0).toUpperCase() + role.slice(1)} at {activeBusiness.name}
              </span>
            )}
            {user?.email_verified === false && (
              <span className={`${styles.pill} ${styles.pillWarn}`}>
                <Icon name="alert" size={13} /> Email not verified
              </span>
            )}
          </div>
        </div>
      </header>

      <div className={styles.layout}>
        <nav className={styles.nav} aria-label="Settings sections">
          {SECTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={section === item.value ? styles.navOn : styles.navItem}
              aria-current={section === item.value ? "page" : undefined}
              onClick={() => setSection(item.value)}
            >
              <IconTile name={item.icon} tone={item.tone} size="sm" />
              <span className={styles.navText}>
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </span>
            </button>
          ))}
        </nav>

        <section className={styles.panel} key={section} aria-labelledby="settings-title">
          <div className={styles.panelHead}>
            <IconTile name={current.icon} tone={current.tone} />
            <div>
              <h2 id="settings-title">{current.label}</h2>
              <p>{current.hint}</p>
            </div>
          </div>

          {section === "profile" && (
            <>
              <div className={styles.photoRow}>
                <Avatar name={name || "?"} src={avatarUrl || undefined} size="lg" />
                <div className={styles.grow}>
                  <Input
                    label={<InfoLabel help="Paste a link to a square photo (e.g. your LinkedIn or Gravatar image). Uploading from your device isn't available yet.">Photo link</InfoLabel>}
                    value={avatarUrl}
                    onChange={(event) => setAvatarUrl(event.target.value)}
                    placeholder="https://…/your-photo.jpg"
                  />
                </div>
              </div>
              <div className={styles.grid}>
                <Input label="Full name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
                <Input label="Email" value={user?.email ?? ""} disabled helperText="Contact support to change your email." />
                <Select
                  label={<InfoLabel help="Times across the app (inbox, activity, reports) are shown in this time zone.">Time zone</InfoLabel>}
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                >
                  {TIMEZONE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className={styles.actions}>
                <Button onClick={handleSaveProfile} isLoading={isSavingProfile} disabled={!profileChanged}>
                  Save changes
                </Button>
              </div>
            </>
          )}

          {section === "security" && (
            <>
              <div className={styles.grid}>
                <Input
                  label="Current password"
                  type={showPasswords ? "text" : "password"}
                  value={passwordForm.current}
                  onChange={(event) => setPasswordForm((form) => ({ ...form, current: event.target.value }))}
                  autoComplete="current-password"
                />
                <span className={styles.gridSpacer} />
                <div>
                  <Input
                    label="New password"
                    type={showPasswords ? "text" : "password"}
                    value={passwordForm.next}
                    onChange={(event) => setPasswordForm((form) => ({ ...form, next: event.target.value }))}
                    autoComplete="new-password"
                    minLength={10}
                  />
                  {passwordForm.next && (
                    <div className={styles.strength} data-level={strength}>
                      <span className={styles.strengthBar}>
                        {[1, 2, 3, 4].map((level) => (
                          <i key={level} className={strength >= level ? styles.strengthOn : ""} />
                        ))}
                      </span>
                      {STRENGTH_LABEL[strength]}
                    </div>
                  )}
                </div>
                <Input
                  label="Confirm new password"
                  type={showPasswords ? "text" : "password"}
                  value={passwordForm.confirm}
                  onChange={(event) => setPasswordForm((form) => ({ ...form, confirm: event.target.value }))}
                  autoComplete="new-password"
                  errorText={mismatch ? "Doesn't match the new password." : undefined}
                />
              </div>
              <Switch checked={showPasswords} onChange={setShowPasswords} label="Show passwords" />
              <ul className={styles.tips}>
                <li>At least 10 characters; 14 or more is better.</li>
                <li>Mix upper and lower case, numbers and a symbol.</li>
                <li>Don&apos;t reuse a password from another site.</li>
              </ul>
              <div className={styles.actions}>
                <Button onClick={handleChangePassword} isLoading={isChangingPassword} disabled={!passwordForm.current || !passwordForm.next || mismatch}>
                  Change password
                </Button>
              </div>
            </>
          )}

          {section === "preferences" && (
            <>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>
                  <InfoLabel help="Saved on this device. “System” follows your phone or computer's light/dark setting.">Appearance</InfoLabel>
                </span>
                <div className={styles.themes} role="radiogroup" aria-label="Appearance">
                  {(
                    [
                      ["system", "System", "Matches your device"],
                      ["light", "Light", "Bright and clean"],
                      ["dark", "Dark", "Easy on the eyes"],
                    ] as Array<[Theme, string, string]>
                  ).map(([value, label, hint]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={theme === value}
                      className={theme === value ? styles.themeOn : styles.theme}
                      onClick={() => chooseTheme(value)}
                    >
                      <span className={`${styles.themePreview} ${styles[`preview_${value}`]}`} aria-hidden>
                        <i />
                        <i />
                        <i />
                      </span>
                      <strong>{label}</strong>
                      <span>{hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.row}>
                <div>
                  <strong>Sound for new messages</strong>
                  <p>A soft chime in the inbox when a customer writes. Saved on this device.</p>
                </div>
                <Switch checked={sound} onChange={chooseSound} aria-label="Sound for new messages" />
              </div>
            </>
          )}

          {section === "plan" && (
            <>
              <div className={styles.row}>
                <div>
                  <strong>{entitlements?.plan_name ? `${entitlements.plan_name} plan` : "Your plan"}</strong>
                  <p>
                    {entitlements?.awaiting_approval
                      ? "Your account is waiting for approval. Until then a small free allowance applies."
                      : "Limits and features below come from your plan."}
                  </p>
                </div>
                {role === "owner" && (
                  <Link href="/billing" className={styles.linkButton}>
                    Plans &amp; billing <Icon name="arrowRight" size={14} />
                  </Link>
                )}
              </div>
              {entitlements && (
                <div className={styles.planGrid}>
                  {entitlements.limits.map((limit) => (
                    <div key={limit.key} className={styles.planItem}>
                      <span>{limit.label}</span>
                      <strong>{limit.value === null ? "Unlimited" : limit.value.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              )}
              {entitlements && entitlements.features.some((feature) => !feature.enabled) && (
                <div className={styles.locked}>
                  <strong>Not included right now</strong>
                  <div className={styles.lockedList}>
                    {entitlements.features
                      .filter((feature) => !feature.enabled)
                      .map((feature) => (
                        <span key={feature.key}>
                          <Icon name="lock" size={13} /> {feature.label}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}

          {section === "account" && (
            <>
              <div className={styles.row}>
                <div>
                  <strong>Sign out</strong>
                  <p>Sign out of your account on this device. Your data stays as it is.</p>
                </div>
                <Button variant="secondary" onClick={handleLogout} isLoading={isLoggingOut} leftIcon={<Icon name="logout" size={16} />}>
                  Sign out
                </Button>
              </div>
              <div className={`${styles.row} ${styles.danger}`}>
                <div>
                  <strong>Delete account</strong>
                  <p>Permanently deletes your account, businesses, conversations and connected channels. This can&apos;t be undone.</p>
                </div>
                <Button variant="danger" onClick={() => setIsDeleteModalOpen(true)} leftIcon={<Icon name="trash" size={16} />}>
                  Delete account
                </Button>
              </div>
            </>
          )}
        </section>
      </div>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteConfirmText("");
        }}
        title="Delete your account?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setDeleteConfirmText("");
              }}
            >
              Keep my account
            </Button>
            <Button variant="danger" onClick={handleDeleteAccount} isLoading={isDeletingAccount} disabled={deleteConfirmText !== "DELETE"}>
              Delete forever
            </Button>
          </>
        }
      >
        <p className={styles.modalText}>
          Everything is deleted permanently. If you pay for a plan, cancel it separately in Plans &amp; billing first.
        </p>
        <Input label='Type "DELETE" to confirm' value={deleteConfirmText} onChange={(event) => setDeleteConfirmText(event.target.value)} placeholder="DELETE" autoComplete="off" />
      </Modal>
    </div>
  );
}
