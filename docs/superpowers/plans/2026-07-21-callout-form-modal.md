# Callout Form Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the callout type-only picker with a form modal that lets the user specify callout type, title, and content before anything is inserted into the editor.

**Architecture:** `calloutInsertText` (in `calloutTypes.ts`) becomes a pure, fully-tested function taking `(type, title, content)` and returning the assembled callout markdown. `CalloutSuggestModal` (a `FuzzySuggestModal`) is replaced by `CalloutFormModal` (a plain `Modal`) in `calloutModal.ts`, which collects the three fields via `Setting` rows and calls `calloutInsertText` on submit. `openCalloutModal(editor, app)` keeps its exact exported signature so `registry.ts` needs no changes.

**Tech Stack:** TypeScript, Obsidian Plugin API (`Modal`, `Setting`, `TextComponent`, `TextAreaComponent`, `ButtonComponent`), Vitest.

## Global Constraints

- `openCalloutModal(editor: EditorLike, app: App): void` must keep this exact exported signature — `registry.ts` calls it for both the `callout` and `ref-callout` commands and must not need changes.
- `calloutInsertText(type: string, title = "", content = ""): string` — type falls back to `"note"` when blank/whitespace; title is trimmed and omitted from the header when blank; content is split on `\n` with each line prefixed `> `, defaulting to a single blank `> ` line when empty.
- The `obsidian` npm package (`node_modules/obsidian`) is types-only (`"main": ""`, no runtime JS) — `CalloutFormModal` cannot be imported or exercised under Vitest (`environment: "node"`, no jsdom for this test file). Do not attempt to unit-test it; verify it by running the plugin in Obsidian instead.
- Follow the existing codebase split: pure text-building logic lives in a small file and is unit-tested (see `linkText.ts`/`buildLinkText`, `embedText.ts`/`buildEmbedText`); the `Modal` subclass stays a thin UI-wiring layer and is not unit-tested (see `LinkSuggestModal`, `EmbedSuggestModal`).

---

## Task 1: Update `calloutInsertText` to accept title and content

**Files:**
- Modify: `src/ribbon/commands/actions/calloutTypes.ts:31-33`
- Test: `tests/ribbon/commands/actions/calloutTypes.test.ts`

**Interfaces:**
- Produces: `calloutInsertText(type: string, title?: string, content?: string): string` — replaces the current single-argument `calloutInsertText(type: string): string`. This is the function `CalloutFormModal` (Task 2) calls on submit.

- [ ] **Step 1: Write the failing tests**

Replace the existing second `it` block in `tests/ribbon/commands/actions/calloutTypes.test.ts` (currently lines 13-15, the `calloutInsertText builds a callout block with the given type` test) with:

```ts
  it("calloutInsertText with only a type omits the title and leaves a trailing content line", () => {
    expect(calloutInsertText("tip")).toBe("> [!tip]\n> ");
  });

  it("calloutInsertText includes a title when one is given", () => {
    expect(calloutInsertText("tip", "Heads up")).toBe("> [!tip] Heads up\n> ");
  });

  it("calloutInsertText trims a whitespace-only title down to no title", () => {
    expect(calloutInsertText("tip", "   ")).toBe("> [!tip]\n> ");
  });

  it("calloutInsertText prefixes every content line with '> '", () => {
    expect(calloutInsertText("tip", "Heads up", "line one\nline two")).toBe(
      "> [!tip] Heads up\n> line one\n> line two"
    );
  });

  it("calloutInsertText falls back to the note type when type is blank", () => {
    expect(calloutInsertText("   ", "Heads up", "content")).toBe("> [!note] Heads up\n> content");
  });

  it("calloutInsertText trims the type", () => {
    expect(calloutInsertText("  tip  ")).toBe("> [!tip]\n> ");
  });
```

The full file should now read:

```ts
import { describe, expect, it } from "vitest";
import { CALLOUT_TYPES, calloutInsertText } from "../../../../src/ribbon/commands/actions/calloutTypes";

describe("calloutTypes", () => {
  it("includes Obsidian's built-in callout types with no duplicates", () => {
    expect(CALLOUT_TYPES).toContain("note");
    expect(CALLOUT_TYPES).toContain("warning");
    expect(CALLOUT_TYPES).toContain("quote");
    expect(CALLOUT_TYPES.length).toBe(27);
    expect(new Set(CALLOUT_TYPES).size).toBe(CALLOUT_TYPES.length);
  });

  it("calloutInsertText with only a type omits the title and leaves a trailing content line", () => {
    expect(calloutInsertText("tip")).toBe("> [!tip]\n> ");
  });

  it("calloutInsertText includes a title when one is given", () => {
    expect(calloutInsertText("tip", "Heads up")).toBe("> [!tip] Heads up\n> ");
  });

  it("calloutInsertText trims a whitespace-only title down to no title", () => {
    expect(calloutInsertText("tip", "   ")).toBe("> [!tip]\n> ");
  });

  it("calloutInsertText prefixes every content line with '> '", () => {
    expect(calloutInsertText("tip", "Heads up", "line one\nline two")).toBe(
      "> [!tip] Heads up\n> line one\n> line two"
    );
  });

  it("calloutInsertText falls back to the note type when type is blank", () => {
    expect(calloutInsertText("   ", "Heads up", "content")).toBe("> [!note] Heads up\n> content");
  });

  it("calloutInsertText trims the type", () => {
    expect(calloutInsertText("  tip  ")).toBe("> [!tip]\n> ");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- calloutTypes`
Expected: FAIL — `calloutInsertText("tip")` currently returns `"> [!tip] Title\n> "`, not `"> [!tip]\n> "`, and calls with 2-3 arguments compile against the old 1-arg signature (TypeScript will error, or the extra args are silently ignored depending on `strict` settings — either way the assertions fail).

- [ ] **Step 3: Implement `calloutInsertText`**

Replace lines 31-33 of `src/ribbon/commands/actions/calloutTypes.ts`:

```ts
export function calloutInsertText(type: string, title = "", content = ""): string {
  const resolvedType = type.trim() || "note";
  const trimmedTitle = title.trim();
  const header = trimmedTitle ? `> [!${resolvedType}] ${trimmedTitle}` : `> [!${resolvedType}]`;
  const lines = content.length > 0 ? content.split("\n") : [""];
  const body = lines.map((line) => `> ${line}`).join("\n");
  return `${header}\n${body}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- calloutTypes`
Expected: PASS — all 7 tests in `calloutTypes.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/calloutTypes.ts tests/ribbon/commands/actions/calloutTypes.test.ts
git commit -m "feat: let calloutInsertText build a title and content, not just a type"
```

---

## Task 2: Replace the callout type picker with a form modal

**Files:**
- Modify: `src/ribbon/commands/actions/calloutModal.ts` (full rewrite)

**Interfaces:**
- Consumes: `calloutInsertText(type: string, title?: string, content?: string): string` and `CALLOUT_TYPES: readonly string[]` from `./calloutTypes` (Task 1). `EditorLike` from `./types` — uses `editor.somethingSelected()`, `editor.getSelection()`, `editor.replaceSelection(text)`, `editor.focus()`.
- Produces: `openCalloutModal(editor: EditorLike, app: App): void` — same exported name and signature as before; `registry.ts` requires no changes.

- [ ] **Step 1: Replace the modal implementation**

Replace the entire contents of `src/ribbon/commands/actions/calloutModal.ts`:

```ts
import { App, Modal, Setting } from "obsidian";
import type { EditorLike } from "./types";
import { CALLOUT_TYPES, calloutInsertText } from "./calloutTypes";

const TYPE_DATALIST_ID = "ribbon-bar-callout-type-options";

class CalloutFormModal extends Modal {
  private typeInput!: HTMLInputElement;
  private titleInput!: HTMLInputElement;
  private contentInput!: HTMLTextAreaElement;

  constructor(
    app: App,
    private editor: EditorLike
  ) {
    super(app);
    this.setTitle("Insert callout");
  }

  onOpen(): void {
    const { contentEl } = this;

    const datalist = contentEl.createEl("datalist", { attr: { id: TYPE_DATALIST_ID } });
    for (const type of CALLOUT_TYPES) {
      datalist.createEl("option", { value: type });
    }

    new Setting(contentEl).setName("Type").addText((text) => {
      this.typeInput = text.inputEl;
      text.inputEl.setAttribute("list", TYPE_DATALIST_ID);
      text.setPlaceholder("note");
      text.inputEl.addEventListener("keydown", (event) => this.handleFieldKeydown(event));
    });

    new Setting(contentEl).setName("Title").addText((text) => {
      this.titleInput = text.inputEl;
      text.inputEl.addEventListener("keydown", (event) => this.handleFieldKeydown(event));
    });

    const initialContent = this.editor.somethingSelected() ? this.editor.getSelection() : "";
    new Setting(contentEl).setName("Content").addTextArea((textArea) => {
      this.contentInput = textArea.inputEl;
      textArea.setValue(initialContent);
      textArea.inputEl.addEventListener("keydown", (event) => this.handleFieldKeydown(event));
    });

    new Setting(contentEl).addButton((button) =>
      button
        .setButtonText("Insert")
        .setCta()
        .onClick(() => this.submit())
    );

    this.typeInput.focus();
  }

  private handleFieldKeydown(event: KeyboardEvent): void {
    const isTextarea = event.target instanceof HTMLTextAreaElement;
    const isSubmitCombo = event.key === "Enter" && (isTextarea ? event.ctrlKey || event.metaKey : true);
    if (!isSubmitCombo) {
      return;
    }
    event.preventDefault();
    this.submit();
  }

  private submit(): void {
    const text = calloutInsertText(this.typeInput.value, this.titleInput.value, this.contentInput.value);
    this.editor.replaceSelection(text);
    this.close();
  }

  onClose(): void {
    this.editor.focus();
  }
}

export function openCalloutModal(editor: EditorLike, app: App): void {
  new CalloutFormModal(app, editor).open();
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Run the full test suite to confirm nothing else broke**

Run: `npm test`
Expected: PASS — in particular `tests/ribbon/commands/registry.test.ts` still passes, since it only asserts `COMMAND_REGISTRY` entries `callout` and `ref-callout` have a `modal` function and no `action` (it never invokes `openCalloutModal`, so it doesn't touch `CalloutFormModal`/`Modal`/`Setting` at runtime).

- [ ] **Step 4: Commit**

```bash
git add src/ribbon/commands/actions/calloutModal.ts
git commit -m "feat: replace the callout type picker with a type/title/content form modal"
```

---

## Task 3: Manually verify in Obsidian

`CalloutFormModal` cannot be exercised by the test suite (see Global Constraints) — this task is the real verification of Task 2's behavior. Do not skip it or consider the feature done without it.

**Files:** none (build artifacts only)

- [ ] **Step 1: Build the plugin**

Run: `npm run build`
Expected: succeeds, produces/updates `main.js`, `styles.css`, `manifest.json` in the project root.

- [ ] **Step 2: Copy the build into the dev vault**

```bash
cp main.js styles.css manifest.json /Users/mfilbin/obsidian-dev-vault/.obsidian/plugins/ribbon-bar/
```

- [ ] **Step 3: Reload the plugin in Obsidian**

In the dev vault, open Settings → Community plugins, toggle "Ribbon Bar" off and back on (or use the "Reload app without saving" command) to load the new `main.js`.

- [ ] **Step 4: Exercise the golden path**

1. Open any note, place the cursor on a blank line, and trigger the "Callout" ribbon action (Insert tab or References tab).
2. Confirm a modal titled "Insert callout" opens with Type, Title, and Content fields and an Insert button, and that the Type field has focus.
3. Type `tip` in Type (confirm the datalist suggests known types as you type), `Heads up` in Title, and `Remember to save often.` in Content.
4. Click Insert. Confirm the editor now contains:
   ```
   > [!tip] Heads up
   > Remember to save often.
   ```
5. Repeat, but press Ctrl/Cmd+Enter from the Content field instead of clicking Insert — confirm it submits the same way.
6. Repeat, but press Enter from the Title field — confirm it submits (rather than doing nothing).

- [ ] **Step 5: Exercise edge cases**

1. Open the modal and click Insert with all fields empty. Confirm the result is `> [!note]\n> ` (cursor left on the trailing `> ` line).
2. Select some existing text in the editor first, then open the modal. Confirm the Content field is pre-filled with the selection, and that submitting replaces the original selection with the assembled callout.
3. Type a custom, non-listed type (e.g. `homebrew`) and submit. Confirm it's accepted verbatim: `> [!homebrew] ...`.
4. Put multiple lines in Content (press Enter inside the textarea to add a line, not to submit) and submit. Confirm every line is prefixed with `> ` in the result.

- [ ] **Step 6: Report results**

If every check in Steps 4-5 passes, the feature is verified — no commit needed for this task. If anything fails, fix the underlying code in Task 1 or Task 2's files, re-run `npm test`, rebuild, and re-verify before considering the feature complete.

---

## Self-Review Notes

- **Spec coverage:** Architecture (Task 2), `calloutTypes.ts` signature/behavior (Task 1), modal fields/datalist/selection-prefill/submit paths/focus (Task 2), out-of-scope items (not implemented, matches spec), testing section (Task 1 covers `calloutTypes.test.ts`; Task 2/3 cover the "not unit-tested, manual verification" decision explicitly). No gaps found.
- **Placeholders:** none — every step has literal code or literal shell commands.
- **Type consistency:** `calloutInsertText(type, title, content)` signature matches between Task 1's implementation and Task 2's `submit()` call. `openCalloutModal(editor: EditorLike, app: App): void` matches the spec and the original signature. `EditorLike` methods used in Task 2 (`somethingSelected`, `getSelection`, `replaceSelection`, `focus`) all exist on the interface already in `src/ribbon/commands/actions/types.ts`.
