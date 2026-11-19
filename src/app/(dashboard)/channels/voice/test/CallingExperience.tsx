"use client";

import { useEffect, useState } from "react";
import { voiceCallsApi, type VoiceStatus } from "@/lib/api/voice-calls";
import {
  voiceRealtimeApi,
  type InterruptionSettings,
  type RealtimeEngine,
  type RealtimeSettings,
  type RegionCatalog,
  type RegionVoiceOverride,
  type QaReport,
  type RoutedVoice,
  type VoiceOption,
} from "@/lib/api/voice-realtime";
import { ExperimentPanel } from "./ExperimentPanel";
import { VoiceCloneConsent } from "./VoiceCloneConsent";
import styles from "./page.module.scss";

interface Props {
  agentId: string;
  value: RealtimeSettings;
  onChange: (patch: Partial<RealtimeSettings>) => void;
  onSave: () => void;
  disabled?: boolean;
}

const ENGINE_LABEL: Record<RealtimeEngine, string> = {
  gemini_live: "Gemini Live (recommended): fastest and most natural",
  open: "Our free engine: no per-minute AI fees, a little slower",
  sarvam: "Sarvam: paid, built for Indian languages",
  auto: "Automatic: Indian languages on Sarvam, everything else on Gemini Live",
};

const ENGINE_NOTE: Record<RealtimeEngine, string> = {
  gemini_live: "Speech goes straight to Google's Live model and back, so replies start in under a second.",
  open: "Runs on our own servers: Whisper listens, Gemini's free text model thinks, Kokoro speaks. Expect replies 1.5 to 3 seconds after the caller stops, and a few languages (English, Hindi, Spanish, French, Italian, Japanese, Portuguese, Mandarin).",
  sarvam: "Needs a Sarvam key on the server. Best for Tamil, Telugu, Bengali and the other Indian languages.",
  auto: "Uses Sarvam for Indian languages when it is set up, and Gemini Live otherwise.",
};

const SENSITIVITY_LABEL = { low: "Hard to interrupt", balanced: "Balanced", high: "Stops at the first word" } as const;
const PATIENCE_LABEL = { quick: "Replies quickly", balanced: "Balanced", patient: "Waits through pauses" } as const;
const PRESET_LABEL: Record<string, string> = { steady: "Steady", balanced: "Balanced", snappy: "Snappy" };
const PRESET_NOTE: Record<string, string> = {
  steady: "Hard to interrupt and patient with pauses. For scripted, formal or noisy-line calls.",
  balanced: "A good default for most conversations.",
  snappy: "Stops on the first word and replies fast. For quick back-and-forth.",
};

/** The voice field a per-country override stores, for the engine that will speak. */
function voiceField(engine: string): "gemini_voice" | "open_voice" | "sarvam_speaker" {
  return engine === "open" ? "open_voice" : engine === "sarvam" ? "sarvam_speaker" : "gemini_voice";
}

function sameInterruption(a: InterruptionSettings, b: InterruptionSettings) {
  return (Object.keys(a) as (keyof InterruptionSettings)[]).every(key => a[key] === b[key]);
}

export function CallingExperience({ agentId, value, onChange, onSave, disabled }: Props) {
  const [catalog, setCatalog] = useState<RegionCatalog>();
  const [status, setStatus] = useState<VoiceStatus>();
  const [engine, setEngine] = useState<RealtimeEngine>("gemini_live");
  const [streaming, setStreaming] = useState(false);
  const [lineBusy, setLineBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [number, setNumber] = useState("");
  const [routed, setRouted] = useState<RoutedVoice>();
  const [newCountry, setNewCountry] = useState("");
  const [qa, setQa] = useState<QaReport>();

  useEffect(() => {
    void voiceRealtimeApi.catalog().then(setCatalog).catch(() => setMessage("Could not load the country and voice list."));
    void voiceCallsApi.status().then(next => {
      setStatus(next);
      setStreaming(Boolean(next.streaming_enabled));
      setEngine((next.engine as RealtimeEngine) || "gemini_live");
    }).catch(() => {});
  }, []);

  const canStream = Boolean(status?.capabilities?.includes("realtime"));
  const canTransfer = Boolean(status?.capabilities?.includes("live_transfer"));
  const interruption = value.interruption;
  const setInterruption = (patch: Partial<InterruptionSettings>) => onChange({ interruption: { ...interruption, ...patch } });
  const voicesFor = (target: string): VoiceOption[] =>
    !catalog ? [] : target === "open" ? catalog.open_voices : target === "sarvam" ? catalog.sarvam_speakers : catalog.gemini_voices;

  async function saveLine() {
    setLineBusy(true);
    try {
      await voiceCallsApi.updateStreamingSettings({ streaming_enabled: streaming, engine });
      setMessage(streaming ? "Real-time calls are on." : "Real-time calls are off. Calls use the slower turn-by-turn mode.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save.");
    } finally { setLineBusy(false); }
  }

  async function loadQa() {
    try { setQa(await voiceRealtimeApi.qa(agentId)); }
    catch { setMessage("Could not load checklist results."); }
  }

  async function tryNumber() {
    setRouted(undefined);
    try { setRouted(await voiceRealtimeApi.previewRouting(agentId, number.trim())); }
    catch { setMessage("Enter the number with its country code, for example +919876543210."); }
  }

  function setOverride(code: string, patch: RegionVoiceOverride | null) {
    const next = { ...value.region_voices };
    if (patch === null) delete next[code]; else next[code] = { ...next[code], ...patch };
    onChange({ region_voices: next });
  }

  const freeKey = "123456789*".split("").find(key => !(key in value.dtmf_menu));
  const overrideCodes = Object.keys(value.region_voices);
  const unused = catalog?.regions.filter(region => !overrideCodes.includes(region.code)) ?? [];
  const activePreset = catalog && Object.entries(catalog.interruption_presets).find(([, preset]) => sameInterruption(preset, interruption))?.[0];
  const spoken = (item: RoutedVoice) => {
    const name = catalog?.regions.find(region => region.code === item.region)?.name;
    const voice = item.engine === "open" ? item.open_voice : item.engine === "sarvam" ? item.sarvam_speaker : item.gemini_voice;
    const language = item.engine === "open" ? item.open_language : item.engine === "sarvam" ? item.sarvam_language : item.language;
    return `${name ? `${name}: ` : "Country not listed, using the agent's own voice: "}${language}, voice ${voice}, on ${item.engine === "gemini_live" ? "Gemini Live" : item.engine === "open" ? "our free engine" : "Sarvam"}.`;
  };

  return <section className={styles.card} aria-labelledby="calling-experience">
    <div><h2 id="calling-experience">Real-time calling experience</h2><p>How the agent sounds and behaves on live phone calls: which voice each country hears, and what happens when a caller talks over it.</p></div>
    {message && <p className={styles.notice} role="status">{message}</p>}

    <fieldset className={styles.fields} disabled={disabled}>
      <h3>Phone line</h3>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={streaming} disabled={!canStream || lineBusy} onChange={e => setStreaming(e.target.checked)} />
        <span>Real-time calls (low delay, caller can interrupt)</span>
      </label>
      {status && !canStream && <p className={styles.hint}>{status.provider_name ?? "This provider"} can&apos;t do real-time calls here. Twilio and Plivo can; other providers use the slower turn-by-turn mode.</p>}
      <label>AI engine<select value={engine} disabled={!canStream || lineBusy} onChange={e => setEngine(e.target.value as RealtimeEngine)}>
        {(Object.keys(ENGINE_LABEL) as RealtimeEngine[]).map(key => <option key={key} value={key}>{ENGINE_LABEL[key]}</option>)}
      </select></label>
      <p className={styles.hint}>{ENGINE_NOTE[engine]}</p>
      <div className={styles.row}><button className={styles.primary} disabled={!canStream || lineBusy} onClick={saveLine}>Save phone line settings</button></div>

      <h3>Voice by country</h3>
      <div className={styles.segmented} role="radiogroup" aria-label="Voice routing">
        {([["agent", "Same voice for everyone"], ["region", "Match the caller's country"]] as const).map(([key, label]) =>
          <button key={key} role="radio" aria-checked={value.voice_routing === key} className={value.voice_routing === key ? styles.segmentOn : undefined} onClick={() => onChange({ voice_routing: key })}>{label}</button>)}
      </div>
      <p className={styles.hint}>{value.voice_routing === "region"
        ? "The voice, and an English agent's accent (Indian English for Indian callers, British for UK), follow the country code of the number. A country we don't list keeps the agent's own voice."
        : "Every caller hears the voice below."}</p>
      <div className={styles.twoCol}>
        <label>Voice style<select value={value.voice_gender} onChange={e => onChange({ voice_gender: e.target.value as "female" | "male" })}><option value="female">Female</option><option value="male">Male</option></select></label>
        {value.voice_routing === "agent"
          ? <label>Agent voice<select value={engine === "open" ? value.open_voice : engine === "sarvam" ? value.live_speaker : value.live_voice}
              onChange={e => onChange(engine === "open" ? { open_voice: e.target.value } : engine === "sarvam" ? { live_speaker: e.target.value } : { live_voice: e.target.value })}>
              <option value="">Default</option>
              {voicesFor(engine).map(voice => <option key={voice.id} value={voice.id}>{voice.id}{voice.character ? ` · ${voice.character}` : ""} ({voice.gender})</option>)}
            </select></label>
          : <label className={styles.checkRow}><input type="checkbox" checked={value.local_language_greeting} onChange={e => onChange({ local_language_greeting: e.target.checked })} /><span>Greet in the caller&apos;s own language (Arabic for the UAE, Japanese for Japan)</span></label>}
      </div>

      {value.voice_routing === "region" && <>
        <h4>Country overrides</h4>
        {overrideCodes.length === 0 && <p className={styles.hint}>None yet. Add a country to choose its language, voice or engine yourself.</p>}
        {overrideCodes.map(code => {
          const region = catalog?.regions.find(item => item.code === code);
          const override = value.region_voices[code];
          const target = override.engine && override.engine !== "auto" ? override.engine : engine;
          const field = voiceField(target);
          return <div className={styles.overrideRow} key={code}>
            <strong>{region?.name ?? code}</strong>
            <select aria-label={`${code} language`} value={override.language ?? ""} onChange={e => setOverride(code, { language: e.target.value || null })}>
              <option value="">Region default{region ? ` (${region.english})` : ""}</option>
              {catalog?.gemini_languages.map(language => <option key={language}>{language}</option>)}
            </select>
            <select aria-label={`${code} voice`} value={override[field] ?? ""} onChange={e => setOverride(code, { [field]: e.target.value || null })}>
              <option value="">Region default</option>
              {voicesFor(target).map(voice => <option key={voice.id} value={voice.id}>{voice.id}{voice.character ? ` · ${voice.character}` : ""}</option>)}
            </select>
            <button aria-label={`Remove ${region?.name ?? code}`} onClick={() => setOverride(code, null)}>×</button>
          </div>;
        })}
        <div className={styles.row}>
          <select aria-label="Country to add" value={newCountry} onChange={e => setNewCountry(e.target.value)}>
            <option value="">Add a country…</option>
            {unused.map(region => <option key={region.code} value={region.code}>{region.name} ({region.dial_codes.join(", ")})</option>)}
          </select>
          <button disabled={!newCountry} onClick={() => { setOverride(newCountry, {}); setNewCountry(""); }}>Add</button>
        </div>
      </>}

      <div className={styles.row}>
        <input aria-label="Number to check" type="tel" placeholder="+971501234567" value={number} onChange={e => setNumber(e.target.value)} />
        <button disabled={!/^\+[1-9]\d{7,14}$/.test(number.trim())} onClick={tryNumber}>What would this caller hear?</button>
      </div>
      {routed && <p className={styles.notice} role="status">{spoken(routed)}</p>}
      <p className={styles.hint}>The check uses your saved settings. Save below first to include recent changes.</p>

      <h3>Interruptions</h3>
      {catalog && <div className={styles.presets}>{Object.keys(catalog.interruption_presets).map(name =>
        <button key={name} aria-pressed={activePreset === name} className={activePreset === name ? styles.segmentOn : undefined} onClick={() => onChange({ interruption: catalog.interruption_presets[name] })}>
          <strong>{PRESET_LABEL[name] ?? name}</strong><span>{PRESET_NOTE[name]}</span></button>)}</div>}
      <label className={styles.checkRow}><input type="checkbox" checked={interruption.enabled} onChange={e => setInterruption({ enabled: e.target.checked })} /><span>Callers can interrupt the agent</span></label>
      {!interruption.enabled && <p className={styles.hint}>The agent always finishes its sentence. Use this for legal wording, not for conversation.</p>}
      <div className={styles.twoCol}>
        <label>How readily speech interrupts<select disabled={!interruption.enabled} value={interruption.sensitivity} onChange={e => setInterruption({ sensitivity: e.target.value as InterruptionSettings["sensitivity"] })}>
          {Object.entries(SENSITIVITY_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>When the caller pauses<select value={interruption.patience} onChange={e => setInterruption({ patience: e.target.value as InterruptionSettings["patience"] })}>
          {Object.entries(PATIENCE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>
      <div className={styles.twoCol}>
        <label>Words before it counts as an interruption<input type="number" min={0} max={5} disabled={!interruption.enabled || engine !== "sarvam"} value={interruption.min_words} onChange={e => setInterruption({ min_words: Math.min(5, Math.max(0, Number(e.target.value) || 0)) })} /></label>
        <label>Check in after silence (seconds, 0 = never)<input type="number" min={0} max={60} value={interruption.idle_prompt_seconds} onChange={e => setInterruption({ idle_prompt_seconds: Math.min(60, Math.max(0, Number(e.target.value) || 0)) })} /></label>
      </div>
      <p className={styles.hint}>The word count only applies to the Sarvam engine, which transcribes as the caller speaks. Gemini Live uses the sensitivity setting instead.</p>
      <label className={styles.checkRow}><input type="checkbox" checked={interruption.protect_greeting} disabled={!interruption.enabled} onChange={e => setInterruption({ protect_greeting: e.target.checked })} /><span>Play the opening line in full (including any recording or AI notice)</span></label>

      <h3>How it speaks</h3>
      <label>Manner<select value={value.speaking_style} onChange={e => onChange({ speaking_style: e.target.value as RealtimeSettings["speaking_style"] })}>
        {catalog ? Object.entries(catalog.speaking_styles).map(([key, text]) => <option key={key} value={key}>{key[0].toUpperCase() + key.slice(1)}: {text}</option>) : <option>{value.speaking_style}</option>}</select></label>
      <p className={styles.hint}>The agent speaks in short, plain sentences, acknowledges before it answers, and says a few words before looking something up. If a caller sincerely asks, it says it is an AI assistant.{canTransfer ? " It can hand the call to your team when asked." : ""}</p>

      <h3>During the call</h3>
      <label className={styles.checkRow}><input type="checkbox" checked={value.live_alerts} onChange={e => onChange({ live_alerts: e.target.checked })} /><span>Tell me when a caller is getting angry (a notification, and a badge on the live call so you can listen in or take over)</span></label>
      <label className={styles.checkRow}><input type="checkbox" checked={value.allow_texts} onChange={e => onChange({ allow_texts: e.target.checked })} /><span>The agent can text the caller something (an address, a link). Up to 3 texts per call, only to the number on the call</span></label>
      <label className={styles.checkRow}><input type="checkbox" checked={value.allow_payment_links} onChange={e => onChange({ allow_payment_links: e.target.checked })} /><span>The agent can text a UPI payment link for an amount the caller agreed to</span></label>
      <p className={styles.hint}>Payment links need your UPI ID under payment settings, and are for 1 to 1,00,000 rupees. UPI does not report payments back, so the agent never says a payment was received: you confirm it.</p>
      <label className={styles.checkRow}><input type="checkbox" checked={value.engine_fallback} onChange={e => onChange({ engine_fallback: e.target.checked })} /><span>If Gemini Live is failing (limits or an outage), move calls to the free engine instead of dropping them</span></label>
      <p className={styles.hint}>Only for languages the free engine speaks. A call is moved at most once, and after a few failures new calls skip Gemini Live for a few minutes.</p>

      <h3>Keypad menu</h3>
      <p className={styles.hint}>Callers can press keys as well as speak. Pressing 0 always asks for a person{canTransfer ? "" : " (needs a team number under Rules)"}. Digits a caller types, ended with # or a pause, are read back to confirm.</p>
      {Object.entries(value.dtmf_menu).map(([key, label]) => <div className={styles.keyRow} key={key}>
        <strong>Press {key}</strong>
        <input aria-label={`Label for key ${key}`} placeholder="What it means, e.g. Sales" maxLength={80} value={label} onChange={e => onChange({ dtmf_menu: { ...value.dtmf_menu, [key]: e.target.value } })} />
        <button aria-label={`Remove key ${key}`} onClick={() => { const next = { ...value.dtmf_menu }; delete next[key]; onChange({ dtmf_menu: next }); }}>×</button>
      </div>)}
      <div className={styles.row}><button disabled={!freeKey} onClick={() => freeKey && onChange({ dtmf_menu: { ...value.dtmf_menu, [freeKey]: "" } })}>+ Add a key</button></div>

      <h3>Departments</h3>
      <p className={styles.hint}>One number, several desks. The agent answers, works out what the caller needs, and connects them. A desk with a phone number is a live hand-off to that person (they hear a briefing first). A desk without one is a role: the same agent takes on its instructions for the rest of the call, in the same voice.</p>
      {value.departments.map((desk, index) => <div className={styles.variant} key={index}>
        <div className={styles.row}>
          <input aria-label={`Department ${index + 1} name`} placeholder="Name, e.g. Billing" maxLength={40} value={desk.name} onChange={e => onChange({ departments: value.departments.map((d, n) => n === index ? { ...d, name: e.target.value } : d) })} />
          <input aria-label={`Department ${index + 1} number`} type="tel" placeholder="Person's number (optional)" value={desk.phone} onChange={e => onChange({ departments: value.departments.map((d, n) => n === index ? { ...d, phone: e.target.value } : d) })} />
          <button aria-label={`Remove department ${index + 1}`} onClick={() => onChange({ departments: value.departments.filter((_, n) => n !== index) })}>×</button>
        </div>
        <input aria-label={`Department ${index + 1} when to use`} placeholder="When to send callers here, e.g. refunds, invoices, payment problems" maxLength={200} value={desk.description} onChange={e => onChange({ departments: value.departments.map((d, n) => n === index ? { ...d, description: e.target.value } : d) })} />
        {!desk.phone && <textarea aria-label={`Department ${index + 1} instructions`} placeholder="How this desk behaves and what it should know" maxLength={1500} value={desk.instructions} onChange={e => onChange({ departments: value.departments.map((d, n) => n === index ? { ...d, instructions: e.target.value } : d) })} />}
      </div>)}
      <div className={styles.row}><button disabled={value.departments.length >= 8} onClick={() => onChange({ departments: [...value.departments, { name: "", description: "", phone: "", instructions: "" }] })}>+ Add a department</button></div>

      <h3>Call quality checklist</h3>
      <p className={styles.hint}>Things the agent must do on every call, such as &quot;asks for the caller&apos;s email&quot; or &quot;never quotes a discount&quot;. Each call is scored pass or fail per item with a few words of evidence, using the same analysis that already reads the call. Items that did not apply to a call are left out.</p>
      {value.qa_checklist.map((item, index) => <div className={styles.keyRow} style={{ gridTemplateColumns: "1fr 38px" }} key={index}>
        <input aria-label={`Checklist item ${index + 1}`} maxLength={160} placeholder="e.g. Asks for an email address" value={item} onChange={e => onChange({ qa_checklist: value.qa_checklist.map((v, n) => n === index ? e.target.value : v) })} />
        <button aria-label={`Remove checklist item ${index + 1}`} onClick={() => onChange({ qa_checklist: value.qa_checklist.filter((_, n) => n !== index) })}>×</button>
      </div>)}
      <div className={styles.row}>
        <button disabled={value.qa_checklist.length >= 10} onClick={() => onChange({ qa_checklist: [...value.qa_checklist, ""] })}>+ Add an item</button>
        <button onClick={loadQa}>Show pass rates (30 days)</button>
      </div>
      {qa && (qa.items.length === 0
        ? <p className={styles.hint}>Save a checklist and take some calls to see results here.</p>
        : <div className={styles.tableWrap}><table className={styles.results}>
            <thead><tr><th>Item</th><th>Met</th><th>Missed</th><th>Pass rate</th></tr></thead>
            <tbody>{qa.items.map(row => <tr key={row.item}><td>{row.item}</td><td>{row.met}</td><td>{row.missed}</td><td>{row.pass_rate === null ? "–" : `${Math.round(row.pass_rate * 100)}%`}</td></tr>)}</tbody>
          </table><p className={styles.hint}>{qa.calls} scored calls{qa.average_score !== null ? `, average ${qa.average_score}%` : ""}.</p></div>)}

      <VoiceCloneConsent selected={value.cloned_voice_id} onSelect={id => onChange({ cloned_voice_id: id })} />

      <ExperimentPanel agentId={agentId} value={value.experiment} onChange={experiment => onChange({ experiment })} catalog={catalog} engine={engine} />

      <button className={styles.primary} onClick={onSave}>Save calling experience</button>
    </fieldset>
  </section>;
}
