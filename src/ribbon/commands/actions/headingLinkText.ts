import type { EditorLike } from "./types";
import { computeFenceLineKinds } from "./formatMarkdown";

const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;

export interface HeadingEntry {
  line: number;
  level: number;
  text: string;
}

export function collectHeadings(editor: EditorLike): HeadingEntry[] {
  const lines: string[] = [];
  for (let line = 0; line <= editor.lastLine(); line++) lines.push(editor.getLine(line));
  const fenceKinds = computeFenceLineKinds(lines);

  const headings: HeadingEntry[] = [];
  for (let line = 0; line < lines.length; line++) {
    if (fenceKinds[line]) continue;
    const match = lines[line].match(HEADING_PATTERN);
    if (match) headings.push({ line, level: match[1].length, text: match[2].trim() });
  }
  return headings;
}

export function buildHeadingLinkText(headingText: string, alias: string | null): string {
  return alias ? `[[#${headingText}|${alias}]]` : `[[#${headingText}]]`;
}
