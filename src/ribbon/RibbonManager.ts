import type { MarkdownView } from "obsidian";
import { mount, unmount } from "svelte";
import RibbonBar from "./components/RibbonBar.svelte";
import type { EditorLike } from "./commands/actions/types";
import { findInjectionPoint } from "./injectionPoint";

interface RibbonInstance {
  host: HTMLElement;
  component: object;
}

export class RibbonManager {
  private instances = new WeakMap<MarkdownView, RibbonInstance>();
  private enabled: boolean;
  private defaultCollapsed: boolean;

  constructor(options: { enabled: boolean; defaultCollapsed: boolean }) {
    this.enabled = options.enabled;
    this.defaultCollapsed = options.defaultCollapsed;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setDefaultCollapsed(defaultCollapsed: boolean): void {
    this.defaultCollapsed = defaultCollapsed;
  }

  syncAllLeaves(views: MarkdownView[]): void {
    for (const view of views) {
      if (this.enabled) this.attach(view);
      else this.detach(view);
    }
  }

  attach(view: MarkdownView): void {
    if (!this.enabled || this.instances.has(view)) return;

    const target = findInjectionPoint(view.containerEl);
    if (!target) {
      console.warn("Ribbon Bar: could not find injection point for view", view);
      return;
    }

    const host = document.createElement("div");
    host.addClass("ribbon-bar-host");
    target.prepend(host);

    const component = mount(RibbonBar, {
      target: host,
      props: {
        editor: (view.editor as unknown as EditorLike) ?? null,
        defaultCollapsed: this.defaultCollapsed,
      },
    });

    this.instances.set(view, { host, component });
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
