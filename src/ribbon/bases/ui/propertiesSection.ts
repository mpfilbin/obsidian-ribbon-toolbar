import { Setting } from "obsidian";
import { getPropertyDisplayName, setPropertyDisplayName } from "../ops";
import type { SectionContext } from "./context";

/** Property ids the base already refers to, in a stable order. */
export function usedProperties(config: SectionContext["state"]["config"]): string[] {
  const ids = new Set<string>(Object.keys(config.properties ?? {}));
  for (const view of config.views ?? []) {
    (view.order ?? []).forEach((id) => ids.add(id));
    (view.sort ?? []).forEach((s) => ids.add(s.property));
    if (view.groupBy) ids.add(view.groupBy.property);
  }
  Object.keys(config.formulas ?? {}).forEach((name) => ids.add(`formula.${name}`));
  return [...ids];
}

export function renderPropertiesSection(el: HTMLElement, ctx: SectionContext): void {
  const { config } = ctx.state;
  el.createEl("p", {
    text: "Give properties friendlier names in column headers. The property itself doesn't change.",
    cls: "setting-item-description",
  });

  const used = usedProperties(config);
  if (used.length === 0) el.createEl("p", { text: "No properties are used yet. Add columns in Views.", cls: "setting-item-description" });

  for (const id of used) {
    new Setting(el).setName(id).addText((text) => {
      text.setPlaceholder("Display name");
      text.setValue(getPropertyDisplayName(config, id));
      text.onChange((value) => ctx.apply(setPropertyDisplayName(ctx.state.config, id, value), { rerender: false }));
    });
  }

  const remaining = ctx.properties.filter((p) => !used.includes(p.id));
  if (remaining.length === 0) return;
  let chosen = remaining[0].id;
  let name = "";
  new Setting(el)
    .setName("Name another property")
    .addDropdown((dropdown) => {
      remaining.forEach((p) => dropdown.addOption(p.id, p.id));
      dropdown.setValue(chosen);
      dropdown.onChange((value) => (chosen = value));
    })
    .addText((text) => {
      text.setPlaceholder("Display name");
      text.onChange((value) => (name = value));
    })
    .addButton((button) =>
      button.setButtonText("Add").onClick(() => {
        if (!name.trim()) return;
        ctx.apply(setPropertyDisplayName(ctx.state.config, chosen, name));
      })
    );
}
