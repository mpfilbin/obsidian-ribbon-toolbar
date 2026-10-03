/**
 * Types and constants for the `.base` format (Obsidian Bases). The shape follows
 * Obsidian's own BasesConfigFile typings; keys this plugin doesn't model are
 * preserved untouched when a base is edited.
 */

export type FilterNode = string | { and: FilterNode[] } | { or: FilterNode[] } | { not: FilterNode[] };
export type FilterMode = "and" | "or" | "not";
export type SortDirection = "ASC" | "DESC";

export interface BaseSort {
  property: string;
  direction: SortDirection;
}

export interface BaseGroupBy {
  property: string;
  direction: SortDirection;
}

export interface BaseView {
  type: string;
  name: string;
  filters?: FilterNode;
  groupBy?: BaseGroupBy;
  order?: string[];
  sort?: BaseSort[];
  limit?: number;
  summaries?: Record<string, string>;
  // View-type specific options (e.g. card size) are kept as-is.
  [option: string]: unknown;
}

export interface BaseConfig {
  filters?: FilterNode;
  formulas?: Record<string, string>;
  properties?: Record<string, Record<string, unknown>>;
  summaries?: Record<string, string>;
  views?: BaseView[];
  [key: string]: unknown;
}

export const VIEW_TYPES: { id: string; label: string }[] = [
  { id: "table", label: "Table" },
  { id: "cards", label: "Cards" },
  { id: "list", label: "List" },
  { id: "map", label: "Map" },
];

/** Keys on a view that the editor has dedicated controls for. */
export const MODELED_VIEW_KEYS = ["type", "name", "filters", "groupBy", "order", "sort", "limit", "summaries"];

/** Summary names Bases ships with; custom ones live in the base's `summaries`. */
export const BUILT_IN_SUMMARIES = [
  "Average",
  "Min",
  "Max",
  "Sum",
  "Range",
  "Median",
  "Stddev",
  "Earliest",
  "Latest",
  "Checked",
  "Unchecked",
  "Empty",
  "Filled",
  "Unique",
];

/** Properties every file has, addressed as `file.<name>`. */
export const FILE_PROPERTIES = [
  "file.name",
  "file.basename",
  "file.path",
  "file.folder",
  "file.ext",
  "file.size",
  "file.ctime",
  "file.mtime",
  "file.tags",
  "file.links",
  "file.backlinks",
  "file.embeds",
];

export const FILTER_MODE_LABELS: Record<FilterMode, string> = {
  and: "All of the following are true",
  or: "Any of the following is true",
  not: "None of the following are true",
};
