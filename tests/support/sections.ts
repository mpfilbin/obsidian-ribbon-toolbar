import { createdSettings, type Setting } from "obsidian";
import type { BaseConfig } from "../../src/ribbon/bases/model";
import type { PropertyOption } from "../../src/ribbon/bases/catalog";
import type { SectionContext, SectionId } from "../../src/ribbon/bases/ui/context";

export const PROPERTIES: PropertyOption[] = [
  { id: "file.name", kind: "text" },
  { id: "file.mtime", kind: "date" },
  { id: "file.size", kind: "number" },
  { id: "file.tags", kind: "list" },
  { id: "note.status", kind: "text" },
  { id: "note.done", kind: "boolean" },
];

/** Renders one section against a base config, redrawing the way the dialog does. */
export function harness(
  render: (el: HTMLElement, ctx: SectionContext) => void,
  config: BaseConfig,
  section: SectionId = "views"
) {
  const el = document.createElement("div");
  const applied: { config: BaseConfig; rerender: boolean }[] = [];
  const state = { config, section, viewIndex: 0, filterScope: "base" as "base" | number };
  const draw = () => {
    createdSettings.length = 0;
    el.empty();
    render(el, ctx);
  };
  const ctx: SectionContext = {
    app: {} as never,
    state,
    properties: PROPERTIES,
    apply(next, options) {
      state.config = next;
      applied.push({ config: next, rerender: options?.rerender !== false });
      if (options?.rerender !== false) draw();
    },
    rerender: draw,
  };
  draw();
  return { el, ctx, state, applied, redraw: draw };
}

export const settingsNamed = (name: string): Setting[] => createdSettings.filter((s) => s.name === name);
/**
 * A setting by name: the one at `index`, or the most recent when no index is given
 * (parts of a form redraw themselves, leaving earlier copies behind in the list).
 */
export const settingNamed = (name: string, index?: number): Setting => {
  const found = settingsNamed(name).at(index ?? -1);
  if (!found) throw new Error(`No setting "${name}" (have: ${createdSettings.map((s) => s.name).join(", ")})`);
  return found;
};

/** Types into a text field the way Obsidian does: set the value, then fire onChange. */
export function typeInto(field: { setValue(v: string): unknown; changeHandler: ((v: string) => unknown) | null }, value: string): void {
  field.setValue(value);
  field.changeHandler?.(value);
}

export const click = (button: { clickHandler: (() => unknown) | null }): void => void button.clickHandler?.();
export const choose = (dropdown: { changeHandler: ((v: string) => unknown) | null }, value: string): void => void dropdown.changeHandler?.(value);

export const texts = (el: HTMLElement, selector: string): string[] => [...el.querySelectorAll(selector)].map((n) => n.textContent ?? "");

/** The first button on screen with this label, wherever it sits. */
export function buttonLabeled(label: string) {
  const found = createdSettings.flatMap((s) => s.buttons).find((b) => b.buttonEl.textContent === label);
  if (!found) throw new Error(`No button "${label}"`);
  return found;
}
