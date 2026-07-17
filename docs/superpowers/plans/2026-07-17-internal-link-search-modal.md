# Internal Link Search Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `[[note name]]` placeholder inserted by the "Internal Link" ribbon button with a search modal that lets the user find an existing note or create a new one, then inserts a correctly-formatted wiki-link.

**Architecture:** Reuse the existing `modal`-kind `CommandEntry` interaction (already wired end-to-end for the callout picker: `App` is threaded from `main.ts` through `RibbonManager` into every Svelte component down to `Button.svelte`, which special-cases `command.modal` by not stealing focus back immediately). Add a pure `linkText.ts` helper (no `obsidian` import, so it's unit-testable) plus a `linkModal.ts` that extends Obsidian's `SuggestModal<T>` directly (not `FuzzySuggestModal`, which can't represent a synthetic "create new note" row) and does its own fuzzy filtering via `prepareFuzzySearch`.

**Tech Stack:** TypeScript, Obsidian Plugin API (`obsidian` npm package — types only, no runtime JS, so files importing it cannot be loaded under vitest), Vitest for unit tests.

## Global Constraints

- The `obsidian` npm package has `"main": ""` in its `package.json` — it is types-only. Any file that imports from `"obsidian"` at module scope cannot be loaded by vitest. Pure logic must live in a separate file with zero `obsidian` imports to be unit-testable.
- Selection at button-click time becomes the link alias: `[[target|selected text]]`. No selection: `[[target]]`.
- Existing files resolve their link target via `app.metadataCache.fileToLinktext(file, sourcePath)` (Obsidian's own shortest-unique-path resolution — disambiguates same-basename files in different folders).
- A "create new note" suggestion is offered whenever the trimmed query is non-empty and doesn't exactly (case-insensitive) match an existing file's basename. Choosing it inserts `[[<typed name>]]` (or with alias) without creating the file.
- Canceling the modal (Esc / click-away) inserts nothing and returns focus to the editor.
- Both the Insert tab's `internal-link` entry and the References tab's `ref-internal-link` entry in `registry.ts` open the same modal, mirroring how `callout`/`ref-callout` already share `openCallout`.
- `insertInternalLink` (old hardcoded-wrap implementation) is deleted from `insert.ts` along with its test case in `insert.test.ts`, once nothing references it.

---

### Task 1: `linkText.ts` pure link-text helper

**Files:**
- Create: `src/ribbon/commands/actions/linkText.ts`
- Test: `tests/ribbon/commands/actions/linkText.test.ts`

**Interfaces:**
- Produces: `buildLinkText(target: string, alias: string | null): string` — used by Task 2's `linkModal.ts`.

- [ ] **Step 1: Write the failing test**

Create `tests/ribbon/commands/actions/linkText.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildLinkText } from "../../../../src/ribbon/commands/actions/linkText";

describe("linkText", () => {
  it("buildLinkText wraps the target in double brackets with no alias", () => {
    expect(buildLinkText("My Note", null)).toBe("[[My Note]]");
  });

  it("buildLinkText adds a pipe-separated alias when given one", () => {
    expect(buildLinkText("My Note", "display text")).toBe("[[My Note|display text]]");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- linkText`
Expected: FAIL — `Cannot find module '../../../../src/ribbon/commands/actions/linkText'` (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/ribbon/commands/actions/linkText.ts`:

```ts
export function buildLinkText(target: string, alias: string | null): string {
  return alias ? `[[${target}|${alias}]]` : `[[${target}]]`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- linkText`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/linkText.ts tests/ribbon/commands/actions/linkText.test.ts
git commit -m "feat: add buildLinkText helper for internal link modal"
```

---

### Task 2: `linkModal.ts` search-and-create modal

**Files:**
- Create: `src/ribbon/commands/actions/linkModal.ts`

**Interfaces:**
- Consumes: `buildLinkText(target: string, alias: string | null): string` from Task 1's `src/ribbon/commands/actions/linkText.ts`; `EditorLike` from `./types` (has `getSelection()`, `somethingSelected()`, `replaceSelection(text: string)`, `focus()` — see `src/ribbon/commands/actions/types.ts:6-18`).
- Produces: `openLinkModal(editor: EditorLike, app: App): void` — used by Task 3's `registry.ts` wrapper.

This file imports from `"obsidian"` at module scope, so it is **not** unit-tested (per Global Constraints). It's verified via `npm run typecheck` (type-checks against Obsidian's `.d.ts` without executing it) and later via manual testing in Task 5.

- [ ] **Step 1: Write the implementation**

Create `src/ribbon/commands/actions/linkModal.ts`:

```ts
import { App, SuggestModal, TFile, prepareFuzzySearch } from "obsidian";
import type { EditorLike } from "./types";
import { buildLinkText } from "./linkText";

type LinkSuggestion = { type: "file"; file: TFile } | { type: "create"; name: string };

const RESULT_LIMIT = 20;

class LinkSuggestModal extends SuggestModal<LinkSuggestion> {
  constructor(
    app: App,
    private editor: EditorLike,
    private alias: string | null
  ) {
    super(app);
    this.setPlaceholder("Find or create a note...");
  }

  getSuggestions(query: string): LinkSuggestion[] {
    const files = this.app.vault.getMarkdownFiles();
    const trimmed = query.trim();

    let fileSuggestions: LinkSuggestion[];
    if (trimmed) {
      const search = prepareFuzzySearch(trimmed);
      fileSuggestions = files
        .map((file) => ({ file, result: search(file.basename) }))
        .filter(
          (entry): entry is { file: TFile; result: NonNullable<typeof entry.result> } => entry.result !== null
        )
        .sort((a, b) => b.result.score - a.result.score)
        .map((entry) => ({ type: "file" as const, file: entry.file }));
    } else {
      fileSuggestions = files.map((file) => ({ type: "file" as const, file }));
    }

    const results = fileSuggestions.slice(0, RESULT_LIMIT);

    const exactMatch = files.some((file) => file.basename.toLowerCase() === trimmed.toLowerCase());
    if (trimmed && !exactMatch) {
      results.push({ type: "create", name: trimmed });
    }

    return results;
  }

  renderSuggestion(item: LinkSuggestion, el: HTMLElement): void {
    if (item.type === "create") {
      el.createEl("div", { text: `Create new note: "${item.name}"` });
      return;
    }
    el.createEl("div", { text: item.file.basename });
    if (item.file.parent && !item.file.parent.isRoot()) {
      el.createEl("small", { text: item.file.parent.path, cls: "ribbon-bar-link-modal-path" });
    }
  }

  onChooseSuggestion(item: LinkSuggestion): void {
    const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
    const target =
      item.type === "file" ? this.app.metadataCache.fileToLinktext(item.file, sourcePath) : item.name;
    this.editor.replaceSelection(buildLinkText(target, this.alias));
    this.editor.focus();
  }

  onClose(): void {
    this.editor.focus();
  }
}

export function openLinkModal(editor: EditorLike, app: App): void {
  const alias = editor.somethingSelected() ? editor.getSelection() : null;
  new LinkSuggestModal(app, editor, alias).open();
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (This file has no existing importers yet, so it type-checks in isolation; Task 3 wires it in.)

- [ ] **Step 3: Commit**

```bash
git add src/ribbon/commands/actions/linkModal.ts
git commit -m "feat: add internal link search-and-create modal"
```

---

### Task 3: Wire the modal into the command registry

**Files:**
- Modify: `src/ribbon/commands/registry.ts:36-40` (add wrapper near existing `openCallout`), `src/ribbon/commands/registry.ts:118-125` (`internal-link` entry), `src/ribbon/commands/registry.ts:221-228` (`ref-internal-link` entry)

**Interfaces:**
- Consumes: `openLinkModal(editor: EditorLike, app: App): void` from Task 2's `src/ribbon/commands/actions/linkModal.ts`.

- [ ] **Step 1: Add the lazy-import wrapper**

In `src/ribbon/commands/registry.ts`, immediately after the existing `openCallout` function (currently at lines 36-40):

```ts
function openCallout(editor: EditorLike, app: App): void {
  void import("./actions/calloutModal")
    .then((module) => module.openCalloutModal(editor, app))
    .catch((error) => console.error("Ribbon Bar: failed to open callout modal", error));
}

function openInternalLink(editor: EditorLike, app: App): void {
  void import("./actions/linkModal")
    .then((module) => module.openLinkModal(editor, app))
    .catch((error) => console.error("Ribbon Bar: failed to open internal link modal", error));
}
```

- [ ] **Step 2: Replace the `internal-link` entry's action with the modal**

Find (around line 118-125):

```ts
  {
    id: "internal-link",
    tab: "insert",
    group: "Links",
    icon: "file-symlink",
    label: "Internal Link",
    action: insertActions.insertInternalLink,
  },
```

Replace with:

```ts
  {
    id: "internal-link",
    tab: "insert",
    group: "Links",
    icon: "file-symlink",
    label: "Internal Link",
    modal: openInternalLink,
  },
```

- [ ] **Step 3: Replace the `ref-internal-link` entry's action with the modal**

Find (around line 221-228):

```ts
  {
    id: "ref-internal-link",
    tab: "references",
    group: "Links",
    icon: "file-symlink",
    label: "Internal Link",
    action: insertActions.insertInternalLink,
  },
```

Replace with:

```ts
  {
    id: "ref-internal-link",
    tab: "references",
    group: "Links",
    icon: "file-symlink",
    label: "Internal Link",
    modal: openInternalLink,
  },
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the still-present `insertInternalLink` test in `insert.test.ts` (it isn't removed until Task 4) — `insertInternalLink` still exists in `insert.ts` at this point, only unused by the registry now.

- [ ] **Step 6: Commit**

```bash
git add src/ribbon/commands/registry.ts
git commit -m "feat: open internal link modal from the Insert and References tabs"
```

---

### Task 4: Remove the old hardcoded `insertInternalLink`

**Files:**
- Modify: `src/ribbon/commands/actions/insert.ts:5`
- Modify: `tests/ribbon/commands/actions/insert.test.ts:1-33`

**Interfaces:**
- None — this task only deletes now-dead code confirmed unreferenced after Task 3.

- [ ] **Step 1: Confirm no remaining references**

Run: `grep -rn "insertInternalLink" src tests`
Expected: only `src/ribbon/commands/actions/insert.ts:5` (the definition) and `tests/ribbon/commands/actions/insert.test.ts` (its test/import). If anything else shows up, stop and investigate before deleting.

- [ ] **Step 2: Remove the function from `insert.ts`**

In `src/ribbon/commands/actions/insert.ts`, delete line 5:

```ts
export const insertInternalLink = (editor: EditorLike): void => wrapSelection(editor, "[[", "]]", "note name");
```

(Leave `insertLink` on line 4 and everything below untouched.)

- [ ] **Step 3: Remove its test case and import**

In `tests/ribbon/commands/actions/insert.test.ts`, remove `insertInternalLink` from the import list (lines 3-11) and delete this test block (lines 28-33):

```ts
  it("insertInternalLink wraps a selection in double brackets", () => {
    const editor = createMockEditor("My Note");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 7 });
    insertInternalLink(editor);
    expect(editor.getValue()).toBe("[[My Note]]");
  });

```

The import block should read:

```ts
import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import {
  insertCodeBlock,
  insertHorizontalRule,
  insertImage,
  insertLink,
  insertTable,
  insertTag,
} from "../../../../src/ribbon/commands/actions/insert";
```

- [ ] **Step 4: Run the full test suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests pass, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/insert.ts tests/ribbon/commands/actions/insert.test.ts
git commit -m "chore: remove superseded insertInternalLink placeholder action"
```

---

### Task 5: Manual verification in Obsidian

**Files:** none (manual QA only — no code changes). Per project convention, automated tests alone have missed real bugs before; this feature is not unit-testable end-to-end since `linkModal.ts` imports the real `obsidian` package.

- [ ] **Step 1: Build the plugin**

Run: `npm run build`
Expected: builds cleanly, produces `main.js`.

- [ ] **Step 2: Load the built plugin in a real Obsidian vault**

Copy/symlink the built plugin folder into the test vault's `.obsidian/plugins/`, reload Obsidian (or use the existing dev workflow already used for prior features in this repo), enable the plugin if not already enabled.

- [ ] **Step 3: Verify Insert tab — no selection**

Open a note, place the cursor with nothing selected, click "Internal Link" in the Insert tab ribbon. Confirm: modal opens with a search box; typing filters the list by fuzzy match on filename; choosing an existing file inserts `[[<name>]]` at the cursor and returns focus to the editor.

- [ ] **Step 4: Verify selection becomes the alias**

Select some text in the editor, click "Internal Link", choose a file. Confirm the inserted text is `[[<name>|<selected text>]]` and the original selection is replaced.

- [ ] **Step 5: Verify "create new note" flow**

Click "Internal Link", type a name that matches no existing file, confirm a "Create new note" suggestion appears at the bottom of the list, choose it, confirm `[[<typed name>]]` is inserted and no new file was created in the vault (check the file explorer).

- [ ] **Step 6: Verify duplicate-basename disambiguation**

Create two notes with the same filename in different folders (e.g. `FolderA/Notes.md` and `FolderB/Notes.md`). Click "Internal Link", search for "Notes", choose one of the two. Confirm the inserted link includes enough path to disambiguate (not a bare `[[Notes]]` that would be ambiguous), matching Obsidian's own shortest-unique-path convention.

- [ ] **Step 7: Verify cancel**

Click "Internal Link", press Esc. Confirm nothing is inserted and the editor regains focus (cursor still where it was).

- [ ] **Step 8: Repeat for the References tab**

Switch to the References tab, click its "Internal Link" button, repeat steps 3 and 7 to confirm the same modal opens and behaves identically.

- [ ] **Step 9: Report results**

Note any discrepancies from the expected behavior above before considering this feature complete.
