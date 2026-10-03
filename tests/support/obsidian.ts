/**
 * Minimal stand-in for the `obsidian` package, which ships type declarations
 * only (no runtime entry), so any module importing a value from it cannot be
 * loaded under vitest. vitest.config.ts aliases "obsidian" to this file.
 *
 * It models just enough behavior for the plugin's modals, settings tab and
 * ribbon manager to run in jsdom, and records calls (see `obsidianLog`) so
 * tests can assert on interactions that have no observable DOM effect.
 */

type ElOptions = string | { text?: string; cls?: string | string[]; attr?: Record<string, string>; value?: string };

export const obsidianLog = {
  renders: [] as { markdown: string; sourcePath: string; el: HTMLElement }[],
  icons: new Map<string, string>(),
  reset(): void {
    this.renders.length = 0;
    this.icons.clear();
    modals.length = 0;
    createdSettings.length = 0;
  },
};

function applyOptions(el: HTMLElement, options?: ElOptions): void {
  if (options === undefined) return;
  if (typeof options === "string") {
    el.className = options;
    return;
  }
  if (options.text !== undefined) el.textContent = options.text;
  if (options.cls) el.classList.add(...(Array.isArray(options.cls) ? options.cls : options.cls.split(" ")));
  if (options.value !== undefined) (el as HTMLInputElement).value = options.value;
  for (const [key, value] of Object.entries(options.attr ?? {})) el.setAttribute(key, value);
}

/** Obsidian patches these helpers onto every element; replicate the ones used. */
export function installObsidianDomHelpers(): void {
  if (typeof HTMLElement === "undefined" || "createEl" in HTMLElement.prototype) return;

  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.createEl = function (this: HTMLElement, tag: string, options?: ElOptions): HTMLElement {
    const el = document.createElement(tag);
    applyOptions(el, options);
    this.appendChild(el);
    return el;
  };
  proto.createDiv = function (this: HTMLElement, options?: ElOptions): HTMLElement {
    return (this as unknown as { createEl(t: string, o?: ElOptions): HTMLElement }).createEl("div", options);
  };
  proto.createSpan = function (this: HTMLElement, options?: ElOptions): HTMLElement {
    return (this as unknown as { createEl(t: string, o?: ElOptions): HTMLElement }).createEl("span", options);
  };
  proto.addClass = function (this: HTMLElement, ...classes: string[]): void {
    this.classList.add(...classes);
  };
  proto.removeClass = function (this: HTMLElement, ...classes: string[]): void {
    this.classList.remove(...classes);
  };
  proto.empty = function (this: HTMLElement): void {
    this.replaceChildren();
  };
  proto.setText = function (this: HTMLElement, text: string): void {
    this.textContent = text;
  };

  const globals = globalThis as unknown as Record<string, unknown>;
  globals.createDiv = makeDiv;
}

function makeDiv(options?: ElOptions): HTMLElement {
  const el = document.createElement("div");
  applyOptions(el, options);
  return el;
}

installObsidianDomHelpers();

export class App {
  workspace: any = {};
  vault: any = {};
  metadataCache: any = {};
}

export class Component {
  loaded = false;
  load(): void {
    this.loaded = true;
  }
  unload(): void {
    this.loaded = false;
  }
}

export const MarkdownRenderer = {
  async render(_app: App, markdown: string, el: HTMLElement, sourcePath: string, _component: Component): Promise<void> {
    // The real renderer produces HTML; tests only need to know what was asked for.
    el.textContent = markdown;
    obsidianLog.renders.push({ markdown, sourcePath, el });
  },
};

/** Every Modal constructed, so tests can reach modals the code under test opens. */
export const modals: Modal[] = [];

export class Modal {
  contentEl: HTMLElement;
  titleEl: HTMLElement;
  opened = false;
  constructor(public app: App) {
    modals.push(this);
    this.contentEl = document.createElement("div");
    this.titleEl = document.createElement("div");
  }
  setTitle(title: string): this {
    this.titleEl.textContent = title;
    return this;
  }
  open(): void {
    this.opened = true;
    (this as unknown as { onOpen?(): void }).onOpen?.();
  }
  close(): void {
    if (!this.opened) return;
    this.opened = false;
    (this as unknown as { onClose?(): void }).onClose?.();
  }
}

export abstract class SuggestModal<T> extends Modal {
  placeholder = "";
  setPlaceholder(placeholder: string): void {
    this.placeholder = placeholder;
  }
  abstract getSuggestions(query: string): T[] | Promise<T[]>;
  abstract renderSuggestion(item: T, el: HTMLElement): void;
  abstract onChooseSuggestion(item: T, evt: MouseEvent | KeyboardEvent): void;
}

export class TFile {
  basename = "";
  extension = "md";
  name = "";
  path = "";
  parent: { path: string; isRoot(): boolean } | null = null;
}

/** Subsequence match, scored so tighter matches sort first; null when no match. */
export function prepareFuzzySearch(query: string): (text: string) => { score: number; matches: number[][] } | null {
  const needle = query.toLowerCase();
  return (text: string) => {
    const haystack = text.toLowerCase();
    let at = 0;
    for (const ch of needle) {
      at = haystack.indexOf(ch, at);
      if (at === -1) return null;
      at++;
    }
    return { score: -(haystack.length - needle.length), matches: [] };
  };
}

export function addIcon(id: string, svg: string): void {
  obsidianLog.icons.set(id, svg);
}

export function setIcon(el: HTMLElement, iconId: string): void {
  el.setAttribute("data-icon", iconId);
}

export class Notice {
  constructor(public message: string) {}
}

class ValueComponent<V> {
  value: V;
  changeHandler: ((value: V) => unknown) | null = null;
  constructor(initial: V) {
    this.value = initial;
  }
  getValue(): V {
    return this.value;
  }
  setValue(value: V): this {
    this.value = value;
    return this;
  }
  onChange(handler: (value: V) => unknown): this {
    this.changeHandler = handler;
    return this;
  }
}

export class TextComponent extends ValueComponent<string> {
  inputEl: HTMLInputElement;
  constructor(parent: HTMLElement) {
    super("");
    this.inputEl = parent.createEl("input") as HTMLInputElement;
    this.inputEl.type = "text";
    this.inputEl.addEventListener("input", () => {
      this.value = this.inputEl.value;
      void this.changeHandler?.(this.value);
    });
  }
  override setValue(value: string): this {
    this.inputEl.value = value;
    return super.setValue(value);
  }
  setPlaceholder(placeholder: string): this {
    this.inputEl.placeholder = placeholder;
    return this;
  }
}

export class TextAreaComponent extends ValueComponent<string> {
  inputEl: HTMLTextAreaElement;
  constructor(parent: HTMLElement) {
    super("");
    this.inputEl = parent.createEl("textarea") as HTMLTextAreaElement;
    this.inputEl.addEventListener("input", () => {
      this.value = this.inputEl.value;
      void this.changeHandler?.(this.value);
    });
  }
  override setValue(value: string): this {
    this.inputEl.value = value;
    return super.setValue(value);
  }
  setPlaceholder(placeholder: string): this {
    this.inputEl.placeholder = placeholder;
    return this;
  }
}

export class ToggleComponent extends ValueComponent<boolean> {
  constructor() {
    super(false);
  }
}

export class DropdownComponent extends ValueComponent<string> {
  options = new Map<string, string>();
  constructor() {
    super("");
  }
  addOption(value: string, label: string): this {
    this.options.set(value, label);
    return this;
  }
}

export class ButtonComponent {
  buttonEl: HTMLButtonElement;
  clickHandler: (() => unknown) | null = null;
  cta = false;
  constructor(parent: HTMLElement) {
    this.buttonEl = parent.createEl("button") as HTMLButtonElement;
    this.buttonEl.addEventListener("click", () => void this.clickHandler?.());
  }
  setButtonText(text: string): this {
    this.buttonEl.textContent = text;
    return this;
  }
  setCta(): this {
    this.cta = true;
    return this;
  }
  onClick(handler: () => unknown): this {
    this.clickHandler = handler;
    return this;
  }
}

export class ExtraButtonComponent {
  icon = "";
  tooltip = "";
  clickHandler: (() => unknown) | null = null;
  setIcon(icon: string): this {
    this.icon = icon;
    return this;
  }
  setTooltip(tooltip: string): this {
    this.tooltip = tooltip;
    return this;
  }
  onClick(handler: () => unknown): this {
    this.clickHandler = handler;
    return this;
  }
}

/** Every Setting created, in order, so tests can reach its components. */
export const createdSettings: Setting[] = [];

export class Setting {
  settingEl: HTMLElement;
  controlEl: HTMLElement;
  name = "";
  desc = "";
  toggles: ToggleComponent[] = [];
  dropdowns: DropdownComponent[] = [];
  texts: TextComponent[] = [];
  textAreas: TextAreaComponent[] = [];
  buttons: ButtonComponent[] = [];
  extraButtons: ExtraButtonComponent[] = [];

  constructor(containerEl: HTMLElement) {
    this.settingEl = containerEl.createDiv("setting-item");
    this.controlEl = this.settingEl.createDiv("setting-item-control");
    createdSettings.push(this);
  }
  setName(name: string): this {
    this.name = name;
    return this;
  }
  setDesc(desc: string): this {
    this.desc = desc;
    return this;
  }
  addText(cb: (text: TextComponent) => unknown): this {
    const component = new TextComponent(this.controlEl);
    this.texts.push(component);
    cb(component);
    return this;
  }
  addTextArea(cb: (text: TextAreaComponent) => unknown): this {
    const component = new TextAreaComponent(this.controlEl);
    this.textAreas.push(component);
    cb(component);
    return this;
  }
  addToggle(cb: (toggle: ToggleComponent) => unknown): this {
    const component = new ToggleComponent();
    this.toggles.push(component);
    cb(component);
    return this;
  }
  addDropdown(cb: (dropdown: DropdownComponent) => unknown): this {
    const component = new DropdownComponent();
    this.dropdowns.push(component);
    cb(component);
    return this;
  }
  addButton(cb: (button: ButtonComponent) => unknown): this {
    const component = new ButtonComponent(this.controlEl);
    this.buttons.push(component);
    cb(component);
    return this;
  }
  addExtraButton(cb: (button: ExtraButtonComponent) => unknown): this {
    const component = new ExtraButtonComponent();
    this.extraButtons.push(component);
    cb(component);
    return this;
  }
}

export class Plugin {
  data: unknown = null;
  settingTabs: unknown[] = [];
  registeredEvents: unknown[] = [];
  constructor(public app: App, public manifest: unknown = {}) {}
  async loadData(): Promise<unknown> {
    return this.data;
  }
  async saveData(data: unknown): Promise<void> {
    this.data = JSON.parse(JSON.stringify(data));
  }
  addSettingTab(tab: unknown): void {
    this.settingTabs.push(tab);
  }
  registerEvent(ref: unknown): void {
    this.registeredEvents.push(ref);
  }
}

export class PluginSettingTab {
  containerEl: HTMLElement;
  constructor(public app: App, public plugin: Plugin) {
    this.containerEl = document.createElement("div");
  }
}

export class MarkdownView {}
