# Internal Link Search Modal — Design

## Summary

Clicking the "Internal Link" button in either the Insert or References ribbon currently inserts a hardcoded `[[note name]]` placeholder via `insertInternalLink` (`wrapSelection(editor, "[[", "]]", "note name")`). This feature replaces that with an Obsidian search modal that lets the user find a note by name (or create a new one) before the link is inserted, following the same `modal`-kind interaction pattern established by the callout type picker.

## Goals

- Clicking "Internal Link" (Insert tab) or "Internal Link" (References tab) opens a search modal listing vault markdown files, fuzzy-filtered as the user types.
- Choosing a file inserts a wiki-link to it at the cursor (or replacing the selection).
- If the typed query doesn't exactly match an existing file, a "Create new note" suggestion appears; choosing it inserts a link to the not-yet-existing note without creating the file (it's created later, on click-through — matching Obsidian's native unresolved-link behavior).
- If text was selected when the button was clicked, that text becomes the link's display alias: `[[target|selected text]]`.
- Canceling the modal (Esc / click-away) inserts nothing and returns focus to the editor.

## Non-goals

- No settings-tab configuration for this modal.
- No preview pane / backlink count / file metadata in the picker — plain filename list (folder path shown only to disambiguate, see below).
- No change to how any other ribbon command works.
- Not unit-testable end-to-end (see Testing) — same constraint as the callout modal, since it imports the real `obsidian` package.

## Architecture

### Reuse the existing `modal` interaction kind

`CommandEntry.modal?: (editor: EditorLike, app: App) => void` and the `App`-threading chain (`main.ts` → `RibbonManager` → `RibbonBar.svelte` → ... → `Button.svelte`) already exist from the callout modal work — no new plumbing required. `Button.svelte` already special-cases `command.modal` by not calling `editor.focus()` immediately after invoking it.

### New file: `linkText.ts` (pure, no `obsidian` import)

The `obsidian` npm package ships types only (`"main": ""` in its `package.json` — no runtime JS), so any module that imports from `"obsidian"` at the top level cannot be loaded under vitest. This is why the callout modal's real implementation ended up with only `calloutTypes.test.ts` (a plain data/logic file) and no test for `calloutModal.ts` itself, despite that feature's design doc proposing one. This design follows the pattern that actually works: pure logic goes in an `obsidian`-free file.

`src/ribbon/commands/actions/linkText.ts`:

```ts
export function buildLinkText(target: string, alias: string | null): string {
  return alias ? `[[${target}|${alias}]]` : `[[${target}]]`;
}
```

### New file: `linkModal.ts`

`src/ribbon/commands/actions/linkModal.ts`. `FuzzySuggestModal<T>` can't represent a synthetic "create new note" row alongside real files, so this extends `SuggestModal<T>` directly with a discriminated union item type and does its own fuzzy filtering via Obsidian's exported `prepareFuzzySearch`:

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

    const matches: LinkSuggestion[] = trimmed
      ? files
          .map((file) => ({ file, result: prepareFuzzySearch(trimmed)(file.basename) }))
          .filter((entry): entry is { file: TFile; result: NonNullable<typeof entry.result> } => entry.result !== null)
          .sort((a, b) => b.result.score - a.result.score)
          .map((entry) => ({ type: "file" as const, file: entry.file }))
      : files.map((file) => ({ type: "file" as const, file }));

    const results = matches.slice(0, RESULT_LIMIT);

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

Notes:
- `alias` is captured at open time (before the modal steals focus/selection state), matching how the callout modal captures `editor` up front.
- Folder path is rendered as secondary text only to help disambiguate same-named files across folders — it is not part of the fuzzy match target (matching stays basename-only, consistent with how users think of note names).
- `fileToLinktext` performs Obsidian's own shortest-unique-path resolution, so `[[Note]]` is only used when unambiguous within the vault.
- `onChooseSuggestion` uses `editor.replaceSelection` directly (not the `insertAtCursor` helper, which is just an alias for the same call) — the plain-insert and replace-selection cases are literally the same call in the `EditorLike` interface; no branching on `alias` is needed for the insert itself, only for whether `buildLinkText` adds `|alias`.

### Registry changes

`registry.ts` defines a local `openInternalLink(editor, app)` wrapper that dynamically imports `linkModal.ts` and calls `openLinkModal`, mirroring the existing `openCallout` wrapper (keeps the `obsidian` `SuggestModal` import out of the eagerly-loaded bundle):
- `internal-link` entry (Insert tab): replace `action: insertActions.insertInternalLink` with `modal: openInternalLink`.
- `ref-internal-link` entry (References tab): same replacement.
- Remove `insertInternalLink` from `insert.ts` — confirmed only referenced by these two registry entries and by `tests/ribbon/commands/actions/insert.test.ts`.

## Testing

- Unit: `linkText.ts`'s `buildLinkText` — no-alias and with-alias cases — tested directly since it has no `obsidian` import, matching how `calloutTypes.test.ts` tests `calloutTypes.ts`. `linkModal.ts` itself is not unit-tested, same as `calloutModal.ts` today.
- Manual (per project convention — tests alone have missed real bugs before): open the vault, click Internal Link in Insert tab with no selection, verify modal opens, search filters the file list, choosing a file inserts a correct wiki-link and returns focus to the editor; repeat with a text selection to verify the alias form; type a name with no match and choose "Create new note" to verify the raw-name link is inserted and no file is created; verify Esc cancels cleanly; repeat for the References tab's Internal Link button; verify duplicate basenames in different folders resolve to disambiguated paths.

## Files touched

- `src/ribbon/commands/registry.ts` — `internal-link`/`ref-internal-link` entries switch to `modal: openLinkModal` via lazy import, same wrapper pattern as `openCallout`.
- `src/ribbon/commands/actions/insert.ts` — remove `insertInternalLink`.
- `src/ribbon/commands/actions/linkText.ts` — new, pure `buildLinkText` helper.
- `src/ribbon/commands/actions/linkModal.ts` — new.
- `tests/ribbon/commands/actions/insert.test.ts` — remove its `insertInternalLink` test case.
- `tests/ribbon/commands/actions/linkText.test.ts` — new, tests `buildLinkText`.
