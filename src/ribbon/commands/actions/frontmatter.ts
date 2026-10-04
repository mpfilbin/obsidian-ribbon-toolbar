import type { EditorLike, EditorPosition } from "./types";

export type PropertyType = "automatic" | "text" | "list" | "number" | "checkbox" | "date" | "datetime";

export interface FrontmatterPropertyConfig {
  name: string;
  type: PropertyType;
  defaultValue?: string;
}

const DELIMITER = "---";

interface FrontmatterRange {
  startLine: number;
  endLine: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findFrontmatterRange(editor: EditorLike): FrontmatterRange | null {
  if (editor.getLine(0).trim() !== DELIMITER) return null;
  for (let line = 1; line <= editor.lastLine(); line++) {
    if (editor.getLine(line).trim() === DELIMITER) {
      return { startLine: 0, endLine: line };
    }
  }
  return null;
}

function findPropertyLine(editor: EditorLike, range: FrontmatterRange, name: string): number | null {
  const pattern = new RegExp(`^${escapeRegExp(name)}:`);
  for (let line = range.startLine + 1; line < range.endLine; line++) {
    if (pattern.test(editor.getLine(line))) return line;
  }
  return null;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowDateTime(): string {
  return new Date().toISOString().slice(0, 16);
}

function formatValueLines(config: FrontmatterPropertyConfig): string[] {
  const { name, type, defaultValue } = config;

  switch (type) {
    case "list": {
      const items = (defaultValue ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      if (items.length === 0) return [`${name}:`, "  - "];
      return [`${name}:`, ...items.map((item) => `  - ${item}`)];
    }
    case "checkbox":
      return [`${name}: ${defaultValue === "true" ? "true" : "false"}`];
    case "date":
      return [`${name}: ${defaultValue && defaultValue.length > 0 ? defaultValue : todayDate()}`];
    case "datetime":
      return [`${name}: ${defaultValue && defaultValue.length > 0 ? defaultValue : nowDateTime()}`];
    case "number":
    case "text":
    case "automatic":
    default:
      return [`${name}: ${defaultValue ?? ""}`];
  }
}

function placeCursorAtEndOf(editor: EditorLike, lineIndex: number): void {
  const text = editor.getLine(lineIndex);
  const pos: EditorPosition = { line: lineIndex, ch: text.length };
  editor.setCursor(pos);
}

/** Whether the note's frontmatter already has a property with this name. */
export function hasProperty(editor: EditorLike, name: string): boolean {
  const range = findFrontmatterRange(editor);
  return range !== null && findPropertyLine(editor, range, name) !== null;
}

/**
 * Writes already-formatted property lines into the note's frontmatter, creating
 * the frontmatter block first if needed, and leaves the cursor at the end of the
 * new property. Returns "exists" without changing anything if a property with
 * this name is already there, so a key is never duplicated.
 */
export function insertPropertyLines(editor: EditorLike, name: string, lines: string[]): "inserted" | "exists" {
  const range = findFrontmatterRange(editor);

  if (!range) {
    editor.replaceRange(`${DELIMITER}\n${lines.join("\n")}\n${DELIMITER}\n`, { line: 0, ch: 0 });
    placeCursorAtEndOf(editor, lines.length);
    return "inserted";
  }

  if (findPropertyLine(editor, range, name) !== null) return "exists";

  editor.replaceRange(`${lines.join("\n")}\n`, { line: range.endLine, ch: 0 });
  placeCursorAtEndOf(editor, range.endLine + lines.length - 1);
  return "inserted";
}

/**
 * Inserts a predefined property into the note's frontmatter (creating the
 * frontmatter block first if needed). No-ops if the property already exists, so
 * choosing the same property twice never creates a duplicate key.
 */
export function insertProperty(config: FrontmatterPropertyConfig): (editor: EditorLike) => void {
  return (editor: EditorLike): void => {
    insertPropertyLines(editor, config.name, formatValueLines(config));
  };
}
