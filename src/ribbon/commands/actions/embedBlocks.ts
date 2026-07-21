import type { CachedMetadata } from "obsidian";

export interface BlockCandidate {
  id: string;
  line: number;
}

export function collectBlockCandidates(cache: CachedMetadata): BlockCandidate[] {
  const blockEntries = Object.entries(cache.blocks ?? {}).map(([id, block]) => ({
    id,
    line: block.position.start.line,
  }));

  const listItemEntries = (cache.listItems ?? [])
    .filter((item): item is typeof item & { id: string } => item.id !== undefined)
    .map((item) => ({ id: item.id, line: item.position.start.line }));

  return [...blockEntries, ...listItemEntries];
}
