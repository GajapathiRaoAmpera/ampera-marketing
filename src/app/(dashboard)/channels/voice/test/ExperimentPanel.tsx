"use client";

import { useState } from "react";
import {
  voiceRealtimeApi,
  type ExperimentConfig,
  type ExperimentResults,
  type ExperimentVariant,
  type RegionCatalog,
  type SpeakingStyle,
} from "@/lib/api/voice-realtime";
import styles from "./page.module.scss";

interface Props {
  agentId: string;
  value: ExperimentConfig;
  onChange: (next: ExperimentConfig) => void;
  catalog?: RegionCatalog;
  /** The engine calls run on, which decides which voice list a variant picks from. */
  engine: string;
}

const MAX_VARIANTS = 4;
const percent = (value: number | null | undefined) => (value === null || value === undefined ? "–" : `${Math.round(value * 100)}%`);

function nextId(variants: ExperimentVariant[]) {
  return "abcd".split("").find(letter => !variants.some(variant => variant.id === letter)) ?? "z";
}

/** Try two to four ways of sounding on real calls, and see which one gets better results. */
export function ExperimentPanel({ agentId, value, onChange, catalog, engine }: Props) {
  const [results, setResults] = useState<ExperimentResults>();
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");

  const voiceKey = engine === "open" ? "open_voice" : engine === "sarvam" ? "sarvam_speaker" : "gemini_voice";
  const voices = !catalog ? [] : engine === "open" ? catalog.open_voices : engine === "sarvam" ? catalog.sarvam_speakers : catalog.gemini_voices;
  const share = value.variants.reduce((sum, variant) => sum + variant.weight, 0) || 1;

  const setVariant = (id: string, patch: Partial<ExperimentVariant>) =>
    onChange({ ...value, variants: value.variants.map(variant => variant.id === id ? { ...variant, ...patch } : variant) });

  function enable(on: boolean) {
    if (on && value.variants.length < 2) {
      onChange({
        ...value, enabled: true, name: value.name || "Voice test",
        variants: [{ id: "a", label: "Current", weight: 50 }, { id: "b", label: "Variation", weight: 50 }],
      });
    } else onChange({ ...value, enabled: on });
  }

  async function refresh() {
    setLoading(true);
    setNote("");
    try { setResults(await voiceRealtimeApi.experiment(agentId)); }
    catch { setNote("Could not load results."); }
    finally { setLoading(false); }
  }

  return <>
    <h3>Voice tests (A/B)</h3>
    <label className={styles.checkRow}>
      <input type="checkbox" checked={value.enabled} onChange={e => enable(e.target.checked)} />
      <span>Try different voices, greetings or manners on real calls and compare results</span>
    </label>
    {value.enabled && <>
      <label>Test name<input value={value.name} maxLength={60} onChange={e => onChange({ ...value, name: e.target.value })} /></label>
      <p className={styles.hint}>Results are kept per test name. Change the variants of a running test and the results mix; start a new name to begin fresh. Each call gets one variant, chosen by its share, and keeps it.</p>
      <div className={styles.variants}>
        {value.variants.map(variant => <div className={styles.variant} key={variant.id}>
          <div className={styles.row}>
            <strong>Variant {variant.id.toUpperCase()}</strong>
            <input aria-label={`Variant ${variant.id} label`} placeholder="Label" maxLength={60} value={variant.label ?? ""} onChange={e => setVariant(variant.id, { label: e.target.value })} />
            <label className={styles.inline}>Share<input type="number" min={1} max={100} value={variant.weight} onChange={e => setVariant(variant.id, { weight: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })} /></label>
            <span className={styles.hint}>{Math.round(variant.weight / share * 100)}% of calls</span>
            {value.variants.length > 2 && <button aria-label={`Remove variant ${variant.id}`} onClick={() => onChange({ ...value, variants: value.variants.filter(item => item.id !== variant.id) })}>×</button>}
          </div>
          <div className={styles.twoCol}>
            <label>Voice<select value={variant[voiceKey] ?? ""} onChange={e => setVariant(variant.id, { [voiceKey]: e.target.value || null })}>
              <option value="">Agent&apos;s normal voice</option>
              {voices.map(voice => <option key={voice.id} value={voice.id}>{voice.id}{voice.character ? ` · ${voice.character}` : ""} ({voice.gender})</option>)}
            </select></label>
            <label>Manner<select value={variant.speaking_style ?? ""} onChange={e => setVariant(variant.id, { speaking_style: (e.target.value || null) as SpeakingStyle | null })}>
              <option value="">Agent&apos;s normal manner</option>
              <option value="warm">Warm</option><option value="professional">Professional</option><option value="casual">Casual</option>
            </select></label>
          </div>
          <div className={styles.twoCol}>
            <label>Interruptions<select value={variant.interruption_preset ?? ""} onChange={e => setVariant(variant.id, { interruption_preset: e.target.value || null })}>
              <option value="">Normal settings</option>
              {catalog && Object.keys(catalog.interruption_presets).map(name => <option key={name} value={name}>{name[0].toUpperCase() + name.slice(1)}</option>)}
            </select></label>
            <label>Opening line<input placeholder="Agent's normal greeting" maxLength={1000} value={variant.greeting ?? ""} onChange={e => setVariant(variant.id, { greeting: e.target.value || null })} /></label>
          </div>
        </div>)}
      </div>
      <div className={styles.row}>
        <button disabled={value.variants.length >= MAX_VARIANTS} onClick={() => onChange({ ...value, variants: [...value.variants, { id: nextId(value.variants), label: "", weight: 50 }] })}>+ Add a variant</button>
        <button disabled={loading} onClick={refresh}>{loading ? "Loading…" : "Show results"}</button>
      </div>
      <p className={styles.hint}>Save below to start or change the test. Results count real conversations only (not voicemails or unanswered calls), and a winner is only named when the gap is unlikely to be chance.</p>
      {note && <p className={styles.notice} role="status">{note}</p>}
      {results && !results.active && <p className={styles.hint}>No test is running yet. Save to start it.</p>}
      {results?.active && results.variants && <>
        {results.verdict && <p className={styles.notice} role="status">
          {results.verdict.status === "winner" ? `Winner: variant ${results.verdict.winner?.toUpperCase()}. ` : ""}{results.verdict.message}
        </p>}
        <div className={styles.tableWrap}><table className={styles.results}>
          <thead><tr><th>Variant</th><th>Calls</th><th>Conversations</th><th>Good outcomes</th><th>Asked for a person</th><th>Avg length</th><th>Avg quality</th></tr></thead>
          <tbody>{results.variants.map(row => <tr key={row.id}>
            <td>{row.id.toUpperCase()} {row.label !== row.id ? `· ${row.label}` : ""}</td><td>{row.calls}</td><td>{row.connected}</td>
            <td>{percent(row.good_outcome_rate)}</td><td>{percent(row.human_request_rate)}</td>
            <td>{row.avg_duration_seconds === null ? "–" : `${Math.floor(row.avg_duration_seconds / 60)}m ${row.avg_duration_seconds % 60}s`}</td>
            <td>{row.avg_qa_score ?? "–"}</td>
          </tr>)}</tbody>
        </table></div>
      </>}
    </>}
  </>;
}
