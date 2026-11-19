"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card, Input, Select, Textarea } from "@/components/ui";
import {
  templateFlowsApi,
  ApiError,
  type Agent,
  type FlowButton,
  type FlowChannel,
  type FlowStep,
  type FlowTriggerType,
} from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { FlowPreview } from "./FlowPreview";
import styles from "./FlowCreateForm.module.scss";

const MAX_BUTTONS_PER_STEP = 3;

function makeStepId(existing: FlowStep[]): string {
  let n = existing.length + 1;
  while (existing.some((s) => s.step_id === `s${n}`)) n += 1;
  return `s${n}`;
}

function makeButtonId(): string {
  return `btn_${Math.random().toString(36).slice(2, 9)}`;
}

function emptyStep(stepId: string): FlowStep {
  return { step_id: stepId, message: "", buttons: [] };
}

export function FlowCreateForm({ agents, onCreated }: { agents: Agent[]; onCreated: () => void }) {
  const { show } = useToast();

  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [channel, setChannel] = useState<FlowChannel>("whatsapp");
  const [triggerType, setTriggerType] = useState<FlowTriggerType>("first_message");

  const firstStepId = "s1";
  const [steps, setSteps] = useState<FlowStep[]>([emptyStep(firstStepId)]);
  const [entryStepId, setEntryStepId] = useState(firstStepId);
  const [activeStepId, setActiveStepId] = useState(firstStepId);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeStep = steps.find((s) => s.step_id === activeStepId) ?? steps[0] ?? null;

  function addStep() {
    const stepId = makeStepId(steps);
    setSteps((prev) => [...prev, emptyStep(stepId)]);
    setActiveStepId(stepId);
  }

  function removeStep(stepId: string) {
    if (steps.length <= 1) return;
    setSteps((prev) =>
      prev
        .filter((s) => s.step_id !== stepId)
        .map((s) => ({
          ...s,
          buttons: s.buttons.map((b) => (b.next_step_id === stepId ? { ...b, next_step_id: null } : b)),
        }))
    );
    if (entryStepId === stepId) {
      const remaining = steps.filter((s) => s.step_id !== stepId);
      setEntryStepId(remaining[0]?.step_id ?? "");
    }
    if (activeStepId === stepId) {
      const remaining = steps.filter((s) => s.step_id !== stepId);
      setActiveStepId(remaining[0]?.step_id ?? "");
    }
  }

  function updateStep(stepId: string, patch: Partial<FlowStep>) {
    setSteps((prev) => prev.map((s) => (s.step_id === stepId ? { ...s, ...patch } : s)));
  }

  function addButton(stepId: string) {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.step_id !== stepId) return s;
        if (s.buttons.length >= MAX_BUTTONS_PER_STEP) {
          show(`Each step allows a maximum of ${MAX_BUTTONS_PER_STEP} buttons (WhatsApp limit).`, "error");
          return s;
        }
        return { ...s, buttons: [...s.buttons, { id: makeButtonId(), title: "", next_step_id: null }] };
      })
    );
  }

  function updateButton(stepId: string, buttonId: string, patch: Partial<FlowButton>) {
    setSteps((prev) =>
      prev.map((s) =>
        s.step_id !== stepId
          ? s
          : { ...s, buttons: s.buttons.map((b) => (b.id === buttonId ? { ...b, ...patch } : b)) }
      )
    );
  }

  function removeButton(stepId: string, buttonId: string) {
    setSteps((prev) =>
      prev.map((s) => (s.step_id !== stepId ? s : { ...s, buttons: s.buttons.filter((b) => b.id !== buttonId) }))
    );
  }

  const isGreeting = triggerType === "first_message";
  const nameValid = name.trim().length > 0;
  const stepsValid = steps.every((s) => s.message.trim().length > 0 && s.buttons.every((b) => b.title.trim().length > 0));
  const greetingStepCountValid = !isGreeting || steps.length === 1;
  const canSubmit = nameValid && agentId && entryStepId && stepsValid && greetingStepCountValid && !isSubmitting;

  const validationHint = useMemo(() => {
    if (!nameValid) return "Give this flow a name.";
    if (!agentId) return "Select which agent this flow belongs to.";
    if (!greetingStepCountValid) return 'A first-message greeting can only have one step. Switch trigger type to "Manual" to build a multi-step flow.';
    if (!stepsValid) return "Every step needs a message, and every button needs a label.";
    return null;
  }, [nameValid, agentId, greetingStepCountValid, stepsValid]);

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const res = await templateFlowsApi.create({
        agent_id: agentId,
        channel,
        name: name.trim(),
        trigger_type: triggerType,
        entry_step_id: entryStepId,
        steps,
        active: true,
      });
      if (res.success) {
        show(`Flow "${name}" created and activated.`, "success");
        onCreated();
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't create flow. Please try again.";
      show(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.layout}>
      <div className={styles.formColumn}>
        <Card className={styles.section}>
          <div className={styles.sectionTitle}>Basics</div>
          <div className={styles.fieldGrid}>
            <Input label="Flow name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Welcome flow" />
            <Select label="Agent" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Select label="Channel" value={channel} onChange={(e) => setChannel(e.target.value as FlowChannel)}>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
            </Select>
            <Select label="Trigger" value={triggerType} onChange={(e) => setTriggerType(e.target.value as FlowTriggerType)}>
              <option value="first_message">First message (greeting)</option>
              <option value="manual">Manual (start explicitly)</option>
            </Select>
          </div>
          {isGreeting && (
            <p className={styles.helperText}>
              This fires once, automatically, the first time a new contact messages you, completely bypassing the AI
              chatbot. Only one active greeting is allowed per agent + channel.
            </p>
          )}
        </Card>

        <Card className={styles.section}>
          <div className={styles.sectionTitle}>
            Steps <span className={styles.countHint}>{steps.length}</span>
          </div>

          <div className={styles.stepTabs}>
            {steps.map((s) => (
              <button
                key={s.step_id}
                type="button"
                className={`${styles.stepTab} ${activeStepId === s.step_id ? styles.stepTabActive : ""} ${entryStepId === s.step_id ? styles.stepTabEntry : ""}`}
                onClick={() => setActiveStepId(s.step_id)}
              >
                {s.step_id}
                {entryStepId === s.step_id && <span className={styles.entryDot} title="Entry step" />}
              </button>
            ))}
            {!isGreeting && (
              <Button variant="secondary" size="sm" onClick={addStep}>
                + Add step
              </Button>
            )}
          </div>

          {activeStep && (
            <div className={styles.stepEditor}>
              <div className={styles.stepEditorRow}>
                <label className={styles.radioRow}>
                  <input
                    type="radio"
                    name="entry-step"
                    checked={entryStepId === activeStep.step_id}
                    onChange={() => setEntryStepId(activeStep.step_id)}
                  />
                  Entry step (flow starts here)
                </label>
                {steps.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeStep(activeStep.step_id)}>
                    Remove step
                  </Button>
                )}
              </div>

              <Textarea
                label="Message"
                value={activeStep.message}
                onChange={(e) => updateStep(activeStep.step_id, { message: e.target.value })}
                placeholder="Hello! Welcome to our page. Reply below to know more."
                rows={3}
                maxLength={1024}
              />

              <div className={styles.buttonsHeader}>
                Buttons (optional) <span className={styles.countHint}>{activeStep.buttons.length}/{MAX_BUTTONS_PER_STEP}</span>
              </div>
              {activeStep.buttons.map((btn) => (
                <div key={btn.id} className={styles.buttonEditor}>
                  <Input
                    value={btn.title}
                    onChange={(e) => updateButton(activeStep.step_id, btn.id, { title: e.target.value })}
                    placeholder="Button text"
                    maxLength={25}
                  />
                  <Select
                    value={btn.next_step_id ?? ""}
                    onChange={(e) => updateButton(activeStep.step_id, btn.id, { next_step_id: e.target.value || null })}
                  >
                    <option value="">End conversation</option>
                    {steps
                      .filter((s) => s.step_id !== activeStep.step_id)
                      .map((s) => (
                        <option key={s.step_id} value={s.step_id}>
                          Leads to {s.step_id}
                        </option>
                      ))}
                  </Select>
                  <Button variant="ghost" onClick={() => removeButton(activeStep.step_id, btn.id)}>
                    Remove
                  </Button>
                </div>
              ))}
              {activeStep.buttons.length < MAX_BUTTONS_PER_STEP && (
                <Button variant="secondary" size="sm" onClick={() => addButton(activeStep.step_id)}>
                  + Add button
                </Button>
              )}
            </div>
          )}
        </Card>

        {validationHint && <div className={styles.validationHint}>{validationHint}</div>}

        <div className={styles.submitRow}>
          <Button onClick={handleSubmit} isLoading={isSubmitting} disabled={!canSubmit}>
            Create &amp; activate flow
          </Button>
        </div>
      </div>

      <div className={styles.previewColumn}>
        <div className={styles.previewSticky}>
          <div className={styles.previewLabel}>
            Live preview <Badge variant="neutral">Step {activeStep?.step_id ?? "-"}</Badge>
          </div>
          <FlowPreview step={activeStep} />
          <p className={styles.previewNote}>
            This simulates how the step looks on WhatsApp/Instagram. Buttons here are quick replies, tapping one on the
            real channel advances the contact to whichever step you picked above.
          </p>
        </div>
      </div>
    </div>
  );
}
