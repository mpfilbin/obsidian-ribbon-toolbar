/** Finding bases inside a note: ```base code blocks and ![[x.base]] embeds. */

export interface BaseBlockRef {
  type: "block";
  /** Line of the opening ```base fence. */
  startLine: number;
  /** Line of the closing fence. */
  endLine: number;
  yaml: string;
}

export interface BaseEmbedRef {
  type: "embed";
  line: number;
  from: number;
  to: number;
  /** Link target as written, e.g. "Projects.base". */
  linkpath: string;
  /** View named after `#`, if any. */
  viewName?: string;
}

export type BaseRef = BaseBlockRef | BaseEmbedRef;

const OPEN_FENCE = /^\s*(`{3,}|~{3,})\s*(\S*)\s*$/;
const BASE_FENCE = /^\s*(`{3,}|~{3,})\s*base\s*$/;
const EMBED = /!\[\[([^\]|#]*?\.base)(?:#([^\]|]*))?(?:\|[^\]]*)?\]\]/g;

export function isBaseFence(line: string): boolean {
  return BASE_FENCE.test(line);
}

/** The closing fence line for a fence opened at `startLine`, or -1 if unclosed. */
export function findFenceEnd(lines: string[], startLine: number): number {
  const open = OPEN_FENCE.exec(lines[startLine] ?? "");
  if (!open) return -1;
  const marker = open[1][0];
  const length = open[1].length;
  for (let i = startLine + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.length >= length && trimmed.split("").every((ch) => ch === marker)) return i;
  }
  return -1;
}

export function locateBases(lines: string[]): BaseRef[] {
  const refs: BaseRef[] = [];
  let line = 0;
  while (line < lines.length) {
    if (OPEN_FENCE.test(lines[line])) {
      const end = findFenceEnd(lines, line);
      if (end === -1) break;
      if (isBaseFence(lines[line])) {
        refs.push({ type: "block", startLine: line, endLine: end, yaml: lines.slice(line + 1, end).join("\n") });
      }
      line = end + 1;
      continue;
    }
    for (const match of lines[line].matchAll(EMBED)) {
      refs.push({
        type: "embed",
        line,
        from: match.index!,
        to: match.index! + match[0].length,
        linkpath: match[1].trim(),
        viewName: match[2]?.trim() || undefined,
      });
    }
    line++;
  }
  return refs;
}

/** The base the cursor is in (a code block) or on (an embed), if any. */
export function baseAtCursor(refs: BaseRef[], cursor: { line: number; ch: number }): BaseRef | null {
  const block = refs.find((r) => r.type === "block" && cursor.line >= r.startLine && cursor.line <= r.endLine);
  if (block) return block;
  const embeds = refs.filter((r): r is BaseEmbedRef => r.type === "embed" && r.line === cursor.line);
  return embeds.find((e) => cursor.ch >= e.from && cursor.ch <= e.to) ?? embeds[0] ?? null;
}

export function describeRef(ref: BaseRef): string {
  return ref.type === "block"
    ? `Inline base (line ${ref.startLine + 1})`
    : `${ref.linkpath}${ref.viewName ? ` › ${ref.viewName}` : ""} (line ${ref.line + 1})`;
}

/** Text of a ```base block holding `yaml`. */
export function formatBaseBlock(yaml: string): string {
  return `\`\`\`base\n${yaml.trimEnd()}\n\`\`\``;
}

/** Text of an embed of a .base file, optionally pinned to one view. */
export function formatBaseEmbed(fileName: string, viewName?: string): string {
  return `![[${fileName}${viewName ? `#${viewName}` : ""}]]`;
}
