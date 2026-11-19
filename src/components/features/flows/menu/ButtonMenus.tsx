"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, templateFlowsApi, type FlowChannel, type TemplateFlow } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Button, Icon, IconTile, InfoLabel, InfoTip, Input, Modal, Skeleton, Switch, Textarea } from "@/components/ui";
import {
  DEFAULT_AI_REPLY,
  DEFAULT_TEAM_REPLY,
  MAX_DEPTH,
  MAX_LINK_LABEL,
  MAX_OPTIONS,
  MAX_TITLE,
  MENU_STARTERS,
  findProblem,
  fromFlow,
  newOption,
  toSteps,
  type MenuNode,
  type MenuOption,
  type OptionKind,
} from "./menuTree";
import styles from "./menu.module.scss";

const DEFAULT_WORDS = "hi, hello, menu, start";

const KINDS: Array<{ value: OptionKind; label: string; hint: string; whatsappOnly?: boolean }> = [
  { value: "reply", label: "Send a reply", hint: "A fixed message (and photo, if you like), then a Main menu button." },
  { value: "menu", label: "Show more options", hint: "Opens another menu." },
  { value: "shop", label: "Show products & take orders", hint: "Your in-stock products with photos and prices. The customer picks one, chooses how many and gets a UPI pay link.", whatsappOnly: true },
  { value: "link", label: "Open a link", hint: "A message with a button that opens your website, a booking page, a map…" },
  { value: "ai", label: "Let the AI answer", hint: "The menu steps aside and the AI agent answers whatever they type next." },
  { value: "team", label: "Connect to my team", hint: "You get a notification and reply from the inbox." },
  { value: "back", label: "Back to main menu", hint: "Shows the first menu again." },
];

interface Draft {
  id: string | null;
  name: string;
  greetNew: boolean;
  words: string;
  root: MenuNode;
}

function draftFrom(flow: TemplateFlow): Draft {
  return {
    id: flow.id,
    name: flow.name,
    greetNew: flow.trigger_type === "first_message",
    words: (flow.keywords ?? []).join(", "),
    root: fromFlow(flow),
  };
}

function wordList(value: string): string[] {
  return Array.from(new Set(value.split(",").map((word) => word.trim().toLowerCase()).filter(Boolean)));
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.userMessage : fallback;
}

/** Ready-to-tap button menus, like a phone menu: no AI and no typing needed. */
export function ButtonMenus({ agentId, channel, canEdit }: { agentId?: string | null; channel: FlowChannel; canEdit: boolean }) {
  const { show } = useToast();
  const [flows, setFlows] = useState<TemplateFlow[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [deleting, setDeleting] = useState<TemplateFlow | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!agentId) return;
    templateFlowsApi
      .list(agentId)
      .then((list) => setFlows(list.filter((flow) => flow.channel === channel)))
      .catch(() => setFlows([]));
  }, [agentId, channel]);

  useEffect(() => {
    load();
  }, [load]);

  function start(root: MenuNode, name: string) {
    const greeting = (flows ?? []).some((flow) => flow.active && flow.trigger_type === "first_message");
    setDraft({ id: null, name, greetNew: !greeting, words: DEFAULT_WORDS, root });
    setChoosing(false);
  }

  async function save() {
    if (!draft || !agentId) return;
    const problem = !draft.name.trim() ? "Give this menu a name." : findProblem(draft.root);
    if (problem) {
      show(problem, "warning");
      return;
    }
    const keywords = wordList(draft.words);
    if (!draft.greetNew && keywords.length === 0) {
      show("Add a word that opens this menu, or turn on “New customers”.", "warning");
      return;
    }
    const { steps, entry } = toSteps(draft.root);
    const trigger_type = draft.greetNew ? "first_message" : "keyword";
    setSaving(true);
    try {
      if (draft.id) {
        await templateFlowsApi.update(draft.id, { name: draft.name.trim(), steps, entry_step_id: entry, keywords, trigger_type });
      } else {
        await templateFlowsApi.create({ agent_id: agentId, channel, name: draft.name.trim(), trigger_type, entry_step_id: entry, steps, keywords, active: true });
      }
      show(draft.id ? "Menu saved." : "Your menu is live. Message your number from another phone to try it.", "success");
      setDraft(null);
      load();
    } catch (error) {
      show(errorText(error, "Couldn't save this menu."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(flow: TemplateFlow, on: boolean) {
    setBusyId(flow.id);
    try {
      if (on) await templateFlowsApi.activate(flow.id);
      else await templateFlowsApi.deactivate(flow.id);
      load();
    } catch (error) {
      show(errorText(error, "Couldn't change this menu."), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(flow: TemplateFlow) {
    setBusyId(flow.id);
    try {
      await templateFlowsApi.delete(flow.id);
      show("Menu deleted.", "default");
      setDeleting(null);
      load();
    } catch (error) {
      show(errorText(error, "Couldn't delete this menu."), "error");
    } finally {
      setBusyId(null);
    }
  }

  if (!agentId) return <p className={styles.muted}>Link an agent to this number first (Settings → Connection). No AI is used; menus just need an agent to receive messages.</p>;

  if (draft) return <MenuEditor draft={draft} channel={channel} onChange={setDraft} onSave={() => void save()} onCancel={() => setDraft(null)} saving={saving} />;

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <IconTile name="overview" tone="green" />
        <div className={styles.headText}>
          <h3>
            Clickable menus
            <InfoTip help="Like a phone menu: customers tap a button (or type its number) and get your answer straight away. No AI is involved, and it works with the AI agent switched off." />
          </h3>
          <p>A message with buttons customers tap instead of typing: answers, products to order, links, or a person.</p>
        </div>
        {canEdit && flows && flows.length > 0 && (
          <Button onClick={() => setChoosing(true)} leftIcon={<Icon name="plus" size={16} />}>
            New menu
          </Button>
        )}
      </div>

      {flows !== null && flows.length === 0 && (
        <ol className={styles.howItWorks}>
          <li>
            <strong>Pick a starting point</strong>
            <span>Each comes filled in. Change the words and buttons to fit your business.</span>
          </li>
          <li>
            <strong>Choose what each button does</strong>
            <span>Reply, open more options, show products to order, open a link, let the AI answer, or call your team.</span>
          </li>
          <li>
            <strong>Go live</strong>
            <span>It opens for new customers and whenever someone sends “hi” or “menu”. Try it from another phone.</span>
          </li>
        </ol>
      )}

      {flows === null ? (
        <Skeleton height={120} />
      ) : flows.length === 0 ? (
        canEdit ? (
          <Starters channel={channel} onPick={start} />
        ) : (
          <p className={styles.muted}>No menus yet.</p>
        )
      ) : (
        <ul className={styles.list}>
          {flows.map((flow) => {
            const options = flow.steps.find((step) => step.step_id === flow.entry_step_id)?.buttons.length ?? 0;
            return (
              <li key={flow.id} className={styles.item}>
                <div className={styles.itemText}>
                  <strong>{flow.name}</strong>
                  <span>
                    {options} {options === 1 ? "option" : "options"}
                    {flow.trigger_type === "first_message" ? " · New customers" : ""}
                    {flow.keywords?.length ? ` · Opens on: ${flow.keywords.join(", ")}` : ""}
                  </span>
                </div>
                <label className={styles.liveSwitch}>
                  <Switch checked={flow.active} disabled={!canEdit || busyId === flow.id} onChange={(value) => void toggle(flow, value)} aria-label={`${flow.name} live`} />
                  {flow.active ? "Live" : "Off"}
                </label>
                {canEdit && (
                  <span className={styles.itemActions}>
                    <button type="button" className={styles.iconAction} onClick={() => setDraft(draftFrom(flow))} aria-label={`Edit ${flow.name}`} title="Edit">
                      <Icon name="pen" size={16} />
                    </button>
                    <button type="button" className={styles.iconAction} onClick={() => setDeleting(flow)} aria-label={`Delete ${flow.name}`} title="Delete">
                      <Icon name="trash" size={16} />
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal isOpen={choosing} onClose={() => setChoosing(false)} title="Start your menu" size="lg">
        <Starters channel={channel} onPick={start} />
      </Modal>

      <Modal
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this menu?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button variant="danger" isLoading={busyId === deleting?.id} onClick={() => deleting && void remove(deleting)}>
              Delete
            </Button>
          </>
        }
      >
        <p className={styles.muted}>“{deleting?.name}” will stop working straight away. To pause it instead, switch it off.</p>
      </Modal>
    </section>
  );
}

function Starters({ channel, onPick }: { channel: FlowChannel; onPick: (root: MenuNode, name: string) => void }) {
  return (
    <div className={styles.starters}>
      {MENU_STARTERS.filter((starter) => !starter.whatsappOnly || channel === "whatsapp").map((starter) => (
        <button key={starter.name} type="button" className={styles.starter} onClick={() => onPick(starter.build(), starter.name === "Start blank" ? "Main menu" : `${starter.name} menu`)}>
          <strong>{starter.name}</strong>
          <span>{starter.detail}</span>
        </button>
      ))}
    </div>
  );
}

function MenuEditor({ draft, channel, onChange, onSave, onCancel, saving }: { draft: Draft; channel: FlowChannel; onChange: (next: Draft) => void; onSave: () => void; onCancel: () => void; saving: boolean }) {
  const problem = !draft.name.trim() ? "Give this menu a name." : findProblem(draft.root);
  return (
    <section className={styles.section}>
      <div className={styles.editorTop}>
        <div>
          <span className={styles.eyebrow}>{draft.id ? "Edit menu" : "New menu"}</span>
          <h3>{draft.name || "Button menu"}</h3>
        </div>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <div className={styles.editor}>
        <div className={styles.editorMain}>
          <Input label="Menu name (only you see this)" value={draft.name} maxLength={60} onChange={(event) => onChange({ ...draft, name: event.target.value })} />

          <div className={styles.startsWhen}>
            <strong>When does it open?</strong>
            <Switch checked={draft.greetNew} onChange={(value) => onChange({ ...draft, greetNew: value })} label="When a new customer messages for the first time" />
            <Input
              label={<InfoLabel help="If a customer sends exactly one of these words, the menu opens, even if they've messaged before. Separate words with commas.">Also when someone sends</InfoLabel>}
              value={draft.words}
              onChange={(event) => onChange({ ...draft, words: event.target.value })}
              placeholder={DEFAULT_WORDS}
            />
          </div>

          <MenuCard menu={draft.root} depth={1} channel={channel} onChange={(root) => onChange({ ...draft, root })} />
        </div>
        <Preview root={draft.root} />
      </div>

      <div className={styles.footer}>
        {problem ? <span className={styles.problem}>{problem}</span> : <span className={styles.ready}>Ready to go live</span>}
        <Button onClick={onSave} isLoading={saving}>
          {draft.id ? "Save menu" : "Go live"}
        </Button>
      </div>
    </section>
  );
}

function MenuCard({ menu, depth, channel, onChange }: { menu: MenuNode; depth: number; channel: FlowChannel; onChange: (next: MenuNode) => void }) {
  function update(id: string, patch: Partial<MenuOption>) {
    onChange({ ...menu, options: menu.options.map((option) => (option.id === id ? { ...option, ...patch } : option)) });
  }

  function setKind(option: MenuOption, kind: OptionKind) {
    update(option.id, {
      kind,
      menu: kind === "menu" ? option.menu ?? { message: "", options: [newOption()] } : option.menu,
      reply: kind === "team" && !option.reply ? DEFAULT_TEAM_REPLY : kind === "ai" && !option.reply ? DEFAULT_AI_REPLY : option.reply,
    });
  }

  function move(index: number, step: number) {
    const options = [...menu.options];
    const [item] = options.splice(index, 1);
    options.splice(index + step, 0, item);
    onChange({ ...menu, options });
  }

  const kinds = KINDS.filter((kind) =>
    (kind.whatsappOnly ? channel === "whatsapp" : true) && (kind.value === "back" ? depth > 1 : kind.value === "menu" ? depth < MAX_DEPTH : true)
  );

  return (
    <div className={depth === 1 ? styles.menuCard : styles.subMenu}>
      <Textarea
        label={depth === 1 ? "Welcome message" : "Message for this menu"}
        value={menu.message}
        rows={2}
        maxLength={1000}
        onChange={(event) => onChange({ ...menu, message: event.target.value })}
        placeholder="Hi! How can we help you today?"
      />
      <ol className={styles.options}>
        {menu.options.map((option, index) => (
          <li key={option.id} className={styles.option}>
            <div className={styles.optionTop}>
              <span className={styles.optionNumber}>{index + 1}</span>
              <input
                className={styles.titleInput}
                value={option.title}
                maxLength={MAX_TITLE}
                onChange={(event) => update(option.id, { title: event.target.value })}
                placeholder="Button label"
                aria-label={`Option ${index + 1} label`}
              />
              <span className={styles.optionTools}>
                <button type="button" className={styles.iconAction} disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up">
                  ↑
                </button>
                <button type="button" className={styles.iconAction} disabled={index === menu.options.length - 1} onClick={() => move(index, 1)} aria-label="Move down">
                  ↓
                </button>
                <button
                  type="button"
                  className={styles.iconAction}
                  disabled={menu.options.length === 1}
                  onClick={() => onChange({ ...menu, options: menu.options.filter((item) => item.id !== option.id) })}
                  aria-label="Remove option"
                >
                  <Icon name="trash" size={15} />
                </button>
              </span>
            </div>
            <div className={styles.kinds} role="radiogroup" aria-label="When tapped">
              {kinds.map((kind) => (
                <button key={kind.value} type="button" role="radio" aria-checked={option.kind === kind.value} title={kind.hint} className={option.kind === kind.value ? styles.kindOn : styles.kind} onClick={() => setKind(option, kind.value)}>
                  {kind.label}
                </button>
              ))}
            </div>
            <p className={styles.kindHint}>{KINDS.find((kind) => kind.value === option.kind)?.hint}</p>
            {(option.kind === "reply" || option.kind === "team" || option.kind === "ai" || option.kind === "link") && (
              <Textarea
                value={option.reply}
                rows={2}
                maxLength={1000}
                aria-label="Reply"
                placeholder={
                  option.kind === "team" ? DEFAULT_TEAM_REPLY : option.kind === "ai" ? DEFAULT_AI_REPLY : option.kind === "link" ? "Book your slot online:" : "What should we reply?"
                }
                onChange={(event) => update(option.id, { reply: event.target.value })}
              />
            )}
            {option.kind === "link" && (
              <div className={styles.linkFields}>
                <Input
                  label="Link"
                  type="url"
                  value={option.link}
                  onChange={(event) => update(option.id, { link: event.target.value })}
                  placeholder="https://yourwebsite.com/book"
                />
                <Input
                  label="Button text"
                  value={option.linkLabel}
                  maxLength={MAX_LINK_LABEL}
                  onChange={(event) => update(option.id, { linkLabel: event.target.value })}
                  placeholder="Book now"
                />
              </div>
            )}
            {(option.kind === "reply" || option.kind === "ai") && (
              <Input
                label={<InfoLabel help="Paste a public link to a photo (it must start with https://). Copy it from your Products page, your website, or Google Drive set to “anyone with the link”.">Photo (optional)</InfoLabel>}
                type="url"
                value={option.image}
                onChange={(event) => update(option.id, { image: event.target.value })}
                placeholder="https://…/photo.jpg"
              />
            )}
            {option.kind === "shop" && (
              <p className={styles.shopNote}>
                Uses the in-stock products in your WhatsApp Shop. Orders need your UPI ID in Settings. You get a notification for each order, and it shows up under Shop → Orders.
              </p>
            )}
            {option.kind === "menu" && option.menu && <MenuCard menu={option.menu} depth={depth + 1} channel={channel} onChange={(next) => update(option.id, { menu: next })} />}
          </li>
        ))}
      </ol>
      {menu.options.length < MAX_OPTIONS && (
        <Button size="sm" variant="secondary" leftIcon={<Icon name="plus" size={14} />} onClick={() => onChange({ ...menu, options: [...menu.options, newOption()] })}>
          Add option
        </Button>
      )}
      {menu.options.length > 3 && <p className={styles.hint}>WhatsApp shows more than 3 options as a “See options” list.</p>}
    </div>
  );
}

type Bubble = { from: "you" | "them"; text: string; image?: string; link?: string; note?: string };

const SAMPLE_PRODUCTS = [
  { name: "Your best seller", price: "₹499" },
  { name: "Another product", price: "₹1,299" },
];

/** What the customer gets after tapping an option that doesn't open another menu. */
function answerFor(option: MenuOption): Bubble[] {
  switch (option.kind) {
    case "shop":
      return [
        { from: "you", text: "Here's what we have. Tap a product to see it and order.", note: SAMPLE_PRODUCTS.map((p) => `${p.name} · ${p.price}`).join("\n") },
        { from: "you", text: "Photo, price, then “Order now” → “How many?” → a UPI pay link.", note: "Your real products appear here" },
      ];
    case "link":
      return [{ from: "you", text: option.reply || "…", link: option.linkLabel || "Open link" }];
    case "ai":
      return [{ from: "you", text: option.reply || DEFAULT_AI_REPLY, image: option.image || undefined, note: "From here, the AI agent answers" }];
    default:
      return [{ from: "you", text: option.reply || "…", image: option.image || undefined }];
  }
}

/** A phone you can tap through, showing what customers will get. */
function Preview({ root }: { root: MenuNode }) {
  const [path, setPath] = useState<Array<{ menu: MenuNode | null; bubbles: Bubble[]; ends?: boolean }>>([]);
  const current = path.length ? path[path.length - 1] : null;
  const menu = current ? current.menu : root;
  const bubbles = current?.bubbles ?? [];

  function tap(option: MenuOption) {
    const said: Bubble = { from: "them", text: option.title || "Option" };
    if (option.kind === "back") setPath([]);
    else if (option.kind === "menu" && option.menu) setPath([...path, { menu: option.menu, bubbles: [said] }]);
    else setPath([...path, { menu: null, bubbles: [said, ...answerFor(option)], ends: option.kind !== "reply" }]);
  }

  const showList = (menu?.options.length ?? 0) > 3;

  return (
    <aside className={styles.previewWrap}>
      <div className={styles.phone}>
        <div className={styles.phoneBar}>Preview: tap the buttons</div>
        <div className={styles.chat}>
          {bubbles.map((bubble, index) => (
            <div key={index} className={bubble.from === "you" ? styles.bubbleYou : styles.bubbleThem}>
              {bubble.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.bubbleImage} src={bubble.image} alt="" onError={(event) => (event.currentTarget.style.display = "none")} />
              )}
              {bubble.text}
              {bubble.note && <small className={styles.bubbleNote}>{bubble.note}</small>}
              {bubble.link && <span className={styles.bubbleLink}>↗ {bubble.link}</span>}
            </div>
          ))}
          {menu && (
            <div className={styles.menuBubble}>
              <p>{menu.message || "Your message appears here"}</p>
              {showList && <span className={styles.listHint}>See options (list)</span>}
              {menu.options.map((option) => (
                <button key={option.id} type="button" className={styles.chatButton} onClick={() => tap(option)}>
                  {option.title || "Button label"}
                </button>
              ))}
            </div>
          )}
          {current && !current.menu && !current.ends && current.bubbles[1] && (
            <button type="button" className={styles.chatButton} onClick={() => setPath([])}>
              Main menu
            </button>
          )}
        </div>
      </div>
      {path.length > 0 && (
        <button type="button" className={styles.restart} onClick={() => setPath([])}>
          Start preview again
        </button>
      )}
    </aside>
  );
}
