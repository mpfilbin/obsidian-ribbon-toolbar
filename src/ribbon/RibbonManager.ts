import type { App, MarkdownView } from "obsidian";
import { mount, unmount } from "svelte";
import { writable, type Writable } from "svelte/store";
import RibbonBar from "./components/RibbonBar.svelte";
import type { EditorLike } from "./commands/actions/types";
import type { FrontmatterPropertyConfig } from "./commands/actions/frontmatter";
import { findInjectionPoint } from "./injectionPoint";

interface RibbonInstance {
  host: HTMLElement;
  component: object;
  editorStore: Writable<EditorLike | null>;
}

export class RibbonManager {
  private instances = new Map<MarkdownView, RibbonInstance>();
  private enabled: boolean;
  private defaultCollapsed: boolean;
  private propertiesStore: Writable<FrontmatterPropertyConfig[]>;
  private app: App;

  constructor(options: {
    app: App;
    enabled: boolean;
    defaultCollapsed: boolean;
    frontmatterProperties: FrontmatterPropertyConfig[];
  }) {
    this.app = options.app;
    this.enabled = options.enabled;
    this.defaultCollapsed = options.defaultCollapsed;
    this.propertiesStore = writable(options.frontmatterProperties);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setDefaultCollapsed(defaultCollapsed: boolean): void {
    this.defaultCollapsed = defaultCollapsed;
  }

  setFrontmatterProperties(properties: FrontmatterPropertyConfig[]): void {
    // Svelte's writable store skips notifying subscribers when the new value
    // is reference-equal to the old one - callers (e.g. settings-tab.ts) may
    // mutate their array in place before calling this, so always publish a
    // fresh array reference to guarantee subscribers are notified.
    this.propertiesStore.set([...properties]);
  }

  syncAllLeaves(views: MarkdownView[]): void {
    const live = new Set(views);
    for (const tracked of this.instances.keys()) {
      if (!live.has(tracked)) this.detach(tracked);
    }

    for (const view of views) {
      if (this.enabled) this.attach(view);
      else this.detach(view);
    }
  }

  /**
   * Computes the live editor value for a view: null while the view is in
   * Reading mode (Obsidian keeps the CM6 editor instance alive underneath
   * Reading view, so `view.editor` alone is not a reliable signal).
   */
  private editorFor(view: MarkdownView): EditorLike | null {
    return view.getMode() === "preview" ? null : ((view.editor as unknown as EditorLike) ?? null);
  }

  attach(view: MarkdownView): void {
    if (!this.enabled) return;

    const existing = this.instances.get(view);
    if (existing) {
      existing.editorStore.set(this.editorFor(view));
      return;
    }

    const target = findInjectionPoint(view.containerEl);
    if (!target) {
      console.warn("Ribbon Bar: could not find injection point for view", view);
      return;
    }

    const host = document.createElement("div");
    host.addClass("ribbon-bar-host");
    target.prepend(host);

    const editorStore = writable<EditorLike | null>(this.editorFor(view));

    const component = mount(RibbonBar, {
      target: host,
      props: {
        editorStore,
        defaultCollapsed: this.defaultCollapsed,
        propertiesStore: this.propertiesStore,
        app: this.app,
      },
    });

    this.instances.set(view, { host, component, editorStore });
  }

  detach(view: MarkdownView): void {
    const instance = this.instances.get(view);
    if (!instance) return;
    unmount(instance.component);
    instance.host.remove();
    this.instances.delete(view);
  }

  detachAll(views: MarkdownView[]): void {
    for (const view of views) this.detach(view);
  }
}
