import { computeFenceLineKinds } from "./formatMarkdown";
import { buildMarkStyle } from "./highlightMark";

// Content must start and end with a character that is neither "=" (so a run of
// "=" characters, as in a setext heading underline like "====", can never match)
// nor whitespace (matching CommonMark/Obsidian's flanking-delimiter rule, so
// "a == b and c == d" - plain prose using "==" as a comparison operator - isn't
// mistaken for a highlight spanning " b and c ").
const HIGHLIGHT_PATTERN = /==([^=\s](?:.*?[^=\s])?)==/g;

// A line that is entirely "=" characters (optionally padded with whitespace) is
// a setext heading underline (e.g. "====" under a title), never a highlight.
// This is a defense-in-depth guard alongside HIGHLIGHT_PATTERN's own exclusion
// of pure "=" content.
const SETEXT_UNDERLINE_PATTERN = /^=+\s*$/;

// The Extended Markdown Syntax community plugin extends ==...== with an
// optional color tag right after the opening delimiter, e.g. =={cyan}text==.
// Migrated highlights use the migration's configured color instead (Obsidian's
// native <mark> has no equivalent color-name syntax to preserve), so this tag
// is stripped from the content rather than left as literal visible text.
const COLOR_TAG_PATTERN = /^\{[^{}]+\}/;

const INLINE_CODE_PATTERN = /`[^`\n]*`/g;

// A null-byte-delimited index is used as the inline-code placeholder. The null
// byte (\0) never legitimately appears in Markdown source, so this placeholder
// cannot collide with real line content the way a printable token could (e.g.
// a bare space-digit-space token could wrongly match an incidental number
// already present in the line, such as " 2024 ").
const PLACEHOLDER_PATTERN = /\0(\d+)\0/g;

/**
 * Replaces each single-backtick inline code span in a line with a placeholder
 * that cannot itself contain "=" characters, so highlight matching can't reach
 * into inline code. Returns the masked line plus the spans to restore.
 */
function maskInlineCode(line: string): { masked: string; spans: string[] } {
  const spans: string[] = [];
  const masked = line.replace(INLINE_CODE_PATTERN, (match) => {
    spans.push(match);
    return `\0${spans.length - 1}\0`;
  });
  return { masked, spans };
}

function unmaskInlineCode(line: string, spans: string[]): string {
  return line.replace(PLACEHOLDER_PATTERN, (_match, index: string) => spans[Number(index)]);
}

export function countHighlights(text: string): number {
  const lines = text.split("\n");
  const fenceKinds = computeFenceLineKinds(lines);
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (fenceKinds[i]) continue;
    if (SETEXT_UNDERLINE_PATTERN.test(lines[i])) continue;
    const { masked } = maskInlineCode(lines[i]);
    const matches = masked.match(HIGHLIGHT_PATTERN);
    if (matches) count += matches.length;
  }
  return count;
}

export function migrateHighlightsInText(text: string, color: string): string {
  const lines = text.split("\n");
  const fenceKinds = computeFenceLineKinds(lines);
  return lines
    .map((line, i) => {
      if (fenceKinds[i]) return line;
      if (SETEXT_UNDERLINE_PATTERN.test(line)) return line;
      const { masked, spans } = maskInlineCode(line);
      const replaced = masked.replace(HIGHLIGHT_PATTERN, (_match, content: string) => {
        const stripped = content.replace(COLOR_TAG_PATTERN, "");
        return `<mark style="${buildMarkStyle(color)}">${stripped}</mark>`;
      });
      return unmaskInlineCode(replaced, spans);
    })
    .join("\n");
}
