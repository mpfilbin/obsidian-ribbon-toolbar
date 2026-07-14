export function findInjectionPoint(containerEl: HTMLElement): HTMLElement | null {
  return containerEl.querySelector<HTMLElement>(".view-content");
}
