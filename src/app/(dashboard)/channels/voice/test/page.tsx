"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { VoicePicker } from "@/components/features/voice/VoicePicker";
import { REALTIME_DEFAULTS, type RealtimeSettings } from "@/lib/api/voice-realtime";
import { CallingExperience } from "./CallingExperience";
import styles from "./page.module.scss";
import { useEmbedded } from "@/components/layout/Embedded";
import { parseServerDate } from "@/lib/utils/date";

type Field = { key: string; label: string; type: string };
type Language = { code: string; name: string; native: string; group: "india" | "world"; builtin_voices: number; sarvam: boolean };
type Settings = { provider: string; region?: string; call_voice_source: string; language: string; voice_id: string; call_voice?: string; greeting: string; extraction_schema: Field[]; has_api_key?: boolean } & RealtimeSettings;
type Reply = { call_sid?: string; reply: string; audio?: string; audio_mode?: string; audio_error?: string; should_hangup?: boolean };
type Schedule = { id: string; to_number: string; scheduled_at: string; status: string; error?: string };
type SpeechEvent = { resultIndex: number; results: { length: number; [index: number]: { isFinal: boolean; [index: number]: { transcript: string } } } };
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: SpeechEvent) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; start(): void; stop(): void; abort(): void };
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

const languages = [
  ["en-IN", "English (India)"], ["hi-IN", "Hindi"], ["bn-IN", "Bengali"], ["ta-IN", "Tamil"], ["te-IN", "Telugu"],
  ["mr-IN", "Marathi"], ["gu-IN", "Gujarati"], ["kn-IN", "Kannada"], ["ml-IN", "Malayalam"], ["pa-IN", "Punjabi"],
  ["or-IN", "Odia"], ["as-IN", "Assamese"], ["ur-IN", "Urdu"], ["ne-NP", "Nepali"], ["sa-IN", "Sanskrit"],
  ["ks-IN", "Kashmiri"], ["kok-IN", "Konkani"], ["mai-IN", "Maithili"], ["mni-IN", "Manipuri"], ["sd-IN", "Sindhi"],
  ["doi-IN", "Dogri"], ["sat-IN", "Santali"], ["brx-IN", "Bodo"], ["en-US", "English (US)"], ["en-GB", "English (UK)"],
  ["es-ES", "Spanish"], ["fr-FR", "French"], ["de-DE", "German"], ["pt-BR", "Portuguese"], ["ar-SA", "Arabic"],
  ["zh-CN", "Chinese"], ["ja-JP", "Japanese"], ["ko-KR", "Korean"], ["ru-RU", "Russian"], ["it-IT", "Italian"],
  ["tr-TR", "Turkish"], ["id-ID", "Indonesian"], ["vi-VN", "Vietnamese"], ["th-TH", "Thai"], ["nl-NL", "Dutch"],
];
const defaults: Settings = { ...REALTIME_DEFAULTS, provider: "google", call_voice_source: "twilio", language: "en-IN", voice_id: "", call_voice: "", greeting: "Hi! How can I help you today?", extraction_schema: [] };

export default function VoiceTestingPage() {
  const { business } = useActiveBusiness();
  return <VoiceWorkspace key={business?.agent_id ?? "none"} agentId={business?.agent_id ?? undefined} />;
}

function VoiceWorkspace({ agentId }: { agentId?: string }) {
  const embedded = useEmbedded();
  const [config, setConfig] = useState<Settings>(defaults);
  const [apiKey, setApiKey] = useState("");
  // The server's language list (with which ones have built-in voices); the short list above is the fallback.
  const [catalog, setCatalog] = useState<Language[]>([]);
  const [readiness, setReadiness] = useState<Record<string, boolean | string>>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [callId, setCallId] = useState("");
  const [lastCallId, setLastCallId] = useState("");
  const [turns, setTurns] = useState<{ role: string; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [latency, setLatency] = useState<number>();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [phone, setPhone] = useState("");
  const [when, setWhen] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const activeCall = useRef("");
  const sending = useRef(false);
  const bottom = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!agentId) return;
    let canceled = false;
    api.get<Settings>(`/channels/voice/agents/${agentId}/call-settings`).then(value => {
      if (!canceled) { setConfig({ ...defaults, ...value }); setLoaded(true); setApiKey(""); }
    }).catch(() => { if (!canceled) setMessage("Could not load calling settings."); });
    return () => { canceled = true; };
  }, [agentId]);

  useEffect(() => {
    void api.get<{ languages: Language[] }>("/channels/voice/voice-languages").then(value => setCatalog(value.languages)).catch(() => {});
    void api.get<Record<string, boolean | string>>("/channels/voice/readiness").then(setReadiness).catch(() => {});
    const load = () => api.get<Schedule[]>("/channels/voice/schedules").then(setSchedules).catch(() => setMessage("Could not refresh schedules."));
    void load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [turns, interim]);
  useEffect(() => () => {
    recognition.current?.abort(); player.current?.pause(); window.speechSynthesis?.cancel();
    if (activeCall.current) void api.post(`/channels/voice/preview/${activeCall.current}/finish`).catch(() => {});
  }, []);

  function stopAudio() { player.current?.pause(); window.speechSynthesis?.cancel(); }
  function speak(reply: Reply) {
    stopAudio();
    setHasAudio(Boolean(reply.audio));
    if (reply.audio_error) { setMessage(reply.audio_error); return; }
    if (reply.audio) {
      player.current = new Audio(reply.audio);
      void player.current.play().catch(() => setMessage("Audio playback was blocked. Use Replay to listen."));
    } else if (reply.audio_mode === "browser" && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(reply.reply);
      utterance.lang = config.language;
      window.speechSynthesis.speak(utterance);
    }
  }
  function errorText(error: unknown) { return error instanceof Error ? error.message : "The request failed. Please try again."; }
  async function save() {
    if (!agentId) return;
    setBusy(true);
    try {
      const value = await api.put<Settings>(`/channels/voice/agents/${agentId}/call-settings`, { ...config, ...(apiKey ? { api_key: apiKey } : {}) });
      setConfig({ ...defaults, ...value }); setApiKey(""); setMessage("Calling settings saved.");
    } catch (error) { setMessage(errorText(error)); } finally { setBusy(false); }
  }
  async function start() {
    if (!agentId) return;
    setBusy(true); setMessage(""); setTurns([]);
    try {
      const reply = await api.post<Reply>("/channels/voice/preview", { agent_id: agentId });
      setCallId(reply.call_sid!); activeCall.current = reply.call_sid!;
      setTurns([{ role: "Agent", text: reply.reply }]); speak(reply);
    } catch (error) { setMessage(errorText(error)); } finally { setBusy(false); }
  }
  async function finish() {
    recognition.current?.abort(); stopAudio(); setBusy(true);
    try {
      await api.post(`/channels/voice/preview/${callId}/finish`);
      setLastCallId(callId); setCallId(""); activeCall.current = "";
      setMessage("Test saved. Analysis is being generated; open the call report shortly.");
    } catch (error) { setMessage(errorText(error)); } finally { setBusy(false); }
  }
  async function send(text: string) {
    if (!text.trim() || busy || sending.current || !callId) return;
    sending.current = true;
    recognition.current?.stop(); stopAudio(); setBusy(true); setDraft(""); setInterim("");
    setTurns(value => [...value, { role: "You", text }]);
    const startTime = performance.now();
    try {
      const reply = await api.post<Reply>(`/channels/voice/preview/${callId}/turn`, { text });
      setLatency(Math.round(performance.now() - startTime));
      setTurns(value => [...value, { role: "Agent", text: reply.reply }]); speak(reply);
      if (reply.should_hangup) setMessage("The agent has concluded the conversation. End the test to save analysis.");
    } catch (error) { setMessage(errorText(error)); setDraft(text); } finally { sending.current = false; setBusy(false); }
  }
  function microphone() {
    if (listening) { recognition.current?.stop(); return; }
    const Speech = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
    if (!Speech) { setMessage("Speech recognition is unavailable in this browser. Use Chrome or Edge, or type a message."); return; }
    stopAudio();
    const instance = new Speech(); recognition.current = instance;
    instance.lang = config.language; instance.interimResults = true; instance.continuous = false;
    instance.onresult = event => {
      let partial = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) void send(result[0].transcript);
        else partial += result[0].transcript;
      }
      setInterim(partial);
    };
    instance.onend = () => { setListening(false); setInterim(""); };
    instance.onerror = event => { setListening(false); setMessage(`Microphone: ${event.error}. Check browser permissions or type below.`); };
    try { instance.start(); setListening(true); } catch (error) { setMessage(errorText(error)); }
  }
  async function schedule() {
    if (!when || !phone) return;
    setBusy(true);
    try {
      await api.post("/channels/voice/schedules", { agent_id: agentId, to_number: phone, scheduled_at: new Date(when).toISOString(), opening_message: config.greeting });
      setSchedules(await api.get<Schedule[]>("/channels/voice/schedules")); setMessage("Call scheduled."); setWhen("");
    } catch (error) { setMessage(errorText(error)); } finally { setBusy(false); }
  }

  return <main className={styles.page}>
    {!embedded && (<header className={styles.header}><div><Link href="/channels/voice">← Voice calling</Link><h1>Voice, language & testing</h1><p>Rehearse conversations, configure speech, and choose when your agent calls.</p></div><Link href="/channels/voice/studio/builder">Edit call flow →</Link></header>)}
    {message && <p className={styles.notice} role="status">{message}</p>}
    <div className={styles.row} aria-label="Voice readiness">{[["phone_connected", "Phone provider"], ["agent_linked", "Linked agent"], ["streaming_configured", "Streaming service"], ["audio_storage_configured", "Phone TTS audio storage"], ["piper_installed", "Local Piper"]].map(([key, title]) => <span className={styles.hint} key={key}>{readiness[key] ? "✓" : "✗"} {title}{readiness[key] ? "" : " (not set up)"}</span>)}</div>
    {!agentId && <p>Select a business with an agent to configure calling.</p>}
    <div className={styles.grid}>
      <section className={styles.card}><h2>Calling settings</h2><p>These settings apply to phone conversations and browser tests. Save before starting a test.</p>
        <fieldset disabled={!loaded || busy || !!callId} className={styles.fields}>
          <label>Language<select value={config.language} onChange={e => setConfig({ ...config, language: e.target.value, call_voice: "", voice_id: "" })}>
            {catalog.length ? (["india", "world"] as const).map(group => <optgroup key={group} label={group === "india" ? "Indian languages" : "World languages"}>
              {catalog.filter(item => item.group === group).map(item => <option key={item.code} value={item.code}>{item.name}{item.native !== item.name && item.native !== "English" ? ` · ${item.native}` : ""}{item.builtin_voices ? "" : item.sarvam ? " (via Sarvam)" : " (speech provider needed)"}</option>)}
            </optgroup>) : languages.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select></label>
          <label>Speech source<select value={config.call_voice_source} onChange={e => setConfig({ ...config, call_voice_source: e.target.value })}><option value="twilio">Built-in voice (no extra setup)</option><option value="tts_provider">A speech provider (your own API key)</option></select></label>
          {config.call_voice_source === "tts_provider" && <label>Speech provider<select value={config.provider} onChange={e => { setApiKey(""); setConfig({ ...config, provider: e.target.value, voice_id: "", has_api_key: false }); }}><option value="google">Google Cloud TTS · paid / free tier</option><option value="elevenlabs">ElevenLabs · paid</option><option value="openai">OpenAI · paid</option><option value="sarvam">Sarvam Bulbul · Indian languages</option><option value="deepgram">Deepgram Aura · paid</option><option value="azure">Microsoft Azure Speech · paid / free tier</option><option value="piper">Piper · open source, local model</option></select></label>}
          {config.call_voice_source === "tts_provider" && config.provider === "azure" && <label>Azure region<input value={config.region ?? ""} onChange={e => setConfig({ ...config, region: e.target.value })} placeholder="centralindia" /></label>}
          {config.call_voice_source === "tts_provider" && config.provider !== "piper" && <label>Provider API key<input type="password" autoComplete="new-password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={config.has_api_key ? "Saved securely; leave blank to keep" : "Leave blank to use server credentials"} /></label>}
          <h3>Voice</h3>
          {agentId && loaded && (config.call_voice_source === "twilio"
            ? <VoicePicker agentId={agentId} source="twilio" provider={config.provider} language={config.language} value={config.call_voice ?? ""} onChange={id => setConfig({ ...config, call_voice: id })} />
            : <VoicePicker agentId={agentId} source="tts_provider" provider={config.provider} language={config.language} region={config.region} apiKey={apiKey} value={config.voice_id} onChange={id => setConfig({ ...config, voice_id: id })} />)}
          {config.call_voice_source === "tts_provider" && <label>Or enter a voice ID yourself<input value={config.voice_id} onChange={e => setConfig({ ...config, voice_id: e.target.value })} placeholder="Provider default" /></label>}
          <p className={styles.hint}>Voices are listed for the language chosen above. Built-in voices work on Twilio numbers; other phone providers use their own default voice. Save, then place a test call to hear it on the line.</p>
          <label>Opening message<textarea value={config.greeting} onChange={e => setConfig({ ...config, greeting: e.target.value })} /></label>
          <h3>Details to extract after calls</h3><p className={styles.hint}>For example: customer_name, budget, appointment_date. Only information mentioned in the conversation is saved.</p>
          {config.extraction_schema.map((field, i) => <div className={styles.fieldRow} key={i}>
            <input aria-label={`Field ${i + 1} key`} placeholder="customer_name" value={field.key} onChange={e => setConfig({ ...config, extraction_schema: config.extraction_schema.map((v, n) => n === i ? { ...v, key: e.target.value } : v) })} />
            <input aria-label={`Field ${i + 1} description`} placeholder="Customer's name" value={field.label} onChange={e => setConfig({ ...config, extraction_schema: config.extraction_schema.map((v, n) => n === i ? { ...v, label: e.target.value } : v) })} />
            <select aria-label={`Field ${i + 1} type`} value={field.type} onChange={e => setConfig({ ...config, extraction_schema: config.extraction_schema.map((v, n) => n === i ? { ...v, type: e.target.value } : v) })}>{["string", "number", "boolean", "date", "email", "phone"].map(type => <option key={type}>{type}</option>)}</select>
            <button aria-label={`Remove field ${i + 1}`} onClick={() => setConfig({ ...config, extraction_schema: config.extraction_schema.filter((_, n) => n !== i) })}>×</button>
          </div>)}
          <button disabled={config.extraction_schema.length >= 20} onClick={() => setConfig({ ...config, extraction_schema: [...config.extraction_schema, { key: "", label: "", type: "string" }] })}>+ Add detail</button>
          <button className={styles.primary} onClick={save}>Save calling settings</button>
        </fieldset>
      </section>
      <section className={styles.card}><div className={styles.row}><h2>Test your voice agent</h2><span className={styles.pill}>{callId ? listening ? "Listening" : busy ? "Thinking" : "Connected" : "Ready"}</span></div>
        <p>Uses the published flow and phone turn handler. Click the microphone for each turn; recognized speech appears live.</p>
        {config.call_voice_source === "twilio" && <p className={styles.hint}>This browser test uses your browser&apos;s voice. Phone calls use the built-in voice you picked; press Listen on a voice to hear it.</p>}
        <div className={styles.transcript} aria-live="polite">{!turns.length && <p className={styles.placeholder}>Start a test to hear your agent’s opening message.</p>}{turns.map((turn, i) => <article key={i} className={turn.role === "You" ? styles.caller : styles.agent}><strong>{turn.role}</strong><p>{turn.text}</p></article>)}{interim && <article className={styles.caller}><strong>You · listening</strong><p>{interim}</p></article>}<div ref={bottom} /></div>
        {latency !== undefined && <p className={styles.hint}>Last reply including speech generation: {latency} ms</p>}
        <div className={styles.row}>{!callId ? <button className={styles.primary} disabled={!loaded || busy} onClick={start}>Start test call</button> : <><button disabled={busy} onClick={microphone}>{listening ? "Stop listening" : "🎙 Speak"}</button><button disabled={busy} onClick={finish}>End & analyze</button></>}<button onClick={stopAudio}>Stop audio</button>{hasAudio && <button onClick={() => { if (player.current) { player.current.currentTime = 0; void player.current.play().catch(() => setMessage("Playback failed.")); } }}>Replay</button>}</div>
        <form className={styles.row} onSubmit={e => { e.preventDefault(); void send(draft); }}><input aria-label="Message to agent" placeholder="Or type what you would say…" value={draft} onChange={e => setDraft(e.target.value)} disabled={!callId || busy} /><button disabled={!callId || busy || !draft.trim()}>Send</button></form>
        {lastCallId && <Link href={`/channels/voice/calls/${lastCallId}`}>View saved transcript & analysis →</Link>}
      </section>
    </div>
    {agentId && loaded && <CallingExperience agentId={agentId} value={config} onChange={patch => setConfig(current => ({ ...current, ...patch }))} onSave={save} disabled={busy || !!callId} />}
    <section className={styles.card}><h2>Schedule a phone call</h2><p>Calls use your connected phone number and linked agent. Time is shown in your device’s timezone.</p>
      <div className={styles.row}><label>Phone number<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+919876543210" /></label><label>Call at<input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} /></label><button className={styles.primary} disabled={busy || !phone || !when || !readiness.phone_connected || !readiness.agent_linked} onClick={schedule}>Schedule call</button></div>
      <div className={styles.scheduleList}>{schedules.map(item => <div key={item.id} className={styles.schedule}><strong>{item.to_number}</strong><span>{parseServerDate(item.scheduled_at).toLocaleString()}</span><span>{item.status}</span>{item.error && <span>{item.error}</span>}{item.status === "scheduled" && <button onClick={async () => { try { await api.delete(`/channels/voice/schedules/${item.id}`); setSchedules(await api.get<Schedule[]>("/channels/voice/schedules")); } catch (error) { setMessage(errorText(error)); } }}>Cancel</button>}</div>)}{!schedules.length && <p>No scheduled calls yet.</p>}</div>
    </section>
  </main>;
}
