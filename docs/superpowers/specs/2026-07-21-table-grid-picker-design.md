# Table Grid Picker — Design

## Problem

The "Table" ribbon action (`insertTable` in `src/ribbon/commands/actions/insert.ts`)
currently inserts a fixed 2-column, 1-row markdown table (`| Column 1 | Column 2 |`
header, `Cell`/`Cell` body) with no way to choose a size before insertion.

## Goal

Clicking the Table button should open a Word-style grid picker: hover over the grid to
preview an R×C table size, click to insert a table of that shape at the cursor.

## Design

### Architecture

Add a new `grid` command type alongside the existing `action`/`options`/`modal` types on
`CommandEntry`, and a new `TablePicker.svelte` component that reuses `Dropdown.svelte`'s
existing toggle/portal/outside-click machinery — that component already solves "popover
anchored under a ribbon button, escaping the ribbon panel's horizontal-scroll overflow
clipping," so `TablePicker` mirrors that pattern rather than inventing a new one. Table
markdown construction stays a pure, tested function, consistent with the existing split
between pure text builders (`calloutInsertText`, `buildLinkText`, `buildEmbedText`) and
thin UI-wiring layers.

### `tableText.ts` (new file)

```ts
buildTableText(columns: number, rows: number): string
```

Builds a markdown table: `columns` empty header cells (`| | | |`), a `---` separator row
matching the column count, and `rows - 1` empty body rows. The `rows` parameter is the
picker's row selection interpreted as *total table rows including the header* — e.g.
`buildTableText(3, 4)` produces 1 header row + 3 empty body rows:

```
| | | |
| --- | --- | --- |
| | | |
| | | |
| | | |
```

A 1-row selection (`buildTableText(n, 1)`) produces a header-only table (header + separator,
zero body rows) — a valid edge case, not specially rejected.

Cells are always empty (no "Column 1"/"Cell" placeholder text) — the picker is for laying
out shape, not templating content.

### `insert.ts`

Remove `insertTable`. Add:

```ts
insertTableGrid(editor: EditorLike, columns: number, rows: number): void
```

Records the cursor position, inserts `buildTableText(columns, rows)` via
`editor.replaceSelection`, then selects the single placeholder space that makes up the
first header cell's content — from `{ line: cursor.line, ch: cursor.ch + 1 }` to
`{ line: cursor.line, ch: cursor.ch + 2 }` — so the first keystroke after insertion starts
naming column 1. This mirrors the existing "select the placeholder" convention already used
by `wrapSelection` (`helpers.ts`) elsewhere in this codebase.

### `registry.ts`

`CommandEntry` gains a new optional field:

```ts
grid?: (editor: EditorLike, columns: number, rows: number) => void;
```

The `table` command entry switches from `action: insertActions.insertTable` to
`grid: insertActions.insertTableGrid`.

### `TablePicker.svelte` (new file)

Same shape as `Dropdown.svelte`: a toggle `<button>` plus a popover portaled to
`document.body` and positioned via the toggle button's `getBoundingClientRect()`
(`position: fixed`), closed on outside click via a `svelte:window onclick` handler.

- Renders a fixed **10 columns × 8 rows** grid of cell elements (Word's default grid size;
  no expand-on-drag past the edge — out of scope, see below).
- Hovering a cell (a plain `onmouseenter`/`onmousemove`, no mouse button held) sets
  `hoverCol`/`hoverRow` state and highlights every cell from the top-left corner (1,1) to
  the hovered cell, inclusive.
- A label below (or above) the grid reads `"{rows} × {columns} Table"` while hovering;
  reads a neutral placeholder (e.g. "Select table size") when nothing has been hovered yet.
- Clicking a cell calls `command.grid(editor, hoverCol, hoverRow)`, closes the popover
  (`open = false`), and refocuses the editor — matching `Dropdown.choose`'s existing
  close/refocus behavior.
- Not unit-tested directly. No Svelte component in this codebase (`Button.svelte`,
  `Dropdown.svelte`, `Group.svelte`) has a direct test today, and there is no
  component-testing setup (`@testing-library/svelte` or similar) in this repo's
  dependencies — this matches that existing convention, not a gap introduced by this
  design.

### `Group.svelte`

Adds a third branch ahead of the existing two:

```
{#if command.grid}
  <TablePicker {command} {editor} />
{:else if command.options}
  <Dropdown {command} {editor} />
{:else}
  <Button {command} {editor} {app} />
{/if}
```

### `styles.css`

New rules scoped to the picker's own classes (`.ribbon-table-picker-menu`,
`.ribbon-table-picker-grid`, `.ribbon-table-picker-cell`,
`.ribbon-table-picker-cell.active`, `.ribbon-table-picker-label`), following the existing
`.ribbon-dropdown-menu` positioning conventions (fixed position, background/border/shadow
matching the rest of the plugin's popovers).

### Out of scope

- Expanding the grid past 10×8 by dragging beyond its edge (Word's "and beyond" behavior).
- A "custom size" fallback dialog for tables larger than the grid.
- Touch/mobile drag support.
- Keyboard navigation of the grid (matches `Dropdown.svelte`, which also has no keyboard
  nav today).

## Testing

- `tableText.test.ts` (new): covers `buildTableText` for various column/row counts,
  including the 1-row (header-only) edge case.
- `insert.test.ts`: the existing `insertTable` test is replaced with `insertTableGrid`
  tests — verifies the inserted table shape for a given columns/rows pair, and that the
  placeholder space in the first header cell ends up selected after insertion.
- `TablePicker.svelte` gets no direct test, per the "no Svelte component tests exist in
  this codebase" convention noted above.
