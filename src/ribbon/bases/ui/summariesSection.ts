import { Setting } from "obsidian";
import { BUILT_IN_SUMMARIES } from "../model";
import { checkExpression, removeCustomSummary, setCustomSummary } from "../ops";
import type { SectionContext } from "./context";

export function renderSummariesSection(el: HTMLElement, ctx: SectionContext): void {
  const custom = Object.entries(ctx.state.config.summaries ?? {});
  el.createEl("p", {
    text: `Built in: ${BUILT_IN_SUMMARIES.join(", ")}. Choose them per column under Views. Custom summaries are formulas over the column's values; use \`values\` to refer to them.`,
    cls: "setting-item-description",
  });

  if (custom.length === 0) el.createEl("p", { text: "No custom summaries.", cls: "setting-item-description" });
  for (const [name, expression] of custom) {
    let note!: HTMLElement;
    new Setting(el)
      .setName(name)
      .addText((text) => {
        text.setValue(expression);
        text.onChange((value) => {
          ctx.apply(setCustomSummary(ctx.state.config, name, value), { rerender: false });
          note.setText(value.trim() ? (checkExpression(value) ?? "") : "");
        });
      })
      .addExtraButton((button) => {
        button.setIcon("trash").setTooltip("Delete summary");
        button.onClick(() => ctx.apply(removeCustomSummary(ctx.state.config, name)));
      });
    note = el.createEl("p", { cls: "setting-item-description mod-warning" });
    note.setText(expression.trim() ? (checkExpression(expression) ?? "") : "");
  }

  const draft = { name: "", expression: "" };
  const note = el.createEl("p", { cls: "setting-item-description mod-warning" });
  new Setting(el)
    .setName("Add a custom summary")
    .addText((text) => {
      text.setPlaceholder("Name");
      text.onChange((value) => (draft.name = value));
    })
    .addText((text) => {
      text.setPlaceholder("values.sum()");
      text.onChange((value) => (draft.expression = value));
    })
    .addButton((button) =>
      button.setButtonText("Add").onClick(() => {
        const name = draft.name.trim();
        if (!name) return note.setText("Give the summary a name.");
        if (BUILT_IN_SUMMARIES.includes(name) || name in (ctx.state.config.summaries ?? {})) return note.setText(`"${name}" is already a summary.`);
        const problem = checkExpression(draft.expression);
        if (problem) return note.setText(problem);
        ctx.apply(setCustomSummary(ctx.state.config, name, draft.expression.trim()));
      })
    );
}
