"use client";

import { useCallback, useEffect, useState } from "react";
import { voiceRealtimeApi, type VoiceClone } from "@/lib/api/voice-realtime";
import styles from "./page.module.scss";

interface Props {
  selected: string;
  onSelect: (id: string) => void;
}

/**
 * Cloning a voice, only with its owner's consent. The owner records themselves reading a one-time sentence (with a
 * random code) right now; it is transcribed and must contain the code and their name, so an old clip or someone
 * else's recording cannot pass. A cloned voice always says it is an AI, and withdrawing it deletes it at once.
 */
export function VoiceCloneConsent({ selected, onSelect }: Props) {
  const [clones, setClones] = useState<VoiceClone[]>([]);
  const [available, setAvailable] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ label: "", owner_name: "", relation: "self" as "self" | "authorized", authorization_note: "", attest: false });
  const [consent, setConsent] = useState<File | null>(null);
  const [samples, setSamples] = useState<File[]>([]);

  const load = useCallback(() => {
    voiceRealtimeApi.clones().then(res => { setClones(res.clones); setAvailable(res.available); }).catch(() => setMessage("Could not load cloned voices."));
  }, []);
  useEffect(() => { load(); }, [load]);

  const pending = clones.find(clone => clone.status === "pending");
  const active = clones.filter(clone => clone.status === "active");
  const fail = (error: unknown) => setMessage(error instanceof Error ? error.message : "That did not work. Please try again.");

  async function start() {
    setBusy(true); setMessage("");
    try { await voiceRealtimeApi.startClone(form); load(); } catch (error) { fail(error); } finally { setBusy(false); }
  }
  async function submit() {
    if (!pending || !consent) return;
    setBusy(true); setMessage("");
    try {
      await voiceRealtimeApi.submitClone(pending.id, consent, samples);
      setConsent(null); setSamples([]); setMessage("Verified. The voice is ready; choose it below and save.");
      load();
    } catch (error) { fail(error); load(); } finally { setBusy(false); }
  }
  async function revoke(clone: VoiceClone) {
    setBusy(true); setMessage("");
    try {
      const result = await voiceRealtimeApi.revokeClone(clone.id);
      if (selected === clone.id) onSelect("");
      setMessage(result.provider_deleted ? "Voice withdrawn and deleted." : "Voice withdrawn and blocked from use. The provider copy could not be deleted just now; contact support to confirm it is removed.");
      load();
    } catch (error) { fail(error); } finally { setBusy(false); }
  }

  const ready = form.label.trim() && form.owner_name.trim().length >= 2 && form.attest && (form.relation === "self" || form.authorization_note.trim().length >= 10);

  return <>
    <h3>Cloned voice (with consent)</h3>
    {!available && <p className={styles.hint}>Voice cloning is off: the server has no voice-provider key (ELEVENLABS_API_KEY).</p>}
    <p className={styles.hint}>Use the agent in a real person&apos;s voice, only with their permission. They record a one-time sentence, which proves they said these words today. The agent always tells callers it is an AI and never claims to be them, and withdrawing the voice deletes it immediately. This costs more per minute than the other voices, and cloned-voice calls use the free engine&apos;s listening, so replies are a little slower.</p>
    {message && <p className={styles.notice} role="status">{message}</p>}

    <label>Voice to use<select value={selected} onChange={e => onSelect(e.target.value)}>
      <option value="">None: the normal voices</option>
      {active.map(clone => <option key={clone.id} value={clone.id}>{clone.label} ({clone.owner_name})</option>)}
    </select></label>

    {clones.filter(clone => clone.status !== "revoked").map(clone => <div className={styles.row} key={clone.id}>
      <strong>{clone.label}</strong>
      <span className={styles.hint}>{clone.owner_name} · {clone.status === "active" ? `active, used on ${clone.uses} calls` : "waiting for the recording"}</span>
      <button disabled={busy} onClick={() => revoke(clone)}>{clone.status === "active" ? "Withdraw and delete" : "Cancel"}</button>
    </div>)}

    {available && !pending && <div className={styles.variant}>
      <div className={styles.twoCol}>
        <label>Name for this voice<input maxLength={60} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. Front desk" /></label>
        <label>Whose voice is it?<input maxLength={80} value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })} placeholder="Full name of the speaker" /></label>
      </div>
      <label>Relationship<select value={form.relation} onChange={e => setForm({ ...form, relation: e.target.value as "self" | "authorized" })}>
        <option value="self">It is my own voice</option><option value="authorized">I have the speaker&apos;s written permission</option></select></label>
      {form.relation === "authorized" && <label>Who gave permission, and how is it documented?<input maxLength={400} value={form.authorization_note} onChange={e => setForm({ ...form, authorization_note: e.target.value })} /></label>}
      <label className={styles.checkRow}><input type="checkbox" checked={form.attest} onChange={e => setForm({ ...form, attest: e.target.checked })} /><span>I confirm this voice is my own, or that I hold the speaker&apos;s written permission to clone it.</span></label>
      <div className={styles.row}><button className={styles.primary} disabled={busy || !ready} onClick={start}>Get the sentence to record</button></div>
    </div>}

    {pending && <div className={styles.variant}>
      <p><strong>{pending.owner_name}</strong>, read this aloud, clearly, exactly as written (valid for 20 minutes, {pending.attempts_left ?? 0} tries left):</p>
      <blockquote style={{ margin: 0, padding: "10px 14px", borderLeft: "3px solid #4f46e5" }}>{pending.challenge}</blockquote>
      <label>Recording of the sentence<input type="file" accept="audio/*" capture onChange={e => setConsent(e.target.files?.[0] ?? null)} /></label>
      <label>Recordings of the voice (about a minute of clear speech in total, up to 5 files)<input type="file" accept="audio/*" multiple onChange={e => setSamples(Array.from(e.target.files ?? []).slice(0, 5))} /></label>
      <div className={styles.row}><button className={styles.primary} disabled={busy || !consent || samples.length === 0} onClick={submit}>{busy ? "Checking…" : "Verify and create the voice"}</button></div>
    </div>}
  </>;
}
