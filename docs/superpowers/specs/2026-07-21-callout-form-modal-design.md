# Callout Form Modal — Design

## Problem

The "Insert Callout" ribbon action (`callout` and `ref-callout` commands) currently opens
`CalloutSuggestModal`, a `FuzzySuggestModal` that only lets the user pick a callout type.
Choosing a type immediately inserts `> [!type] Title\n> ` at the cursor with the literal
placeholder word "Title" and an empty content line — the user must manually edit both
afterward. There is no way to specify the title or content up front.

## Goal

Let the user specify callout type, title, and content in one step before anything is
inserted into the editor.

## Design

### Architecture

Replace `CalloutSuggestModal` with `CalloutFormModal`, a plain Obsidian `Modal` (not a
`FuzzySuggestModal`) containing three fields — Type, Title, Content — and an Insert button.
This follows the existing split in the codebase between a thin, untested `Modal` class for
UI wiring and a pure, fully-tested function that builds the resulting markdown string
(mirroring `linkText.ts`/`buildLinkText` and `embedText.ts`/`buildEmbedText`).

### `calloutTypes.ts`

`calloutInsertText` gets a new signature:

```ts
calloutInsertText(type: string, title = "", content = ""): string
```

- `type`: trimmed; falls back to `"note"` if blank/whitespace-only.
- `title`: trimmed; if non-empty, appended to the header line (`> [!tip] Heads up`); if
  empty, the header has no title segment (`> [!tip]`).
- `content`: split on `\n`; each line is prefixed with `> `. If content is empty, the
  result is a single trailing `> ` line (preserves today's "ready to type" behavior).

`CALLOUT_TYPES` is unchanged and is reused as the source list for a `<datalist>` of
autocomplete suggestions in the modal.

### `calloutModal.ts`

`CalloutSuggestModal` is replaced by `CalloutFormModal extends Modal`:

- **Type field** — text input (`Setting.addText`) with a `list` attribute pointing at a
  `<datalist id="callout-type-options">` built from `CALLOUT_TYPES`. Autocompletes against
  the known types but accepts any typed value (Obsidian supports custom callout types).
- **Title field** — plain text input (`Setting.addText`).
- **Content field** — textarea (`Setting.addTextArea`). Pre-filled with
  `editor.getSelection()` when `editor.somethingSelected()` is true, matching the existing
  pattern in `linkModal.ts`/`embedModal.ts` where an active selection seeds a field.
- **Insert button** — `Setting.addButton`, CTA-styled, submits the form.
- **Focus** — the Type field receives focus when the modal opens.
- **Submit** — triggered by clicking Insert, pressing Enter in the Type or Title field, or
  pressing Ctrl/Cmd+Enter from any field (including the Content textarea, where plain Enter
  must remain a newline). On submit: call
  `editor.replaceSelection(calloutInsertText(type, title, content))`, close the modal, and
  refocus the editor.

`openCalloutModal(editor: EditorLike, app: App): void` keeps its exact exported signature —
it constructs `CalloutFormModal` instead of `CalloutSuggestModal`. No changes are needed in
`registry.ts`, which calls `openCalloutModal` for both the `callout` and `ref-callout`
commands.

### Out of scope

- Foldable callout syntax (`+`/`-` after the type).
- Nested callouts.
- Remembering the last-used type across invocations.

## Testing

- `calloutTypes.test.ts`: expand coverage for the new `calloutInsertText` signature —
  type fallback to `"note"` when blank, title omitted when blank, title included when
  present, multi-line content prefixing, and empty content producing the trailing `> `
  line.
- `CalloutFormModal` is not unit-tested directly, consistent with `LinkSuggestModal` and
  `EmbedSuggestModal` today — the vitest config runs with `environment: "node"` (no DOM),
  and UI wiring in this codebase is intentionally left to manual verification while the
  underlying text-building logic is tested in isolation.
