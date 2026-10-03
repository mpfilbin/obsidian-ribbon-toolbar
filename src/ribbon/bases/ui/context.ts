import type { App } from "obsidian";
import type { BaseConfig } from "../model";
import type { FilterScope } from "../ops";
import type { PropertyOption } from "../catalog";

export type SectionId = "views" | "filters" | "formulas" | "properties" | "summaries";

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "views", label: "Views" },
  { id: "filters", label: "Filters" },
  { id: "formulas", label: "Formulas" },
  { id: "properties", label: "Properties" },
  { id: "summaries", label: "Summaries" },
];

export interface EditorState {
  config: BaseConfig;
  section: SectionId;
  viewIndex: number;
  filterScope: FilterScope;
}

/** What each section needs from the dialog that hosts it. */
export interface SectionContext {
  app: App;
  state: EditorState;
  /** Every property that can be chosen (file, note and formula properties). */
  properties: PropertyOption[];
  /** Replaces the config; pass rerender:false while typing so focus is kept. */
  apply(next: BaseConfig, options?: { rerender?: boolean }): void;
  rerender(): void;
}

export const NONE = "__none__";
