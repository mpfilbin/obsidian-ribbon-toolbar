import type { EditorLike } from "./types";
import { computeFenceLineKinds } from "./formatMarkdown";

const BLOCK_ID_AT_END = /(?:^|\s)\^([A-Za-z0-9-]+)\s*$/;
const STANDALONE_BLOCK_ID = /^\^([A-Za-z0-9-]+)\s*$/;
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

export type BlockIdPlan =
  | { type: "skip"; reason: string }
  | { type: "insert"; taken: Set<string>; insert(id: string): void };

/** A random ID that is not already used in the note. */
export function uniqueBlockId(taken: Set<string>, generate: () => string = randomBlockId): string {
  let id = generate();
  for (let attempt = 0; taken.has(id) && attempt < 100; attempt++) id = generate();
  return id;
}

/** Cleans up what the user typed (a leading `^` and surrounding space are ignored) and checks it. */
export function validateBlockId(input: string, taken: Set<string>): { id: string } | { error: string } {
  const id = input.trim().replace(/^\^/, "");
  if (!/^[A-Za-z0-9-]+$/.test(id)) return { error: "Block IDs can only use letters, numbers and hyphens." };
  if (taken.has(id)) return { error: `^${id} is already used in this note.` };
  return { id };
}

/**
 * Works out where a block identifier (`^abc123`) for the block under the cursor
 * would go, so it can be linked to with `[[Note#^abc123]]`. The ID goes at the
 * end of the list item or paragraph; for quotes and tables it goes on its own
 * line below, as Obsidian requires. Plans a skip, with the reason, for blank
 * lines, headings (link to those directly), fenced code, and blocks that
 * already have an ID.
 */
export function planBlockId(editor: EditorLike): BlockIdPlan {
  const lines: string[] = [];
  for (let line = 0; line <= editor.lastLine(); line++) lines.push(editor.getLine(line));

  const start = editor.getCursor().line;
  const fenceKinds = computeFenceLineKinds(lines);
  const first = lines[start];
  if (fenceKinds[start]) return { type: "skip", reason: "Block IDs can't be added inside fenced code." };
  if (first.trim() === "") {
    return { type: "skip", reason: "Put the cursor in a paragraph, list item, quote or table to add a block ID." };
  }
  if (HEADING.test(first)) {
    return { type: "skip", reason: "Headings can't have block IDs; link to them with Heading Link instead." };
  }

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
  const existing = ownLine && lines[end + 1]?.trim() === "" ? lines[end + 2]?.match(STANDALONE_BLOCK_ID) : null;
  const existingId = lines[end].match(BLOCK_ID_AT_END)?.[1] ?? existing?.[1];
  if (existingId) return { type: "skip", reason: `This block already has an ID (^${existingId}).` };

  const endCh = lines[end].length;
  return {
    type: "insert",
    taken: existingBlockIds(lines),
    insert(id) {
      if (ownLine) {
        editor.replaceRange(`\n\n^${id}`, { line: end, ch: endCh });
      } else {
        const trimmedLength = lines[end].trimEnd().length;
        editor.replaceRange(` ^${id}`, { line: end, ch: trimmedLength }, { line: end, ch: endCh });
      }
    },
  };
}
