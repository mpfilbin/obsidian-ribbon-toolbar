import type { App } from "obsidian";
import type { BaseConfig } from "./model";
import { FILE_PROPERTIES } from "./model";
import { inferKind, type ValueKind } from "./filters";

export interface PropertyOption {
  /** Property id as used in a base: file.name, note.status, formula.total. */
  id: string;
  kind: ValueKind;
}

const MAX_FILES_SCANNED = 2000;

/** Frontmatter properties used across the vault, with a guessed kind each. */
export function collectNoteProperties(app: App): PropertyOption[] {
  const samples = new Map<string, unknown>();
  const files = app.vault.getMarkdownFiles().slice(0, MAX_FILES_SCANNED);
  for (const file of files) {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontmatter) continue;
    for (const [key, value] of Object.entries(frontmatter)) {
      if (key === "position") continue;
      if (!samples.has(key) || samples.get(key) == null) samples.set(key, value);
    }
  }
  return [...samples.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, sample]) => ({ id: `note.${key}`, kind: inferKind(`note.${key}`, sample) }));
}

/** Every property a user might pick: file, note, and this base's formulas. */
export function propertyOptions(config: BaseConfig, noteProperties: PropertyOption[]): PropertyOption[] {
  const seen = new Set<string>();
  const options: PropertyOption[] = [];
  const add = (option: PropertyOption) => {
    if (seen.has(option.id)) return;
    seen.add(option.id);
    options.push(option);
  };

  FILE_PROPERTIES.forEach((id) => add({ id, kind: inferKind(id) }));
  noteProperties.forEach(add);
  Object.keys(config.formulas ?? {}).forEach((name) => add({ id: `formula.${name}`, kind: "text" }));

  // Properties already referenced by the base stay selectable even if no note has them.
  const referenced = new Set<string>(Object.keys(config.properties ?? {}));
  for (const view of config.views ?? []) {
    (view.order ?? []).forEach((id) => referenced.add(id));
    (view.sort ?? []).forEach((s) => referenced.add(s.property));
    if (view.groupBy) referenced.add(view.groupBy.property);
  }
  referenced.forEach((id) => add({ id, kind: inferKind(id) }));
  return options;
}

export function kindOf(options: PropertyOption[], id: string): ValueKind {
  return options.find((o) => o.id === id)?.kind ?? inferKind(id);
}
