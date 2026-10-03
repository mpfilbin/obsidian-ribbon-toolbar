import type { BaseConfig, BaseSort, BaseView, FilterMode, FilterNode, SortDirection } from "./model";
import { VIEW_TYPES } from "./model";

/**
 * Pure edits to a parsed base. Every function returns a new config and leaves
 * its input untouched, so callers can keep the original as an undo point.
 */

export type FilterScope = "base" | number;

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function withViews(config: BaseConfig, edit: (views: BaseView[]) => void): BaseConfig {
  const next = clone(config);
  const views = next.views ?? [];
  edit(views);
  next.views = views;
  return next;
}

/** An empty, valid base: one table view that lists every note. */
export function emptyBase(viewType = "table", viewName?: string): BaseConfig {
  return { views: [{ type: viewType, name: viewName ?? defaultViewName(viewType) }] };
}

export function defaultViewName(type: string): string {
  return VIEW_TYPES.find((t) => t.id === type)?.label ?? type;
}

// ---------------------------------------------------------------- views

export function uniqueViewName(config: BaseConfig, wanted: string): string {
  const taken = new Set((config.views ?? []).map((v) => v.name));
  if (!taken.has(wanted)) return wanted;
  let n = 2;
  while (taken.has(`${wanted} ${n}`)) n++;
  return `${wanted} ${n}`;
}

export function addView(config: BaseConfig, type: string, name?: string): { config: BaseConfig; index: number } {
  const viewName = uniqueViewName(config, name?.trim() || defaultViewName(type));
  let index = 0;
  const next = withViews(config, (views) => {
    views.push({ type, name: viewName });
    index = views.length - 1;
  });
  return { config: next, index };
}

export function removeView(config: BaseConfig, index: number): BaseConfig {
  return withViews(config, (views) => {
    views.splice(index, 1);
  });
}

export function duplicateView(config: BaseConfig, index: number): { config: BaseConfig; index: number } {
  let newIndex = index;
  const next = withViews(config, (views) => {
    const source = views[index];
    if (!source) return;
    const copy = clone(source);
    copy.name = uniqueViewName({ views }, `${source.name} copy`);
    views.splice(index + 1, 0, copy);
    newIndex = index + 1;
  });
  return { config: next, index: newIndex };
}

export function moveView(config: BaseConfig, index: number, delta: -1 | 1): { config: BaseConfig; index: number } {
  const target = index + delta;
  const views = config.views ?? [];
  if (target < 0 || target >= views.length) return { config: clone(config), index };
  const next = withViews(config, (list) => {
    const [moved] = list.splice(index, 1);
    list.splice(target, 0, moved);
  });
  return { config: next, index: target };
}

/** Merges `patch` into a view; a key set to `undefined` is removed. */
export function updateView(config: BaseConfig, index: number, patch: Partial<BaseView>): BaseConfig {
  return withViews(config, (views) => {
    const view = views[index];
    if (!view) return;
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || (Array.isArray(value) && value.length === 0)) delete view[key];
      else view[key] = clone(value);
    }
  });
}

export function setViewName(config: BaseConfig, index: number, name: string): BaseConfig {
  const trimmed = name.trim();
  if (!trimmed) return clone(config);
  const others = { views: (config.views ?? []).filter((_, i) => i !== index) };
  return updateView(config, index, { name: uniqueViewName(others, trimmed) });
}

export function setViewSort(config: BaseConfig, index: number, sort: BaseSort[]): BaseConfig {
  return updateView(config, index, { sort });
}

export function setViewGroupBy(config: BaseConfig, index: number, property: string | null, direction: SortDirection = "ASC"): BaseConfig {
  return updateView(config, index, { groupBy: property ? { property, direction } : undefined });
}

export function setViewLimit(config: BaseConfig, index: number, limit: number | null): BaseConfig {
  const valid = limit !== null && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : undefined;
  return updateView(config, index, { limit: valid });
}

export function setViewColumns(config: BaseConfig, index: number, order: string[]): BaseConfig {
  return updateView(config, index, { order });
}

/** Adds or removes one column, keeping the existing column order. */
export function toggleViewColumn(config: BaseConfig, index: number, property: string, shown: boolean): BaseConfig {
  const current = config.views?.[index]?.order ?? [];
  const without = current.filter((p) => p !== property);
  return setViewColumns(config, index, shown ? [...without, property] : without);
}

export function moveViewColumn(config: BaseConfig, index: number, property: string, delta: -1 | 1): BaseConfig {
  const order = [...(config.views?.[index]?.order ?? [])];
  const from = order.indexOf(property);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= order.length) return clone(config);
  [order[from], order[to]] = [order[to], order[from]];
  return setViewColumns(config, index, order);
}

export function setViewSummary(config: BaseConfig, index: number, property: string, summary: string | null): BaseConfig {
  const summaries = { ...(config.views?.[index]?.summaries ?? {}) };
  if (summary) summaries[property] = summary;
  else delete summaries[property];
  return updateView(config, index, { summaries: Object.keys(summaries).length ? summaries : undefined });
}

/** Sets or clears a view-type specific option such as a card size. */
export function setViewOption(config: BaseConfig, index: number, key: string, value: unknown): BaseConfig {
  return updateView(config, index, { [key]: value === "" || value === null ? undefined : value });
}

/** Reads an option value typed into a text field: booleans and numbers keep their type. */
export function parseOptionValue(text: string): string | number | boolean {
  const trimmed = text.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed !== "" && Number.isFinite(Number(trimmed))) return Number(trimmed);
  return trimmed;
}

// -------------------------------------------------------------- filters

export interface FilterGroup {
  mode: FilterMode;
  items: FilterNode[];
}

/** Views a filter (possibly a bare string) as a group of conditions. */
export function filterGroup(node: FilterNode | undefined): FilterGroup | null {
  if (node === undefined) return null;
  if (typeof node === "string") return { mode: "and", items: [node] };
  for (const mode of ["and", "or", "not"] as const) {
    const items = (node as Record<string, FilterNode[] | undefined>)[mode];
    if (Array.isArray(items)) return { mode, items: [...items] };
  }
  return null;
}

function groupToNode(group: FilterGroup): FilterNode | undefined {
  if (group.items.length === 0) return undefined;
  return { [group.mode]: group.items } as FilterNode;
}

export function getScopeFilter(config: BaseConfig, scope: FilterScope): FilterNode | undefined {
  return scope === "base" ? config.filters : config.views?.[scope]?.filters;
}

export function setScopeFilter(config: BaseConfig, scope: FilterScope, node: FilterNode | undefined): BaseConfig {
  if (scope === "base") {
    const next = clone(config);
    if (node === undefined) delete next.filters;
    else next.filters = clone(node);
    return next;
  }
  return updateView(config, scope, { filters: node });
}

function editGroup(config: BaseConfig, scope: FilterScope, edit: (group: FilterGroup) => void): BaseConfig {
  const group = filterGroup(getScopeFilter(config, scope)) ?? { mode: "and" as FilterMode, items: [] };
  edit(group);
  return setScopeFilter(config, scope, groupToNode(group));
}

export function addCondition(config: BaseConfig, scope: FilterScope, condition: FilterNode): BaseConfig {
  return editGroup(config, scope, (group) => group.items.push(condition));
}

export function replaceCondition(config: BaseConfig, scope: FilterScope, index: number, condition: FilterNode): BaseConfig {
  return editGroup(config, scope, (group) => {
    if (index >= 0 && index < group.items.length) group.items[index] = condition;
  });
}

export function removeCondition(config: BaseConfig, scope: FilterScope, index: number): BaseConfig {
  return editGroup(config, scope, (group) => {
    group.items.splice(index, 1);
  });
}

export function setFilterMode(config: BaseConfig, scope: FilterScope, mode: FilterMode): BaseConfig {
  return editGroup(config, scope, (group) => {
    group.mode = mode;
  });
}

/** One-line description of a condition, for lists. Nested groups are summarised. */
export function describeCondition(node: FilterNode): string {
  if (typeof node === "string") return node;
  const group = filterGroup(node);
  if (!group) return "(unrecognised filter)";
  const word = { and: "all of", or: "any of", not: "none of" }[group.mode];
  return `${word} ${group.items.length} nested condition${group.items.length === 1 ? "" : "s"}`;
}

// ------------------------------------------------------------- formulas

const PROPERTY_REF = (name: string): string => `formula.${name}`;

export function setFormula(config: BaseConfig, name: string, expression: string): BaseConfig {
  const next = clone(config);
  next.formulas = { ...(next.formulas ?? {}), [name.trim()]: expression };
  return next;
}

function mapPropertyRefs(config: BaseConfig, from: string, to: string | null): BaseConfig {
  const next = clone(config);
  const swap = (id: string): string | null => (id === from ? to : id);

  const fixView = (view: BaseView) => {
    if (view.order) view.order = view.order.map(swap).filter((p): p is string => p !== null);
    if (view.sort) view.sort = view.sort.flatMap((s) => (swap(s.property) === null ? [] : [{ ...s, property: swap(s.property)! }]));
    if (view.groupBy && swap(view.groupBy.property) !== view.groupBy.property) {
      const mapped = swap(view.groupBy.property);
      if (mapped === null) delete view.groupBy;
      else view.groupBy.property = mapped;
    }
    if (view.summaries) {
      const entries = Object.entries(view.summaries).flatMap(([key, value]) => {
        const mapped = swap(key);
        return mapped === null ? [] : [[mapped, value] as const];
      });
      if (entries.length) view.summaries = Object.fromEntries(entries);
      else delete view.summaries;
    }
  };
  for (const view of next.views ?? []) {
    fixView(view);
    if (view.order?.length === 0) delete view.order;
    if (view.sort?.length === 0) delete view.sort;
  }

  if (next.properties && from in next.properties) {
    const settings = next.properties[from];
    delete next.properties[from];
    if (to !== null) next.properties[to] = settings;
    if (Object.keys(next.properties).length === 0) delete next.properties;
  }
  return next;
}

export function removeFormula(config: BaseConfig, name: string): BaseConfig {
  const next = mapPropertyRefs(config, PROPERTY_REF(name), null);
  if (next.formulas) {
    delete next.formulas[name];
    if (Object.keys(next.formulas).length === 0) delete next.formulas;
  }
  return next;
}

/** Renames a formula and every reference to it (columns, sort, group, other formulas). */
export function renameFormula(config: BaseConfig, from: string, to: string): BaseConfig {
  const newName = to.trim();
  if (!newName || newName === from || !config.formulas || !(from in config.formulas)) return clone(config);
  const next = mapPropertyRefs(config, PROPERTY_REF(from), PROPERTY_REF(newName));
  const reference = new RegExp(`\\bformula\\.${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
  next.formulas = Object.fromEntries(
    Object.entries(config.formulas).map(([key, expression]) => [
      key === from ? newName : key,
      expression.replace(reference, PROPERTY_REF(newName)),
    ])
  );
  return next;
}

// ----------------------------------------------------------- properties

export function setPropertyDisplayName(config: BaseConfig, propertyId: string, displayName: string): BaseConfig {
  const next = clone(config);
  const properties = { ...(next.properties ?? {}) };
  const settings = { ...(properties[propertyId] ?? {}) };
  if (displayName.trim()) settings.displayName = displayName.trim();
  else delete settings.displayName;

  if (Object.keys(settings).length) properties[propertyId] = settings;
  else delete properties[propertyId];

  if (Object.keys(properties).length) next.properties = properties;
  else delete next.properties;
  return next;
}

export function getPropertyDisplayName(config: BaseConfig, propertyId: string): string {
  const name = config.properties?.[propertyId]?.displayName;
  return typeof name === "string" ? name : "";
}

// ------------------------------------------------------------ summaries

export function setCustomSummary(config: BaseConfig, name: string, expression: string): BaseConfig {
  const next = clone(config);
  next.summaries = { ...(next.summaries ?? {}), [name.trim()]: expression };
  return next;
}

export function removeCustomSummary(config: BaseConfig, name: string): BaseConfig {
  const next = clone(config);
  if (next.summaries) {
    delete next.summaries[name];
    if (Object.keys(next.summaries).length === 0) delete next.summaries;
  }
  for (const view of next.views ?? []) {
    if (!view.summaries) continue;
    for (const [property, summary] of Object.entries(view.summaries)) {
      if (summary === name) delete view.summaries[property];
    }
    if (Object.keys(view.summaries).length === 0) delete view.summaries;
  }
  return next;
}

// ----------------------------------------------------------- validation

export interface BaseProblem {
  where: string;
  message: string;
}

/** Cheap structural check of a formula or filter string; not a full parser. */
export function checkExpression(expression: string): string | null {
  const text = expression.trim();
  if (!text) return "The expression is empty.";
  const closers: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const stack: string[] = [];
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (closers[ch]) stack.push(closers[ch]);
    else if (ch === ")" || ch === "]" || ch === "}") {
      if (stack.pop() !== ch) return `Unexpected "${ch}".`;
    }
  }
  if (quote) return "A quote is never closed.";
  if (stack.length) return `Missing "${stack[stack.length - 1]}".`;
  return null;
}

function checkFilter(node: FilterNode, where: string, problems: BaseProblem[]): void {
  if (typeof node === "string") {
    const problem = checkExpression(node);
    if (problem) problems.push({ where, message: `${problem} (${node})` });
    return;
  }
  const group = filterGroup(node);
  if (!group) {
    problems.push({ where, message: "A filter group must be and / or / not with a list of conditions." });
    return;
  }
  group.items.forEach((item) => checkFilter(item, where, problems));
}

export function validateBase(config: BaseConfig): BaseProblem[] {
  const problems: BaseProblem[] = [];
  const knownTypes = new Set(VIEW_TYPES.map((t) => t.id));

  if (config.filters !== undefined) checkFilter(config.filters, "Filters", problems);

  for (const [name, expression] of Object.entries(config.formulas ?? {})) {
    if (!name.trim() || name.includes(".")) problems.push({ where: `Formula "${name}"`, message: "Formula names can't be empty or contain a period." });
    const problem = checkExpression(String(expression));
    if (problem) problems.push({ where: `Formula "${name}"`, message: problem });
  }
  for (const [name, expression] of Object.entries(config.summaries ?? {})) {
    const problem = checkExpression(String(expression));
    if (problem) problems.push({ where: `Summary "${name}"`, message: problem });
  }

  const seen = new Set<string>();
  (config.views ?? []).forEach((view, index) => {
    const where = `View ${index + 1}${view.name ? ` (${view.name})` : ""}`;
    if (!view.name?.trim()) problems.push({ where, message: "A view needs a name." });
    else if (seen.has(view.name)) problems.push({ where, message: "Another view has the same name." });
    seen.add(view.name);
    if (!knownTypes.has(view.type)) problems.push({ where, message: `Unknown view type "${view.type}".` });
    if (view.filters !== undefined) checkFilter(view.filters, where, problems);
  });
  if (!config.views?.length) problems.push({ where: "Views", message: "A base needs at least one view." });
  return problems;
}
