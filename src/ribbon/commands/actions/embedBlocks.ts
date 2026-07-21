import type { CachedMetadata } from "obsidian";

export interface BlockCandidate {
  id: string;
  line: number;
}

// Merges cache.blocks with ListItemCache.id/SectionCache.id as defensive breadth: Obsidian
// normally mirrors list-item and section block IDs into cache.blocks too, so those two passes
// are usually redundant with the first. Kept for cache states where they aren't (not a confirmed
// fix for any specific reported bug), deduped by ID so no source contributes a duplicate.
export function collectBlockCandidates(cache: CachedMetadata): BlockCandidate[] {
  const blockEntries = Object.entries(cache.blocks ?? {}).map(([id, block]) => ({
    id,
    line: block.position.start.line,
  }));

  const listItemEntries = (cache.listItems ?? [])
    .filter((item): item is typeof item & { id: string } => item.id !== undefined)
    .map((item) => ({ id: item.id, line: item.position.start.line }));

  const sectionEntries = (cache.sections ?? [])
    .filter((section): section is typeof section & { id: string } => section.id !== undefined)
    .map((section) => ({ id: section.id, line: section.position.start.line }));

  const seenIds = new Set<string>();
  const candidates: BlockCandidate[] = [];
  for (const entry of [...blockEntries, ...listItemEntries, ...sectionEntries]) {
    if (seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    candidates.push(entry);
  }
  return candidates;
}
