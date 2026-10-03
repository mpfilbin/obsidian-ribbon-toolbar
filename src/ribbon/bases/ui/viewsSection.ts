import { Setting } from "obsidian";
import { BUILT_IN_SUMMARIES, MODELED_VIEW_KEYS, VIEW_TYPES, type BaseSort, type SortDirection } from "../model";
import {
  addView,
  duplicateView,
  moveView,
  moveViewColumn,
  parseOptionValue,
  removeView,
  setViewGroupBy,
  setViewLimit,
  setViewName,
  setViewOption,
  setViewSort,
  setViewSummary,
  toggleViewColumn,
  updateView,
} from "../ops";
import { NONE, type SectionContext } from "./context";
import { renderFilterEditor } from "./filtersSection";

const DIRECTIONS: [SortDirection, string][] = [
  ["ASC", "Ascending"],
  ["DESC", "Descending"],
];

export function renderViewsSection(el: HTMLElement, ctx: SectionContext): void {
  const { state } = ctx;
  const views = state.config.views ?? [];
  if (state.viewIndex >= views.length) state.viewIndex = Math.max(0, views.length - 1);

  renderViewList(el, ctx);
  renderAddView(el, ctx);
  if (views[state.viewIndex]) renderViewDetails(el, ctx, state.viewIndex);
}

function renderViewList(el: HTMLElement, ctx: SectionContext): void {
  const views = ctx.state.config.views ?? [];
  el.createEl("h4", { text: "Views" });
  views.forEach((view, index) => {
    const selected = index === ctx.state.viewIndex;
    const row = new Setting(el)
      .setName(view.name)
      .setDesc(`${VIEW_TYPES.find((t) => t.id === view.type)?.label ?? view.type}${selected ? " · editing" : ""}`);
    if (selected) row.settingEl.addClass("is-active");

    row.addButton((button) =>
      button.setButtonText(selected ? "Editing" : "Edit").onClick(() => {
        ctx.state.viewIndex = index;
        ctx.rerender();
      })
    );
    row.addExtraButton((button) => {
      button.setIcon("arrow-up").setTooltip("Move up");
      button.onClick(() => moveAndSelect(ctx, index, -1));
    });
    row.addExtraButton((button) => {
      button.setIcon("arrow-down").setTooltip("Move down");
      button.onClick(() => moveAndSelect(ctx, index, 1));
    });
    row.addExtraButton((button) => {
      button.setIcon("copy").setTooltip("Duplicate");
      button.onClick(() => {
        const result = duplicateView(ctx.state.config, index);
        ctx.state.viewIndex = result.index;
        ctx.apply(result.config);
      });
    });
    row.addExtraButton((button) => {
      button.setIcon("trash").setTooltip("Delete view");
      button.onClick(() => {
        if (views.length <= 1) return;
        ctx.apply(removeView(ctx.state.config, index));
      });
    });
  });
}

function moveAndSelect(ctx: SectionContext, index: number, delta: -1 | 1): void {
  const result = moveView(ctx.state.config, index, delta);
  if (result.index === index) return;
  ctx.state.viewIndex = ctx.state.viewIndex === index ? result.index : ctx.state.viewIndex;
  ctx.apply(result.config);
}

function renderAddView(el: HTMLElement, ctx: SectionContext): void {
  const draft = { type: VIEW_TYPES[0].id, name: "" };
  new Setting(el)
    .setName("Add a view")
    .addDropdown((dropdown) => {
      VIEW_TYPES.forEach((t) => dropdown.addOption(t.id, t.label));
      dropdown.setValue(draft.type);
      dropdown.onChange((value) => (draft.type = value));
    })
    .addText((text) => {
      text.setPlaceholder("Name (optional)");
      text.onChange((value) => (draft.name = value));
    })
    .addButton((button) =>
      button.setButtonText("Add").onClick(() => {
        const result = addView(ctx.state.config, draft.type, draft.name);
        ctx.state.viewIndex = result.index;
        ctx.apply(result.config);
      })
    );
}

function propertyDropdown(ctx: SectionContext, setting: Setting, current: string, allowNone: string | null, onChange: (value: string | null) => void): void {
  setting.addDropdown((dropdown) => {
    if (allowNone) dropdown.addOption(NONE, allowNone);
    const known = new Set(ctx.properties.map((p) => p.id));
    ctx.properties.forEach((p) => dropdown.addOption(p.id, p.id));
    if (current && !known.has(current)) dropdown.addOption(current, current);
    dropdown.setValue(current || NONE);
    dropdown.onChange((value) => onChange(value === NONE ? null : value));
  });
}

function renderViewDetails(el: HTMLElement, ctx: SectionContext, index: number): void {
  const view = ctx.state.config.views![index];
  const set = (next: ReturnType<typeof setViewName>, rerender = true) => ctx.apply(next, { rerender });
  el.createEl("h4", { text: `Settings for "${view.name}"` });

  new Setting(el).setName("Name").addText((text) => {
    text.setValue(view.name);
    // Renaming can reorder nothing, so avoid redrawing (and losing focus) while typing.
    text.onChange((value) => set(setViewName(ctx.state.config, index, value), false));
    text.inputEl.addEventListener("blur", () => ctx.rerender());
  });

  new Setting(el).setName("Type").addDropdown((dropdown) => {
    VIEW_TYPES.forEach((t) => dropdown.addOption(t.id, t.label));
    if (!VIEW_TYPES.some((t) => t.id === view.type)) dropdown.addOption(view.type, view.type);
    dropdown.setValue(view.type);
    dropdown.onChange((value) => set(updateView(ctx.state.config, index, { type: value })));
  });

  renderColumns(el, ctx, index);
  renderSort(el, ctx, index);

  const group = new Setting(el).setName("Group by");
  propertyDropdown(ctx, group, view.groupBy?.property ?? "", "No grouping", (value) =>
    set(setViewGroupBy(ctx.state.config, index, value, view.groupBy?.direction ?? "ASC"))
  );
  if (view.groupBy) {
    group.addDropdown((dropdown) => {
      DIRECTIONS.forEach(([id, label]) => dropdown.addOption(id, label));
      dropdown.setValue(view.groupBy!.direction);
      dropdown.onChange((value) => set(setViewGroupBy(ctx.state.config, index, view.groupBy!.property, value as SortDirection)));
    });
  }

  new Setting(el)
    .setName("Limit")
    .setDesc("Show at most this many results. Leave empty for no limit.")
    .addText((text) => {
      text.setValue(view.limit === undefined ? "" : String(view.limit));
      text.onChange((value) => set(setViewLimit(ctx.state.config, index, value.trim() === "" ? null : Number(value)), false));
    });

  renderViewSummaries(el, ctx, index);

  el.createEl("h4", { text: `Filters for "${view.name}"` });
  renderFilterEditor(el, ctx, index);

  renderOtherOptions(el, ctx, index);
}

function renderColumns(el: HTMLElement, ctx: SectionContext, index: number): void {
  const order = ctx.state.config.views![index].order ?? [];
  el.createEl("h4", { text: "Columns" });
  if (order.length === 0) {
    el.createEl("p", { text: "No columns chosen: the view shows its default properties.", cls: "setting-item-description" });
  }
  order.forEach((property) => {
    new Setting(el)
      .setName(property)
      .addExtraButton((button) => {
        button.setIcon("arrow-up").setTooltip("Move up");
        button.onClick(() => ctx.apply(moveViewColumn(ctx.state.config, index, property, -1)));
      })
      .addExtraButton((button) => {
        button.setIcon("arrow-down").setTooltip("Move down");
        button.onClick(() => ctx.apply(moveViewColumn(ctx.state.config, index, property, 1)));
      })
      .addExtraButton((button) => {
        button.setIcon("x").setTooltip("Remove column");
        button.onClick(() => ctx.apply(toggleViewColumn(ctx.state.config, index, property, false)));
      });
  });

  const available = ctx.properties.filter((p) => !order.includes(p.id));
  if (available.length === 0) return;
  let chosen = available[0].id;
  new Setting(el)
    .setName("Add a column")
    .addDropdown((dropdown) => {
      available.forEach((p) => dropdown.addOption(p.id, p.id));
      dropdown.setValue(chosen);
      dropdown.onChange((value) => (chosen = value));
    })
    .addButton((button) => button.setButtonText("Add").onClick(() => ctx.apply(toggleViewColumn(ctx.state.config, index, chosen, true))));
}

function renderSort(el: HTMLElement, ctx: SectionContext, index: number): void {
  const sort = ctx.state.config.views![index].sort ?? [];
  el.createEl("h4", { text: "Sort" });
  const replace = (next: BaseSort[], rerender = true) => ctx.apply(setViewSort(ctx.state.config, index, next), { rerender });

  sort.forEach((entry, position) => {
    const row = new Setting(el).setName(position === 0 ? "Sort by" : "Then by");
    propertyDropdown(ctx, row, entry.property, null, (value) => {
      if (value) replace(sort.map((s, i) => (i === position ? { ...s, property: value } : s)));
    });
    row.addDropdown((dropdown) => {
      DIRECTIONS.forEach(([id, label]) => dropdown.addOption(id, label));
      dropdown.setValue(entry.direction);
      dropdown.onChange((value) => replace(sort.map((s, i) => (i === position ? { ...s, direction: value as SortDirection } : s))));
    });
    row.addExtraButton((button) => {
      button.setIcon("x").setTooltip("Remove sort");
      button.onClick(() => replace(sort.filter((_, i) => i !== position)));
    });
  });

  const first = ctx.properties[0]?.id;
  if (!first) return;
  new Setting(el).addButton((button) =>
    button.setButtonText(sort.length ? "Add another sort" : "Add a sort").onClick(() => replace([...sort, { property: first, direction: "ASC" }]))
  );
}

function renderViewSummaries(el: HTMLElement, ctx: SectionContext, index: number): void {
  const view = ctx.state.config.views![index];
  const columns = view.order ?? [];
  if (columns.length === 0) return;
  const custom = Object.keys(ctx.state.config.summaries ?? {});

  el.createEl("h4", { text: "Summaries" });
  columns.forEach((property) => {
    new Setting(el).setName(property).addDropdown((dropdown) => {
      dropdown.addOption(NONE, "None");
      [...BUILT_IN_SUMMARIES, ...custom].forEach((name) => dropdown.addOption(name, name));
      const current = view.summaries?.[property];
      if (current && ![...BUILT_IN_SUMMARIES, ...custom].includes(current)) dropdown.addOption(current, current);
      dropdown.setValue(current ?? NONE);
      dropdown.onChange((value) => ctx.apply(setViewSummary(ctx.state.config, index, property, value === NONE ? null : value), { rerender: false }));
    });
  });
}

/** Options only some view types have (card size, …): shown and edited as plain key/value pairs. */
function renderOtherOptions(el: HTMLElement, ctx: SectionContext, index: number): void {
  const view = ctx.state.config.views![index];
  const keys = Object.keys(view).filter((key) => !MODELED_VIEW_KEYS.includes(key));
  el.createEl("h4", { text: "Other options" });
  el.createEl("p", {
    text: "Settings specific to this view type, such as card size. Existing ones are kept; add new ones by key.",
    cls: "setting-item-description",
  });

  keys.forEach((key) => {
    new Setting(el)
      .setName(key)
      .addText((text) => {
        const value = view[key];
        text.setValue(typeof value === "object" ? JSON.stringify(value) : String(value));
        text.setDisabled?.(typeof value === "object");
        text.onChange((next) => ctx.apply(setViewOption(ctx.state.config, index, key, parseOptionValue(next)), { rerender: false }));
      })
      .addExtraButton((button) => {
        button.setIcon("x").setTooltip("Remove option");
        button.onClick(() => ctx.apply(setViewOption(ctx.state.config, index, key, null)));
      });
  });

  const draft = { key: "", value: "" };
  new Setting(el)
    .setName("Add an option")
    .addText((text) => {
      text.setPlaceholder("key");
      text.onChange((value) => (draft.key = value));
    })
    .addText((text) => {
      text.setPlaceholder("value");
      text.onChange((value) => (draft.value = value));
    })
    .addButton((button) =>
      button.setButtonText("Add").onClick(() => {
        const key = draft.key.trim();
        if (!key || MODELED_VIEW_KEYS.includes(key)) return;
        ctx.apply(setViewOption(ctx.state.config, index, key, parseOptionValue(draft.value)));
      })
    );
}
