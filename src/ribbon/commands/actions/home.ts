import type { EditorLike } from "./types";
import { toggleListPrefix, togglePrefix, wrapSelection } from "./helpers";

export const toggleBold = (editor: EditorLike): void => wrapSelection(editor, "**", "**", "bold text");
export const toggleItalic = (editor: EditorLike): void => wrapSelection(editor, "*", "*", "italic text");
export const toggleStrikethrough = (editor: EditorLike): void =>
  wrapSelection(editor, "~~", "~~", "strikethrough text");
export const toggleHighlight = (editor: EditorLike): void => wrapSelection(editor, "==", "==", "highlighted text");
export const toggleInlineCode = (editor: EditorLike): void => wrapSelection(editor, "`", "`", "code");
export const toggleUnderline = (editor: EditorLike): void =>
  wrapSelection(editor, "<u>", "</u>", "underlined text");
export const toggleSuperscript = (editor: EditorLike): void =>
  wrapSelection(editor, "<sup>", "</sup>", "superscript text");
export const toggleSubscript = (editor: EditorLike): void =>
  wrapSelection(editor, "<sub>", "</sub>", "subscript text");

export function setHeading(level: 1 | 2 | 3): (editor: EditorLike) => void {
  return (editor: EditorLike): void => {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const stripped = line.replace(/^#{1,6} /, "");
    editor.setLine(cursor.line, `${"#".repeat(level)} ${stripped}`);
    editor.setCursor({ line: cursor.line, ch: level + 1 + stripped.length });
  };
}

export const toggleBulletList = (editor: EditorLike): void => toggleListPrefix(editor, "bullet", "- ");
export const toggleNumberedList = (editor: EditorLike): void => toggleListPrefix(editor, "numbered", "1. ");
export const toggleChecklist = (editor: EditorLike): void => toggleListPrefix(editor, "checklist", "- [ ] ");
export const toggleBlockquote = (editor: EditorLike): void => togglePrefix(editor, "> ");

const FORMATTING_MARKERS = [/\*\*(.*?)\*\*/g, /\*(.*?)\*/g, /~~(.*?)~~/g, /==(.*?)==/g, /`(.*?)`/g];

const IMAGE_PATTERN = /!\[([^\]]*)\]\([^)]*\)/g;
const LINK_PATTERN = /\[([^\]]*)\]\([^)]*\)/g;
const FOOTNOTE_REF_PATTERN = /\[\^(\d+)\]/g;
const HTML_TAG_PATTERN = /<\/?[a-zA-Z][^>]*>/g;

function stripLineLeadingMarkers(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^>+\s?/, "")
    .replace(/^- \[[ xX]\]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/^[-*+]\s+/, "");
}

function collectFootnoteIndices(text: string): string[] {
  return [...text.matchAll(FOOTNOTE_REF_PATTERN)].map((match) => match[1]);
}

function deleteLine(editor: EditorLike, line: number): void {
  const lastLine = editor.lastLine();
  if (line < lastLine) {
    editor.replaceRange("", { line, ch: 0 }, { line: line + 1, ch: 0 });
    return;
  }
  if (line === 0) {
    editor.setLine(line, "");
    return;
  }
  let fromLine = line - 1;
  while (fromLine > 0 && editor.getLine(fromLine) === "") fromLine--;
  const fromLength = editor.getLine(fromLine).length;
  editor.replaceRange("", { line: fromLine, ch: fromLength }, { line, ch: editor.getLine(line).length });
}

function removeFootnoteDefinitions(editor: EditorLike, indices: string[]): void {
  if (indices.length === 0) return;
  const pending = new Set(indices);
  for (let line = editor.lastLine(); line >= 0; line--) {
    const match = editor.getLine(line).match(/^\[\^(\d+)\]:/);
    if (match && pending.has(match[1])) {
      deleteLine(editor, line);
    }
  }
}

export function clearFormatting(editor: EditorLike): void {
  if (!editor.somethingSelected()) return;
  let text = editor.getSelection();
  const footnoteIndices = collectFootnoteIndices(text);

  text = text.replace(IMAGE_PATTERN, "$1");
  text = text.replace(LINK_PATTERN, "$1");
  text = text.replace(FOOTNOTE_REF_PATTERN, "");
  text = text.replace(HTML_TAG_PATTERN, "");
  for (const pattern of FORMATTING_MARKERS) {
    text = text.replace(pattern, "$1");
  }
  text = text.split("\n").map(stripLineLeadingMarkers).join("\n");

  editor.replaceSelection(text);
  removeFootnoteDefinitions(editor, footnoteIndices);
}
