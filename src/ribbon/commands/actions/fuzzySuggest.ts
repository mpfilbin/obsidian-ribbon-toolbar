import { prepareFuzzySearch } from "obsidian";
import type { TFile } from "obsidian";

export const RESULT_LIMIT = 20;

/**
 * Filters `items` by fuzzy-matching `query` against `getText(item)`, best match
 * first. A blank query keeps every item in its original order.
 */
export function fuzzyFilter<T>(items: T[], query: string, getText: (item: T) => string): T[] {
  const trimmed = query.trim();
  if (!trimmed) return items;

  const search = prepareFuzzySearch(trimmed);
  return items
    .map((item) => ({ item, result: search(getText(item)) }))
    .filter((entry): entry is { item: T; result: NonNullable<typeof entry.result> } => entry.result !== null)
    .sort((a, b) => b.result.score - a.result.score)
    .map((entry) => entry.item);
}

export type NoteSuggestion = { type: "file"; file: TFile } | { type: "create"; name: string };

/**
 * File suggestions for a query, capped at RESULT_LIMIT, followed by a "create
 * new note" entry when the query is non-empty and names no existing file.
 */
export function suggestNotes(files: TFile[], query: string): NoteSuggestion[] {
  const trimmed = query.trim();
  const results: NoteSuggestion[] = fuzzyFilter(files, trimmed, (file) => file.basename)
    .slice(0, RESULT_LIMIT)
    .map((file) => ({ type: "file" as const, file }));

  const exactMatch = files.some((file) => file.basename.toLowerCase() === trimmed.toLowerCase());
  if (trimmed && !exactMatch) {
    results.push({ type: "create", name: trimmed });
  }
  return results;
}
