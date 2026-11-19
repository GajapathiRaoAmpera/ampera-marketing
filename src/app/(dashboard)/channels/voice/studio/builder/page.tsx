"use client";

import Link from "next/link";
import { newId } from "@/lib/utils/browser";
import { useSearchParams } from "next/navigation";
import { DragEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Input, Textarea } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import {
  voiceFlowsApi,
  type CallFlow,
  type CallFlowEdge,
  type CallFlowNode,
  type CallFlowNodeType,
  type CallFlowValidation,
  type ExtractionField,
} from "@/lib/api/voice-flows";
import styles from "./page.module.scss";

const palette: { type: CallFlowNodeType; label: string; group: string }[] = [
  { type: "greeting", label: "Greeting", group: "Opening" },
  { type: "qualify", label: "Qualify", group: "Opening" },
  { type: "pitch", label: "Pitch / script", group: "Persuasion" },
  { type: "objection_handler", label: "Objection handler", group: "Persuasion" },
  { type: "collect_info", label: "Collect info", group: "Data" },
  { type: "condition", label: "Condition", group: "Logic" },
  { type: "book_appointment", label: "Book appointment", group: "Actions" },
  { type: "transfer_human", label: "Transfer to human", group: "Actions" },
  { type: "closing", label: "Closing", group: "Closing" },
  { type: "end", label: "End", group: "Closing" },
];

const initialNodes: CallFlowNode[] = [
  { id: "start", type: "start", x: 60, y: 180, label: "Start", config: {} },
  { id: "greeting", type: "greeting", x: 320, y: 180, label: "Greeting", config: { opening_lines: ["Hi! Thanks for taking my call, got a minute?"], tone: "warm" } },
  { id: "end", type: "end", x: 580, y: 180, label: "End", config: {} },
];
const initialEdges: CallFlowEdge[] = [
  { id: "start-greeting", source: "start", target: "greeting", source_handle: "default" },
  { id: "greeting-end", source: "greeting", target: "end", source_handle: "default" },
];

const recipes: Record<string, { description: string; nodes: CallFlowNode[]; edges: CallFlowEdge[] }> = {
  "Sales qualification & booking": {
    description: "Qualify the caller, pitch, handle price objections, then book a meeting.",
    nodes: [
      { id: "start", type: "start", x: 40, y: 220, label: "Start", config: {} },
      { id: "greeting", type: "greeting", x: 260, y: 220, label: "Greeting", config: { opening_lines: ["Hi! Thanks for your interest, do you have a couple of minutes?"], tone: "warm" } },
      { id: "qualify", type: "qualify", x: 500, y: 220, label: "Qualify", config: { questions: ["What's your budget range?", "When are you looking to get started?"], extract_fields: ["budget", "timeline"] } },
      { id: "pitch", type: "pitch", x: 740, y: 220, label: "Pitch", config: { value_props: ["Saves your team hours every week", "Pays for itself within a month"], inspirational_script: "Based on what you've told me, this could genuinely change how your team works day to day. Most customers see results within the first two weeks." } },
      { id: "objection_price", type: "objection_handler", x: 740, y: 420, label: "Price objection", config: { objection_type: "price", acknowledge: "I hear you, cost is always a real consideration.", validate: "That makes complete sense, especially if you haven't seen the ROI yet.", pivot_to_step_id: "book" } },
      { id: "book", type: "book_appointment", x: 980, y: 220, label: "Book appointment", config: { calendar_note: "Book a 15-minute demo call." } },
      { id: "closing", type: "closing", x: 1220, y: 220, label: "Closing", config: { closing_lines: ["Great, you're all set. Looking forward to speaking again soon!"], confirm_next_steps: true } },
      { id: "end", type: "end", x: 1460, y: 220, label: "End", config: {} },
    ],
    edges: [
      { id: "e1", source: "start", target: "greeting", source_handle: "default" },
      { id: "e2", source: "greeting", target: "qualify", source_handle: "default" },
      { id: "e3", source: "qualify", target: "pitch", source_handle: "default" },
      { id: "e4", source: "pitch", target: "objection_price", source_handle: "default" },
      { id: "e5", source: "objection_price", target: "book", source_handle: "default" },
      { id: "e6", source: "book", target: "closing", source_handle: "default" },
      { id: "e7", source: "closing", target: "end", source_handle: "default" },
    ],
  },
  "Inspirational outbound pitch": {
    description: "An energetic, persuasive opener with built-in objection handling.",
    nodes: [
      { id: "start", type: "start", x: 40, y: 220, label: "Start", config: {} },
      { id: "greeting", type: "greeting", x: 260, y: 220, label: "Energetic opener", config: { opening_lines: ["Hey! I'll keep this quick, I think this is genuinely worth 60 seconds of your time."], tone: "energetic" } },
      { id: "pitch", type: "pitch", x: 500, y: 220, label: "The pitch", config: { inspirational_script: "Here's the thing: the businesses that win right now aren't the ones with the most resources, they're the ones who move fastest on the right opportunity. That's exactly what this gives you: a head start your competitors won't have. I'm not asking you to decide today, just to see it for yourself." } },
      { id: "objection_timing", type: "objection_handler", x: 500, y: 400, label: "\"Not right now\"", config: { objection_type: "timing", acknowledge: "Totally fair, timing matters.", validate: "And I'd rather you see this when you're actually ready to act on it.", pivot_to_step_id: "book" } },
      { id: "objection_trust", type: "objection_handler", x: 780, y: 400, label: "\"Not sure this works\"", config: { objection_type: "trust", acknowledge: "That's a smart thing to question.", validate: "Most of our best customers felt exactly the same way before they tried it.", pivot_to_step_id: "book" } },
      { id: "book", type: "book_appointment", x: 740, y: 220, label: "Book a look", config: { calendar_note: "Book a short intro call." } },
      { id: "closing", type: "closing", x: 980, y: 220, label: "Closing", config: { closing_lines: ["Appreciate your time, talk soon!"], confirm_next_steps: true } },
      { id: "end", type: "end", x: 1220, y: 220, label: "End", config: {} },
    ],
    edges: [
      { id: "e1", source: "start", target: "greeting", source_handle: "default" },
      { id: "e2", source: "greeting", target: "pitch", source_handle: "default" },
      { id: "e3", source: "pitch", target: "book", source_handle: "default" },
      { id: "e4", source: "objection_timing", target: "book", source_handle: "default" },
      { id: "e5", source: "objection_trust", target: "book", source_handle: "default" },
      { id: "e6", source: "book", target: "closing", source_handle: "default" },
      { id: "e7", source: "closing", target: "end", source_handle: "default" },
    ],
  },
  "Support triage": {
    description: "Collect the issue, then resolve or transfer to a human.",
    nodes: [
      { id: "start", type: "start", x: 40, y: 200, label: "Start", config: {} },
      { id: "greeting", type: "greeting", x: 260, y: 200, label: "Greeting", config: { opening_lines: ["Hi, thanks for calling, how can I help today?"], tone: "professional" } },
      { id: "collect", type: "collect_info", x: 500, y: 200, label: "Collect issue", config: { prompt: "Can you tell me a bit more about the issue you're facing?", variable: "issue_description" } },
      { id: "condition", type: "condition", x: 740, y: 200, label: "Needs human?", config: { variable: "issue_description", operator: "contains", value: "" } },
      { id: "transfer", type: "transfer_human", x: 980, y: 100, label: "Transfer", config: { message: "Let me connect you with someone who can help right away.", reason: "Escalated during support triage" } },
      { id: "closing", type: "closing", x: 980, y: 300, label: "Closing", config: { closing_lines: ["Glad I could help, have a great day!"], confirm_next_steps: false } },
      { id: "end", type: "end", x: 1220, y: 200, label: "End", config: {} },
    ],
    edges: [
      { id: "e1", source: "start", target: "greeting", source_handle: "default" },
      { id: "e2", source: "greeting", target: "collect", source_handle: "default" },
      { id: "e3", source: "collect", target: "condition", source_handle: "default" },
      { id: "e4", source: "condition", target: "transfer", source_handle: "true" },
      { id: "e5", source: "condition", target: "closing", source_handle: "false" },
      { id: "e6", source: "transfer", target: "end", source_handle: "default" },
      { id: "e7", source: "closing", target: "end", source_handle: "default" },
    ],
  },
};

function idFor(type: CallFlowNodeType) {
  return `${type}-${newId().slice(0, 8)}`;
}

function defaultConfig(type: CallFlowNodeType): Record<string, unknown> {
  if (type === "greeting") return { opening_lines: ["Hi! Thanks for taking my call."], tone: "warm" };
  if (type === "qualify") return { questions: ["What are you looking for?"], extract_fields: [] };
  if (type === "pitch") return { value_props: [], inspirational_script: "Write your persuasive script here…" };
  if (type === "objection_handler") return { objection_type: "price", acknowledge: "", validate: "", pivot_to_step_id: "" };
  if (type === "collect_info") return { prompt: "What information do you need to collect?", variable: "field_name" };
  if (type === "book_appointment") return { calendar_note: "Book an appointment." };
  if (type === "transfer_human") return { message: "Let me connect you with a person.", reason: "" };
  if (type === "condition") return { variable: "", operator: "equals", value: "" };
  if (type === "closing") return { closing_lines: ["Thanks for your time, have a great day!"], confirm_next_steps: true };
  return {};
}

function handlesFor(node: CallFlowNode): { id: string; label: string }[] {
  if (node.type === "condition") return [{ id: "true", label: "True" }, { id: "false", label: "False" }];
  return node.type === "end" || node.type === "transfer_human" ? [] : [{ id: "default", label: "Next" }];
}

const objectionTypes = ["price", "trust", "timing", "authority", "competition", "other"] as const;

export default function VoiceFlowBuilderPage() {
  const { businessId } = useActiveBusiness();
  const { show } = useToast();
  const searchParams = useSearchParams();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("New call flow");
  const [description, setDescription] = useState("Describe what this call flow should accomplish.");
  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [flowId, setFlowId] = useState<string | null>(null);
  const [activeVersion, setActiveVersion] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [flows, setFlows] = useState<Omit<CallFlow, "graph" | "extraction_schema">[]>([]);
  const [nodes, setNodes] = useState<CallFlowNode[]>(initialNodes);
  const [edges, setEdges] = useState<CallFlowEdge[]>(initialEdges);
  const [extractionSchema, setExtractionSchema] = useState<ExtractionField[]>([]);
  const [selectedId, setSelectedId] = useState("greeting");
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; handle: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState<CallFlowValidation | null>(null);
  const [testTrace, setTestTrace] = useState<{ node_id: string; type: CallFlowNodeType; label?: string | null }[]>([]);
  const selected = nodes.find((node) => node.id === selectedId) ?? null;
  const groups = useMemo(() => [...new Set(palette.map((item) => item.group))], []);

  useEffect(() => {
    if (!businessId) return;
    void voiceFlowsApi.flows(businessId).then((result) => setFlows(result.flows)).catch(() => undefined);
  }, [businessId]);

  useEffect(() => {
    const flowParam = searchParams.get("flow");
    const recipeParam = searchParams.get("recipe");
    if (flowParam && businessId) {
      void openFlow(flowParam);
    } else if (recipeParam && recipes[recipeParam]) {
      applyRecipe(recipeParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  async function openFlow(id: string) {
    if (!businessId || !id) return;
    setBusy(true);
    try {
      const flow = await voiceFlowsApi.flow(businessId, id);
      setFlowId(flow.id);
      setName(flow.name);
      setDescription(flow.description ?? "");
      setDefaultLanguage(flow.default_language);
      setActiveVersion(flow.published_version ?? null);
      setIsActive(flow.active);
      setNodes(flow.graph.nodes);
      setEdges(flow.graph.edges);
      setExtractionSchema(flow.extraction_schema);
      setSelectedId(flow.graph.nodes[0]?.id ?? "");
      setValidation(null);
    } catch {
      show("Could not open that call flow.", "error");
    } finally {
      setBusy(false);
    }
  }

  function newFlow() {
    setFlowId(null);
    setActiveVersion(null);
    setIsActive(false);
    setName("New call flow");
    setDescription("Describe what this call flow should accomplish.");
    setDefaultLanguage("en");
    setNodes(initialNodes);
    setEdges(initialEdges);
    setExtractionSchema([]);
    setSelectedId("greeting");
    setValidation(null);
  }

  function applyRecipe(recipeName: string) {
    const recipe = recipes[recipeName];
    if (!recipe) return;
    setFlowId(null);
    setActiveVersion(null);
    setIsActive(false);
    setName(recipeName);
    setDescription(recipe.description);
    setNodes(recipe.nodes);
    setEdges(recipe.edges);
    setSelectedId(recipe.nodes[0]?.id ?? "");
    setValidation(null);
  }

  function addNode(type: CallFlowNodeType, x = 360, y = 300) {
    const item = palette.find((entry) => entry.type === type);
    const node: CallFlowNode = { id: idFor(type), type, x, y, label: item?.label ?? type, config: defaultConfig(type) };
    setNodes((current) => [...current, node]);
    setSelectedId(node.id);
  }

  function dropNode(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/call-flow-node") as CallFlowNodeType;
    const box = canvasRef.current?.getBoundingClientRect();
    if (!type || !box) return;
    addNode(type, Math.max(10, event.clientX - box.left - 90), Math.max(10, event.clientY - box.top - 35));
  }

  function startMove(event: PointerEvent<HTMLDivElement>, node: CallFlowNode) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const originX = event.clientX;
    const originY = event.clientY;
    const move = (next: globalThis.PointerEvent) =>
      setNodes((current) =>
        current.map((item) =>
          item.id === node.id ? { ...item, x: node.x + next.clientX - originX, y: node.y + next.clientY - originY } : item
        )
      );
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function connect(target: string) {
    if (!connectingFrom || connectingFrom.nodeId === target) return;
    setEdges((current) => [
      ...current.filter((edge) => !(edge.source === connectingFrom.nodeId && edge.source_handle === connectingFrom.handle)),
      { id: idFor("condition"), source: connectingFrom.nodeId, target, source_handle: connectingFrom.handle },
    ]);
    setConnectingFrom(null);
  }

  function updateSelected(changes: Partial<CallFlowNode>) {
    setNodes((current) => current.map((node) => (node.id === selectedId ? { ...node, ...changes } : node)));
  }

  function addExtractionField() {
    setExtractionSchema((current) => [...current, { key: `field_${current.length + 1}`, label: "New field", type: "text", required: false }]);
  }

  function updateExtractionField(index: number, changes: Partial<ExtractionField>) {
    setExtractionSchema((current) => current.map((field, i) => (i === index ? { ...field, ...changes } : field)));
  }

  function removeExtractionField(index: number) {
    setExtractionSchema((current) => current.filter((_, i) => i !== index));
  }

  async function save() {
    if (!businessId) return null;
    setBusy(true);
    try {
      const body = { name, description, default_language: defaultLanguage, graph: { nodes, edges }, extraction_schema: extractionSchema };
      const result = flowId
        ? await voiceFlowsApi.updateFlow(businessId, flowId, body)
        : await voiceFlowsApi.createFlow(businessId, body);
      setFlowId(result.flow.id);
      setValidation(result.validation);
      const list = await voiceFlowsApi.flows(businessId);
      setFlows(list.flows);
      show("Call flow draft saved.", "success");
      return result.flow.id;
    } catch {
      show("Couldn't save the call flow. The name may already exist.", "error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function run(action: "validate" | "test" | "activate") {
    if (!businessId) return;
    const savedId = await save();
    if (!savedId) return;
    setBusy(true);
    try {
      if (action === "validate") {
        const result = await voiceFlowsApi.validateFlow(businessId, savedId);
        setValidation(result);
        show(result.valid ? "Call flow is ready to activate." : `Found ${result.errors.length} issue(s).`, result.valid ? "success" : "warning");
      } else if (action === "test") {
        const result = await voiceFlowsApi.simulateFlow(businessId, savedId);
        setTestTrace(result.trace);
        show(`Test visited ${result.trace.length} steps${result.completed ? " and completed." : "."}`, result.completed ? "success" : "warning");
      } else {
        const result = await voiceFlowsApi.activateFlow(businessId, savedId);
        setActiveVersion(result.version);
        setIsActive(true);
        setValidation({ valid: true, errors: [] });
        show(`Activated version ${result.version}. This is now the live call flow.`, "success");
      }
    } catch {
      show(`${action === "activate" ? "Activation" : "Flow check"} failed. Validate the highlighted configuration.`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!businessId || !flowId || !confirm("Deactivate this call flow? Calls will fall back to the agent's default behavior.")) return;
    setBusy(true);
    try {
      await voiceFlowsApi.deactivateFlow(businessId, flowId);
      setIsActive(false);
      show("Call flow deactivated.", "success");
    } catch {
      show("Could not deactivate this call flow.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <Link href="/channels/voice/studio">← Voice Call Flows</Link>
          <select
            aria-label="Open saved flow"
            value={flowId ?? ""}
            onChange={(event) => (event.target.value ? void openFlow(event.target.value) : newFlow())}
          >
            <option value="">+ New flow</option>
            {flows.map((flow) => (
              <option key={flow.id} value={flow.id}>
                {flow.name}
              </option>
            ))}
          </select>
          <Input aria-label="Flow name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className={styles.actions}>
          <Badge variant={isActive ? "success" : validation?.valid ? "info" : "neutral"}>
            {isActive ? `Active v${activeVersion}` : validation?.valid ? "Ready" : "Draft"}
          </Badge>
          {isActive ? (
            <Button variant="secondary" onClick={() => void deactivate()} disabled={busy}>
              Deactivate
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => void save()} disabled={busy}>
            Save draft
          </Button>
          <Button variant="secondary" onClick={() => void run("validate")} disabled={busy}>
            Validate
          </Button>
          <Button variant="secondary" onClick={() => void run("test")} disabled={busy}>
            Test
          </Button>
          <Button onClick={() => void run("activate")} isLoading={busy}>
            Activate
          </Button>
        </div>
      </header>

      <div className={styles.guide}>
        <div>
          <span>1</span>
          <strong>Design the call</strong>
          <small>Add and connect stages</small>
        </div>
        <div>
          <span>2</span>
          <strong>Write your script</strong>
          <small>Greeting, pitch, objections</small>
        </div>
        <div>
          <span>3</span>
          <strong>Test it</strong>
          <small>Trace the expected path</small>
        </div>
        <div>
          <span>4</span>
          <strong>Activate</strong>
          <small>Go live on real calls</small>
        </div>
      </div>

      <div className={styles.workspace}>
        <aside className={styles.palette}>
          <h2>1. Setup</h2>
          <p>Basic settings for this call flow.</p>
          <Textarea label="What this flow does" value={description} onChange={(event) => setDescription(event.target.value)} />
          <label className={styles.fieldLabel}>
            Default language
            <select value={defaultLanguage} onChange={(event) => setDefaultLanguage(event.target.value)}>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="te">Telugu</option>
              <option value="kn">Kannada</option>
              <option value="mr">Marathi</option>
            </select>
          </label>

          <h2>2. Add stages</h2>
          <p>Click or drag a stage, then use its green + to connect it.</p>
          {groups.map((group) => (
            <section key={group}>
              <h3>{group}</h3>
              {palette
                .filter((item) => item.group === group)
                .map((item) => (
                  <button
                    key={item.type}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData("application/call-flow-node", item.type)}
                    onClick={() => addNode(item.type)}
                  >
                    <span>+</span>
                    {item.label}
                  </button>
                ))}
            </section>
          ))}

          <h2>3. Information to extract</h2>
          <p>Fields the AI should pull out of the conversation.</p>
          {extractionSchema.map((field, index) => (
            <div key={index} className={styles.fieldPair}>
              <Input
                aria-label="Field label"
                value={field.label}
                onChange={(event) => updateExtractionField(index, { label: event.target.value, key: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || field.key })}
              />
              <Button size="sm" variant="ghost" onClick={() => removeExtractionField(index)}>
                Remove
              </Button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={addExtractionField}>
            + Add field
          </Button>
        </aside>

        <main ref={canvasRef} className={styles.canvas} onDragOver={(event) => event.preventDefault()} onDrop={dropNode}>
          <div className={styles.grid} />
          <svg className={styles.edges} aria-hidden="true">
            {edges.map((edge) => {
              const from = nodes.find((node) => node.id === edge.source);
              const to = nodes.find((node) => node.id === edge.target);
              if (!from || !to) return null;
              const x1 = from.x + 180;
              const y1 = from.y + 36;
              const x2 = to.x;
              const y2 = to.y + 36;
              return <path key={edge.id} d={`M ${x1} ${y1} C ${x1 + 70} ${y1}, ${x2 - 70} ${y2}, ${x2} ${y2}`} />;
            })}
          </svg>
          {nodes.map((node) => (
            <div
              key={node.id}
              className={`${styles.node} ${selectedId === node.id ? styles.selected : ""}`}
              style={{ left: node.x, top: node.y }}
              onPointerDown={(event) => startMove(event, node)}
              onClick={() => (connectingFrom ? connect(node.id) : setSelectedId(node.id))}
            >
              <span className={styles.nodeType}>{node.type.replaceAll("_", " ")}</span>
              <strong>{node.label || node.type}</strong>
              {node.type === "greeting" || node.type === "closing" ? (
                <small>{String((node.config.opening_lines as string[] | undefined)?.[0] ?? (node.config.closing_lines as string[] | undefined)?.[0] ?? "")}</small>
              ) : null}
              {node.type === "pitch" ? <small>{String(node.config.inspirational_script ?? "")}</small> : null}
              <div className={styles.handles}>
                {handlesFor(node).map((handle) => (
                  <button
                    key={handle.id}
                    className={styles.branchHandle}
                    aria-label={`Connect ${handle.label} from ${node.label}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setConnectingFrom({ nodeId: node.id, handle: handle.id });
                    }}
                  >
                    <span>{handle.label}</span>+
                  </button>
                ))}
              </div>
            </div>
          ))}
          {connectingFrom ? <div className={styles.connectHint}>Select the destination stage · Esc to cancel</div> : null}
        </main>

        <aside className={styles.inspector}>
          <h2>Stage settings</h2>
          <p>Edit what happens at this stage, then connect every outcome.</p>
          {selected ? (
            <div className={styles.inspectorForm}>
              <Input label="Label" value={selected.label ?? ""} onChange={(event) => updateSelected({ label: event.target.value })} />

              {selected.type === "greeting" || selected.type === "closing" ? (
                <Textarea
                  label={selected.type === "greeting" ? "Opening line" : "Closing line"}
                  value={String((selected.config.opening_lines as string[] | undefined)?.[0] ?? (selected.config.closing_lines as string[] | undefined)?.[0] ?? "")}
                  onChange={(event) => {
                    const key = selected.type === "greeting" ? "opening_lines" : "closing_lines";
                    updateSelected({ config: { ...selected.config, [key]: [event.target.value] } });
                  }}
                />
              ) : null}

              {selected.type === "greeting" ? (
                <label className={styles.fieldLabel}>
                  Tone
                  <select
                    value={String(selected.config.tone ?? "warm")}
                    onChange={(event) => updateSelected({ config: { ...selected.config, tone: event.target.value } })}
                  >
                    <option value="warm">Warm</option>
                    <option value="professional">Professional</option>
                    <option value="energetic">Energetic</option>
                  </select>
                </label>
              ) : null}

              {selected.type === "qualify" ? (
                <Textarea
                  label="Qualifying questions"
                  helperText="One question per line."
                  value={(Array.isArray(selected.config.questions) ? (selected.config.questions as string[]) : []).join("\n")}
                  onChange={(event) =>
                    updateSelected({ config: { ...selected.config, questions: event.target.value.split("\n").filter(Boolean) } })
                  }
                />
              ) : null}

              {selected.type === "pitch" ? (
                <Textarea
                  label="Persuasive script"
                  helperText="Used as guidance, not a rigid script. The AI stays natural while following this direction."
                  value={String(selected.config.inspirational_script ?? "")}
                  onChange={(event) => updateSelected({ config: { ...selected.config, inspirational_script: event.target.value } })}
                />
              ) : null}

              {selected.type === "objection_handler" ? (
                <>
                  <label className={styles.fieldLabel}>
                    Objection type
                    <select
                      value={String(selected.config.objection_type ?? "price")}
                      onChange={(event) => updateSelected({ config: { ...selected.config, objection_type: event.target.value } })}
                    >
                      {objectionTypes.map((type) => (
                        <option key={type} value={type}>
                          {type[0].toUpperCase() + type.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Textarea
                    label="Acknowledge"
                    helperText="Show you understood the concern."
                    value={String(selected.config.acknowledge ?? "")}
                    onChange={(event) => updateSelected({ config: { ...selected.config, acknowledge: event.target.value } })}
                  />
                  <Textarea
                    label="Validate"
                    helperText="Show the concern is reasonable."
                    value={String(selected.config.validate ?? "")}
                    onChange={(event) => updateSelected({ config: { ...selected.config, validate: event.target.value } })}
                  />
                </>
              ) : null}

              {selected.type === "collect_info" ? (
                <>
                  <Textarea
                    label="Question to ask"
                    value={String(selected.config.prompt ?? "")}
                    onChange={(event) => updateSelected({ config: { ...selected.config, prompt: event.target.value } })}
                  />
                  <Input
                    label="Save answer as"
                    value={String(selected.config.variable ?? selected.id)}
                    onChange={(event) => updateSelected({ config: { ...selected.config, variable: event.target.value } })}
                  />
                </>
              ) : null}

              {selected.type === "book_appointment" ? (
                <Textarea
                  label="Booking note"
                  value={String(selected.config.calendar_note ?? "")}
                  onChange={(event) => updateSelected({ config: { ...selected.config, calendar_note: event.target.value } })}
                />
              ) : null}

              {selected.type === "transfer_human" ? (
                <>
                  <Textarea
                    label="Message to caller"
                    value={String(selected.config.message ?? "")}
                    onChange={(event) => updateSelected({ config: { ...selected.config, message: event.target.value } })}
                  />
                  <Input
                    label="Internal handoff reason"
                    value={String(selected.config.reason ?? "")}
                    onChange={(event) => updateSelected({ config: { ...selected.config, reason: event.target.value } })}
                  />
                </>
              ) : null}

              {selected.type === "condition" ? (
                <>
                  <Input
                    label="Extracted field to check"
                    value={String(selected.config.variable ?? "")}
                    onChange={(event) => updateSelected({ config: { ...selected.config, variable: event.target.value } })}
                  />
                  <label className={styles.fieldLabel}>
                    Rule
                    <select
                      value={String(selected.config.operator ?? "equals")}
                      onChange={(event) => updateSelected({ config: { ...selected.config, operator: event.target.value } })}
                    >
                      <option value="equals">Equals</option>
                      <option value="not_equals">Does not equal</option>
                      <option value="contains">Contains</option>
                      <option value="exists">Has a value</option>
                      <option value="greater_than">Greater than</option>
                    </select>
                  </label>
                  <Input
                    label="Comparison value"
                    value={String(selected.config.value ?? "")}
                    onChange={(event) => updateSelected({ config: { ...selected.config, value: event.target.value } })}
                  />
                </>
              ) : null}

              {selected.type !== "start" && selected.type !== "end" ? (
                <Button
                  variant="danger"
                  onClick={() => {
                    setNodes((current) => current.filter((node) => node.id !== selected.id));
                    setEdges((current) => current.filter((edge) => edge.source !== selected.id && edge.target !== selected.id));
                    setSelectedId("start");
                  }}
                >
                  Delete stage
                </Button>
              ) : null}
            </div>
          ) : (
            <p>Select a stage to edit it.</p>
          )}

          {validation && !validation.valid ? (
            <div className={styles.issues}>
              <h3>Fix before activating</h3>
              {validation.errors.map((error, index) => (
                <p key={`${error.code}-${index}`}>{error.message}</p>
              ))}
            </div>
          ) : null}

          {testTrace.length ? (
            <div className={styles.testTrace}>
              <h3>Test path</h3>
              {testTrace.map((step, index) => (
                <div key={`${step.node_id}-${index}`}>
                  <span>{index + 1}</span>
                  <p>
                    <strong>{step.label || step.type}</strong>
                    <small>{step.type.replaceAll("_", " ")}</small>
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
