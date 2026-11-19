import { SHOP_STEP_ID, type FlowButton, type FlowStep, type TemplateFlow } from "@/lib/api";

// A button menu as people think of it: a message with options, where each
// option does one thing. It's stored as the flat steps the flow engine runs.

export type OptionKind = "reply" | "menu" | "shop" | "link" | "ai" | "team" | "back";

export interface MenuOption {
  id: string;
  title: string;
  kind: OptionKind;
  /** What to send for "reply", "link", "ai" and "team". */
  reply: string;
  /** Optional photo sent with a "reply" or "ai" message. */
  image: string;
  /** For "link": where the button goes and what it says. */
  link: string;
  linkLabel: string;
  /** The next menu, for "menu". */
  menu: MenuNode | null;
}

export interface MenuNode {
  message: string;
  options: MenuOption[];
}

export const MAX_OPTIONS = 10;
export const MAX_TITLE = 20;
export const MAX_DEPTH = 4;
const BACK_TITLE = "Main menu";
export const DEFAULT_TEAM_REPLY = "Thanks! Someone from our team will reply here shortly.";
export const DEFAULT_AI_REPLY = "Sure! Type your question and I'll answer right away.";
export const MAX_LINK_LABEL = 20;

const isHttps = (value: string) => /^https:\/\/\S+\.\S+/.test(value.trim());

export function newId(): string {
  return `opt_${Math.random().toString(36).slice(2, 10)}`;
}

export function newOption(partial: Partial<MenuOption> = {}): MenuOption {
  return { id: newId(), title: "", kind: "reply", reply: "", image: "", link: "", linkLabel: "", menu: null, ...partial };
}

export function replyOption(title: string, reply: string): MenuOption {
  return newOption({ title, reply });
}

export function teamOption(title = "Talk to our team"): MenuOption {
  return newOption({ title, kind: "team", reply: DEFAULT_TEAM_REPLY });
}

export function shopOption(title = "Browse & order"): MenuOption {
  return newOption({ title, kind: "shop" });
}

export function aiOption(title = "Ask a question"): MenuOption {
  return newOption({ title, kind: "ai", reply: DEFAULT_AI_REPLY });
}

/** The flat steps for saving. The first step is always the main menu. */
export function toSteps(root: MenuNode): { steps: FlowStep[]; entry: string } {
  const entry = "s1";
  const steps: FlowStep[] = [];
  let next = 1;
  const stepId = () => `s${next++}`;

  function addMenu(menu: MenuNode, id: string) {
    const step: FlowStep = { step_id: id, message: menu.message.trim(), buttons: [] };
    steps.push(step);
    for (const option of menu.options) {
      const button: FlowButton = { id: option.id, title: option.title.trim(), next_step_id: null };
      step.buttons.push(button);
      if (option.kind === "back") {
        button.next_step_id = entry;
      } else if (option.kind === "shop") {
        button.next_step_id = SHOP_STEP_ID;
      } else if (option.kind === "link") {
        const child = stepId();
        button.next_step_id = child;
        steps.push({ step_id: child, message: option.reply.trim(), buttons: [], link_url: option.link.trim(), link_label: option.linkLabel.trim() || "Open link" });
      } else if (option.kind === "ai") {
        const child = stepId();
        button.next_step_id = child;
        steps.push({ step_id: child, message: option.reply.trim() || DEFAULT_AI_REPLY, buttons: [], ask_ai: true, image_url: option.image.trim() || null });
      } else if (option.kind === "menu" && option.menu) {
        const child = stepId();
        button.next_step_id = child;
        addMenu(option.menu, child);
      } else if (option.kind === "team") {
        const child = stepId();
        button.next_step_id = child;
        steps.push({ step_id: child, message: option.reply.trim() || DEFAULT_TEAM_REPLY, buttons: [], handoff: true });
      } else {
        // A reply offers the way back, so the customer is never left stuck.
        const child = stepId();
        button.next_step_id = child;
        steps.push({
          step_id: child,
          message: option.reply.trim(),
          buttons: [{ id: `${option.id}_menu`, title: BACK_TITLE, next_step_id: entry }],
          image_url: option.image.trim() || null,
        });
      }
    }
  }

  addMenu(root, stepId());
  return { steps, entry };
}

/** Back to a tree for editing, including flows made with the older form. */
export function fromFlow(flow: TemplateFlow): MenuNode {
  const byId = new Map(flow.steps.map((step) => [step.step_id, step]));
  const seen = new Set<string>();

  function isReply(step: FlowStep): boolean {
    if (step.buttons.length === 0) return true;
    return step.buttons.length === 1 && step.buttons[0].next_step_id === flow.entry_step_id && step.buttons[0].title === BACK_TITLE;
  }

  function toOption(button: FlowButton): MenuOption {
    const base = { id: button.id, title: button.title };
    const target = button.next_step_id ? byId.get(button.next_step_id) : undefined;
    if (button.next_step_id === flow.entry_step_id) return newOption({ ...base, kind: "back" });
    if (button.next_step_id === SHOP_STEP_ID) return newOption({ ...base, kind: "shop" });
    if (!target) return newOption(base);
    if (target.handoff) return newOption({ ...base, kind: "team", reply: target.message });
    if (target.link_url) return newOption({ ...base, kind: "link", reply: target.message, link: target.link_url, linkLabel: target.link_label ?? "" });
    if (target.ask_ai) return newOption({ ...base, kind: "ai", reply: target.message, image: target.image_url ?? "" });
    if (isReply(target) || seen.has(target.step_id)) return newOption({ ...base, reply: target.message, image: target.image_url ?? "" });
    return newOption({ ...base, kind: "menu", menu: toMenu(target) });
  }

  function toMenu(step: FlowStep): MenuNode {
    seen.add(step.step_id);
    return { message: step.message, options: step.buttons.map(toOption) };
  }

  const entry = byId.get(flow.entry_step_id) ?? flow.steps[0];
  return entry ? toMenu(entry) : { message: "", options: [] };
}

/** The first thing stopping this menu from being saved, or null. */
export function findProblem(menu: MenuNode, depth = 1): string | null {
  if (!menu.message.trim()) return depth === 1 ? "Write the welcome message." : "One of your menus has no message.";
  if (menu.options.length === 0) return depth === 1 ? "Add at least one option." : "One of your menus has no options.";
  if (menu.options.length > MAX_OPTIONS) return `A menu can have at most ${MAX_OPTIONS} options.`;
  const titles = new Set<string>();
  for (const option of menu.options) {
    const title = option.title.trim();
    if (!title) return "Every option needs a button label.";
    if (title.length > MAX_TITLE) return `“${title}” is too long. Labels can be ${MAX_TITLE} characters.`;
    if (titles.has(title.toLowerCase())) return `Two options are both called “${title}”.`;
    titles.add(title.toLowerCase());
    if (option.kind === "reply" && !option.reply.trim()) return `Write the reply for “${title}”.`;
    if ((option.kind === "reply" || option.kind === "ai") && option.image.trim() && !isHttps(option.image)) return `The photo for “${title}” needs a full link starting with https://`;
    if (option.kind === "link") {
      if (!option.reply.trim()) return `Write the message shown above the link for “${title}”.`;
      if (!isHttps(option.link)) return `The link for “${title}” needs to start with https://`;
      if (option.linkLabel.trim().length > MAX_LINK_LABEL) return `The link button for “${title}” can be ${MAX_LINK_LABEL} characters.`;
    }
    if (option.kind === "menu") {
      if (!option.menu) return `Set up the menu for “${title}”.`;
      const inner = findProblem(option.menu, depth + 1);
      if (inner) return inner;
    }
  }
  return null;
}

export interface MenuStarter {
  name: string;
  detail: string;
  /** Uses WhatsApp-only options (the product list). */
  whatsappOnly?: boolean;
  build: () => MenuNode;
}

export const MENU_STARTERS: MenuStarter[] = [
  {
    name: "Shop & order",
    detail: "Customers browse your products and pay by UPI, all inside WhatsApp",
    whatsappOnly: true,
    build: () => ({
      message: "Hi! 👋 Welcome to our store. What would you like to do?",
      options: [
        shopOption(),
        replyOption("Delivery & returns", "We deliver in 3 to 5 working days. Returns are free within 7 days."),
        aiOption(),
        teamOption(),
      ],
    }),
  },
  {
    name: "Shop",
    detail: "Prices, delivery and your team",
    build: () => ({
      message: "Hi! Welcome to our store. How can we help you today?",
      options: [
        replyOption("See prices", "Here are our latest prices:\n\n"),
        replyOption("Delivery info", "We deliver in 3 to 5 working days."),
        teamOption(),
      ],
    }),
  },
  {
    name: "Bookings",
    detail: "Timings, location and booking",
    build: () => ({
      message: "Hello! What would you like to do?",
      options: [
        replyOption("Opening hours", "We're open Monday to Saturday, 10 am to 7 pm."),
        replyOption("Our location", "You can find us here:\n\n"),
        teamOption("Book a slot"),
      ],
    }),
  },
  {
    name: "Support",
    detail: "Sales and support, each with its own options",
    build: () => ({
      message: "Hi! Please choose an option:",
      options: [
        newOption({
          title: "Sales",
          kind: "menu",
          menu: { message: "What would you like to know?", options: [replyOption("Pricing", "Our plans start at:\n\n"), teamOption("Talk to sales"), newOption({ title: "Main menu", kind: "back" })] },
        }),
        newOption({
          title: "Support",
          kind: "menu",
          menu: { message: "How can we help?", options: [replyOption("Track my order", "Please send your order number and we'll check it."), teamOption("Talk to support"), newOption({ title: "Main menu", kind: "back" })] },
        }),
      ],
    }),
  },
  {
    name: "Start blank",
    detail: "Write your own from scratch",
    build: () => ({ message: "", options: [newOption()] }),
  },
];
