import type { BaseConfig } from "./model";
import { addCondition, emptyBase, setViewColumns } from "./ops";
import { buildCondition, folderOfNoteCondition, type ConditionSpec } from "./filters";

export type StarterScope = "all" | "folder" | "tag" | "links";

export interface StarterOptions {
  viewType: string;
  viewName?: string;
  scope: StarterScope;
  /** Path of the note the base is going into (for the "folder" scope). */
  notePath?: string;
  tag?: string;
}

/** A new base: one view of the chosen type, optionally narrowed to a first filter. */
export function buildStarterBase(options: StarterOptions): BaseConfig {
  let config = emptyBase(options.viewType, options.viewName?.trim() || undefined);
  config = setViewColumns(config, 0, ["file.name"]);

  let spec: ConditionSpec | null = null;
  if (options.scope === "folder") spec = folderOfNoteCondition(options.notePath ?? "");
  else if (options.scope === "tag" && options.tag?.trim()) spec = { kind: "tag", tags: [options.tag] };
  else if (options.scope === "links") spec = { kind: "linksToThis" };

  const built = spec ? buildCondition(spec) : null;
  return built?.ok ? addCondition(config, "base", built.expression) : config;
}

export function baseFileName(name: string): string {
  const trimmed = name.trim().replace(/[\\/:*?"<>|#^[\]]/g, "-");
  if (!trimmed) return "Untitled.base";
  return trimmed.toLowerCase().endsWith(".base") ? trimmed : `${trimmed}.base`;
}
