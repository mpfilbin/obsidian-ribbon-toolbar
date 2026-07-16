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

/**
 * Inserts a property into the note's frontmatter (creating the frontmatter
 * block first if needed). No-ops if the property already exists, so
 * clicking the same property's button twice never creates a duplicate key.
 */
export function insertProperty(config: FrontmatterPropertyConfig): (editor: EditorLike) => void {
  return (editor: EditorLike): void => {
    const range = findFrontmatterRange(editor);

    if (!range) {
      const lines = formatValueLines(config);
      editor.replaceRange(`${DELIMITER}\n${lines.join("\n")}\n${DELIMITER}\n`, { line: 0, ch: 0 });
      placeCursorAtEndOf(editor, lines.length);
      return;
    }

    if (findPropertyLine(editor, range, config.name) !== null) return;

    const lines = formatValueLines(config);
    editor.replaceRange(`${lines.join("\n")}\n`, { line: range.endLine, ch: 0 });
    placeCursorAtEndOf(editor, range.endLine + lines.length - 1);
  };
}
