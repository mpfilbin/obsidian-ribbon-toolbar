import { Setting } from "obsidian";
import { FILTER_MODE_LABELS, type FilterMode } from "../model";
import {
  addCondition,
  describeCondition,
  filterGroup,
  getScopeFilter,
  removeCondition,
  setFilterMode,
  type FilterScope,
} from "../ops";
import { buildCondition, operatorsFor, VALUE_KIND_LABELS, type ConditionSpec, type ValueKind } from "../filters";
import { kindOf } from "../catalog";
import type { SectionContext } from "./context";

const CONDITION_TYPES: [string, string][] = [
  ["property", "Property"],
  ["tag", "Has tag"],
  ["folder", "In folder"],
  ["linksToThis", "Links to this note"],
  ["linkedFromThis", "Linked from this note"],
  ["modified", "Modified in the last … days"],
  ["created", "Created in the last … days"],
  ["hasProperty", "Has property"],
  ["raw", "Custom expression"],
];

/** The filter list plus "add a condition" form for one scope (whole base or one view). */
export function renderFilterEditor(el: HTMLElement, ctx: SectionContext, scope: FilterScope): void {
  const group = filterGroup(getScopeFilter(ctx.state.config, scope));

  if (group) {
    new Setting(el).setName("Match").addDropdown((dropdown) => {
      for (const mode of ["and", "or", "not"] as FilterMode[]) dropdown.addOption(mode, FILTER_MODE_LABELS[mode]);
      dropdown.setValue(group.mode);
      dropdown.onChange((value) => ctx.apply(setFilterMode(ctx.state.config, scope, value as FilterMode)));
    });
  }

  if (!group) {
    el.createEl("p", { text: "No filters: every note matches.", cls: "setting-item-description" });
  }
  group?.items.forEach((item, index) => {
    new Setting(el)
      .setName(describeCondition(item))
      .addExtraButton((button) => {
        button.setIcon("trash").setTooltip("Remove this condition");
        button.onClick(() => ctx.apply(removeCondition(ctx.state.config, scope, index)));
      });
  });

  renderConditionBuilder(el, ctx, scope);
}

function renderConditionBuilder(el: HTMLElement, ctx: SectionContext, scope: FilterScope): void {
  const draft = { type: "property", property: ctx.properties[0]?.id ?? "", operator: "", value: "", text: "", days: "7" };
  const form = el.createDiv({ cls: "ribbon-bar-base-builder" });
  const error = el.createEl("p", { cls: "setting-item-description mod-warning" });

  const fields = form.createDiv();
  const draw = () => {
    fields.empty();
    error.setText("");
    const kind: ValueKind = kindOf(ctx.properties, draft.property);

    if (draft.type === "property") {
      new Setting(fields).setName("Property").addDropdown((d) => {
        ctx.properties.forEach((p) => d.addOption(p.id, `${p.id} (${VALUE_KIND_LABELS[p.kind].toLowerCase()})`));
        d.setValue(draft.property);
        d.onChange((value) => {
          draft.property = value;
          draft.operator = "";
          draw();
        });
      });
      const operators = operatorsFor(kind);
      if (!operators.some((o) => o.id === draft.operator)) draft.operator = operators[0].id;
      const operator = operators.find((o) => o.id === draft.operator)!;
      new Setting(fields).setName("Condition").addDropdown((d) => {
        operators.forEach((o) => d.addOption(o.id, o.label));
        d.setValue(draft.operator);
        d.onChange((value) => {
          draft.operator = value;
          draw();
        });
      });
      if (operator.input !== "none") {
        new Setting(fields).setName("Value").addText((t) => {
          t.setPlaceholder(operator.input === "date" ? "YYYY-MM-DD" : operator.input === "text" ? "" : "0");
          t.setValue(draft.value);
          t.onChange((value) => (draft.value = value));
        });
      }
    } else if (["tag", "folder", "hasProperty", "raw"].includes(draft.type)) {
      const labels: Record<string, [string, string]> = {
        tag: ["Tags", "project, work (any of these)"],
        folder: ["Folder", "Projects/Active"],
        hasProperty: ["Property name", "due"],
        raw: ["Expression", 'status == "done"'],
      };
      new Setting(fields).setName(labels[draft.type][0]).addText((t) => {
        t.setPlaceholder(labels[draft.type][1]);
        t.setValue(draft.text);
        t.onChange((value) => (draft.text = value));
      });
    } else if (draft.type === "modified" || draft.type === "created") {
      new Setting(fields).setName("Days").addText((t) => {
        t.setValue(draft.days);
        t.onChange((value) => (draft.days = value));
      });
    }
  };

  new Setting(form).setName("Add a condition").addDropdown((d) => {
    CONDITION_TYPES.forEach(([id, label]) => d.addOption(id, label));
    d.setValue(draft.type);
    d.onChange((value) => {
      draft.type = value;
      draw();
    });
  });
  form.appendChild(fields);
  draw();

  new Setting(form).addButton((button) =>
    button
      .setButtonText("Add condition")
      .setCta()
      .onClick(() => {
        const result = buildCondition(toSpec(draft));
        if (!result.ok) {
          error.setText(result.error);
          return;
        }
        ctx.apply(addCondition(ctx.state.config, scope, result.expression));
      })
  );
}

function toSpec(draft: { type: string; property: string; operator: string; value: string; text: string; days: string }): ConditionSpec {
  switch (draft.type) {
    case "property":
      return { kind: "property", property: draft.property, operator: draft.operator, value: draft.value };
    case "tag":
      return { kind: "tag", tags: draft.text.split(",") };
    case "folder":
      return { kind: "folder", folder: draft.text };
    case "linksToThis":
      return { kind: "linksToThis" };
    case "linkedFromThis":
      return { kind: "linkedFromThis" };
    case "modified":
    case "created":
      return { kind: draft.type, days: Number(draft.days) };
    case "hasProperty":
      return { kind: "hasProperty", name: draft.text };
    default:
      return { kind: "raw", expression: draft.text };
  }
}

export function renderFiltersSection(el: HTMLElement, ctx: SectionContext): void {
  const views = ctx.state.config.views ?? [];
  if (typeof ctx.state.filterScope === "number" && ctx.state.filterScope >= views.length) ctx.state.filterScope = "base";

  el.createEl("p", {
    text: "Filters on the whole base apply to every view. A view's own filters narrow it further.",
    cls: "setting-item-description",
  });
  new Setting(el).setName("Filters for").addDropdown((dropdown) => {
    dropdown.addOption("base", "All views");
    views.forEach((view, index) => dropdown.addOption(String(index), `View: ${view.name}`));
    dropdown.setValue(String(ctx.state.filterScope));
    dropdown.onChange((value) => {
      ctx.state.filterScope = value === "base" ? "base" : Number(value);
      ctx.rerender();
    });
  });
  renderFilterEditor(el, ctx, ctx.state.filterScope);
}
