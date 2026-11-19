"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { CheckMark } from "./VoiceIcons";
import styles from "./VoiceCenter.module.scss";

export interface CallVoice {
  id: string;
  name: string;
  gender: "female" | "male" | null;
  tier: "natural" | "neural" | "standard";
  locale: string;
}

interface VoiceList {
  voices: CallVoice[];
  note: string;
}

interface VoicePickerProps {
  agentId: string;
  /** "twilio" = the phone provider's own voices; "tts_provider" = a speech provider's. */
  source: string;
  provider: string;
  language: string;
  region?: string;
  /** A key typed but not saved yet, so voices can be listed before saving. */
  apiKey?: string;
  value: string;
  onChange: (voiceId: string) => void;
  disabled?: boolean;
}

const TIER_LABEL: Record<CallVoice["tier"], string> = {
  natural: "Most natural",
  neural: "Natural",
  standard: "Basic",
};
const TIERS: CallVoice["tier"][] = ["natural", "neural", "standard"];

type Gender = "all" | "female" | "male";

function PlayIcon({ playing }: { playing: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      {playing ? <path d="M6 4h3v12H6zM11 4h3v12h-3z" /> : <path d="M6 3.5v13l11-6.5z" />}
    </svg>
  );
}

/**
 * Pick the voice callers hear, from the list that actually exists for the
 * chosen language, and listen to one before choosing it.
 */
export function VoicePicker({ agentId, source, provider, language, region = "", apiKey = "", value, onChange, disabled }: VoicePickerProps) {
  const [gender, setGender] = useState<Gender>("all");
  const [playing, setPlaying] = useState("");
  const [loadingSample, setLoadingSample] = useState("");
  const [sampleError, setSampleError] = useState("");
  const player = useRef<HTMLAudioElement | null>(null);
  const body = { source, provider, language, region, ...(apiKey ? { api_key: apiKey } : {}) };

  const { data, isLoading, error } = useAsync<VoiceList>(
    () => api.post<VoiceList>(`/channels/voice/agents/${agentId}/voices`, body),
    // The typed key is deliberately not a dependency: listing on every keystroke would hammer the provider.
    [agentId, source, provider, language, region],
  );

  useEffect(() => () => { player.current?.pause(); }, []);

  function stop() {
    player.current?.pause();
    player.current = null;
    setPlaying("");
  }

  async function listen(voice: CallVoice) {
    if (playing === voice.id) { stop(); return; }
    stop();
    setSampleError("");
    setLoadingSample(voice.id);
    try {
      const { audio } = await api.post<{ audio: string }>(`/channels/voice/agents/${agentId}/voice-sample`, { ...body, voice: voice.id });
      const clip = new Audio(audio);
      player.current = clip;
      clip.onended = () => setPlaying("");
      await clip.play();
      setPlaying(voice.id);
    } catch (err) {
      setSampleError(err instanceof ApiError ? err.userMessage : "Couldn't play a sample of this voice.");
    } finally {
      setLoadingSample("");
    }
  }

  if (isLoading) return <div className={styles.voiceEmpty}>Loading voices…</div>;
  if (!data) return <div className={styles.voiceEmpty}>{error ?? "Couldn't load voices. Try again."}</div>;

  const voices = data.voices;
  const hasGenders = voices.some((voice) => voice.gender);
  const shown = voices.filter((voice) => gender === "all" || voice.gender === gender);
  const isUnknownSaved = Boolean(value) && !voices.some((voice) => voice.id === value);

  return (
    <div className={styles.voicePicker} aria-disabled={disabled || undefined}>
      {data.note && <p className={styles.voiceNote}>{data.note}</p>}
      {isUnknownSaved && voices.length > 0 && (
        <p className={styles.voiceNote}>The saved voice isn&apos;t available for this language. Pick one below, or the default voice is used.</p>
      )}

      {voices.length > 0 && (
        <>
          <div className={styles.voiceToolbar}>
            <span className={styles.muted}>{voices.length} voice{voices.length === 1 ? "" : "s"} in this language</span>
            {hasGenders && (
              <div className={styles.segmented} style={{ marginBottom: 0 }} role="tablist" aria-label="Filter by voice">
                {(["all", "female", "male"] as const).map((option) => (
                  <button key={option} type="button" role="tab" aria-selected={gender === option} data-active={gender === option || undefined} onClick={() => setGender(option)}>
                    {option === "all" ? "All" : option === "female" ? "Female" : "Male"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className={styles.voiceRow}
            data-selected={!value || undefined}
            disabled={disabled}
            onClick={() => onChange("")}
          >
            <span className={styles.voiceCheck}>{!value && <CheckMark size={14} />}</span>
            <span className={styles.voiceName}>Default voice</span>
            <span className={styles.voiceMeta}>Chosen by the provider for this language</span>
          </button>

          {TIERS.map((tier) => {
            const group = shown.filter((voice) => voice.tier === tier);
            if (!group.length) return null;
            return (
              <div key={tier}>
                <div className={styles.voiceTier}>{TIER_LABEL[tier]}</div>
                <div className={styles.voiceGrid}>
                  {group.map((voice) => (
                    <div key={voice.id} className={styles.voiceCard} data-selected={value === voice.id || undefined}>
                      <button type="button" className={styles.voicePick} disabled={disabled} onClick={() => onChange(voice.id)} aria-pressed={value === voice.id}>
                        <span className={styles.voiceCheck}>{value === voice.id && <CheckMark size={14} />}</span>
                        <span className={styles.voiceName}>{voice.name}</span>
                        {voice.gender && <span className={styles.voiceMeta}>{voice.gender === "female" ? "Female" : "Male"}</span>}
                      </button>
                      <button
                        type="button"
                        className={styles.voiceListen}
                        onClick={() => listen(voice)}
                        disabled={loadingSample === voice.id}
                        aria-label={playing === voice.id ? `Stop ${voice.name}` : `Listen to ${voice.name}`}
                        title={playing === voice.id ? "Stop" : "Listen"}
                      >
                        {loadingSample === voice.id ? "…" : <PlayIcon playing={playing === voice.id} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {sampleError && <p className={styles.voiceNote} role="alert">{sampleError}</p>}
        </>
      )}
    </div>
  );
}
