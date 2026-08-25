import type { EditorLike } from "./types";

const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;

export interface HeadingEntry {
  line: number;
  level: number;
  text: string;
}

export function collectHeadings(editor: EditorLike): HeadingEntry[] {
  const headings: HeadingEntry[] = [];
  for (let line = 0; line <= editor.lastLine(); line++) {
    const match = editor.getLine(line).match(HEADING_PATTERN);
    if (match) headings.push({ line, level: match[1].length, text: match[2].trim() });
  }
  return headings;
}

export function buildHeadingLinkText(headingText: string, alias: string | null): string {
  return alias ? `[[#${headingText}|${alias}]]` : `[[#${headingText}]]`;
}
