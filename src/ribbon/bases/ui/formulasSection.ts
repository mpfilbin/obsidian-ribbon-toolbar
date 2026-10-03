import { Setting } from "obsidian";
import { checkExpression, removeFormula, renameFormula, setFormula } from "../ops";
import { FUNCTIONS } from "../functions";
import { insertIntoText } from "../insertFunction";
import { NONE, type SectionContext } from "./context";

/** An "Insert a function…" dropdown that writes into a text area at its caret. */
function addFunctionPicker(setting: Setting, area: HTMLTextAreaElement, onInserted: (text: string) => void): void {
  setting.addDropdown((dropdown) => {
    dropdown.addOption(NONE, "Insert a function…");
    FUNCTIONS.forEach((fn, index) => dropdown.addOption(String(index), `${fn.group}: ${fn.signature}`));
    dropdown.setValue(NONE);
    dropdown.onChange((value) => {
      if (value === NONE) return;
      const result = insertIntoText(area.value, area.selectionStart ?? area.value.length, area.selectionEnd ?? area.value.length, FUNCTIONS[Number(value)]);
      area.value = result.text;
      area.setSelectionRange?.(result.caret, result.caret);
      area.focus();
      onInserted(result.text);
      dropdown.setValue(NONE);
    });
  });
}

function showProblem(note: HTMLElement, expression: string): void {
  const problem = expression.trim() ? checkExpression(expression) : null;
  note.setText(problem ?? "");
}

export function renderFormulasSection(el: HTMLElement, ctx: SectionContext): void {
  const formulas = Object.entries(ctx.state.config.formulas ?? {});
  el.createEl("p", {
    text: "Formulas compute a new property from other properties, e.g. price * quantity. Use them as columns, in sorting, or in filters as formula.name.",
    cls: "setting-item-description",
  });

  if (formulas.length === 0) el.createEl("p", { text: "No formulas yet.", cls: "setting-item-description" });

  for (const [name, expression] of formulas) {
    const row = new Setting(el).setName(`formula.${name}`);
    const note = el.createEl("p", { cls: "setting-item-description mod-warning" });
    let area!: HTMLTextAreaElement;

    row.addText((text) => {
      text.setValue(name);
      text.setPlaceholder("Name");
      text.inputEl.addEventListener("change", () => {
        const next = text.inputEl.value.trim();
        if (!next || next.includes(".") || next === name) {
          text.setValue(name);
          return;
        }
        ctx.apply(renameFormula(ctx.state.config, name, next));
      });
    });
    row.addTextArea((textArea) => {
      area = textArea.inputEl;
      textArea.setValue(expression);
      textArea.inputEl.rows = 2;
      textArea.onChange((value) => {
        ctx.apply(setFormula(ctx.state.config, name, value), { rerender: false });
        showProblem(note, value);
      });
    });
    addFunctionPicker(row, area, (text) => {
      ctx.apply(setFormula(ctx.state.config, name, text), { rerender: false });
      showProblem(note, text);
    });
    row.addExtraButton((button) => {
      button.setIcon("trash").setTooltip("Delete formula");
      button.onClick(() => ctx.apply(removeFormula(ctx.state.config, name)));
    });
    showProblem(note, expression);
  }

  renderAddFormula(el, ctx);
}

function renderAddFormula(el: HTMLElement, ctx: SectionContext): void {
  el.createEl("h4", { text: "Add a formula" });
  const draft = { name: "", expression: "" };
  const row = new Setting(el).setName("Name and expression");
  const note = el.createEl("p", { cls: "setting-item-description mod-warning" });
  let area!: HTMLTextAreaElement;

  row.addText((text) => {
    text.setPlaceholder("total");
    text.onChange((value) => (draft.name = value));
  });
  row.addTextArea((textArea) => {
    area = textArea.inputEl;
    textArea.setPlaceholder("price * quantity");
    textArea.inputEl.rows = 2;
    textArea.onChange((value) => {
      draft.expression = value;
      showProblem(note, value);
    });
  });
  addFunctionPicker(row, area, (text) => {
    draft.expression = text;
    showProblem(note, text);
  });
  row.addButton((button) =>
    button
      .setButtonText("Add")
      .setCta()
      .onClick(() => {
        const name = draft.name.trim();
        if (!name || name.includes(".")) return note.setText("Give the formula a name without a period.");
        if (ctx.state.config.formulas && name in ctx.state.config.formulas) return note.setText(`A formula named "${name}" already exists.`);
        const problem = checkExpression(draft.expression);
        if (problem) return note.setText(problem);
        ctx.apply(setFormula(ctx.state.config, name, draft.expression.trim()));
      })
  );
}
