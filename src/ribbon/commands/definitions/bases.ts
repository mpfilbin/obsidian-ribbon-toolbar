import type { CommandEntry } from "../types";
import { VIEW_TYPES } from "../../bases/model";
import { QUICK_FILTERS } from "../../bases/filters";
import { FUNCTION_GROUPS, functionsInGroup, type BaseFunction, type FunctionGroup } from "../../bases/functions";
import { insertFunction } from "../../bases/insertFunction";
import { addBaseQuickFilter, addBaseView, openBaseSection, openEmbedBase, openNewBase } from "../modalLoaders";

const FUNCTION_MENUS: Record<FunctionGroup, { label: string; icon: string }> = {
  Global: { label: "Functions", icon: "square-function" },
  Text: { label: "Text", icon: "type" },
  Number: { label: "Number", icon: "hash" },
  List: { label: "List", icon: "list" },
  Date: { label: "Date", icon: "calendar" },
  File: { label: "File", icon: "file" },
};

/** What a menu cell shows: the call as it will be inserted (properties like `.length` get no parentheses). */
export function functionCellText(fn: BaseFunction): string {
  const prefix = fn.template.startsWith(".") ? "." : "";
  const suffix = fn.template.includes("(") ? "()" : "";
  return `${prefix}${fn.name}${suffix}`;
}

// One menu per function group. Each cell shows the call; hovering shows its signature.
const functionMenus: CommandEntry[] = FUNCTION_GROUPS.map((group) => ({
  id: `base-fn-${group.toLowerCase()}`,
  tab: "bases",
  group: "Functions",
  icon: FUNCTION_MENUS[group].icon,
  label: FUNCTION_MENUS[group].label,
  optionColumns: 3,
  optionCellWidth: 110,
  options: functionsInGroup(group).map((fn) => {
    const action = insertFunction(fn);
    return {
      id: `fn-${group.toLowerCase()}-${fn.name}`,
      label: `${fn.signature}: ${fn.description}`,
      display: functionCellText(fn),
      action: (editor) => action(editor),
    };
  }),
}));

export const BASES_COMMANDS: CommandEntry[] = [
  { id: "base-new", tab: "bases", group: "Base", icon: "database", label: "New Base", modal: openNewBase },
  { id: "base-embed", tab: "bases", group: "Base", icon: "file-input", label: "Embed Base", modal: openEmbedBase },
  { id: "base-edit", tab: "bases", group: "Base", icon: "sliders-horizontal", label: "Edit Base", modal: openBaseSection("views") },

  {
    id: "base-add-view",
    tab: "bases",
    group: "Views",
    icon: "layout-grid",
    label: "Add View",
    options: VIEW_TYPES.map((type) => ({
      id: `base-view-${type.id}`,
      label: type.label,
      action: addBaseView(type.id),
    })),
  },
  { id: "base-views", tab: "bases", group: "Views", icon: "table", label: "Edit Views", modal: openBaseSection("views") },

  {
    id: "base-quick-filter",
    tab: "bases",
    group: "Filters",
    icon: "filter",
    label: "Quick Filter",
    options: [
      { id: "base-filter-this-folder", label: "In this note's folder", action: addBaseQuickFilter("this-folder") },
      ...QUICK_FILTERS.map((quick) => ({
        id: `base-filter-${quick.id}`,
        label: quick.label,
        action: addBaseQuickFilter(quick.id),
      })),
    ],
  },
  { id: "base-filters", tab: "bases", group: "Filters", icon: "list-filter", label: "Filters", modal: openBaseSection("filters") },

  { id: "base-formulas", tab: "bases", group: "Formulas", icon: "calculator", label: "Formulas", modal: openBaseSection("formulas") },
  ...functionMenus,

  { id: "base-properties", tab: "bases", group: "Columns", icon: "columns-3", label: "Properties", modal: openBaseSection("properties") },
  { id: "base-summaries", tab: "bases", group: "Columns", icon: "sigma", label: "Summaries", modal: openBaseSection("summaries") },
];
