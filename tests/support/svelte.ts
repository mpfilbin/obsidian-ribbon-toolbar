import { flushSync, mount, unmount } from "svelte";
import { afterEach } from "vitest";

const mounted: { component: object; target: HTMLElement }[] = [];

/** Mounts a Svelte component into a fresh element attached to the document. */
export function render<P extends Record<string, unknown>>(
  Component: Parameters<typeof mount>[0],
  props: P
): HTMLElement {
  const target = document.body.appendChild(document.createElement("div"));
  mounted.push({ component: mount(Component, { target, props } as never), target });
  // mount() leaves effects (actions, bindings) queued; run them so the DOM is final.
  flushSync();
  return target;
}

/** Unmounts everything rendered so far, as when a pane closes. */
export function unmountAll(): void {
  for (const { component, target } of mounted.splice(0)) {
    unmount(component);
    target.remove();
  }
}

afterEach(() => {
  unmountAll();
  document.body.replaceChildren();
});

/** Dispatches a click and applies the resulting state changes synchronously. */
export function click(el: Element): void {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  flushSync();
}
