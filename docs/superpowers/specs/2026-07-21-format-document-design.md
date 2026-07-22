# Format Document — Design

## Problem

The Layout tab has no whole-document markdown cleanup action. Notes can accumulate trailing
whitespace, inconsistent bullet markers, ragged blank-line spacing, un-aligned tables, and
ATX headings with stray trailing `#` characters, with no single action to clean all of it up
at once.

## Goal

Add a "Format Document" action to the Layout tab that reformats the whole current file in
place: whitespace cleanup, blank-line spacing normalization, bullet/heading marker
normalization, and markdown table column alignment.

## Design

### Architecture

- **`src/ribbon/commands/actions/formatMarkdown.ts`** (new) — pure text-transformation
  logic, no editor dependency. Exports several small, independently-testable functions
  (matching this codebase's existing pure-function convention: `buildTableText`,
  `calloutInsertText`, `buildLinkText`), plus a top-level `formatMarkdown(text): string`
  that composes them:
  - `stripHeadingTrailingHashes(text): string`
  - `normalizeBulletMarkers(text): string`
  - `trimTrailingWhitespace(text): string`
  - `alignTables(text): string`
  - `normalizeBlankLines(text): string`
  - `formatMarkdown(text): string`

- **`src/ribbon/commands/actions/layout.ts`** (existing) — gets a new thin wrapper,
  `formatDocument(editor: EditorLike): void`, that reads the whole document, runs it
  through `formatMarkdown`, and — only if the result actually changed — writes it back and
  restores the cursor to its original line/column, clamped to the new document bounds.

- **`src/ribbon/commands/registry.ts`** — one new entry on the Layout tab, in a new
  **"Formatting"** group: `{ id: "format-document", tab: "layout", group: "Formatting",
  icon: "sparkles", label: "Format Document", action: layout.formatDocument }`. Plain
  `action`, no popover/modal — matches how `insertTableOfContents` already works as a
  single-click whole-document action.

- **`package.json`** — adds `markdown-table` (npm, MIT, zero runtime dependencies, ESM,
  actively maintained by wooorm) as the project's first production dependency, used only
  by `alignTables`. esbuild bundles it into `main.js` like everything else except
  `obsidian`/`electron`/`@codemirror/*` (the existing `external` list in
  `esbuild.config.mjs`), so no build config changes are needed.

### The rules

**1. `stripHeadingTrailingHashes`** — ATX headings only (`# ... #`); strips trailing `#`
runs and the whitespace before them. Setext-style headings (`Title` underlined with
`===`/`---`) are out of scope — this plugin's existing heading logic
(`promoteHeading`/`demoteHeading` in `layout.ts`) is ATX-only too, so this stays consistent.

```
## Title ##   ->   ## Title
```

**2. `normalizeBulletMarkers`** — any unordered list item starting with `*` or `+` becomes
`-`, preserving its indentation. Ordered lists (`1.`) are untouched.

**3. `trimTrailingWhitespace`** — strips trailing whitespace per line, *except* a line
ending in exactly two trailing spaces (a markdown hard line-break), which is preserved
exactly.

**4. `alignTables`** — detects each contiguous pipe-table block (a row containing `|`,
immediately followed by a separator row like `|---|:---:|`). For each block:
1. Splits the header row and body rows into cells (splitting on unescaped `|`, trimming
   whitespace, dropping the leading/trailing empty strings produced by the outer pipes).
2. Reads per-column alignment from the original separator row's colons (`:---` → `l`,
   `---:` → `r`, `:---:` → `c`, plain `---` → no explicit alignment).
3. Calls `markdownTable([headerRow, ...bodyRows], { align })` from the `markdown-table`
   package to regenerate the block: properly padded cells, aligned pipes, and a correctly
   re-sized separator row (preserving the alignment markers from step 2).
4. Replaces the original block's lines with the library's output.

Multiple tables in one document are each handled independently. Cells with escaped pipes
(`\|`) are an out-of-scope edge case (uncommon, not handled specially).

**5. `normalizeBlankLines`** — walks the document as a sequence of blocks (heading /
fenced-code-block / table / "other" text / blank-run) and, between any two adjacent blocks:
- if either block is a heading, fence, or table, forces exactly one blank line between them
  (inserting one if missing);
- otherwise (two "other" blocks, e.g. consecutive paragraph/list lines with no existing
  blank line) leaves them touching;
- any existing run of blank lines anywhere is collapsed to exactly one;
- leading/trailing blank lines at the very start/end of the document are removed entirely.

Code fence *contents* still get rules 1-4 applied uniformly (no special-casing to skip
inside fences) — only rule 5's block-boundary detection treats a fence as a single unit
needing separation from its neighbors. This is a deliberate simplification accepted for
this design: formatting could theoretically alter fenced code content (e.g. trimming
meaningful trailing whitespace in a code sample), but avoids the complexity of a
fence-aware "skip" pass through every other rule.

### Frontmatter

A leading YAML frontmatter block (`--- ... ---` at the very top of the file, using the same
detection this plugin's `frontmatter.ts` already uses) is sliced off before any of the five
rules run, and reattached byte-for-byte afterward. Frontmatter content is never touched.

### Trailing newline

The final result always ends with exactly one `\n` (no trailing blank lines before it); an
empty document (or frontmatter-only document) stays empty/frontmatter-only rather than
gaining an artificial blank line.

### `formatDocument` cursor handling

Since `EditorLike` has no `getValue()`/`setValue()`, `formatDocument` reads the whole
document by joining `getLine(i)` for every line, and — only when `formatMarkdown`'s output
differs from the original — writes it back via a single `replaceRange` spanning the whole
document (`{ line: 0, ch: 0 }` to `{ line: lastLine, ch: <last line's length> }`). The
cursor's original line/column is restored afterward, clamped to the reformatted document's
new bounds (line count and that line's new length) — a best-effort restoration, not a
content-aware position mapping, per the earlier design decision that formatting always
operates on the whole file rather than a selection.

### Out of scope

- Setext headings.
- Escaped pipes (`\|`) inside table cells.
- Per-rule buttons (this ships as one combined "Format Document" action).
- Formatting a selection instead of the whole file.
- Skipping rules 1-4 inside fenced code blocks (see rule 5 above).

## Testing

- `formatMarkdown.test.ts` (new): each exported function gets focused tests for its own
  rule (including the edge cases called out above — hard-break preservation, header-only
  tables, multiple tables, frontmatter passthrough, nested/adjacent lists using mixed
  markers, blank-line collapsing vs. block-boundary insertion), plus a handful of
  integration-style tests running the full `formatMarkdown` composition over a small
  representative document.
- `layout.test.ts` (existing file, extended): `formatDocument` tests using the existing
  `createMockEditor` helper — verifies the whole-document replacement happens, that a
  no-op format (already-clean document) doesn't call `replaceRange` unnecessarily, and that
  the cursor is clamped sensibly after a format that changes line count.
- No UI component work in this feature (plain `action`, not a new Svelte component), so no
  new UI-layer testing gap is introduced.
