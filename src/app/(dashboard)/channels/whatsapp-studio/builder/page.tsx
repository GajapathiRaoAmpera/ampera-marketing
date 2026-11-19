"use client";

import Link from "next/link";
import { newId } from "@/lib/utils/browser";
import { DragEvent, PointerEvent, WheelEvent, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Input, Textarea } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api/client";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import {
  whatsappStudioApi,
  type StudioFlowEdge,
  type StudioFlowNode,
  type StudioFlowValidation,
  type StudioNodeType,
  type StudioFlow,
  type StudioMetaFlow,
} from "@/lib/api/whatsapp-studio";
import styles from "./page.module.scss";

function flowBuilderError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.detail && typeof error.detail === "object" && "message" in error.detail) {
    const message = (error.detail as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return error.userMessage;
}

const palette: { type: StudioNodeType; label: string; group: string }[] = [
  { type: "text", label: "Text message", group: "Messages" },
  { type: "image", label: "Image", group: "Messages" },
  { type: "location", label: "Location", group: "Messages" },
  { type: "buttons", label: "Buttons", group: "Messages" },
  { type: "template", label: "Template", group: "Messages" },
  { type: "user_input", label: "User input", group: "Collect" },
  { type: "form", label: "WhatsApp form", group: "Collect" },
  { type: "appointment", label: "Appointment", group: "Collect" },
  { type: "condition", label: "Condition", group: "Logic" },
  { type: "delay", label: "Delay", group: "Logic" },
  { type: "ai_reply", label: "AI reply", group: "Logic" },
  { type: "http_request", label: "HTTP action", group: "Logic" },
  { type: "human_handoff", label: "Human handoff", group: "Logic" },
  { type: "end", label: "End", group: "Logic" },
];

const initialNodes: StudioFlowNode[] = [
  { id: "start", type: "start", x: 70, y: 160, label: "Start", config: {} },
  { id: "welcome", type: "text", x: 330, y: 160, label: "Welcome message", config: { text: "Hi {{first_name}}! How can we help today?" } },
  { id: "end", type: "end", x: 590, y: 160, label: "End", config: {} },
];
const initialEdges: StudioFlowEdge[] = [
  { id: "start-welcome", source: "start", target: "welcome", source_handle: "default" },
  { id: "welcome-end", source: "welcome", target: "end", source_handle: "default" },
];

const recipes = [
  { name: "Welcome & route", detail: "Greet customers and route them to sales or support.", message: "Hi {{first_name}}! What can we help you with today?" },
  { name: "Lead capture", detail: "Ask what a customer needs before your team responds.", message: "Welcome! Tell us what product or service you are interested in." },
  { name: "Appointment request", detail: "Collect an appointment request for your team.", message: "Hi! I can help you request an appointment." },
];

function idFor(type: StudioNodeType) {
  return `${type}-${newId().slice(0, 8)}`;
}

function defaultConfig(type: StudioNodeType): Record<string, unknown> {
  if (type === "text") return { text: "Write your message…" };
  if (type === "buttons") return { text: "Choose an option", buttons: [{ id: "option-1", title: "Option 1" }] };
  if (type === "form" || type === "appointment") return { prompt: type === "appointment" ? "Choose an appointment time." : "Please complete this short form.", flow_id: "", cta: type === "appointment" ? "Book now" : "Open form", screen: "", variable: type === "appointment" ? "appointment" : "form_response" };
  if (type === "location") return { latitude: 0, longitude: 0, name: "Our location", address: "" };
  if (["image", "audio", "video", "file", "http_request"].includes(type)) return { url: "https://" };
  if (type === "delay") return { seconds: 1 };
  return {};
}

function kindFor(type: StudioNodeType): "message" | "collect" | "logic" | "system" {
  if (["start", "end"].includes(type)) return "system";
  if (["user_input", "form", "appointment"].includes(type)) return "collect";
  if (["condition", "delay", "ai_reply", "http_request", "human_handoff"].includes(type)) return "logic";
  return "message";
}

function handlesFor(node: StudioFlowNode): { id: string; label: string }[] {
  if (node.type === "buttons") {
    const buttons = Array.isArray(node.config.buttons) ? node.config.buttons as { id?: string; title?: string }[] : [];
    return buttons.map((button, index) => ({ id: button.id || `option-${index + 1}`, label: button.title || `Option ${index + 1}` }));
  }
  if (node.type === "condition") return [{ id: "true", label: "True" }, { id: "false", label: "False" }];
  return node.type === "end" || node.type === "human_handoff" ? [] : [{ id: "default", label: "Next" }];
}

export default function WhatsAppFlowBuilderPage() {
  const { businessId } = useActiveBusiness();
  const { show } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("Customer welcome flow");
  const [description, setDescription] = useState("Greets new customers and guides them to the right next step.");
  const [triggerType, setTriggerType] = useState<StudioFlow["trigger_type"]>("first_message");
  const [keywords, setKeywords] = useState("hello, hi, start");
  const [intentDescription, setIntentDescription] = useState("");
  const [flowId, setFlowId] = useState<string | null>(null);
  const [liveVersion, setLiveVersion] = useState<number | null>(null);
  const [flows, setFlows] = useState<Omit<StudioFlow, "graph">[]>([]);
  const [metaFlows, setMetaFlows] = useState<StudioMetaFlow[]>([]);
  const [nodes, setNodes] = useState<StudioFlowNode[]>(initialNodes);
  const [edges, setEdges] = useState<StudioFlowEdge[]>(initialEdges);
  const [selectedId, setSelectedId] = useState("welcome");
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; handle: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState<StudioFlowValidation | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [testTrace, setTestTrace] = useState<{ node_id: string; type: StudioNodeType; label?: string }[]>([]);
  const [zoom, setZoom] = useState(1);
  const [testChoices, setTestChoices] = useState<Record<string, string>>({});
  const paletteRef = useRef<HTMLElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const selected = nodes.find((node) => node.id === selectedId) ?? null;
  const groups = useMemo(() => [...new Set(palette.map((item) => item.group))], []);
  const branchNodes = useMemo(() => nodes.filter((node) => handlesFor(node).length > 1), [nodes]);
  const canvasExtent = useMemo(() => {
    const maxX = nodes.reduce((max, node) => Math.max(max, node.x + 220), 1100);
    const maxY = nodes.reduce((max, node) => Math.max(max, node.y + 120), 780);
    return { width: maxX, height: maxY };
  }, [nodes]);

  // Real progress, not decoration: each step lights up once its condition is
  // actually true, and the guide becomes a nav: clicking a step focuses the
  // panel that step is about, or fires the matching action. The click
  // dispatches by step number in the JSX handler itself (see runGuideStep)
  // rather than storing ref-accessing closures in this render-time array,
  // since react-hooks/refs flags any ref read reachable from render, even
  // inside an unexecuted callback stored in array data.
  const hasTrigger = triggerType === "first_message" || (triggerType === "keyword" && keywords.trim().length > 0) || (triggerType === "intent" && intentDescription.trim().length >= 10);
  const hasConversation = nodes.length > 2 && edges.length > 1;
  const hasTested = testTrace.length > 0;
  const currentStep = liveVersion ? 4 : hasTested ? 3 : hasConversation ? 2 : hasTrigger ? 1 : 1;
  const guideSteps = [
    { step: 1, title: "Choose when it starts", detail: "Set a customer trigger", done: hasTrigger },
    { step: 2, title: "Build the conversation", detail: "Add and connect blocks", done: hasConversation },
    { step: 3, title: "Test as a customer", detail: "Check every path", done: hasTested },
    { step: 4, title: "Publish to WhatsApp", detail: "Activate this version", done: Boolean(liveVersion) },
  ];

  function runGuideStep(step: number) {
    if (step === 1) paletteRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    else if (step === 2) canvasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    else if (step === 3) { inspectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); void run("test"); }
    else if (step === 4) void run("publish");
  }

  function zoomBy(delta: number) {
    setZoom((current) => Math.min(1.5, Math.max(0.3, Math.round((current + delta) * 100) / 100)));
  }

  function onCanvasWheel(event: WheelEvent<HTMLDivElement>) {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    zoomBy(event.deltaY > 0 ? -0.1 : 0.1);
  }

  useEffect(() => {
    if (!businessId) return;
    void Promise.all([
      whatsappStudioApi.flows(businessId),
      whatsappStudioApi.overview(businessId),
      whatsappStudioApi.metaFlows(businessId).catch(() => []),
    ]).then(([result, overview, liveFlows]) => {
      setFlows(result.flows); setIsConnected(overview.readiness.official_connection); setMetaFlows(liveFlows);
    }).catch(() => undefined);
  }, [businessId]);

  // The connect-mode hint tells users "Esc to cancel": this is what
  // actually makes that true. Without it, starting a connection and
  // changing your mind had no way out except completing it (even by
  // accident, since any node click while connecting completes the edge).
  useEffect(() => {
    if (!connectingFrom) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConnectingFrom(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [connectingFrom]);

  async function openFlow(id: string) {
    if (!businessId || !id) return;
    setBusy(true);
    try {
      const flow = await whatsappStudioApi.flow(businessId, id);
      setFlowId(flow.id); setName(flow.name); setDescription(flow.description ?? "");
      setLiveVersion(flow.published_version ?? null);
      setTriggerType(flow.trigger_type);
      setKeywords(Array.isArray(flow.trigger_config.keywords) ? flow.trigger_config.keywords.join(", ") : "");
      setIntentDescription(typeof flow.trigger_config.intent_description === "string" ? flow.trigger_config.intent_description : "");
      setNodes(flow.graph.nodes); setEdges(flow.graph.edges);
      setSelectedId(flow.graph.nodes[0]?.id ?? ""); setValidation(null);
    } catch (error) { show(flowBuilderError(error, "Could not open that flow."), "error"); } finally { setBusy(false); }
  }

  function newFlow() {
    setFlowId(null); setLiveVersion(null); setName("New customer flow");
    setDescription("Explain what this automation should do.");
    setTriggerType("first_message"); setKeywords("hello, hi, start"); setIntentDescription("");
    setNodes(initialNodes); setEdges(initialEdges); setSelectedId("welcome"); setValidation(null);
  }

  function applyRecipe(recipe: typeof recipes[number]) {
    setName(recipe.name); setDescription(recipe.detail); setTriggerType("first_message");
    setNodes(initialNodes.map((node) => node.id === "welcome" ? { ...node, config: { text: recipe.message } } : node));
    setEdges(initialEdges); setSelectedId("welcome"); setValidation(null);
  }

  function addNode(type: StudioNodeType, x = 360, y = 300) {
    const item = palette.find((entry) => entry.type === type);
    const node: StudioFlowNode = { id: idFor(type), type, x, y, label: item?.label ?? type, config: defaultConfig(type) };
    setNodes((current) => [...current, node]);
    setSelectedId(node.id);
  }

  function dropNode(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/studio-node") as StudioNodeType;
    const box = canvasRef.current?.getBoundingClientRect();
    if (!type || !box) return;
    addNode(type, Math.max(10, (event.clientX - box.left) / zoom - 90), Math.max(10, (event.clientY - box.top) / zoom - 35));
  }

  function startMove(event: PointerEvent<HTMLDivElement>, node: StudioFlowNode) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const originX = event.clientX;
    const originY = event.clientY;
    const move = (next: globalThis.PointerEvent) => setNodes((current) => current.map((item) => item.id === node.id
      ? { ...item, x: node.x + (next.clientX - originX) / zoom, y: node.y + (next.clientY - originY) / zoom }
      : item));
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function connect(target: string) {
    if (!connectingFrom || connectingFrom.nodeId === target) return;
    setEdges((current) => [...current.filter((edge) => !(edge.source === connectingFrom.nodeId && edge.source_handle === connectingFrom.handle)), {
      id: idFor("condition"), source: connectingFrom.nodeId, target, source_handle: connectingFrom.handle,
    }]);
    setConnectingFrom(null);
  }

  function updateSelected(changes: Partial<StudioFlowNode>) {
    setNodes((current) => current.map((node) => node.id === selectedId ? { ...node, ...changes } : node));
  }

  async function save() {
    if (!businessId) return null;
    setBusy(true);
    try {
      const triggerConfig = triggerType === "keyword"
        ? { keywords: keywords.split(",").map((item) => item.trim()).filter(Boolean) }
        : triggerType === "intent"
          ? { keywords: keywords.split(",").map((item) => item.trim()).filter(Boolean), intent_description: intentDescription.trim() }
          : {};
      const body = {
        name, description, trigger_type: triggerType,
        trigger_config: triggerConfig,
        graph: { nodes, edges },
      };
      const result = flowId
        ? await whatsappStudioApi.updateFlow(businessId, flowId, body)
        : await whatsappStudioApi.createFlow(businessId, body);
      setFlowId(result.flow.id);
      setLiveVersion(result.flow.published_version ?? null);
      const list = await whatsappStudioApi.flows(businessId);
      setFlows(list.flows);
      show("Flow draft saved.", "success");
      return result.flow.id;
    } catch (error) {
      show(flowBuilderError(error, "Couldn't save the flow. Try again."), "error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function run(action: "validate" | "test" | "publish") {
    if (!businessId) return;
    const savedId = await save();
    if (!savedId) return;
    setBusy(true);
    try {
      if (action === "validate") {
        const result = await whatsappStudioApi.validateFlow(businessId, savedId);
        setValidation(result);
        show(result.valid ? "Flow is ready to publish." : `Found ${result.errors.length} issue(s).`, result.valid ? "success" : "warning");
      } else if (action === "test") {
        const result = await whatsappStudioApi.simulateFlow(businessId, savedId, testChoices);
        setTestTrace(result.trace);
        show(`Test visited ${result.trace.length} nodes${result.completed ? " and completed." : "."}`, result.completed ? "success" : "warning");
      } else {
        const result = await whatsappStudioApi.publishFlow(businessId, savedId);
        setLiveVersion(result.version);
        setValidation({ valid: true, errors: [] });
        show(`Published version ${result.version}.`, "success");
      }
    } catch (error) {
      const fallback = `${action === "publish" ? "Publish" : "Flow check"} failed. Validate the highlighted configuration.`;
      show(flowBuilderError(error, fallback), "error");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (!businessId || !flowId || !liveVersion || !confirm("Deactivate this live flow? New customer messages will no longer enter it. Anyone already partway through a conversation with it will still be able to finish.")) return;
    setBusy(true);
    try {
      await whatsappStudioApi.unpublishFlow(businessId, flowId);
      setLiveVersion(null);
      show("Live version deactivated. Your draft is still saved.", "success");
    } catch (error) { show(flowBuilderError(error, "Could not deactivate the live version."), "error"); }
    finally { setBusy(false); }
  }

  async function deleteFlow() {
    if (!businessId || !flowId) return;
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      await whatsappStudioApi.deleteFlow(businessId, flowId);
      show("Flow deleted.", "success");
      newFlow();
      const list = await whatsappStudioApi.flows(businessId);
      setFlows(list.flows);
    } catch (error) {
      show(flowBuilderError(error, "Could not delete this flow."), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div><Link href="/channels/whatsapp">← WhatsApp</Link><select aria-label="Open saved flow" value={flowId ?? ""} onChange={(event) => event.target.value ? void openFlow(event.target.value) : newFlow()}><option value="">+ New flow</option>{flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}</select><Input aria-label="Flow name" value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div className={styles.actions}>
          <Badge variant={isConnected ? "success" : "warning"}>{isConnected ? "WhatsApp connected" : "Connect WhatsApp"}</Badge>
          <Badge variant={liveVersion ? "success" : validation?.valid ? "info" : "neutral"}>{liveVersion ? `Live · v${liveVersion}` : validation?.valid ? "Ready to publish" : "Unsaved draft"}</Badge>
          <span className={styles.actionDivider} aria-hidden="true" />
          <Button variant="secondary" onClick={() => void save()} disabled={busy} title="Save your changes without going live">Save draft</Button>
          <Button variant="secondary" onClick={() => void run("validate")} disabled={busy} title="Check the graph for errors before publishing, doesn't send anything">Check for errors</Button>
          <Button variant="secondary" onClick={() => void run("test")} disabled={busy} title="Dry-run this flow with fake data, no real WhatsApp messages sent">Preview conversation</Button>
          <span className={styles.actionDivider} aria-hidden="true" />
          {liveVersion ? <Button variant="secondary" onClick={() => void unpublish()} disabled={busy} title="Take this flow offline, customers stop entering it">Deactivate</Button> : null}
          {flowId && !liveVersion ? <Button variant="danger" onClick={() => void deleteFlow()} disabled={busy} title="Permanently delete this flow">Delete</Button> : null}
          <Button onClick={() => void run("publish")} isLoading={busy} disabled={!isConnected} title={!isConnected ? "Connect WhatsApp before you can publish" : "Make this flow live for real customers"}>{liveVersion ? "Publish update" : "Publish"}</Button>
        </div>
      </header>

      <div className={styles.guide}>
        {guideSteps.map((item) => (
          <button
            key={item.step}
            type="button"
            className={`${styles.guideStep} ${item.done ? styles.guideStepDone : ""} ${currentStep === item.step ? styles.guideStepActive : ""}`}
            onClick={() => runGuideStep(item.step)}
          >
            <span>{item.done ? "✓" : item.step}</span>
            <span><strong>{item.title}</strong><small>{item.detail}</small></span>
          </button>
        ))}
      </div>

      <div className={styles.workspace}>
        <aside className={styles.palette} ref={paletteRef}>
          <h2>1. Setup</h2><p>Choose who should enter this flow and why.</p>
          <label className={styles.fieldLabel}>Start this flow when</label>
          <select value={triggerType} onChange={(event) => setTriggerType(event.target.value as StudioFlow["trigger_type"])}>
            <option value="first_message">A customer messages for the first time</option>
            <option value="keyword">A message contains exact keywords</option>
            <option value="intent">AI understands the customer&apos;s intent</option>
          </select>
          {triggerType === "keyword" ? <Input label="Keywords" helperText="Separate keywords with commas. Matches only if the message contains one of these exactly." value={keywords} onChange={(event) => setKeywords(event.target.value)} /> : null}
          {triggerType === "intent" ? <>
            <Textarea label="What is this flow for?" helperText="Describe the customer need this flow handles. The AI reads this to decide when to start it, even if their wording doesn't match exactly." value={intentDescription} onChange={(event) => setIntentDescription(event.target.value)} />
            <Input label="Keywords (optional shortcut)" helperText="Any of these words trigger the flow instantly, skipping the AI check." value={keywords} onChange={(event) => setKeywords(event.target.value)} />
          </> : null}
          <Textarea label="What this flow does" value={description} onChange={(event) => setDescription(event.target.value)} />
          <section><h3>Quick-start recipes</h3>{recipes.map((recipe) => <button key={recipe.name} onClick={() => applyRecipe(recipe)}><span>↗</span><span><b>{recipe.name}</b><small>{recipe.detail}</small></span></button>)}</section>
          <h2>2. Add blocks</h2><p>Click or drag a block, then use its green + to connect it.</p>
          {groups.map((group) => <section key={group} data-group={group}><h3>{group}</h3>{palette.filter((item) => item.group === group).map((item) => <button key={item.type} draggable onDragStart={(event) => event.dataTransfer.setData("application/studio-node", item.type)} onClick={() => addNode(item.type)}><span>+</span>{item.label}</button>)}</section>)}
        </aside>

        <main ref={canvasRef} className={styles.canvas} onWheel={onCanvasWheel} onDragOver={(event) => event.preventDefault()} onDrop={dropNode} onClick={(event) => { if (connectingFrom && event.target === event.currentTarget) setConnectingFrom(null); }}>
          <div className={styles.zoomControls}>
            <button type="button" onClick={() => zoomBy(-0.1)} aria-label="Zoom out">−</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => zoomBy(0.1)} aria-label="Zoom in">+</button>
            <button type="button" onClick={() => setZoom(1)} aria-label="Reset zoom">Reset</button>
          </div>
          <div className={styles.canvasSurface} style={{ width: canvasExtent.width * zoom, height: canvasExtent.height * zoom }}>
            <div className={styles.canvasScaled} style={{ width: canvasExtent.width, height: canvasExtent.height, transform: `scale(${zoom})` }}>
              <div className={styles.grid} />
              <svg className={styles.edges} aria-hidden="true">{edges.map((edge) => {
                const from = nodes.find((node) => node.id === edge.source);
                const to = nodes.find((node) => node.id === edge.target);
                if (!from || !to) return null;
                const x1 = from.x + 180, y1 = from.y + 36, x2 = to.x, y2 = to.y + 36;
                return <path key={edge.id} d={`M ${x1} ${y1} C ${x1 + 70} ${y1}, ${x2 - 70} ${y2}, ${x2} ${y2}`} />;
              })}</svg>
              {nodes.map((node) => <div key={node.id} data-kind={kindFor(node.type)} className={`${styles.node} ${selectedId === node.id ? styles.selected : ""}`} style={{ left: node.x, top: node.y }} onPointerDown={(event) => startMove(event, node)} onClick={() => connectingFrom ? connect(node.id) : setSelectedId(node.id)}>
                <span className={styles.nodeType}>{node.type.replaceAll("_", " ")}</span><strong>{node.label || node.type}</strong>
                {node.type === "text" ? <small>{String(node.config.text ?? "")}</small> : null}
                <div className={styles.handles}>{handlesFor(node).map((handle) => <button key={handle.id} className={styles.branchHandle} aria-label={`Connect ${handle.label} from ${node.label}`} onClick={(event) => { event.stopPropagation(); setConnectingFrom({ nodeId: node.id, handle: handle.id }); }}><span>{handle.label}</span>+</button>)}</div>
              </div>)}
            </div>
          </div>
          {connectingFrom ? <div className={styles.connectHint}>Select the destination node · Esc to cancel</div> : null}
        </main>

        <aside className={styles.inspector} ref={inspectorRef}>
          <h2>Block settings</h2><p>Edit what happens at this step, then connect every outcome.</p>
          {selected ? <div className={styles.inspectorForm}>
            <Input label="Label" value={selected.label ?? ""} onChange={(event) => updateSelected({ label: event.target.value })} />
            {selected.type === "text" || selected.type === "buttons" ? <Textarea label="Customer message" value={String(selected.config.text ?? "")} onChange={(event) => updateSelected({ config: { ...selected.config, text: event.target.value } })} /> : null}
            {selected.type === "buttons" ? <Input label="Button labels" helperText="Comma-separated, maximum three. Each gets its own connector." value={(Array.isArray(selected.config.buttons) ? selected.config.buttons as { title: string }[] : []).map((button) => button.title).join(", ")} onChange={(event) => { const buttons = event.target.value.split(",").map((title) => title.trim()).filter(Boolean).slice(0, 3).map((title, index) => ({ id: `option-${index + 1}`, title })); updateSelected({ config: { ...selected.config, buttons } }); }} /> : null}
            {["image", "audio", "video", "file", "http_request"].includes(selected.type) ? <Input label="Public HTTPS URL" value={String(selected.config.url ?? "")} onChange={(event) => updateSelected({ config: { ...selected.config, url: event.target.value } })} /> : null}
            {selected.type === "location" ? <><div className={styles.fieldPair}><Input label="Latitude" type="number" min="-90" max="90" step="any" value={String(selected.config.latitude ?? 0)} onChange={(event) => updateSelected({ config: { ...selected.config, latitude: Number(event.target.value) } })} /><Input label="Longitude" type="number" min="-180" max="180" step="any" value={String(selected.config.longitude ?? 0)} onChange={(event) => updateSelected({ config: { ...selected.config, longitude: Number(event.target.value) } })} /></div><Input label="Place name" value={String(selected.config.name ?? "")} onChange={(event) => updateSelected({ config: { ...selected.config, name: event.target.value } })} /><Input label="Address" value={String(selected.config.address ?? "")} onChange={(event) => updateSelected({ config: { ...selected.config, address: event.target.value } })} /></> : null}
            {selected.type === "user_input" ? <><Textarea label="Question to ask" value={String(selected.config.prompt ?? "")} onChange={(event) => updateSelected({ config: { ...selected.config, prompt: event.target.value } })} /><Input label="Save answer as" value={String(selected.config.variable ?? selected.id)} onChange={(event) => updateSelected({ config: { ...selected.config, variable: event.target.value } })} /></> : null}
            {selected.type === "form" || selected.type === "appointment" ? <><Textarea label="Message above the form" value={String(selected.config.prompt ?? "")} onChange={(event) => updateSelected({ config: { ...selected.config, prompt: event.target.value } })} /><label className={styles.fieldLabel}>Published WhatsApp form<select value={String(selected.config.flow_id ?? "")} onChange={(event) => updateSelected({ config: { ...selected.config, flow_id: event.target.value } })}><option value="">Select a published Meta Flow</option>{metaFlows.filter((flow) => flow.status === "PUBLISHED").map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}</select></label>{!metaFlows.some((flow) => flow.status === "PUBLISHED") ? <small>No published forms yet. <Link href="/channels/whatsapp-studio/forms">Build and publish a WhatsApp form</Link>, then return here.</small> : <small><Link href="/channels/whatsapp-studio/forms">Create or review WhatsApp forms</Link></small>}<Input label="Button label" maxLength={20} value={String(selected.config.cta ?? "Open form")} onChange={(event) => updateSelected({ config: { ...selected.config, cta: event.target.value } })} /><Input label="Starting screen ID (optional)" value={String(selected.config.screen ?? "")} onChange={(event) => updateSelected({ config: { ...selected.config, screen: event.target.value } })} /><Input label="Save submitted fields as" value={String(selected.config.variable ?? selected.id)} onChange={(event) => updateSelected({ config: { ...selected.config, variable: event.target.value } })} /></> : null}
            {selected.type === "template" ? <><Input label="Approved template name" value={String(selected.config.template_name ?? "")} onChange={(event) => updateSelected({ config: { ...selected.config, template_name: event.target.value } })} /><Input label="Language code" value={String(selected.config.language_code ?? "en_US")} onChange={(event) => updateSelected({ config: { ...selected.config, language_code: event.target.value } })} /></> : null}
            {selected.type === "ai_reply" ? <Textarea label="AI instruction" value={String(selected.config.prompt ?? "")} onChange={(event) => updateSelected({ config: { ...selected.config, prompt: event.target.value } })} /> : null}
            {selected.type === "condition" ? <><Input label="Variable to check" value={String(selected.config.variable ?? "")} onChange={(event) => updateSelected({ config: { ...selected.config, variable: event.target.value } })} /><label className={styles.fieldLabel}>Rule<select value={String(selected.config.operator ?? "equals")} onChange={(event) => updateSelected({ config: { ...selected.config, operator: event.target.value } })}><option value="equals">Equals</option><option value="not_equals">Does not equal</option><option value="contains">Contains</option><option value="exists">Has a value</option><option value="greater_than">Greater than</option></select></label><Input label="Comparison value" value={String(selected.config.value ?? "")} onChange={(event) => updateSelected({ config: { ...selected.config, value: event.target.value } })} /></> : null}
            {selected.type === "delay" ? <Input label="Wait seconds (maximum 10)" type="number" min="0" max="10" value={String(selected.config.seconds ?? 1)} onChange={(event) => updateSelected({ config: { ...selected.config, seconds: Number(event.target.value) } })} helperText="Use Drip Campaigns for waits longer than 10 seconds." /> : null}
            {selected.type === "human_handoff" ? <><Textarea label="Message to customer" value={String(selected.config.message ?? "")} onChange={(event) => updateSelected({ config: { ...selected.config, message: event.target.value } })} /><Input label="Internal handoff reason" value={String(selected.config.reason ?? "")} onChange={(event) => updateSelected({ config: { ...selected.config, reason: event.target.value } })} /></> : null}
            {selected.type !== "start" && selected.type !== "end" ? <Button variant="danger" onClick={() => { setNodes((current) => current.filter((node) => node.id !== selected.id)); setEdges((current) => current.filter((edge) => edge.source !== selected.id && edge.target !== selected.id)); setSelectedId("start"); }}>Delete block</Button> : null}
          </div> : <p>Select a block to edit it.</p>}
          {validation && !validation.valid ? <div className={styles.issues}><h3>Fix before publishing</h3>{validation.errors.map((error, index) => <p key={`${error.code}-${index}`}>{error.message}</p>)}</div> : null}
          {branchNodes.length ? <div className={styles.testChoices}>
            <h3>Test path: pick a branch</h3>
            <p>Choose which outcome to follow at each fork, then click Test.</p>
            {branchNodes.map((node) => <label key={node.id} className={styles.fieldLabel}>{node.label || node.id}
              <select value={testChoices[node.id] ?? ""} onChange={(event) => setTestChoices((current) => ({ ...current, [node.id]: event.target.value }))}>
                <option value="">First available option</option>
                {handlesFor(node).map((handle) => <option key={handle.id} value={handle.id}>{handle.label}</option>)}
              </select>
            </label>)}
          </div> : null}
          {testTrace.length ? <div className={styles.testTrace}><h3>Customer test path</h3>{testTrace.map((step, index) => <div key={`${step.node_id}-${index}`}><span>{index + 1}</span><p><strong>{step.label || step.type}</strong><small>{step.type.replaceAll("_", " ")}</small></p></div>)}</div> : null}
        </aside>
      </div>
    </div>
  );
}
