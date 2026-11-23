import type { EditorLike } from "./types";
import { computeFenceLineKinds } from "./formatMarkdown";

const BLOCK_ID_AT_END = /(?:^|\s)\^([A-Za-z0-9-]+)\s*$/;
const STANDALONE_BLOCK_ID = /^\^[A-Za-z0-9-]+\s*$/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s/;
const HEADING = /^#{1,6}\s/;
// Obsidian only reads a block ID at the end of a quote or table when it sits on its own line below.
const NEEDS_OWN_LINE = /^\s*[>|]/;

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const ID_LENGTH = 6;

export function randomBlockId(): string {
  let id = "";
  for (let i = 0; i < ID_LENGTH; i++) id += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  return id;
}

function existingBlockIds(lines: string[]): Set<string> {
  const ids = new Set<string>();
  for (const line of lines) {
    const match = line.match(BLOCK_ID_AT_END);
    if (match) ids.add(match[1]);
  }
  return ids;
}

/**
 * Gives the block under the cursor a block identifier (`^abc123`) so it can be
 * linked to with `[[Note#^abc123]]`. The ID goes at the end of the list item or
 * paragraph; for quotes and tables it goes on its own line below, as Obsidian
 * requires. Does nothing for blank lines, headings (link to those directly),
 * fenced code, or blocks that already have an ID.
 */
export function insertBlockId(editor: EditorLike, generate: () => string = randomBlockId): void {
  const lines: string[] = [];
  for (let line = 0; line <= editor.lastLine(); line++) lines.push(editor.getLine(line));

  const start = editor.getCursor().line;
  const fenceKinds = computeFenceLineKinds(lines);
  const first = lines[start];
  if (fenceKinds[start] || first.trim() === "" || HEADING.test(first)) return;

  let end = start;
  if (!LIST_ITEM.test(first)) {
    const continues = (line: number) =>
      line < lines.length &&
      lines[line].trim() !== "" &&
      !fenceKinds[line] &&
      !LIST_ITEM.test(lines[line]) &&
      !HEADING.test(lines[line]);
    while (continues(end + 1)) end++;
  }

  const ownLine = NEEDS_OWN_LINE.test(first) && !LIST_ITEM.test(first);
  if (BLOCK_ID_AT_END.test(lines[end])) return;
  if (ownLine && lines[end + 1]?.trim() === "" && STANDALONE_BLOCK_ID.test(lines[end + 2] ?? "")) return;

  const taken = existingBlockIds(lines);
  let id = generate();
  for (let attempt = 0; taken.has(id) && attempt < 100; attempt++) id = generate();

  const endCh = lines[end].length;
  if (ownLine) {
    editor.replaceRange(`\n\n^${id}`, { line: end, ch: endCh });
  } else {
    const trimmedLength = lines[end].trimEnd().length;
    editor.replaceRange(` ^${id}`, { line: end, ch: trimmedLength }, { line: end, ch: endCh });
  }
}
