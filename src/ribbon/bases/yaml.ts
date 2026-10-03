import { parseYaml, stringifyYaml } from "obsidian";
import type { BaseConfig } from "./model";

export type ParseResult = { ok: true; config: BaseConfig } | { ok: false; error: string };

/** Parses the YAML of a base; empty text is a valid, empty base. */
export function parseBase(text: string): ParseResult {
  if (!text.trim()) return { ok: true, config: {} };
  try {
    const parsed: unknown = parseYaml(text);
    if (parsed === null || parsed === undefined) return { ok: true, config: {} };
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "A base must be a YAML mapping (filters, formulas, views, …)." };
    }
    return { ok: true, config: parsed as BaseConfig };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function serializeBase(config: BaseConfig): string {
  return stringifyYaml(config).trimEnd();
}
