import type { App, MarkdownView } from "obsidian";
import { mount, unmount } from "svelte";
import { writable, type Writable } from "svelte/store";
import RibbonBar from "./components/RibbonBar.svelte";
import type { EditorLike } from "./commands/actions/types";
import type { FrontmatterPropertyConfig } from "./commands/actions/frontmatter";
import type { TabId } from "./commands/types";
import { findInjectionPoint } from "./injectionPoint";

// Set on the container a ribbon lives in; styles.css lays that container out as
// a column so the ribbon and the editor share its height instead of overflowing it.
const ACTIVE_CLASS = "ribbon-bar-active";

interface RibbonInstance {
  host: HTMLElement;
  component: object;
  editorStore: Writable<EditorLike | null>;
  // Stops watching the view (see watch()); null when not watching.
  stopWatching: (() => void) | null;
}

export class RibbonManager {
  private instances = new Map<MarkdownView, RibbonInstance>();
  private enabled: boolean;
  private defaultCollapsed: boolean;
  private propertiesStore: Writable<FrontmatterPropertyConfig[]>;
  private app: App;
  private lastTab: TabId | undefined;
  private onLastTabChange: ((tab: TabId) => void) | undefined;

  constructor(options: {
    app: App;
    enabled: boolean;
    defaultCollapsed: boolean;
    frontmatterProperties: FrontmatterPropertyConfig[];
    // The tab new ribbons open on, and a callback so the choice can be saved.
    lastTab?: TabId;
    onLastTabChange?: (tab: TabId) => void;
  }) {
    this.app = options.app;
    this.enabled = options.enabled;
    this.defaultCollapsed = options.defaultCollapsed;
    this.propertiesStore = writable(options.frontmatterProperties);
    this.lastTab = options.lastTab;
    this.onLastTabChange = options.onLastTabChange;
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

  // New ribbons open on the most recently chosen tab; existing panes keep
  // whatever tab they are showing.
  private rememberTab(tab: TabId): void {
    this.lastTab = tab;
    this.onLastTabChange?.(tab);
  }

  attach(view: MarkdownView): void {
    if (!this.enabled) return;

    const existing = this.instances.get(view);
    if (existing) {
      this.ensureMounted(view, existing);
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
    this.place(host, target);

    const editorStore = writable<EditorLike | null>(this.editorFor(view));

    const component = mount(RibbonBar, {
      target: host,
      props: {
        editorStore,
        defaultCollapsed: this.defaultCollapsed,
        propertiesStore: this.propertiesStore,
        app: this.app,
        initialTab: this.lastTab,
        ontabchange: (tab: TabId) => this.rememberTab(tab),
      },
    });

    const instance: RibbonInstance = { host, component, editorStore, stopWatching: null };
    this.instances.set(view, instance);
    this.watch(view, instance);
  }

  /**
   * Obsidian can rebuild a view's DOM (the ribbon has been seen to vanish while
   * pasting a lot of text), which removes our host element while the component
   * stays mounted and the manager still believes the ribbon is showing. Put the
   * existing host back, keeping its component (and so its selected tab).
   * Returns whether the ribbon is in place afterwards.
   */
  private ensureMounted(view: MarkdownView, instance: RibbonInstance): boolean {
    const target = findInjectionPoint(view.containerEl);
    if (!target) return false;
    if (instance.host.parentElement === target) return true;

    console.warn("Ribbon Bar: restored a ribbon that was removed from the page", view);
    this.place(instance.host, target);
    // The observer and scroll guard were bound to the old container; follow the ribbon.
    this.watch(view, instance);
    return true;
  }

  /** Puts a ribbon host at the top of its container and marks the container for layout. */
  private place(host: HTMLElement, target: HTMLElement): void {
    host.parentElement?.classList.remove(ACTIVE_CLASS);
    target.prepend(host);
    target.classList.add(ACTIVE_CLASS);
  }

  /**
   * Watches only the direct children of the view and of its .view-content (not
   * the whole subtree, which churns constantly while editing), which is where our
   * host lives and where it can be removed from or its parent replaced.
   *
   * It also keeps .view-content scrolled to the top. That container holds just the
   * editor and the ribbon and should never scroll (the editor scrolls itself), but
   * a container that ends up taller than it is can be scrolled by the browser, for
   * example to reveal the caret after a very large paste, which carries the ribbon
   * off the top of the screen.
   */
  private watch(view: MarkdownView, instance: RibbonInstance): void {
    if (typeof MutationObserver === "undefined") return;

    instance.stopWatching?.();
    const target = findInjectionPoint(view.containerEl);

    const observer = new MutationObserver(() => {
      if (this.instances.get(view) !== instance) return;
      const current = findInjectionPoint(view.containerEl);
      if (current && instance.host.parentElement !== current) this.ensureMounted(view, instance);
    });
    observer.observe(view.containerEl, { childList: true });

    const keepAtTop = (): void => {
      if (target && target.scrollTop !== 0) target.scrollTop = 0;
    };
    if (target) {
      observer.observe(target, { childList: true });
      target.addEventListener("scroll", keepAtTop);
    }

    instance.stopWatching = () => {
      observer.disconnect();
      target?.removeEventListener("scroll", keepAtTop);
      instance.stopWatching = null;
    };
  }

  detach(view: MarkdownView): void {
    const instance = this.instances.get(view);
    if (!instance) return;
    instance.stopWatching?.();
    unmount(instance.component);
    instance.host.parentElement?.classList.remove(ACTIVE_CLASS);
    instance.host.remove();
    this.instances.delete(view);
  }

  detachAll(views: MarkdownView[]): void {
    for (const view of views) this.detach(view);
  }
}
