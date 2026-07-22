# Table Grid Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed 2-column, 1-row "Table" ribbon action with a Word-style grid picker popover: hover to preview an R×C table size, click to insert a table of that shape at the cursor.

**Architecture:** `buildTableText` (new, in `tableText.ts`) is a pure function building the markdown table string. `insertTableGrid` (`insert.ts`) is the thin editor-side-effect wrapper that calls it and places the cursor. `CommandEntry` gains a `grid` field alongside `action`/`options`/`modal`; the `table` registry entry uses it. `TablePicker.svelte` is a new component reusing `Dropdown.svelte`'s toggle/portal/outside-click popover pattern, rendering a fixed 10×8 grid of hoverable/clickable cells instead of a menu list. `Group.svelte` gets a new branch to render it.

**Tech Stack:** TypeScript, Svelte 5 (runes: `$state`, `$props`), Obsidian Plugin API, Vitest.

## Global Constraints

- `buildTableText(columns: number, rows: number): string` — `rows` is the *total* row count including the header: 1 header row + `columns` empty cells, 1 `---` separator row, then `rows - 1` empty body rows. Cells are always empty (no "Column N"/"Cell" placeholder text).
- `insertTableGrid(editor: EditorLike, columns: number, rows: number): void` — inserts `buildTableText(columns, rows)` at the cursor, then selects the single placeholder space making up the first header cell's content (so the first keystroke starts naming column 1).
- `CommandEntry.grid?: (editor: EditorLike, columns: number, rows: number) => void` — new field; the `table` entry uses `grid: insertActions.insertTableGrid` instead of `action: insertActions.insertTable`.
- The grid picker is a fixed **10 columns × 8 rows** — no expand-past-edge, no custom-size dialog (out of scope).
- Hover (mouse move, no button held) previews the size; click confirms. No drag-and-release requirement.
- `TablePicker.svelte` gets no direct unit test — no Svelte component in this codebase has one today, and there is no component-testing setup in this repo's dependencies. Verify it via `npm run typecheck`, `npm test` (no regressions), `npm run build`, and manual testing in Obsidian (Task 5).

---

## Task 1: `buildTableText` pure function

**Files:**
- Create: `src/ribbon/commands/actions/tableText.ts`
- Test: `tests/ribbon/commands/actions/tableText.test.ts`

**Interfaces:**
- Produces: `buildTableText(columns: number, rows: number): string` — consumed by Task 2's `insertTableGrid`.

- [ ] **Step 1: Write the failing tests**

Create `tests/ribbon/commands/actions/tableText.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildTableText } from "../../../../src/ribbon/commands/actions/tableText";

describe("tableText", () => {
  it("buildTableText builds a 2-column, 2-row table (1 header row + 1 body row)", () => {
    expect(buildTableText(2, 2)).toBe("| | |\n| --- | --- |\n| | |\n");
  });

  it("buildTableText builds a 3-column, 4-row table (1 header row + 3 body rows)", () => {
    expect(buildTableText(3, 4)).toBe("| | | |\n| --- | --- | --- |\n| | | |\n| | | |\n| | | |\n");
  });

  it("buildTableText builds a header-only table when rows is 1", () => {
    expect(buildTableText(2, 1)).toBe("| | |\n| --- | --- |\n");
  });

  it("buildTableText builds a single-column table", () => {
    expect(buildTableText(1, 3)).toBe("| |\n| --- |\n| |\n| |\n");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tableText`
Expected: FAIL — `src/ribbon/commands/actions/tableText.ts` does not exist yet, so the import fails.

- [ ] **Step 3: Implement `buildTableText`**

Create `src/ribbon/commands/actions/tableText.ts`:

```ts
export function buildTableText(columns: number, rows: number): string {
  const emptyRow = "|" + " |".repeat(columns);
  const separatorRow = "|" + " --- |".repeat(columns);
  const bodyRows = Array(rows - 1).fill(emptyRow);
  return [emptyRow, separatorRow, ...bodyRows].join("\n") + "\n";
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tableText`
Expected: PASS — all 4 tests in `tableText.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/tableText.ts tests/ribbon/commands/actions/tableText.test.ts
git commit -m "feat: add buildTableText for constructing markdown tables of a given shape"
```

---

## Task 2: `insertTableGrid` editor action

**Files:**
- Modify: `src/ribbon/commands/actions/insert.ts`
- Test: `tests/ribbon/commands/actions/insert.test.ts`

**Interfaces:**
- Consumes: `buildTableText(columns: number, rows: number): string` from `./tableText` (Task 1).
- Produces: `insertTableGrid(editor: EditorLike, columns: number, rows: number): void` — consumed by Task 3's registry wiring.
- Removes: `insertTable(editor: EditorLike): void` (no longer used anywhere — the `table` registry entry switches to `insertTableGrid` in Task 3).

- [ ] **Step 1: Write the failing tests**

In `tests/ribbon/commands/actions/insert.test.ts`, change the import list to drop `insertTable` and add `insertTableGrid`:

```ts
import {
  insertCodeBlock,
  insertHorizontalRule,
  insertImage,
  insertLink,
  insertTableGrid,
  insertTag,
} from "../../../../src/ribbon/commands/actions/insert";
```

Replace the existing `insertTable inserts a 2-column markdown table` test (currently the block that calls `insertTable(editor)` and checks for `"| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |\n"`) with:

```ts
  it("insertTableGrid inserts a table of the given shape at the cursor", () => {
    const editor = createMockEditor("");
    insertTableGrid(editor, 3, 4);
    expect(editor.getValue()).toBe("| | | |\n| --- | --- | --- |\n| | | |\n| | | |\n| | | |\n");
  });

  it("insertTableGrid selects the placeholder space in the first header cell", () => {
    const editor = createMockEditor("");
    insertTableGrid(editor, 2, 2);
    expect(editor.getSelection()).toBe(" ");
  });
```

The full file should now read:

```ts
import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import {
  insertCodeBlock,
  insertHorizontalRule,
  insertImage,
  insertLink,
  insertTableGrid,
  insertTag,
} from "../../../../src/ribbon/commands/actions/insert";

describe("Insert tab actions", () => {
  it("insertLink wraps a selection as a markdown link", () => {
    const editor = createMockEditor("site");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 4 });
    insertLink(editor);
    expect(editor.getValue()).toBe("[site](url)");
  });

  it("insertLink inserts a placeholder link when nothing is selected", () => {
    const editor = createMockEditor("");
    insertLink(editor);
    expect(editor.getValue()).toBe("[link text](url)");
    expect(editor.getSelection()).toBe("link text");
  });

  it("insertImage inserts an image template at the cursor", () => {
    const editor = createMockEditor("");
    insertImage(editor);
    expect(editor.getValue()).toBe("![alt text](url)");
  });

  it("insertTableGrid inserts a table of the given shape at the cursor", () => {
    const editor = createMockEditor("");
    insertTableGrid(editor, 3, 4);
    expect(editor.getValue()).toBe("| | | |\n| --- | --- | --- |\n| | | |\n| | | |\n| | | |\n");
  });

  it("insertTableGrid selects the placeholder space in the first header cell", () => {
    const editor = createMockEditor("");
    insertTableGrid(editor, 2, 2);
    expect(editor.getSelection()).toBe(" ");
  });

  it("insertHorizontalRule inserts a rule", () => {
    const editor = createMockEditor("");
    insertHorizontalRule(editor);
    expect(editor.getValue()).toBe("\n---\n");
  });

  it("insertCodeBlock wraps a selection in a fenced code block", () => {
    const editor = createMockEditor("const x = 1;");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 13 });
    insertCodeBlock(editor);
    expect(editor.getValue()).toBe("```\nconst x = 1;\n```");
  });

  it("insertCodeBlock inserts a placeholder fenced block and selects the placeholder", () => {
    const editor = createMockEditor("");
    insertCodeBlock(editor);
    expect(editor.getValue()).toBe("```\ncode\n```");
    expect(editor.getSelection()).toBe("code");
  });

  it("insertTag inserts a placeholder tag and selects it", () => {
    const editor = createMockEditor("");
    insertTag(editor);
    expect(editor.getValue()).toBe("#tag");
    expect(editor.getSelection()).toBe("tag");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- insert.test`
Expected: FAIL — `insertTableGrid` is not exported from `insert.ts` yet (import error).

- [ ] **Step 3: Implement `insertTableGrid` and remove `insertTable`**

Replace the contents of `src/ribbon/commands/actions/insert.ts`:

```ts
import type { EditorLike } from "./types";
import { insertAtCursor, wrapSelection } from "./helpers";
import { buildTableText } from "./tableText";

export const insertLink = (editor: EditorLike): void => wrapSelection(editor, "[", "](url)", "link text");

export function insertImage(editor: EditorLike): void {
  insertAtCursor(editor, "![alt text](url)");
}

export function insertTableGrid(editor: EditorLike, columns: number, rows: number): void {
  const cursor = editor.getCursor();
  editor.replaceSelection(buildTableText(columns, rows));
  editor.setSelection({ line: cursor.line, ch: cursor.ch + 1 }, { line: cursor.line, ch: cursor.ch + 2 });
}

export function insertHorizontalRule(editor: EditorLike): void {
  insertAtCursor(editor, "\n---\n");
}

export function insertCodeBlock(editor: EditorLike): void {
  const cursor = editor.getCursor();
  if (editor.somethingSelected()) {
    const selected = editor.getSelection();
    editor.replaceSelection(`\`\`\`\n${selected}\n\`\`\``);
    return;
  }
  editor.replaceSelection("```\ncode\n```");
  editor.setSelection({ line: cursor.line + 1, ch: 0 }, { line: cursor.line + 1, ch: 4 });
}

export const insertTag = (editor: EditorLike): void => wrapSelection(editor, "#", "", "tag");
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- insert.test`
Expected: PASS — all 7 tests in `insert.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/insert.ts tests/ribbon/commands/actions/insert.test.ts
git commit -m "feat: replace fixed insertTable with insertTableGrid(editor, columns, rows)"
```

---

## Task 3: Wire the `grid` command type into the registry

**Files:**
- Modify: `src/ribbon/commands/registry.ts:18-27` (interface), `:148` (table entry)
- Test: `tests/ribbon/commands/registry.test.ts`

**Interfaces:**
- Consumes: `insertTableGrid(editor: EditorLike, columns: number, rows: number): void` from `./actions/insert` (Task 2).
- Produces: `CommandEntry.grid?: (editor: EditorLike, columns: number, rows: number) => void` — consumed by Task 4's `Group.svelte`.

- [ ] **Step 1: Write the failing tests**

In `tests/ribbon/commands/registry.test.ts`, replace the `"every command is either a direct action, a modal, or a non-empty set of options"` test with:

```ts
  it("every command is either a direct action, a modal, a grid picker, or a non-empty set of options", () => {
    for (const entry of COMMAND_REGISTRY) {
      if (entry.options) {
        expect(entry.options.length).toBeGreaterThan(0);
        for (const option of entry.options) {
          expect(typeof option.action).toBe("function");
        }
      } else if (entry.modal) {
        expect(typeof entry.modal).toBe("function");
      } else if (entry.grid) {
        expect(typeof entry.grid).toBe("function");
      } else {
        expect(typeof entry.action).toBe("function");
      }
    }
  });
```

Add a new test right after the existing `"embed command opens the embed modal instead of a direct action"` test:

```ts
  it("table command opens the grid picker instead of a direct action", () => {
    const table = COMMAND_REGISTRY.find((entry) => entry.id === "table");
    expect(table?.grid).toBeTypeOf("function");
    expect(table?.action).toBeUndefined();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- registry.test`
Expected: FAIL — `entry.grid` doesn't exist on the type yet (TypeScript will flag it, or at runtime `table?.grid` is `undefined` and `table?.action` is still the old `insertTable` function, so the new assertions fail).

- [ ] **Step 3: Add the `grid` field and wire the `table` entry**

In `src/ribbon/commands/registry.ts`, add a `grid` field to `CommandEntry` (after the existing `modal` field, lines 18-27):

```ts
export interface CommandEntry {
  id: string;
  tab: TabId;
  group: string;
  icon: string;
  label: string;
  action?: (editor: EditorLike) => void;
  options?: CommandOption[];
  modal?: (editor: EditorLike, app: App) => void;
  grid?: (editor: EditorLike, columns: number, rows: number) => void;
}
```

Change the `table` entry (line 148) from:

```ts
  { id: "table", tab: "insert", group: "Tables", icon: "table", label: "Table", action: insertActions.insertTable },
```

to:

```ts
  { id: "table", tab: "insert", group: "Tables", icon: "table", label: "Table", grid: insertActions.insertTableGrid },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- registry.test`
Expected: PASS — all tests in `registry.test.ts` green.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests pass (no regressions in other files that reference `CommandEntry` or `insertActions`), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/ribbon/commands/registry.ts tests/ribbon/commands/registry.test.ts
git commit -m "feat: add grid command type, wire Table to insertTableGrid"
```

---

## Task 4: `TablePicker.svelte` grid popover

**Files:**
- Create: `src/ribbon/components/TablePicker.svelte`
- Modify: `src/ribbon/components/Group.svelte`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `CommandEntry` (with `.grid`) and `EditorLike` from `../commands/registry` / `../commands/actions/types`; the `icon` action exported from `./Button.svelte` (`export function icon(node: HTMLElement, iconId: string)`); calls `command.grid(editor, columns, rows)` on cell click.
- Produces: the `TablePicker` Svelte component, rendered by `Group.svelte` whenever `command.grid` is set.

- [ ] **Step 1: Create `TablePicker.svelte`**

Create `src/ribbon/components/TablePicker.svelte`:

```svelte
<script lang="ts">
  import type { CommandEntry } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import { icon } from "./Button.svelte";

  let { command, editor }: { command: CommandEntry; editor: EditorLike | null } = $props();

  const GRID_COLUMNS = 10;
  const GRID_ROWS = 8;

  let open = $state(false);
  let menuStyle = $state("");
  let hoverCol = $state(0);
  let hoverRow = $state(0);
  let toggleEl: HTMLButtonElement | undefined = $state();
  let menuEl: HTMLDivElement | undefined = $state();
  const rootId = `ribbon-table-picker-${command.id}`;

  // Same overflow-escape rationale as Dropdown.svelte: the ribbon panel scrolls
  // horizontally, which clips vertical overflow of descendants, so the popover is
  // portaled to <body> and positioned via the toggle button's viewport rect.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  function toggleOpen() {
    open = !open;
    if (open && toggleEl) {
      const rect = toggleEl.getBoundingClientRect();
      menuStyle = `position: fixed; top: ${rect.bottom + 2}px; left: ${rect.left}px;`;
      hoverCol = 0;
      hoverRow = 0;
    }
  }

  function hover(col: number, row: number) {
    hoverCol = col;
    hoverRow = row;
  }

  function choose(col: number, row: number) {
    if (editor && command.grid) {
      command.grid(editor, col, row);
      editor.focus();
    }
    open = false;
  }

  function handleWindowClick(event: MouseEvent) {
    if (!(event.target instanceof Node)) return;
    const root = document.getElementById(rootId);
    const clickedRoot = root?.contains(event.target) ?? false;
    const clickedMenu = menuEl?.contains(event.target) ?? false;
    if (!clickedRoot && !clickedMenu) open = false;
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="ribbon-dropdown" id={rootId}>
  <button
    class="ribbon-button"
    type="button"
    title={command.label}
    aria-label={command.label}
    disabled={!editor}
    onclick={toggleOpen}
    bind:this={toggleEl}
  >
    <span class="ribbon-button-icon" use:icon={command.icon}></span>
    <span class="ribbon-button-label">{command.label} ▾</span>
  </button>
  {#if open}
    <div class="ribbon-table-picker-menu" style={menuStyle} use:portal bind:this={menuEl}>
      <div class="ribbon-table-picker-grid">
        {#each Array.from({ length: GRID_ROWS }) as _, rowIndex (rowIndex)}
          {#each Array.from({ length: GRID_COLUMNS }) as _, colIndex (colIndex)}
            {@const row = rowIndex + 1}
            {@const col = colIndex + 1}
            <button
              type="button"
              class="ribbon-table-picker-cell"
              class:active={col <= hoverCol && row <= hoverRow}
              aria-label={`${row} × ${col} table`}
              onmouseenter={() => hover(col, row)}
              onclick={() => choose(col, row)}
            ></button>
          {/each}
        {/each}
      </div>
      <div class="ribbon-table-picker-label">
        {hoverCol > 0 && hoverRow > 0 ? `${hoverRow} × ${hoverCol} Table` : "Select table size"}
      </div>
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Wire it into `Group.svelte`**

Replace the contents of `src/ribbon/components/Group.svelte`:

```svelte
<script lang="ts">
  import type { App } from "obsidian";
  import type { CommandEntry } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import Button from "./Button.svelte";
  import Dropdown from "./Dropdown.svelte";
  import TablePicker from "./TablePicker.svelte";

  let {
    label,
    commands,
    editor,
    app,
  }: { label: string; commands: CommandEntry[]; editor: EditorLike | null; app: App } = $props();
</script>

<div class="ribbon-group">
  <div class="ribbon-group-buttons">
    {#each commands as command (command.id)}
      {#if command.grid}
        <TablePicker {command} {editor} />
      {:else if command.options}
        <Dropdown {command} {editor} />
      {:else}
        <Button {command} {editor} {app} />
      {/if}
    {/each}
  </div>
  <div class="ribbon-group-label">{label}</div>
</div>
```

- [ ] **Step 3: Add grid picker styles**

Append to `styles.css` (after the existing `.ribbon-bar-callout-content` rule at the end of the file):

```css
.ribbon-table-picker-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: var(--layer-menu);
  margin: 2px 0 0;
  padding: 8px;
  background-color: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  box-shadow: var(--shadow-s);
}

.ribbon-table-picker-grid {
  display: grid;
  grid-template-columns: repeat(10, 16px);
  grid-template-rows: repeat(8, 16px);
  gap: 2px;
}

.ribbon-table-picker-cell {
  width: 16px;
  height: 16px;
  padding: 0;
  background-color: var(--background-modifier-hover);
  border: 1px solid var(--background-modifier-border);
  border-radius: 2px;
  cursor: pointer;
  box-shadow: none;
}

.ribbon-table-picker-cell.active {
  background-color: var(--interactive-accent);
  border-color: var(--interactive-accent);
}

.ribbon-table-picker-label {
  margin-top: 6px;
  font-size: var(--font-ui-smaller);
  color: var(--text-muted);
  text-align: center;
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Run the full test suite to confirm nothing else broke**

Run: `npm test`
Expected: PASS — no regressions. There is no direct test for `TablePicker.svelte` (see Global Constraints) or for `Group.svelte`/`Dropdown.svelte`/`Button.svelte`, which have none today either.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: succeeds (pre-existing Svelte `state_referenced_locally` warnings in unrelated files are expected and not a regression — see the callout-modal plan's Task 3 for context; do not attempt to fix them here).

- [ ] **Step 7: Commit**

```bash
git add src/ribbon/components/TablePicker.svelte src/ribbon/components/Group.svelte styles.css
git commit -m "feat: add TablePicker grid popover for the Table ribbon action"
```

---

## Task 5: Manually verify in Obsidian

`TablePicker.svelte` cannot be exercised by the test suite (see Global Constraints) — this task is the real verification of Task 4's behavior. Do not skip it or consider the feature done without it.

**Files:** none (build artifacts only)

- [ ] **Step 1: Build the plugin**

Run: `npm run build`
Expected: succeeds, updates `main.js`, `styles.css`, `manifest.json` in the project root.

- [ ] **Step 2: Copy the build into the dev vault**

```bash
cp main.js styles.css manifest.json /Users/mfilbin/obsidian-dev-vault/.obsidian/plugins/ribbon-bar/
```

- [ ] **Step 3: Reload the plugin in Obsidian**

In the dev vault, open Settings → Community plugins, toggle "Ribbon Bar" off and back on (or use "Reload app without saving") to load the new `main.js`.

- [ ] **Step 4: Exercise the golden path**

1. Open any note, place the cursor on a blank line, and click the "Table" button on the Insert tab.
2. Confirm a grid popover opens directly below the button, showing a 10×8 grid of empty cells.
3. Move the mouse over the grid (without clicking) and confirm cells highlight from the top-left corner out to the hovered cell, and a label below the grid reads e.g. "3 × 4 Table" (rows × columns) as you hover different cells.
4. Click a cell at, say, column 4 / row 3. Confirm the popover closes and the editor now contains:
   ```
   | | | | |
   | --- | --- | --- | --- |
   | | | | |
   | | | | |
   ```
5. Confirm the cursor/selection lands on the placeholder space in the first header cell, ready to type a column name immediately.

- [ ] **Step 5: Exercise edge cases**

1. Open the picker and click without moving the mouse first (i.e. click immediately at whatever the toggle button's default position leaves you over, or move to the very first cell and click it). Confirm a 1×1 selection produces a table with just a header and separator row (no body rows).
2. Open the picker, hover to the far corner (column 10, row 8), and click. Confirm a 10-column, 8-row table is inserted without error.
3. Open the picker and click outside the popover (elsewhere in the note). Confirm the popover closes with no table inserted.
4. Open the picker twice in a row. Confirm the hover/label state resets (no stale highlight from the previous open) each time it opens.

- [ ] **Step 6: Report results**

If every check in Steps 4-5 passes, the feature is verified — no commit needed for this task. If anything fails or looks visually off (e.g. cell sizing, spacing, label placement), fix the underlying code in Task 4's files, re-run `npm test` and `npm run typecheck`, rebuild, and re-verify before considering the feature complete.

---

## Self-Review Notes

- **Spec coverage:** Architecture (Task 4 component + Task 1/2 pure/effect split), `buildTableText` behavior including the header-only edge case (Task 1), `insertTableGrid` cursor/selection placement (Task 2), `CommandEntry.grid` field and registry wiring (Task 3), 10×8 fixed grid / hover-to-preview / click-to-confirm interaction (Task 4), out-of-scope items (not implemented, matches spec: no expand-past-edge, no custom-size dialog, no touch support, no keyboard nav), testing section (Task 1/2/3 automated tests; Task 4/5 manual verification, matching the "no Svelte component tests" convention). No gaps found.
- **Placeholders:** none — every step has literal code, literal shell commands, or a concrete manual-verification checklist.
- **Type consistency:** `buildTableText(columns: number, rows: number): string` matches between Task 1's implementation and Task 2's call site. `insertTableGrid(editor: EditorLike, columns: number, rows: number): void` matches between Task 2's implementation, Task 3's registry wiring (`grid: insertActions.insertTableGrid`), and Task 4's `command.grid(editor, col, row)` call. `CommandEntry.grid?: (editor: EditorLike, columns: number, rows: number) => void` matches between Task 3's interface change and Task 4's usage in `TablePicker.svelte`.
