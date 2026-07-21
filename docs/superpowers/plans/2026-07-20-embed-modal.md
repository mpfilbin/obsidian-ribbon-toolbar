# Embed (Transclusion) Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Embed" ribbon command (Insert tab, Media group) that opens a search modal for transcluding any vault file — or a specific heading/block within a note — as an Obsidian `![[target]]` embed.

**Architecture:** A new `EmbedSuggestModal` (Obsidian `SuggestModal`) parses its query on the first `#` to switch between three suggestion modes: whole-file search (`app.vault.getFiles()`), heading search within a resolved note (`metadataCache.getFileCache(file).headings`), and block-reference search with an async content preview (`vault.cachedRead`, cached per-file). A pure `buildEmbedText` helper builds the final `![[target]]` / `![[target|alias]]` string. The command is wired into the existing `registry.ts` using the `modal` interaction kind already added for the Callout picker — no new plumbing in `Button.svelte`/`RibbonManager`/`main.ts` is needed.

**Tech Stack:** TypeScript (strict), Obsidian Plugin API (`obsidian` npm package types), Vitest.

## Global Constraints

- Design doc: `docs/superpowers/specs/2026-07-20-embed-modal-design.md` — follow it exactly; this plan implements it task-by-task.
- `tsconfig.json` has `strict: true` and `noImplicitAny: true` — no `any`, no implicit-any params.
- Project convention (see `linkModal.ts`, `calloutModal.ts`): modal classes that need a real Obsidian `App`/DOM are **not** unit-tested; only pure helper functions (`linkText.ts`, `calloutTypes.ts`) get `*.test.ts` files. `embedModal.ts` follows this — verify it with `npm run typecheck`, not a new test file.
- Reuse the existing (currently unstyled, pre-existing) CSS class `ribbon-bar-link-modal-path` for all small-text subtitles in the embed modal, rather than introducing a new undefined class — matches `linkModal.ts`'s existing usage.
- No `vault.create()` call for the "create new note" suggestion — inserting a link to a not-yet-existing note is standard Obsidian unresolved-link behavior, same as `linkModal.ts`.
- Run `npm test` and `npm run typecheck` after every task; both must pass before committing.

---

### Task 1: `buildEmbedText` helper

**Files:**
- Create: `src/ribbon/commands/actions/embedText.ts`
- Test: `tests/ribbon/commands/actions/embedText.test.ts`

**Interfaces:**
- Produces: `buildEmbedText(target: string, alias: string | null): string` — used by Task 2.

- [ ] **Step 1: Write the failing test**

Create `tests/ribbon/commands/actions/embedText.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildEmbedText } from "../../../../src/ribbon/commands/actions/embedText";

describe("embedText", () => {
  it("buildEmbedText wraps the target in bang-double-brackets with no alias", () => {
    expect(buildEmbedText("My Note", null)).toBe("![[My Note]]");
  });

  it("buildEmbedText adds a pipe-separated alias when given one", () => {
    expect(buildEmbedText("My Note", "display text")).toBe("![[My Note|display text]]");
  });

  it("buildEmbedText works for heading targets", () => {
    expect(buildEmbedText("My Note#Section", null)).toBe("![[My Note#Section]]");
  });

  it("buildEmbedText works for block reference targets", () => {
    expect(buildEmbedText("My Note#^abc123", null)).toBe("![[My Note#^abc123]]");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ribbon/commands/actions/embedText.test.ts`
Expected: FAIL — `Cannot find module '../../../../src/ribbon/commands/actions/embedText'` (or similar module-not-found error).

- [ ] **Step 3: Write minimal implementation**

Create `src/ribbon/commands/actions/embedText.ts`:

```ts
export function buildEmbedText(target: string, alias: string | null): string {
  return alias ? `![[${target}|${alias}]]` : `![[${target}]]`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ribbon/commands/actions/embedText.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/embedText.ts tests/ribbon/commands/actions/embedText.test.ts
git commit -m "feat: add buildEmbedText helper for embed modal"
```

---

### Task 2: `EmbedSuggestModal` and `openEmbedModal`

**Files:**
- Create: `src/ribbon/commands/actions/embedModal.ts`

**Interfaces:**
- Consumes: `buildEmbedText(target: string, alias: string | null): string` (Task 1); `EditorLike` from `src/ribbon/commands/actions/types.ts` (has `getSelection()`, `replaceSelection(text)`, `somethingSelected()`, `focus()`).
- Produces: `openEmbedModal(editor: EditorLike, app: App): void` — consumed by Task 3's registry wiring.

This is one cohesive file (a single class implementing `SuggestModal`'s abstract methods plus its private helpers) — it can't be meaningfully split into smaller reviewable units without leaving the class non-compiling in between, so it's written in full in one step per the design doc.

- [ ] **Step 1: Write `embedModal.ts`**

Create `src/ribbon/commands/actions/embedModal.ts`:

```ts
import { App, SuggestModal, TFile, prepareFuzzySearch } from "obsidian";
import type { CachedMetadata } from "obsidian";
import type { EditorLike } from "./types";
import { buildEmbedText } from "./embedText";

type EmbedSuggestion =
  | { type: "file"; file: TFile }
  | { type: "heading"; file: TFile; heading: string }
  | { type: "block"; file: TFile; blockId: string; preview: string }
  | { type: "create"; name: string };

const RESULT_LIMIT = 20;

class EmbedSuggestModal extends SuggestModal<EmbedSuggestion> {
  private blockContentCache: { file: TFile; lines: string[] } | null = null;

  constructor(
    app: App,
    private editor: EditorLike,
    private alias: string | null
  ) {
    super(app);
    this.setPlaceholder("Find a file, or type Note# for headings, Note#^ for blocks...");
  }

  getSuggestions(query: string): EmbedSuggestion[] | Promise<EmbedSuggestion[]> {
    const hashIndex = query.indexOf("#");
    if (hashIndex === -1) {
      return this.getFileSuggestions(query);
    }
    const filePart = query.slice(0, hashIndex).trim();
    const fragmentPart = query.slice(hashIndex + 1);
    return this.getFragmentSuggestions(filePart, fragmentPart);
  }

  private getFileSuggestions(query: string): EmbedSuggestion[] {
    const files = this.app.vault.getFiles();
    const trimmed = query.trim();

    let fileSuggestions: EmbedSuggestion[];
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

  private async getFragmentSuggestions(filePart: string, fragmentPart: string): Promise<EmbedSuggestion[]> {
    const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
    const file = filePart
      ? this.app.metadataCache.getFirstLinkpathDest(filePart, sourcePath)
      : this.app.workspace.getActiveFile();

    if (!file || file.extension !== "md") {
      return [];
    }

    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache) {
      return [];
    }

    if (fragmentPart.startsWith("^")) {
      return this.getBlockSuggestions(file, cache, fragmentPart.slice(1));
    }
    return this.getHeadingSuggestions(file, cache, fragmentPart);
  }

  private getHeadingSuggestions(file: TFile, cache: CachedMetadata, headingQuery: string): EmbedSuggestion[] {
    const headings = cache.headings ?? [];
    const trimmed = headingQuery.trim();

    let matches: string[];
    if (trimmed) {
      const search = prepareFuzzySearch(trimmed);
      matches = headings
        .map((h) => ({ heading: h.heading, result: search(h.heading) }))
        .filter(
          (entry): entry is { heading: string; result: NonNullable<typeof entry.result> } => entry.result !== null
        )
        .sort((a, b) => b.result.score - a.result.score)
        .map((entry) => entry.heading);
    } else {
      matches = headings.map((h) => h.heading);
    }

    return matches.slice(0, RESULT_LIMIT).map((heading) => ({ type: "heading" as const, file, heading }));
  }

  private async getBlockSuggestions(
    file: TFile,
    cache: CachedMetadata,
    blockQuery: string
  ): Promise<EmbedSuggestion[]> {
    const blocks = cache.blocks ?? {};
    const ids = Object.keys(blocks);
    if (ids.length === 0) {
      return [];
    }

    if (!this.blockContentCache || this.blockContentCache.file !== file) {
      const content = await this.app.vault.cachedRead(file);
      this.blockContentCache = { file, lines: content.split("\n") };
    }
    const lines = this.blockContentCache.lines;

    const candidates = ids.map((id) => ({
      id,
      preview: lines[blocks[id].position.start.line]?.trim() ?? "",
    }));

    const trimmed = blockQuery.trim();
    let matches: { id: string; preview: string }[];
    if (trimmed) {
      const search = prepareFuzzySearch(trimmed);
      matches = candidates
        .map((c) => ({ ...c, result: search(c.id) }))
        .filter(
          (entry): entry is { id: string; preview: string; result: NonNullable<typeof entry.result> } =>
            entry.result !== null
        )
        .sort((a, b) => b.result.score - a.result.score);
    } else {
      matches = candidates;
    }

    return matches
      .slice(0, RESULT_LIMIT)
      .map((c) => ({ type: "block" as const, file, blockId: c.id, preview: c.preview }));
  }

  renderSuggestion(item: EmbedSuggestion, el: HTMLElement): void {
    if (item.type === "create") {
      el.createEl("div", { text: `Create new note: "${item.name}"` });
      return;
    }
    if (item.type === "file") {
      const displayName = item.file.extension === "md" ? item.file.basename : item.file.name;
      el.createEl("div", { text: displayName });
      if (item.file.parent && !item.file.parent.isRoot()) {
        el.createEl("small", { text: item.file.parent.path, cls: "ribbon-bar-link-modal-path" });
      }
      return;
    }
    if (item.type === "heading") {
      el.createEl("div", { text: item.heading });
      el.createEl("small", { text: item.file.basename, cls: "ribbon-bar-link-modal-path" });
      return;
    }
    el.createEl("div", { text: `^${item.blockId}` });
    el.createEl("small", { text: item.preview, cls: "ribbon-bar-link-modal-path" });
  }

  onChooseSuggestion(item: EmbedSuggestion): void {
    const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
    let target: string;
    switch (item.type) {
      case "file":
        target = this.app.metadataCache.fileToLinktext(item.file, sourcePath);
        break;
      case "heading":
        target = `${this.app.metadataCache.fileToLinktext(item.file, sourcePath)}#${item.heading}`;
        break;
      case "block":
        target = `${this.app.metadataCache.fileToLinktext(item.file, sourcePath)}#^${item.blockId}`;
        break;
      case "create":
        target = item.name;
        break;
    }
    this.editor.replaceSelection(buildEmbedText(target, this.alias));
    this.editor.focus();
  }

  onClose(): void {
    this.editor.focus();
  }
}

export function openEmbedModal(editor: EditorLike, app: App): void {
  const alias = editor.somethingSelected() ? editor.getSelection() : null;
  new EmbedSuggestModal(app, editor, alias).open();
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0, no errors (in particular, no `any`/implicit-any complaints and no missing-abstract-method errors for `EmbedSuggestModal`).

- [ ] **Step 3: Run full test suite (regression check)**

Run: `npm test`
Expected: all existing tests plus Task 1's `embedText.test.ts` pass; no tests reference `embedModal.ts` yet.

- [ ] **Step 4: Commit**

```bash
git add src/ribbon/commands/actions/embedModal.ts
git commit -m "feat: add embed search-and-create modal"
```

---

### Task 3: Wire "Embed" into the ribbon registry

**Files:**
- Modify: `src/ribbon/commands/registry.ts`
- Modify: `tests/ribbon/commands/registry.test.ts`

**Interfaces:**
- Consumes: `openEmbedModal(editor: EditorLike, app: App): void` (Task 2), lazy-imported the same way `openCallout`/`openInternalLink` already are in this file.
- Produces: a `COMMAND_REGISTRY` entry with `id: "embed"` — nothing downstream depends on this beyond the UI/tests in this task.

- [ ] **Step 1: Add the lazy-loader function**

In `src/ribbon/commands/registry.ts`, immediately after the existing `openInternalLink` function (around line 46), add:

```ts
function openEmbed(editor: EditorLike, app: App): void {
  void import("./actions/embedModal")
    .then((module) => module.openEmbedModal(editor, app))
    .catch((error) => console.error("Ribbon Bar: failed to open embed modal", error));
}
```

- [ ] **Step 2: Add the registry entry**

In the `// Insert` section of `COMMAND_REGISTRY`, immediately after the `image` entry (around line 133), add:

```ts
  {
    id: "embed",
    tab: "insert",
    group: "Media",
    icon: "layout-template",
    label: "Embed",
    modal: openEmbed,
  },
```

- [ ] **Step 3: Write the failing registry test**

In `tests/ribbon/commands/registry.test.ts`, add a new test immediately after the existing `"callout commands open the callout type modal instead of a direct action"` test (after line 44):

```ts
  it("embed command opens the embed modal instead of a direct action", () => {
    const embed = COMMAND_REGISTRY.find((entry) => entry.id === "embed");
    expect(embed?.modal).toBeTypeOf("function");
    expect(embed?.action).toBeUndefined();
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, including the new test. (It should pass immediately since Steps 1-2 already added the entry — this confirms the entry's shape is correct, matching the TDD-for-regression-tests pattern used for `registry.test.ts`'s other assertions.)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/ribbon/commands/registry.ts tests/ribbon/commands/registry.test.ts
git commit -m "feat: wire Embed command into the Insert tab ribbon"
```

---

### Task 4: Manual verification in the dev vault

**Files:** none (no code changes — this task is pure verification, per [[project_manual_verification_essential]]).

- [ ] **Step 1: Build and reload the plugin**

Run: `npm run build`
Then reload the plugin in the dev vault at `/Users/mfilbin/obsidian-dev-vault/.obsidian/plugins/ribbon-bar` (copy `main.js`, `manifest.json`, `styles.css` if the build doesn't already output there, then use Obsidian's "Reload app without saving" command, or disable/re-enable the plugin in Settings).

- [ ] **Step 2: Verify whole-file embed across file types**

In the dev vault, open a note, place the cursor, click the ribbon's Insert tab → Media group → **Embed**. Confirm:
- The modal opens with placeholder text and focus in the search box (no stray focus in the editor).
- Typing a note's name shows it in results; choosing it inserts `![[NoteName]]` and Obsidian renders the transcluded note content.
- Typing an image's name (if the dev vault has one) shows and embeds it as `![[image.png]]`, rendering the image.
- If the vault has a PDF or `.canvas` file, confirm it appears in results (with its extension shown) and embeds correctly.

- [ ] **Step 3: Verify heading embed**

Type `SomeNote#` (a real note name in the dev vault) followed by part of a heading's text. Confirm the suggestion list narrows to that note's headings only. Choose one; confirm `![[SomeNote#Heading Text]]` is inserted and Obsidian renders just that section.

- [ ] **Step 4: Verify block reference embed**

In a dev-vault note, add a line ending in a block ID, e.g. `Some paragraph text. ^my-block`, and save. In the Embed modal, type `SomeNote#^` followed by part of the block ID. Confirm the suggestion shows `^my-block` with the paragraph text as its preview subtitle. Choose it; confirm `![[SomeNote#^my-block]]` is inserted and renders just that block.

- [ ] **Step 5: Verify current-file heading embed**

With the cursor in a note that has headings, type `#` followed by part of one of that same note's heading names (no file part). Confirm it resolves against the active file and inserts `![[#Heading Text]]`.

- [ ] **Step 6: Verify alias behavior**

Select some text in the editor, then open the Embed modal and choose any suggestion (file, heading, or block). Confirm the inserted text has the selected text as a `|alias` suffix, e.g. `![[NoteName|My Selected Text]]`.

- [ ] **Step 7: Verify cancel and create-new-note paths**

Open the Embed modal and press Esc; confirm nothing is inserted and focus returns to the editor. Open it again and type a name that matches no existing file; confirm a "Create new note: ..." option appears, and choosing it inserts `![[TypedName]]`.

- [ ] **Step 8: Report results**

If any check fails, fix the underlying code (not the test) and re-run the affected steps above before proceeding. Do not mark this task complete until all seven checks pass in the real Obsidian dev vault.
