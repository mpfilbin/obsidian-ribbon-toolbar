# Embed (Transclusion) Modal — Design

## Summary

Add an "Embed" command to the Insert tab's Media group that opens a search modal for transcluding content from another file — a note (whole file or a specific heading/block within it), an image, a PDF, a canvas, or an audio/video file — using Obsidian's `![[target]]` embed syntax.

## Goals

- Clicking "Embed" opens a `SuggestModal` that searches every file in the vault (any type), not just markdown notes.
- Typing `Note#` narrows the search to that note's headings; typing `Note#^` narrows it to that note's block references (with a content preview).
- Typing `#Heading` (no file part) searches headings in the currently active file.
- Choosing a result inserts `![[target]]`, or `![[target|alias]]` if text was selected in the editor before opening the modal (alias = the selected text), matching the Internal Link modal's alias behavior.
- No exact match in file-search mode offers "Create new note: X", matching the Internal Link modal.
- Canceling the modal (Esc / click-away) inserts nothing and returns focus to the editor.

## Non-goals

- No image-size argument support (`![[image.png|300]]`) — users can hand-edit the inserted embed if they want a size. Only the alias/caption pipe segment is supported, and only because it's already alias text, not a size.
- No settings-tab configuration for this feature.
- No change to how any other ribbon command works.
- The modal itself is not unit-tested (see Testing) — this matches the project's existing convention for `linkModal.ts` and `calloutModal.ts`, which also have no test files.

## Architecture

This feature reuses the `modal` interaction kind and `App` threading added for the Callout picker — no changes needed to `Button.svelte`, `RibbonManager`, or `main.ts`.

### New file: `embedText.ts`

`src/ribbon/commands/actions/embedText.ts` — pure helper, mirrors `linkText.ts`:

```ts
export function buildEmbedText(target: string, alias: string | null): string {
  return alias ? `![[${target}|${alias}]]` : `![[${target}]]`;
}
```

### New file: `embedModal.ts`

`src/ribbon/commands/actions/embedModal.ts`. Suggestion union:

```ts
type EmbedSuggestion =
  | { type: "file"; file: TFile }
  | { type: "heading"; file: TFile; heading: string }
  | { type: "block"; file: TFile; blockId: string; preview: string }
  | { type: "create"; name: string };
```

#### Query parsing

`getSuggestions` splits the query on the first `#`:

- **No `#` → file mode.** Fuzzy search `app.vault.getFiles()` (every file in the vault, any extension) by `file.basename`, same scoring/sort/limit-to-20 pattern as `LinkSuggestModal`. Display: markdown files show `file.basename`; non-markdown files show `file.name` (with extension) to disambiguate from same-named notes of a different type. If the trimmed query doesn't exactly match any file's basename, append a `{ type: "create", name: trimmed }` suggestion.
- **`#` present → fragment mode.** Split into `filePart` (before `#`, trimmed) and `fragmentPart` (after `#`). Resolve the target file:
  ```ts
  const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
  const file = filePart
    ? this.app.metadataCache.getFirstLinkpathDest(filePart, sourcePath)
    : this.app.workspace.getActiveFile();
  ```
  If `file` is missing or not markdown (`file.extension !== "md"`), return `[]` — non-markdown files have no headings/blocks.
  - `fragmentPart` starts with `^` → **block mode**: fuzzy-match `Object.keys(cache.blocks ?? {})` against `fragmentPart.slice(1)`.
  - otherwise → **heading mode**: fuzzy-match `cache.headings ?? []` (by `.heading` text) against `fragmentPart`.

  `cache` comes from `app.metadataCache.getFileCache(file)`; if null, return `[]`.

#### Block content preview (async)

Block IDs alone aren't very readable, so block suggestions include the trimmed source line as a preview. Since that requires a file read, `getSuggestions` is `async` (Obsidian's `SuggestModal` supports `Promise<T[]>` return values) and the modal keeps a one-entry cache to avoid re-reading on every keystroke:

```ts
private blockContentCache: { file: TFile; lines: string[] } | null = null;

private async getBlockSuggestions(file: TFile, cache: CachedMetadata, blockQuery: string): Promise<EmbedSuggestion[]> {
  const blocks = cache.blocks ?? {};
  const ids = Object.keys(blocks);
  if (ids.length === 0) return [];

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
  const filtered = trimmed
    ? candidates
        .map((c) => ({ ...c, result: prepareFuzzySearch(trimmed)(c.id) }))
        .filter((c): c is typeof c & { result: NonNullable<typeof c.result> } => c.result !== null)
        .sort((a, b) => b.result.score - a.result.score)
    : candidates;

  return filtered.slice(0, RESULT_LIMIT).map((c) => ({ type: "block" as const, file, blockId: c.id, preview: c.preview }));
}
```

The cache is keyed on `file` only (not query), so it's invalidated automatically the moment the user's query targets a different file, and reused across keystrokes that narrow the same file's block search.

#### Rendering

`renderSuggestion(item, el)`:
- `file` — main text = display name (basename for `.md`, full name otherwise); small subtitle = folder path, if not vault root (same as `LinkSuggestModal`).
- `heading` — main text = heading text; small subtitle = `file.basename`.
- `block` — main text = `^${blockId}`; small subtitle = `preview`.
- `create` — `Create new note: "${name}"` (unchanged from Internal Link modal).

#### Insertion

```ts
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
```

```ts
export function openEmbedModal(editor: EditorLike, app: App): void {
  const alias = editor.somethingSelected() ? editor.getSelection() : null;
  new EmbedSuggestModal(app, editor, alias).open();
}
```

(No `vault.create()` call for the `create` suggestion — same as Internal Link, the embed simply points at a not-yet-existing note, which Obsidian resolves the standard unresolved-link way.)

### Registry changes

`registry.ts`:
- Add loader function, same lazy-import pattern as `openCallout`/`openInternalLink`:
  ```ts
  function openEmbed(editor: EditorLike, app: App): void {
    void import("./actions/embedModal")
      .then((module) => module.openEmbedModal(editor, app))
      .catch((error) => console.error("Ribbon Bar: failed to open embed modal", error));
  }
  ```
- New entry in the Insert tab's Media group, after `image`:
  ```ts
  { id: "embed", tab: "insert", group: "Media", icon: "layout-template", label: "Embed", modal: openEmbed },
  ```
  (`layout-template` is a placeholder Lucide icon choice — easy one-line swap if a better fit is found.)

## Testing

- **Unit**: `embedText.test.ts` — `buildEmbedText` with and without alias (mirrors `linkText.test.ts`).
- **Manual** (per project convention — no automated test exists for `linkModal.ts` or `calloutModal.ts` either, since both need a real Obsidian `App`/DOM): in the dev vault,
  - File-mode search across a note, an image, and a PDF/canvas; confirm `![[...]]` inserts and renders as an embed.
  - Typing `Note#` narrows to that note's headings; choosing one inserts `![[Note#Heading]]`.
  - Typing `Note#^` narrows to block refs (requires a note with an existing `^block-id` in the dev vault); confirm the preview line text and the inserted `![[Note#^id]]`.
  - `![[#Heading]]` works with no file part, targeting the active note.
  - Selecting text before opening the modal, then choosing any suggestion type, produces `![[target|alias]]`.
  - Esc cancels cleanly and returns focus to the editor.
  - An unmatched file-mode query offers "Create new note" and inserts correctly.

## Files touched

- `src/ribbon/commands/actions/embedText.ts` — new.
- `src/ribbon/commands/actions/embedModal.ts` — new.
- `src/ribbon/commands/registry.ts` — new `openEmbed` loader, new `embed` entry in Insert tab.
- `tests/ribbon/commands/actions/embedText.test.ts` — new.
