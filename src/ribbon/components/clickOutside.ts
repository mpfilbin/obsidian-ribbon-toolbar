/**
 * Whether a click target falls outside every given container. Deliberately
 * takes element references rather than ids/selectors: split panes can mount
 * multiple ribbon instances for the same command, and DOM ids derived only
 * from the command id collide across them, so document.getElementById-based
 * lookups can resolve to the wrong pane's element.
 */
export function isOutsideClick(target: Node, ...containers: (Element | null | undefined)[]): boolean {
  return !containers.some((container) => container?.contains(target) ?? false);
}
