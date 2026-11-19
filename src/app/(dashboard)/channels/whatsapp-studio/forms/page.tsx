"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, Select, Skeleton, Switch, Table, Tabs, type TableColumn } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api/client";
import {
  whatsappStudioApi,
  type StudioFormSubmission,
  type StudioMetaFlow,
  type StudioMetaFormField,
  type StudioMetaFormFieldType,
} from "@/lib/api/whatsapp-studio";
import { useAsync } from "@/lib/hooks/useAsync";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import styles from "./page.module.scss";
import { parseServerDate } from "@/lib/utils/date";

type View = "build" | "responses";

const FIELD_TYPES: { value: StudioMetaFormFieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "textarea", label: "Long answer" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown" },
];

const newField = (index: number): StudioMetaFormField => ({
  key: `answer_${index}`,
  label: "Your question",
  type: "text",
  required: true,
  options: [],
});

function flowError(error: unknown): string {
  if (!(error instanceof ApiError)) return "Could not publish the form. Try again.";
  if (error.detail && typeof error.detail === "object") {
    const detail = error.detail as { message?: unknown; meta_flow_id?: unknown };
    if (typeof detail.message === "string") {
      // A meta_flow_id here means Meta already created the Flow object before
      // failing at asset-upload/publish. It's not gone, just stuck as an
      // unpublished draft on the WABA. Surface that instead of leaving the
      // user to wonder why it reappears in the list below after a refresh.
      const orphanNote = typeof detail.meta_flow_id === "string"
        ? ` Meta created a draft (ID ${detail.meta_flow_id}) before this failed. It'll show up below as unpublished; retire it or fix and republish under a new name.`
        : "";
      return `${detail.message}${orphanNote}`;
    }
  }
  return error.userMessage;
}

export default function WhatsAppFormsPage() {
  const { businessId, hasNoBusinesses } = useActiveBusiness();
  const { show } = useToast();
  const [view, setView] = useState<View>("build");
  const [flows, setFlows] = useState<StudioMetaFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [deprecatingId, setDeprecatingId] = useState<string | null>(null);
  const [name, setName] = useState("Customer intake form");
  const [title, setTitle] = useState("Tell us how we can help");
  const [category, setCategory] = useState("LEAD_GENERATION");
  const [submitLabel, setSubmitLabel] = useState("Submit");
  const [fields, setFields] = useState<StudioMetaFormField[]>([
    { key: "full_name", label: "Full name", type: "text", required: true, options: [] },
    { key: "phone", label: "Phone number", type: "phone", required: true, options: [] },
  ]);

  const load = useCallback(async () => {
    if (!businessId) { setLoading(false); return; }
    setLoading(true);
    try { setFlows(await whatsappStudioApi.metaFlows(businessId)); }
    catch (error) { show(flowError(error), "error"); }
    finally { setLoading(false); }
  }, [businessId, show]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const invalidReason = useMemo(() => {
    if (!name.trim() || !title.trim() || !submitLabel.trim()) return "Complete the form name, title, and button label.";
    if (!fields.length) return "Add at least one question.";
    const keys = fields.map((field) => field.key.trim());
    if (keys.some((key) => !/^[a-z][a-z0-9_]*$/.test(key))) return "Question keys must start with a letter and use lowercase letters, numbers, or underscores.";
    if (new Set(keys).size !== keys.length) return "Each question needs a unique key.";
    if (fields.some((field) => !field.label.trim())) return "Every question needs a label.";
    if (fields.some((field) => field.type === "dropdown" && field.options.filter(Boolean).length < 2)) return "Each dropdown needs at least two choices.";
    return "";
  }, [fields, name, submitLabel, title]);

  function updateField(index: number, changes: Partial<StudioMetaFormField>) {
    setFields((current) => current.map((field, itemIndex) => itemIndex === index ? { ...field, ...changes } : field));
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!businessId || invalidReason) return;
    setPublishing(true);
    try {
      const result = await whatsappStudioApi.createMetaFlow(businessId, {
        name: name.trim(), category, title: title.trim(), submit_label: submitLabel.trim(),
        fields: fields.map((field) => ({ ...field, key: field.key.trim(), label: field.label.trim(), options: field.options.map((option) => option.trim()).filter(Boolean) })),
      });
      show(`${result.flow.name} is published and ready to use in the chatbot builder.`, "success");
      await load();
    } catch (error) { show(flowError(error), "error"); }
    finally { setPublishing(false); }
  }

  async function deprecate(flow: StudioMetaFlow) {
    if (!businessId || !confirm(`Retire “${flow.name}”? Existing templates that use it should be updated first.`)) return;
    setDeprecatingId(flow.id);
    try {
      await whatsappStudioApi.deprecateMetaFlow(businessId, flow.id);
      show(`${flow.name} was retired and can no longer be added to new messages.`, "success");
      await load();
    } catch (error) { show(flowError(error), "error"); }
    finally { setDeprecatingId(null); }
  }

  if (hasNoBusinesses) return <div className={styles.empty}>Create a business before building a WhatsApp form.</div>;

  return (
    <main className={styles.page}>
      <header>
        <div>
          <Link href="/channels/whatsapp">← WhatsApp</Link>
          <h1>WhatsApp Forms</h1>
          <p>Build a native form customers complete without leaving WhatsApp, and see what they answered.</p>
        </div>
        <Link className={styles.templateLink} href="/channels/whatsapp/templates">Message templates →</Link>
      </header>

      <Tabs
        variant="underline"
        value={view}
        onChange={setView}
        options={[
          { value: "build", label: "Build a form" },
          { value: "responses", label: "Responses" },
        ]}
      />

      {view === "responses" ? (
        <ResponsesView businessId={businessId} />
      ) : (
      <>
      <section className={styles.steps} aria-label="Setup steps">
        <span><b>1</b> Add questions</span><span><b>2</b> Preview</span><span><b>3</b> Publish to Meta</span><span><b>4</b> Add it to a chatbot flow</span><span><b>5</b> Read answers in Responses</span>
      </section>

      <div className={styles.workspace}>
        <Card className={styles.editor}>
          <h2>Create a customer form</h2>
          <p className={styles.help}>Publishing is permanent in Meta. Review the preview first; future changes should be published as a new form.</p>
          <form onSubmit={publish}>
            <div className={styles.twoColumns}>
              <Input label="Internal form name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
              <Select label="Purpose" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="LEAD_GENERATION">Lead generation</option>
                <option value="APPOINTMENT_BOOKING">Appointment booking</option>
                <option value="CONTACT_US">Contact us</option>
                <option value="CUSTOMER_SUPPORT">Customer support</option>
                <option value="SURVEY">Survey</option>
                <option value="SIGN_UP">Sign up</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div className={styles.twoColumns}>
              <Input label="Customer-facing title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required />
              <Input label="Submit button" value={submitLabel} onChange={(event) => setSubmitLabel(event.target.value)} maxLength={30} required />
            </div>

            <div className={styles.questionsHeader}><div><h3>Questions</h3><p>Use the key later as a chatbot variable.</p></div><Button type="button" variant="secondary" size="sm" onClick={() => setFields((current) => [...current, newField(current.length + 1)])} disabled={fields.length >= 10}>+ Add question</Button></div>
            <div className={styles.questions}>
              {fields.map((field, index) => (
                <article key={`${index}-${field.key}`}>
                  <div className={styles.questionTop}><strong>Question {index + 1}</strong><Button type="button" variant="ghost" size="sm" onClick={() => setFields((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button></div>
                  <div className={styles.questionGrid}>
                    <Input label="Label" value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} maxLength={80} required />
                    <Input label="Variable key" value={field.key} onChange={(event) => updateField(index, { key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} maxLength={40} required />
                    <Select label="Answer type" value={field.type} onChange={(event) => updateField(index, { type: event.target.value as StudioMetaFormFieldType, options: event.target.value === "dropdown" ? ["Option 1", "Option 2"] : [] })}>{FIELD_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>
                    <div className={styles.required}><Switch checked={field.required} onChange={(required) => updateField(index, { required })} label="Required" /></div>
                  </div>
                  {field.type === "dropdown" && <Input label="Choices (one per line)" value={field.options.join("\n")} onChange={(event) => updateField(index, { options: event.target.value.split("\n") })} helperText="Add 2–20 unique choices." />}
                </article>
              ))}
            </div>
            {invalidReason && <p className={styles.validation} role="alert">{invalidReason}</p>}
            <Button type="submit" fullWidth isLoading={publishing} disabled={Boolean(invalidReason) || !businessId}>Validate and publish to Meta</Button>
            <p className={styles.afterPublish}>After publishing: open Chatbot Builder → add “WhatsApp form” → select this form → connect its next step.</p>
          </form>
        </Card>

        <aside>
          <Card className={styles.phoneCard}>
            <div className={styles.phone}>
              <div className={styles.phoneHeader}><span>‹</span><b>Your business</b><span>•••</span></div>
              <div className={styles.formPreview}>
                <small>WHATSAPP FORM PREVIEW</small><h3>{title || "Form title"}</h3>
                {fields.map((field, index) => <div className={styles.previewField} key={index}><label>{field.label || `Question ${index + 1}`}{field.required ? " *" : ""}</label><span>{field.type === "dropdown" ? `${field.options.filter(Boolean)[0] || "Select an option"} ⌄` : field.type === "date" ? "Choose a date" : "Type your answer"}</span></div>)}
                <button type="button" tabIndex={-1}>{submitLabel || "Submit"}</button>
              </div>
            </div>
          </Card>

          <Card className={styles.published}>
            <div className={styles.publishedHeader}><div><h2>Meta forms</h2><p>Available to chatbot flows.</p></div><Button type="button" variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>Refresh</Button></div>
            {loading ? <p className={styles.muted}>Loading forms…</p> : flows.length === 0 ? <p className={styles.muted}>No forms yet. Publish your first form above.</p> : flows.map((flow) => <article key={flow.id}><div><strong>{flow.name}</strong><span>ID {flow.id}</span></div><div className={styles.flowActions}><Badge variant={flow.status === "PUBLISHED" ? "success" : flow.status === "DRAFT" ? "warning" : "neutral"}>{flow.status}</Badge>{flow.status === "PUBLISHED" ? <Button type="button" variant="ghost" size="sm" isLoading={deprecatingId === flow.id} onClick={() => void deprecate(flow)}>Retire</Button> : null}</div></article>)}
          </Card>
        </aside>
      </div>
      </>
      )}
    </main>
  );
}

function ResponsesView({ businessId }: { businessId: string | null }) {
  const { data, isLoading, error } = useAsync(
    () => businessId ? whatsappStudioApi.formSubmissions(businessId, { limit: 100 }) : Promise.resolve(null),
    [businessId],
  );
  const submissions = data?.submissions ?? [];

  const columns: TableColumn<StudioFormSubmission>[] = [
    { key: "created_at", header: "Submitted", render: (row) => parseServerDate(row.created_at).toLocaleString() },
    { key: "contact_phone", header: "Contact", render: (row) => row.contact_phone },
    { key: "form", header: "Form", render: (row) => row.node_label || "WhatsApp form" },
    {
      key: "answers",
      header: "Answers",
      render: (row) => (
        <div className={styles.answerList}>
          {Object.entries(row.answers)
            .filter(([key]) => key !== "flow_token")
            .map(([key, value]) => (
              <div key={key} className={styles.answerRow}>
                <span className={styles.answerKey}>{key}</span>
                <span className={styles.answerValue}>{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
              </div>
            ))}
        </div>
      ),
    },
  ];

  return (
    <div className={styles.responsesView}>
      <Card className={styles.responsesExplainer}>
        <h2>Why this matters</h2>
        <p>
          When a customer fills out a WhatsApp form you&apos;ve added to a chatbot flow, their answers land here:
          permanently. Nothing here expires. This is the actual lead/appointment/survey data your form exists to
          collect: names, phone numbers, whatever questions you asked.
        </p>
        <h3>How to use it</h3>
        <ul>
          <li>Every row is one submission, newest first: who submitted, when, and every answer they gave.</li>
          <li>
            To collect responses in the first place: publish a form under <strong>Build a form</strong>, then add a
            &quot;WhatsApp form&quot; block to a chatbot flow in{" "}
            <Link href="/channels/whatsapp-studio/builder">Flow builder</Link> and connect it to your published form.
          </li>
          <li>
            Want submissions pushed somewhere else automatically (a CRM, a spreadsheet, Slack)? Add an{" "}
            <strong>HTTP action</strong> block right after the form block in Flow builder. It can forward the same
            answers you see below to any URL the moment they come in.
          </li>
        </ul>
      </Card>

      {isLoading ? (
        <Skeleton height={240} />
      ) : error ? (
        <EmptyState title="Couldn't load responses" description={error} />
      ) : submissions.length === 0 ? (
        <EmptyState
          title="No responses yet"
          description="Once a customer submits a WhatsApp form connected to one of your flows, their answers will show up here."
        />
      ) : (
        <Table columns={columns} rows={submissions} rowKey={(row) => row.id} />
      )}
    </div>
  );
}
