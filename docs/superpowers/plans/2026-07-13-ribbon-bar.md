# Ribbon Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Obsidian plugin that docks a Microsoft Office–style, four-tab
editing ribbon (Home, Insert, Layout, References) above every open Markdown editor
pane, with theme-native styling and Office-style collapse behavior.

**Architecture:** A `RibbonManager` tracks open `MarkdownView` leaves and mounts one
Svelte 5 `RibbonBar` component per leaf into a DOM host prepended to that view's
`.view-content` element (a common ancestor of Source/Live Preview/Reading modes, so
one instance covers all three). Buttons are driven by a declarative command registry
that maps `{ tab, group, icon, label, action }` entries to pure functions operating on
a minimal `EditorLike` interface, keeping formatting logic fully unit-testable without
an Obsidian runtime.

**Tech Stack:** TypeScript, Svelte 5 (runes, `mount`/`unmount`), esbuild +
esbuild-svelte, vitest (+ jsdom for one DOM-touching test file), Obsidian Plugin API.

## Global Constraints

- Desktop only: `manifest.json` sets `"isDesktopOnly": true` (per spec).
- No hardcoded colors — all ribbon styling uses Obsidian's CSS custom properties
  (`--background-secondary`, `--text-normal`, `--interactive-accent`, etc.) (per spec).
- Ribbon buttons are stateless in v1 — no "active formatting" highlighting (per spec).
- Per-pane collapse state is session-only; only `defaultCollapsed` and `ribbonEnabled`
  persist to plugin settings (per spec).
- One ribbon instance per Markdown leaf/pane, bound to that leaf's own `Editor`, not a
  single global editor reference (per spec).
- Formatting/action logic (`ribbon/commands/**`) must stay decoupled from the
  `obsidian` package at the type level (only `import type` where unavoidable) so it is
  unit-testable under vitest without an Obsidian runtime.

---

## File Structure

```
ribbon-bar/
  manifest.json
  versions.json
  package.json
  esbuild.config.mjs
  tsconfig.json
  vitest.config.ts
  styles.css                              # loaded by Obsidian automatically, no import needed
  .gitignore
  src/
    main.ts                               # Plugin entry, workspace event wiring
    settings.ts                           # RibbonBarSettings type + DEFAULT_SETTINGS (pure, no obsidian import)
    settings-tab.ts                       # PluginSettingTab UI
    plugin-contract.ts                    # RibbonBarPluginLike interface (decouples settings-tab from main.ts)
    ribbon/
      injectionPoint.ts                   # pure DOM lookup, isolated for testability
      RibbonManager.ts                    # leaf lifecycle: mount/unmount RibbonBar per leaf
      commands/
        registry.ts                       # CommandEntry/CommandOption/TabId + COMMAND_REGISTRY + TABS
        actions/
          types.ts                        # EditorPosition, EditorLike
          helpers.ts                      # wrapSelection, togglePrefix, insertAtCursor
          home.ts
          insert.ts
          layout.ts
          references.ts
      components/
        Button.svelte
        Dropdown.svelte
        Group.svelte
        RibbonPanel.svelte
        Tab.svelte
        RibbonBar.svelte
  tests/
    support/
      mockEditor.ts                       # in-memory EditorLike implementation for tests
    ribbon/
      injectionPoint.test.ts
      commands/
        registry.test.ts
        actions/
          helpers.test.ts
          home.test.ts
          insert.test.ts
          layout.test.ts
          references.test.ts
    settings.test.ts
```

---

### Task 1: Project scaffolding & build pipeline

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `vitest.config.ts`
- Create: `manifest.json`
- Create: `versions.json`
- Create: `styles.css`
- Create: `src/main.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: an npm project where `npm run build` type-checks and bundles `src/main.ts`
  to `main.js`, `npm run dev` watches, and `npm test` runs vitest. Every later task
  builds inside `src/` and `tests/` created here.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "ribbon-bar",
  "version": "0.1.0",
  "private": true,
  "description": "An Office-style multi-tab editing ribbon for Obsidian Markdown notes.",
  "type": "module",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
    "test": "vitest run"
  },
  "devDependencies": {
    "@tsconfig/svelte": "^5.0.4",
    "@types/node": "^20.14.0",
    "esbuild": "^0.21.5",
    "esbuild-svelte": "^0.8.2",
    "jsdom": "^24.1.0",
    "obsidian": "^1.5.7",
    "svelte": "^5.0.0",
    "svelte-preprocess": "^6.0.2",
    "tslib": "^2.6.3",
    "typescript": "^5.5.2",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "strict": true,
    "noImplicitAny": true,
    "skipLibCheck": true,
    "lib": ["DOM", "ES2020"],
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Write `esbuild.config.mjs`**

```js
import esbuild from "esbuild";
import esbuildSvelte from "esbuild-svelte";
import sveltePreprocess from "svelte-preprocess";
import process from "process";

const production = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*"],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  plugins: [
    esbuildSvelte({
      preprocess: sveltePreprocess(),
      compilerOptions: { css: "injected" },
    }),
  ],
});

if (production) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
```

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Write `manifest.json`**

```json
{
  "id": "ribbon-bar",
  "name": "Ribbon Bar",
  "version": "0.1.0",
  "minAppVersion": "1.5.0",
  "description": "An Office-style multi-tab editing ribbon docked above your Markdown notes.",
  "author": "Michael Filbin",
  "isDesktopOnly": true
}
```

- [ ] **Step 6: Write `versions.json`**

```json
{
  "0.1.0": "1.5.0"
}
```

- [ ] **Step 7: Write `styles.css`** (placeholder rule so the file is non-empty and loads cleanly; real rules added in Task 11)

```css
.ribbon-bar-host {
  display: block;
}
```

- [ ] **Step 8: Write `src/main.ts`**

```ts
import { Plugin } from "obsidian";

export default class RibbonBarPlugin extends Plugin {
  async onload(): Promise<void> {}

  onunload(): void {}
}
```

- [ ] **Step 9: Update `.gitignore`**

Append to the existing `.gitignore` (currently just `/.idea/`):

```
node_modules/
main.js
*.js.map
.DS_Store
```

- [ ] **Step 10: Install dependencies and verify the build**

Run: `npm install && npm run build`
Expected: completes with no errors, produces `main.js` in the project root.

Run: `npm test`
Expected: `No test files found` (vitest exits 0 since `tests/` doesn't exist yet — this is expected at this step).

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json tsconfig.json esbuild.config.mjs vitest.config.ts manifest.json versions.json styles.css src/main.ts .gitignore
git commit -m "chore: scaffold Obsidian plugin build pipeline"
```

---

### Task 2: EditorLike types, helpers, and mock editor test utility

**Files:**
- Create: `src/ribbon/commands/actions/types.ts`
- Create: `src/ribbon/commands/actions/helpers.ts`
- Create: `tests/support/mockEditor.ts`
- Test: `tests/ribbon/commands/actions/helpers.test.ts`

**Interfaces:**
- Produces: `EditorPosition { line: number; ch: number }`, `EditorLike` interface
  (`getSelection`, `replaceSelection`, `getCursor`, `setCursor`, `setSelection`,
  `somethingSelected`, `getLine`, `setLine`, `lastLine`); `wrapSelection(editor,
  before, after?, placeholder?)`, `togglePrefix(editor, prefix)`,
  `insertAtCursor(editor, text)`; `createMockEditor(text: string, cursor?:
  EditorPosition): EditorLike & { getValue(): string }`.
- Consumed by: every file under `src/ribbon/commands/actions/*.ts` (Tasks 3-6),
  `src/ribbon/commands/registry.ts` (Task 7), and every test file under
  `tests/ribbon/commands/**` (Tasks 3-7).

- [ ] **Step 1: Write `src/ribbon/commands/actions/types.ts`**

```ts
export interface EditorPosition {
  line: number;
  ch: number;
}

export interface EditorLike {
  getSelection(): string;
  replaceSelection(text: string): void;
  getCursor(from?: "from" | "to" | "head" | "anchor"): EditorPosition;
  setCursor(pos: EditorPosition): void;
  setSelection(anchor: EditorPosition, head: EditorPosition): void;
  somethingSelected(): boolean;
  getLine(line: number): string;
  setLine(line: number, text: string): void;
  lastLine(): number;
}
```

- [ ] **Step 2: Write `tests/support/mockEditor.ts`**

```ts
import type { EditorLike, EditorPosition } from "../../src/ribbon/commands/actions/types";

export function createMockEditor(
  text: string,
  cursor: EditorPosition = { line: 0, ch: 0 }
): EditorLike & { getValue(): string } {
  let lines = text.split("\n");
  let selectionFrom: EditorPosition = cursor;
  let selectionTo: EditorPosition = cursor;

  function posToOffset(pos: EditorPosition): number {
    let offset = 0;
    for (let i = 0; i < pos.line; i++) offset += lines[i].length + 1;
    return offset + pos.ch;
  }

  function offsetToPos(offset: number): EditorPosition {
    let remaining = offset;
    for (let line = 0; line < lines.length; line++) {
      if (remaining <= lines[line].length) return { line, ch: remaining };
      remaining -= lines[line].length + 1;
    }
    return { line: lines.length - 1, ch: lines[lines.length - 1].length };
  }

  return {
    getSelection() {
      const full = lines.join("\n");
      return full.slice(posToOffset(selectionFrom), posToOffset(selectionTo));
    },
    replaceSelection(replacement: string) {
      const full = lines.join("\n");
      const from = posToOffset(selectionFrom);
      const to = posToOffset(selectionTo);
      const newText = full.slice(0, from) + replacement + full.slice(to);
      lines = newText.split("\n");
      const newPos = offsetToPos(from + replacement.length);
      selectionFrom = newPos;
      selectionTo = newPos;
    },
    getCursor(from: "from" | "to" | "head" | "anchor" = "head") {
      return from === "from" || from === "anchor" ? selectionFrom : selectionTo;
    },
    setCursor(pos: EditorPosition) {
      selectionFrom = pos;
      selectionTo = pos;
    },
    setSelection(anchor: EditorPosition, head: EditorPosition) {
      selectionFrom = anchor;
      selectionTo = head;
    },
    somethingSelected() {
      return posToOffset(selectionFrom) !== posToOffset(selectionTo);
    },
    getLine(line: number) {
      return lines[line] ?? "";
    },
    setLine(line: number, text: string) {
      lines[line] = text;
    },
    lastLine() {
      return lines.length - 1;
    },
    getValue() {
      return lines.join("\n");
    },
  };
}
```

- [ ] **Step 3: Write the failing test `tests/ribbon/commands/actions/helpers.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import { insertAtCursor, togglePrefix, wrapSelection } from "../../../../src/ribbon/commands/actions/helpers";

describe("wrapSelection", () => {
  it("wraps an existing selection", () => {
    const editor = createMockEditor("hello");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 5 });
    wrapSelection(editor, "**");
    expect(editor.getValue()).toBe("**hello**");
  });

  it("inserts a placeholder and selects it when nothing is selected", () => {
    const editor = createMockEditor("");
    wrapSelection(editor, "**", "**", "bold text");
    expect(editor.getValue()).toBe("**bold text**");
    expect(editor.getSelection()).toBe("bold text");
  });
});

describe("togglePrefix", () => {
  it("adds the prefix when absent", () => {
    const editor = createMockEditor("hello");
    togglePrefix(editor, "> ");
    expect(editor.getValue()).toBe("> hello");
  });

  it("removes the prefix when present (round trip)", () => {
    const editor = createMockEditor("> hello");
    togglePrefix(editor, "> ");
    expect(editor.getValue()).toBe("hello");
  });
});

describe("insertAtCursor", () => {
  it("inserts multi-line text at the cursor", () => {
    const editor = createMockEditor("");
    insertAtCursor(editor, "---\n");
    expect(editor.getValue()).toBe("---\n");
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run tests/ribbon/commands/actions/helpers.test.ts`
Expected: FAIL — `helpers.ts` does not exist yet (module not found).

- [ ] **Step 5: Write `src/ribbon/commands/actions/helpers.ts`**

```ts
import type { EditorLike } from "./types";

export function wrapSelection(
  editor: EditorLike,
  before: string,
  after: string = before,
  placeholder: string = ""
): void {
  if (editor.somethingSelected()) {
    const selected = editor.getSelection();
    editor.replaceSelection(`${before}${selected}${after}`);
    return;
  }

  const cursor = editor.getCursor();
  editor.replaceSelection(`${before}${placeholder}${after}`);
  editor.setSelection(
    { line: cursor.line, ch: cursor.ch + before.length },
    { line: cursor.line, ch: cursor.ch + before.length + placeholder.length }
  );
}

export function togglePrefix(editor: EditorLike, prefix: string): void {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);

  if (line.startsWith(prefix)) {
    editor.setLine(cursor.line, line.slice(prefix.length));
    editor.setCursor({ line: cursor.line, ch: Math.max(0, cursor.ch - prefix.length) });
  } else {
    editor.setLine(cursor.line, `${prefix}${line}`);
    editor.setCursor({ line: cursor.line, ch: cursor.ch + prefix.length });
  }
}

export function insertAtCursor(editor: EditorLike, text: string): void {
  editor.replaceSelection(text);
}
```

> Note: `wrapSelection`'s no-selection branch does cursor math assuming `before`/`after`
> are single-line strings. It must only be used with single-line markers (`**`, `*`,
> `~~`, `==`, `` ` ``, `[`, `]]`, `#`). Multi-line markers (like code fences) need a
> bespoke implementation — see `insertCodeBlock` in Task 4.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/ribbon/commands/actions/helpers.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 7: Commit**

```bash
git add src/ribbon/commands/actions/types.ts src/ribbon/commands/actions/helpers.ts tests/support/mockEditor.ts tests/ribbon/commands/actions/helpers.test.ts
git commit -m "feat: add EditorLike types, formatting helpers, and mock editor test utility"
```

---

### Task 3: Home tab actions

**Files:**
- Create: `src/ribbon/commands/actions/home.ts`
- Test: `tests/ribbon/commands/actions/home.test.ts`

**Interfaces:**
- Consumes: `EditorLike` from `./types`, `wrapSelection`/`togglePrefix` from
  `./helpers` (Task 2), `createMockEditor` from `tests/support/mockEditor` (Task 2).
- Produces: `toggleBold`, `toggleItalic`, `toggleStrikethrough`, `toggleHighlight`,
  `toggleInlineCode`, `setHeading(level: 1 | 2 | 3): (editor: EditorLike) => void`,
  `toggleBulletList`, `toggleNumberedList`, `toggleChecklist`, `toggleBlockquote`,
  `clearFormatting` — all `(editor: EditorLike) => void` except `setHeading`, which is
  a factory. Consumed by `src/ribbon/commands/registry.ts` (Task 7).

- [ ] **Step 1: Write the failing test `tests/ribbon/commands/actions/home.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import {
  clearFormatting,
  setHeading,
  toggleBlockquote,
  toggleBold,
  toggleBulletList,
  toggleChecklist,
  toggleHighlight,
  toggleInlineCode,
  toggleItalic,
  toggleNumberedList,
  toggleStrikethrough,
} from "../../../../src/ribbon/commands/actions/home";

describe("Home tab actions", () => {
  it("toggleBold wraps the selection", () => {
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    toggleBold(editor);
    expect(editor.getValue()).toBe("**hi**");
  });

  it("toggleItalic wraps the selection", () => {
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    toggleItalic(editor);
    expect(editor.getValue()).toBe("*hi*");
  });

  it("toggleStrikethrough wraps the selection", () => {
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    toggleStrikethrough(editor);
    expect(editor.getValue()).toBe("~~hi~~");
  });

  it("toggleHighlight wraps the selection", () => {
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    toggleHighlight(editor);
    expect(editor.getValue()).toBe("==hi==");
  });

  it("toggleInlineCode wraps the selection", () => {
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    toggleInlineCode(editor);
    expect(editor.getValue()).toBe("`hi`");
  });

  it("setHeading(2) sets the current line to an H2, replacing any existing heading", () => {
    const editor = createMockEditor("# Title");
    setHeading(2)(editor);
    expect(editor.getValue()).toBe("## Title");
  });

  it("toggleBulletList prefixes the current line", () => {
    const editor = createMockEditor("item");
    toggleBulletList(editor);
    expect(editor.getValue()).toBe("- item");
  });

  it("toggleNumberedList prefixes the current line", () => {
    const editor = createMockEditor("item");
    toggleNumberedList(editor);
    expect(editor.getValue()).toBe("1. item");
  });

  it("toggleChecklist prefixes the current line", () => {
    const editor = createMockEditor("item");
    toggleChecklist(editor);
    expect(editor.getValue()).toBe("- [ ] item");
  });

  it("toggleBlockquote prefixes the current line", () => {
    const editor = createMockEditor("item");
    toggleBlockquote(editor);
    expect(editor.getValue()).toBe("> item");
  });

  it("clearFormatting strips bold/italic/strike/highlight/code markers from the selection", () => {
    const editor = createMockEditor("**bold** and *italic* and ~~gone~~ and ==hi== and `code`");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: editor.getValue().length });
    clearFormatting(editor);
    expect(editor.getValue()).toBe("bold and italic and gone and hi and code");
  });

  it("clearFormatting does nothing when there is no selection", () => {
    const editor = createMockEditor("**bold**");
    clearFormatting(editor);
    expect(editor.getValue()).toBe("**bold**");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ribbon/commands/actions/home.test.ts`
Expected: FAIL — `home.ts` does not exist yet.

- [ ] **Step 3: Write `src/ribbon/commands/actions/home.ts`**

```ts
import type { EditorLike } from "./types";
import { togglePrefix, wrapSelection } from "./helpers";

export const toggleBold = (editor: EditorLike): void => wrapSelection(editor, "**", "**", "bold text");
export const toggleItalic = (editor: EditorLike): void => wrapSelection(editor, "*", "*", "italic text");
export const toggleStrikethrough = (editor: EditorLike): void =>
  wrapSelection(editor, "~~", "~~", "strikethrough text");
export const toggleHighlight = (editor: EditorLike): void => wrapSelection(editor, "==", "==", "highlighted text");
export const toggleInlineCode = (editor: EditorLike): void => wrapSelection(editor, "`", "`", "code");

export function setHeading(level: 1 | 2 | 3): (editor: EditorLike) => void {
  return (editor: EditorLike): void => {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const stripped = line.replace(/^#{1,6} /, "");
    editor.setLine(cursor.line, `${"#".repeat(level)} ${stripped}`);
    editor.setCursor({ line: cursor.line, ch: level + 1 + stripped.length });
  };
}

export const toggleBulletList = (editor: EditorLike): void => togglePrefix(editor, "- ");
export const toggleNumberedList = (editor: EditorLike): void => togglePrefix(editor, "1. ");
export const toggleChecklist = (editor: EditorLike): void => togglePrefix(editor, "- [ ] ");
export const toggleBlockquote = (editor: EditorLike): void => togglePrefix(editor, "> ");

const FORMATTING_MARKERS = [/\*\*(.*?)\*\*/g, /\*(.*?)\*/g, /~~(.*?)~~/g, /==(.*?)==/g, /`(.*?)`/g];

export function clearFormatting(editor: EditorLike): void {
  if (!editor.somethingSelected()) return;
  let text = editor.getSelection();
  for (const pattern of FORMATTING_MARKERS) {
    text = text.replace(pattern, "$1");
  }
  editor.replaceSelection(text);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/ribbon/commands/actions/home.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/home.ts tests/ribbon/commands/actions/home.test.ts
git commit -m "feat: add Home tab formatting actions"
```

---

### Task 4: Insert tab actions

**Files:**
- Create: `src/ribbon/commands/actions/insert.ts`
- Test: `tests/ribbon/commands/actions/insert.test.ts`

**Interfaces:**
- Consumes: `EditorLike` from `./types`, `wrapSelection`/`insertAtCursor` from
  `./helpers` (Task 2).
- Produces: `insertLink`, `insertInternalLink`, `insertImage`, `insertTable`,
  `insertHorizontalRule`, `insertCodeBlock`, `insertCallout`, `insertTag` — all
  `(editor: EditorLike) => void`. Consumed by `src/ribbon/commands/registry.ts`
  (Task 7), including reuse of `insertInternalLink`, `insertTag`, `insertCallout` from
  the References tab (Task 6/7).

- [ ] **Step 1: Write the failing test `tests/ribbon/commands/actions/insert.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import {
  insertCallout,
  insertCodeBlock,
  insertHorizontalRule,
  insertImage,
  insertInternalLink,
  insertLink,
  insertTable,
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

  it("insertInternalLink wraps a selection in double brackets", () => {
    const editor = createMockEditor("My Note");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 7 });
    insertInternalLink(editor);
    expect(editor.getValue()).toBe("[[My Note]]");
  });

  it("insertImage inserts an image template at the cursor", () => {
    const editor = createMockEditor("");
    insertImage(editor);
    expect(editor.getValue()).toBe("![alt text](url)");
  });

  it("insertTable inserts a 2-column markdown table", () => {
    const editor = createMockEditor("");
    insertTable(editor);
    expect(editor.getValue()).toBe("| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |\n");
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

  it("insertCallout inserts a callout template", () => {
    const editor = createMockEditor("");
    insertCallout(editor);
    expect(editor.getValue()).toBe("> [!note] Title\n> ");
  });

  it("insertTag inserts a placeholder tag and selects it", () => {
    const editor = createMockEditor("");
    insertTag(editor);
    expect(editor.getValue()).toBe("#tag");
    expect(editor.getSelection()).toBe("tag");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ribbon/commands/actions/insert.test.ts`
Expected: FAIL — `insert.ts` does not exist yet.

- [ ] **Step 3: Write `src/ribbon/commands/actions/insert.ts`**

```ts
import type { EditorLike } from "./types";
import { insertAtCursor, wrapSelection } from "./helpers";

export const insertLink = (editor: EditorLike): void => wrapSelection(editor, "[", "](url)", "link text");
export const insertInternalLink = (editor: EditorLike): void => wrapSelection(editor, "[[", "]]", "note name");

export function insertImage(editor: EditorLike): void {
  insertAtCursor(editor, "![alt text](url)");
}

export function insertTable(editor: EditorLike): void {
  insertAtCursor(editor, "| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |\n");
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

export function insertCallout(editor: EditorLike): void {
  insertAtCursor(editor, "> [!note] Title\n> ");
}

export const insertTag = (editor: EditorLike): void => wrapSelection(editor, "#", "", "tag");
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/ribbon/commands/actions/insert.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/insert.ts tests/ribbon/commands/actions/insert.test.ts
git commit -m "feat: add Insert tab actions"
```

---

### Task 5: Layout tab actions

**Files:**
- Create: `src/ribbon/commands/actions/layout.ts`
- Test: `tests/ribbon/commands/actions/layout.test.ts`

**Interfaces:**
- Consumes: `EditorLike` from `./types` (Task 2).
- Produces: `promoteHeading`, `demoteHeading`, `indentList`, `outdentList`,
  `moveLineUp`, `moveLineDown`, `insertTableOfContents` — all
  `(editor: EditorLike) => void`. Consumed by `src/ribbon/commands/registry.ts`
  (Task 7).

- [ ] **Step 1: Write the failing test `tests/ribbon/commands/actions/layout.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import {
  demoteHeading,
  indentList,
  insertTableOfContents,
  moveLineDown,
  moveLineUp,
  outdentList,
  promoteHeading,
} from "../../../../src/ribbon/commands/actions/layout";

describe("Layout tab actions", () => {
  it("promoteHeading reduces the heading level by one", () => {
    const editor = createMockEditor("### Title");
    promoteHeading(editor);
    expect(editor.getValue()).toBe("## Title");
  });

  it("promoteHeading does nothing at level 1", () => {
    const editor = createMockEditor("# Title");
    promoteHeading(editor);
    expect(editor.getValue()).toBe("# Title");
  });

  it("promoteHeading does nothing on a non-heading line", () => {
    const editor = createMockEditor("plain text");
    promoteHeading(editor);
    expect(editor.getValue()).toBe("plain text");
  });

  it("demoteHeading increases the heading level by one", () => {
    const editor = createMockEditor("## Title");
    demoteHeading(editor);
    expect(editor.getValue()).toBe("### Title");
  });

  it("demoteHeading does nothing at level 6", () => {
    const editor = createMockEditor("###### Title");
    demoteHeading(editor);
    expect(editor.getValue()).toBe("###### Title");
  });

  it("indentList adds a leading tab", () => {
    const editor = createMockEditor("- item");
    indentList(editor);
    expect(editor.getValue()).toBe("\t- item");
  });

  it("outdentList removes a leading tab", () => {
    const editor = createMockEditor("\t- item");
    outdentList(editor);
    expect(editor.getValue()).toBe("- item");
  });

  it("outdentList removes four leading spaces when there is no tab", () => {
    const editor = createMockEditor("    - item");
    outdentList(editor);
    expect(editor.getValue()).toBe("- item");
  });

  it("moveLineUp swaps the current line with the one above", () => {
    const editor = createMockEditor("first\nsecond");
    editor.setCursor({ line: 1, ch: 0 });
    moveLineUp(editor);
    expect(editor.getValue()).toBe("second\nfirst");
  });

  it("moveLineUp does nothing on the first line", () => {
    const editor = createMockEditor("first\nsecond");
    moveLineUp(editor);
    expect(editor.getValue()).toBe("first\nsecond");
  });

  it("moveLineDown swaps the current line with the one below", () => {
    const editor = createMockEditor("first\nsecond");
    moveLineDown(editor);
    expect(editor.getValue()).toBe("second\nfirst");
  });

  it("moveLineDown does nothing on the last line", () => {
    const editor = createMockEditor("first\nsecond");
    editor.setCursor({ line: 1, ch: 0 });
    moveLineDown(editor);
    expect(editor.getValue()).toBe("first\nsecond");
  });

  it("insertTableOfContents lists headings as nested links", () => {
    const editor = createMockEditor("# Intro\ntext\n## Details\nmore text");
    editor.setCursor({ line: 3, ch: 9 });
    insertTableOfContents(editor);
    expect(editor.getValue()).toBe(
      "# Intro\ntext\n## Details\nmore text- [Intro](#intro)\n  - [Details](#details)\n"
    );
  });

  it("insertTableOfContents inserts a placeholder when there are no headings", () => {
    const editor = createMockEditor("no headings here");
    insertTableOfContents(editor);
    expect(editor.getValue()).toBe("no headings here- (no headings found)\n");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ribbon/commands/actions/layout.test.ts`
Expected: FAIL — `layout.ts` does not exist yet.

- [ ] **Step 3: Write `src/ribbon/commands/actions/layout.ts`**

```ts
import type { EditorLike } from "./types";

const HEADING_PATTERN = /^(#{1,6}) /;

export function promoteHeading(editor: EditorLike): void {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  const match = line.match(HEADING_PATTERN);
  if (!match) return;
  const level = match[1].length;
  if (level <= 1) return;
  editor.setLine(cursor.line, line.replace(HEADING_PATTERN, `${"#".repeat(level - 1)} `));
}

export function demoteHeading(editor: EditorLike): void {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  const match = line.match(HEADING_PATTERN);
  if (!match) return;
  const level = match[1].length;
  if (level >= 6) return;
  editor.setLine(cursor.line, line.replace(HEADING_PATTERN, `${"#".repeat(level + 1)} `));
}

export function indentList(editor: EditorLike): void {
  const cursor = editor.getCursor();
  editor.setLine(cursor.line, `\t${editor.getLine(cursor.line)}`);
  editor.setCursor({ line: cursor.line, ch: cursor.ch + 1 });
}

export function outdentList(editor: EditorLike): void {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  if (line.startsWith("\t")) {
    editor.setLine(cursor.line, line.slice(1));
    editor.setCursor({ line: cursor.line, ch: Math.max(0, cursor.ch - 1) });
  } else if (line.startsWith("    ")) {
    editor.setLine(cursor.line, line.slice(4));
    editor.setCursor({ line: cursor.line, ch: Math.max(0, cursor.ch - 4) });
  }
}

export function moveLineUp(editor: EditorLike): void {
  const cursor = editor.getCursor();
  if (cursor.line === 0) return;
  const current = editor.getLine(cursor.line);
  const above = editor.getLine(cursor.line - 1);
  editor.setLine(cursor.line - 1, current);
  editor.setLine(cursor.line, above);
  editor.setCursor({ line: cursor.line - 1, ch: cursor.ch });
}

export function moveLineDown(editor: EditorLike): void {
  const cursor = editor.getCursor();
  if (cursor.line >= editor.lastLine()) return;
  const current = editor.getLine(cursor.line);
  const below = editor.getLine(cursor.line + 1);
  editor.setLine(cursor.line + 1, current);
  editor.setLine(cursor.line, below);
  editor.setCursor({ line: cursor.line + 1, ch: cursor.ch });
}

function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function insertTableOfContents(editor: EditorLike): void {
  const entries: string[] = [];
  for (let line = 0; line <= editor.lastLine(); line++) {
    const match = editor.getLine(line).match(HEADING_PATTERN);
    if (!match) continue;
    const level = match[1].length;
    const text = editor.getLine(line).slice(match[0].length);
    entries.push(`${"  ".repeat(level - 1)}- [${text}](#${slugify(text)})`);
  }
  const toc = entries.length > 0 ? entries.join("\n") : "- (no headings found)";
  editor.replaceSelection(`${toc}\n`);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/ribbon/commands/actions/layout.test.ts`
Expected: PASS (14 tests)

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/layout.ts tests/ribbon/commands/actions/layout.test.ts
git commit -m "feat: add Layout tab actions"
```

---

### Task 6: References tab actions

**Files:**
- Create: `src/ribbon/commands/actions/references.ts`
- Test: `tests/ribbon/commands/actions/references.test.ts`

**Interfaces:**
- Consumes: `EditorLike` from `./types` (Task 2).
- Produces: `insertFootnote(editor: EditorLike): void`. (The References tab's other
  three buttons — Internal Link, Tag, Callout — reuse `insertInternalLink`,
  `insertTag`, `insertCallout` from `./insert`, Task 4; no new code needed for those.)
  Consumed by `src/ribbon/commands/registry.ts` (Task 7).

- [ ] **Step 1: Write the failing test `tests/ribbon/commands/actions/references.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import { insertFootnote } from "../../../../src/ribbon/commands/actions/references";

describe("insertFootnote", () => {
  it("inserts [^1] at the cursor and appends a definition on a new empty document", () => {
    const editor = createMockEditor("text");
    editor.setCursor({ line: 0, ch: 4 });
    insertFootnote(editor);
    expect(editor.getValue()).toBe("text[^1]\n\n[^1]: ");
  });

  it("picks the next unused footnote number", () => {
    const editor = createMockEditor("first[^1] second[^2]");
    editor.setCursor({ line: 0, ch: 21 });
    insertFootnote(editor);
    expect(editor.getValue()).toBe("first[^1] second[^2][^3]\n\n[^3]: ");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ribbon/commands/actions/references.test.ts`
Expected: FAIL — `references.ts` does not exist yet.

- [ ] **Step 3: Write `src/ribbon/commands/actions/references.ts`**

```ts
import type { EditorLike } from "./types";

const FOOTNOTE_PATTERN = /\[\^(\d+)\]/g;

export function insertFootnote(editor: EditorLike): void {
  let maxIndex = 0;
  for (let line = 0; line <= editor.lastLine(); line++) {
    const matches = editor.getLine(line).matchAll(FOOTNOTE_PATTERN);
    for (const match of matches) {
      maxIndex = Math.max(maxIndex, Number(match[1]));
    }
  }
  const nextIndex = maxIndex + 1;

  const cursor = editor.getCursor();
  editor.setSelection(cursor, cursor);
  editor.replaceSelection(`[^${nextIndex}]`);

  const endLine = editor.lastLine();
  const endCh = editor.getLine(endLine).length;
  editor.setSelection({ line: endLine, ch: endCh }, { line: endLine, ch: endCh });
  editor.replaceSelection(`\n\n[^${nextIndex}]: `);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/ribbon/commands/actions/references.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/actions/references.ts tests/ribbon/commands/actions/references.test.ts
git commit -m "feat: add References tab footnote action"
```

---

### Task 7: Command registry

**Files:**
- Create: `src/ribbon/commands/registry.ts`
- Test: `tests/ribbon/commands/registry.test.ts`

**Interfaces:**
- Consumes: `EditorLike` from `./actions/types` (Task 2); all action functions from
  `./actions/home` (Task 3), `./actions/insert` (Task 4), `./actions/layout` (Task 5),
  `./actions/references` (Task 6).
- Produces: `type TabId = "home" | "insert" | "layout" | "references"`;
  `interface CommandOption { id: string; label: string; action: (editor: EditorLike)
  => void }`; `interface CommandEntry { id: string; tab: TabId; group: string; icon:
  string; label: string; action?: (editor: EditorLike) => void; options?:
  CommandOption[] }` (exactly one of `action`/`options` is present); `TABS: { id:
  TabId; label: string }[]`; `COMMAND_REGISTRY: CommandEntry[]`;
  `commandsForTab(tab: TabId): CommandEntry[]`; `groupsForTab(tab: TabId): string[]`.
  Consumed by `src/ribbon/components/RibbonPanel.svelte` and
  `src/ribbon/components/RibbonBar.svelte` (Tasks 10-11).

- [ ] **Step 1: Write the failing test `tests/ribbon/commands/registry.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { COMMAND_REGISTRY, TABS, commandsForTab, groupsForTab } from "../../../src/ribbon/commands/registry";

describe("COMMAND_REGISTRY", () => {
  it("has a unique id for every command", () => {
    const ids = COMMAND_REGISTRY.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has at least one command for every tab", () => {
    for (const tab of TABS) {
      expect(commandsForTab(tab.id).length).toBeGreaterThan(0);
    }
  });

  it("every command is either a direct action or a non-empty set of options", () => {
    for (const entry of COMMAND_REGISTRY) {
      if (entry.options) {
        expect(entry.options.length).toBeGreaterThan(0);
        for (const option of entry.options) {
          expect(typeof option.action).toBe("function");
        }
      } else {
        expect(typeof entry.action).toBe("function");
      }
    }
  });

  it("groups commands within the Home tab in first-seen order", () => {
    expect(groupsForTab("home")).toEqual(["Font", "Paragraph"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ribbon/commands/registry.test.ts`
Expected: FAIL — `registry.ts` does not exist yet.

- [ ] **Step 3: Write `src/ribbon/commands/registry.ts`**

```ts
import type { EditorLike } from "./actions/types";
import * as home from "./actions/home";
import * as insertActions from "./actions/insert";
import * as layout from "./actions/layout";
import * as references from "./actions/references";

export type TabId = "home" | "insert" | "layout" | "references";

export interface CommandOption {
  id: string;
  label: string;
  action: (editor: EditorLike) => void;
}

export interface CommandEntry {
  id: string;
  tab: TabId;
  group: string;
  icon: string;
  label: string;
  action?: (editor: EditorLike) => void;
  options?: CommandOption[];
}

export const TABS: { id: TabId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "insert", label: "Insert" },
  { id: "layout", label: "Layout" },
  { id: "references", label: "References" },
];

export const COMMAND_REGISTRY: CommandEntry[] = [
  // Home
  { id: "bold", tab: "home", group: "Font", icon: "bold", label: "Bold", action: home.toggleBold },
  { id: "italic", tab: "home", group: "Font", icon: "italic", label: "Italic", action: home.toggleItalic },
  {
    id: "strikethrough",
    tab: "home",
    group: "Font",
    icon: "strikethrough",
    label: "Strikethrough",
    action: home.toggleStrikethrough,
  },
  {
    id: "highlight",
    tab: "home",
    group: "Font",
    icon: "highlighter",
    label: "Highlight",
    action: home.toggleHighlight,
  },
  { id: "inline-code", tab: "home", group: "Font", icon: "code", label: "Code", action: home.toggleInlineCode },
  {
    id: "clear-formatting",
    tab: "home",
    group: "Font",
    icon: "eraser",
    label: "Clear Formatting",
    action: home.clearFormatting,
  },
  {
    id: "heading",
    tab: "home",
    group: "Paragraph",
    icon: "heading",
    label: "Heading",
    options: [
      { id: "heading-1", label: "Heading 1", action: home.setHeading(1) },
      { id: "heading-2", label: "Heading 2", action: home.setHeading(2) },
      { id: "heading-3", label: "Heading 3", action: home.setHeading(3) },
    ],
  },
  {
    id: "bullet-list",
    tab: "home",
    group: "Paragraph",
    icon: "list",
    label: "Bulleted List",
    action: home.toggleBulletList,
  },
  {
    id: "numbered-list",
    tab: "home",
    group: "Paragraph",
    icon: "list-ordered",
    label: "Numbered List",
    action: home.toggleNumberedList,
  },
  {
    id: "checklist",
    tab: "home",
    group: "Paragraph",
    icon: "list-checks",
    label: "Checklist",
    action: home.toggleChecklist,
  },
  {
    id: "blockquote",
    tab: "home",
    group: "Paragraph",
    icon: "quote",
    label: "Quote",
    action: home.toggleBlockquote,
  },

  // Insert
  { id: "link", tab: "insert", group: "Links", icon: "link", label: "Link", action: insertActions.insertLink },
  {
    id: "internal-link",
    tab: "insert",
    group: "Links",
    icon: "file-symlink",
    label: "Internal Link",
    action: insertActions.insertInternalLink,
  },
  { id: "tag", tab: "insert", group: "Links", icon: "tag", label: "Tag", action: insertActions.insertTag },
  { id: "image", tab: "insert", group: "Media", icon: "image", label: "Image", action: insertActions.insertImage },
  { id: "table", tab: "insert", group: "Tables", icon: "table", label: "Table", action: insertActions.insertTable },
  {
    id: "code-block",
    tab: "insert",
    group: "Code",
    icon: "square-code",
    label: "Code Block",
    action: insertActions.insertCodeBlock,
  },
  {
    id: "horizontal-rule",
    tab: "insert",
    group: "Illustrations",
    icon: "minus",
    label: "Horizontal Rule",
    action: insertActions.insertHorizontalRule,
  },
  {
    id: "callout",
    tab: "insert",
    group: "Illustrations",
    icon: "message-square",
    label: "Callout",
    action: insertActions.insertCallout,
  },

  // Layout
  {
    id: "promote-heading",
    tab: "layout",
    group: "Headings",
    icon: "chevron-left",
    label: "Promote Heading",
    action: layout.promoteHeading,
  },
  {
    id: "demote-heading",
    tab: "layout",
    group: "Headings",
    icon: "chevron-right",
    label: "Demote Heading",
    action: layout.demoteHeading,
  },
  {
    id: "indent",
    tab: "layout",
    group: "Indentation",
    icon: "indent",
    label: "Indent",
    action: layout.indentList,
  },
  {
    id: "outdent",
    tab: "layout",
    group: "Indentation",
    icon: "outdent",
    label: "Outdent",
    action: layout.outdentList,
  },
  {
    id: "move-line-up",
    tab: "layout",
    group: "Arrange",
    icon: "arrow-up",
    label: "Move Line Up",
    action: layout.moveLineUp,
  },
  {
    id: "move-line-down",
    tab: "layout",
    group: "Arrange",
    icon: "arrow-down",
    label: "Move Line Down",
    action: layout.moveLineDown,
  },
  {
    id: "table-of-contents",
    tab: "layout",
    group: "Arrange",
    icon: "list-tree",
    label: "Table of Contents",
    action: layout.insertTableOfContents,
  },

  // References
  {
    id: "footnote",
    tab: "references",
    group: "Citations",
    icon: "asterisk",
    label: "Footnote",
    action: references.insertFootnote,
  },
  {
    id: "ref-internal-link",
    tab: "references",
    group: "Links",
    icon: "file-symlink",
    label: "Internal Link",
    action: insertActions.insertInternalLink,
  },
  {
    id: "ref-tag",
    tab: "references",
    group: "Links",
    icon: "tag",
    label: "Tag",
    action: insertActions.insertTag,
  },
  {
    id: "ref-callout",
    tab: "references",
    group: "Callouts",
    icon: "message-square",
    label: "Callout",
    action: insertActions.insertCallout,
  },
];

export function commandsForTab(tab: TabId): CommandEntry[] {
  return COMMAND_REGISTRY.filter((entry) => entry.tab === tab);
}

export function groupsForTab(tab: TabId): string[] {
  const groups: string[] = [];
  for (const entry of commandsForTab(tab)) {
    if (!groups.includes(entry.group)) groups.push(entry.group);
  }
  return groups;
}
```

> Note: icon names are Lucide identifiers Obsidian's `setIcon()` accepts. Verify each
> renders correctly during Task 13's manual vault check — an unrecognized id simply
> renders a blank icon (non-fatal), so treat any mismatch as a cosmetic fix, not a
> blocker.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/ribbon/commands/registry.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/commands/registry.ts tests/ribbon/commands/registry.test.ts
git commit -m "feat: add declarative command registry wiring all tab actions"
```

---

### Task 8: Settings module and settings tab UI

**Files:**
- Create: `src/settings.ts`
- Create: `src/plugin-contract.ts`
- Create: `src/settings-tab.ts`
- Test: `tests/settings.test.ts`

**Interfaces:**
- Produces: `interface RibbonBarSettings { ribbonEnabled: boolean; defaultCollapsed:
  boolean }`, `DEFAULT_SETTINGS: RibbonBarSettings` (in `settings.ts`, no `obsidian`
  import — kept pure and unit-testable); `interface RibbonBarPluginLike { settings:
  RibbonBarSettings; saveSettings(): Promise<void>; setRibbonEnabled(enabled:
  boolean): void }` (in `plugin-contract.ts`); `class RibbonBarSettingTab extends
  PluginSettingTab` (in `settings-tab.ts`, constructed as `new RibbonBarSettingTab(app,
  plugin)` where `plugin: Plugin & RibbonBarPluginLike`).
- Consumed by: `src/main.ts` (Task 13), which implements `RibbonBarPluginLike`.

- [ ] **Step 1: Write the failing test `tests/settings.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/settings";

describe("DEFAULT_SETTINGS", () => {
  it("enables the ribbon and starts expanded by default", () => {
    expect(DEFAULT_SETTINGS).toEqual({ ribbonEnabled: true, defaultCollapsed: false });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/settings.test.ts`
Expected: FAIL — `src/settings.ts` does not exist yet.

- [ ] **Step 3: Write `src/settings.ts`**

```ts
export interface RibbonBarSettings {
  ribbonEnabled: boolean;
  defaultCollapsed: boolean;
}

export const DEFAULT_SETTINGS: RibbonBarSettings = {
  ribbonEnabled: true,
  defaultCollapsed: false,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/settings.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Write `src/plugin-contract.ts`**

```ts
import type { RibbonBarSettings } from "./settings";

export interface RibbonBarPluginLike {
  settings: RibbonBarSettings;
  saveSettings(): Promise<void>;
  setRibbonEnabled(enabled: boolean): void;
}
```

- [ ] **Step 6: Write `src/settings-tab.ts`**

```ts
import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { RibbonBarPluginLike } from "./plugin-contract";

type RibbonBarPluginInstance = Plugin & RibbonBarPluginLike;

export class RibbonBarSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: RibbonBarPluginInstance) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Enable ribbon")
      .setDesc("Show the editing ribbon above Markdown panes.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.ribbonEnabled).onChange(async (value) => {
          this.plugin.settings.ribbonEnabled = value;
          await this.plugin.saveSettings();
          this.plugin.setRibbonEnabled(value);
        })
      );

    new Setting(containerEl)
      .setName("Collapse ribbon by default")
      .setDesc("New ribbons start collapsed to just the tab strip.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.defaultCollapsed).onChange(async (value) => {
          this.plugin.settings.defaultCollapsed = value;
          await this.plugin.saveSettings();
        })
      );
  }
}
```

- [ ] **Step 7: Type-check the new files**

Run: `npx tsc -noEmit -skipLibCheck`
Expected: no errors (main.ts does not yet implement `RibbonBarPluginLike` — that's
expected and fine, since nothing constructs `RibbonBarSettingTab` yet).

- [ ] **Step 8: Commit**

```bash
git add src/settings.ts src/plugin-contract.ts src/settings-tab.ts tests/settings.test.ts
git commit -m "feat: add plugin settings, contract interface, and settings tab UI"
```

---

### Task 9: Button and Dropdown Svelte components

**Files:**
- Create: `src/ribbon/components/Button.svelte`
- Create: `src/ribbon/components/Dropdown.svelte`

**Interfaces:**
- Consumes: `CommandEntry`/`CommandOption` from `../commands/registry` (Task 7),
  `EditorLike` from `../commands/actions/types` (Task 2).
- Produces: `Button.svelte` — props `{ command: CommandEntry; editor: EditorLike |
  null }`, renders a button that calls `command.action(editor)` on click, disabled
  when `editor` is `null`. `Dropdown.svelte` — props `{ command: CommandEntry; editor:
  EditorLike | null }`, renders a toggle button that opens a menu of
  `command.options`, each calling `option.action(editor)` on click. Consumed by
  `src/ribbon/components/Group.svelte` (Task 10).

- [ ] **Step 1: Write `src/ribbon/components/Button.svelte`**

```svelte
<script lang="ts" module>
  import { setIcon } from "obsidian";

  export function icon(node: HTMLElement, iconId: string) {
    setIcon(node, iconId);
    return {
      update(newIconId: string) {
        setIcon(node, newIconId);
      },
    };
  }
</script>

<script lang="ts">
  import type { CommandEntry } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";

  let { command, editor }: { command: CommandEntry; editor: EditorLike | null } = $props();

  function handleClick() {
    if (!editor || !command.action) return;
    command.action(editor);
  }
</script>

<button
  class="ribbon-button"
  type="button"
  title={command.label}
  aria-label={command.label}
  disabled={!editor}
  onclick={handleClick}
>
  <span class="ribbon-button-icon" use:icon={command.icon}></span>
  <span class="ribbon-button-label">{command.label}</span>
</button>
```

- [ ] **Step 2: Write `src/ribbon/components/Dropdown.svelte`**

```svelte
<script lang="ts">
  import type { CommandEntry } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";

  let { command, editor }: { command: CommandEntry; editor: EditorLike | null } = $props();

  let open = $state(false);
  const rootId = `ribbon-dropdown-${command.id}`;

  function toggleOpen() {
    open = !open;
  }

  function choose(action: (editor: EditorLike) => void) {
    if (editor) action(editor);
    open = false;
  }

  function handleWindowClick(event: MouseEvent) {
    if (!(event.target instanceof Node)) return;
    const root = document.getElementById(rootId);
    if (root && !root.contains(event.target)) open = false;
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
  >
    <span class="ribbon-button-label">{command.label} ▾</span>
  </button>
  {#if open}
    <ul class="ribbon-dropdown-menu">
      {#each command.options ?? [] as option (option.id)}
        <li>
          <button type="button" onclick={() => choose(option.action)}>{option.label}</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -noEmit -skipLibCheck`
Expected: no errors (`.svelte` files are outside `tsconfig.json`'s `include`, so this
checks only that the surrounding `.ts` files still compile — full component
type-checking happens implicitly via `npm run build`'s esbuild-svelte pass, verified
in Task 13).

- [ ] **Step 4: Commit**

```bash
git add src/ribbon/components/Button.svelte src/ribbon/components/Dropdown.svelte
git commit -m "feat: add ribbon Button and Dropdown components"
```

---

### Task 10: Group and RibbonPanel Svelte components

**Files:**
- Create: `src/ribbon/components/Group.svelte`
- Create: `src/ribbon/components/RibbonPanel.svelte`

**Interfaces:**
- Consumes: `Button.svelte`, `Dropdown.svelte` (Task 9); `CommandEntry`, `TabId`,
  `commandsForTab`, `groupsForTab` from `../commands/registry` (Task 7); `EditorLike`
  from `../commands/actions/types` (Task 2).
- Produces: `Group.svelte` — props `{ label: string; commands: CommandEntry[];
  editor: EditorLike | null }`, renders a labeled cluster of `Button`/`Dropdown`
  elements (picking `Dropdown` when `command.options` is set, `Button` otherwise).
  `RibbonPanel.svelte` — props `{ tab: TabId; editor: EditorLike | null }`, renders one
  `Group` per group in the active tab. Consumed by
  `src/ribbon/components/RibbonBar.svelte` (Task 11).

- [ ] **Step 1: Write `src/ribbon/components/Group.svelte`**

```svelte
<script lang="ts">
  import type { CommandEntry } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import Button from "./Button.svelte";
  import Dropdown from "./Dropdown.svelte";

  let {
    label,
    commands,
    editor,
  }: { label: string; commands: CommandEntry[]; editor: EditorLike | null } = $props();
</script>

<div class="ribbon-group">
  <div class="ribbon-group-buttons">
    {#each commands as command (command.id)}
      {#if command.options}
        <Dropdown {command} {editor} />
      {:else}
        <Button {command} {editor} />
      {/if}
    {/each}
  </div>
  <div class="ribbon-group-label">{label}</div>
</div>
```

- [ ] **Step 2: Write `src/ribbon/components/RibbonPanel.svelte`**

```svelte
<script lang="ts">
  import type { CommandEntry, TabId } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import { commandsForTab, groupsForTab } from "../commands/registry";
  import Group from "./Group.svelte";

  let { tab, editor }: { tab: TabId; editor: EditorLike | null } = $props();

  let groups = $derived(groupsForTab(tab));
  let commands = $derived(commandsForTab(tab));
</script>

<div class="ribbon-panel">
  {#each groups as group (group)}
    <Group label={group} commands={commands.filter((c: CommandEntry) => c.group === group)} {editor} />
  {/each}
</div>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -noEmit -skipLibCheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/ribbon/components/Group.svelte src/ribbon/components/RibbonPanel.svelte
git commit -m "feat: add ribbon Group and RibbonPanel components"
```

---

### Task 11: Tab and RibbonBar Svelte components, plus ribbon styling

**Files:**
- Create: `src/ribbon/components/Tab.svelte`
- Create: `src/ribbon/components/RibbonBar.svelte`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `RibbonPanel.svelte` (Task 10); `TABS`, `TabId` from `../commands/registry`
  (Task 7); `EditorLike` from `../commands/actions/types` (Task 2).
- Produces: `Tab.svelte` — props `{ label: string; active: boolean; onselect: () =>
  void; ondoubleclick: () => void }`. `RibbonBar.svelte` — props `{ editor: EditorLike
  | null; defaultCollapsed: boolean }`, the root component: renders the tab strip,
  owns `activeTab`/`collapsed` state, double-click on a tab toggles collapse. Consumed
  by `src/ribbon/RibbonManager.ts` (Task 12), which mounts it via Svelte's `mount()`.

- [ ] **Step 1: Write `src/ribbon/components/Tab.svelte`**

```svelte
<script lang="ts">
  let {
    label,
    active,
    onselect,
    ondoubleclick,
  }: { label: string; active: boolean; onselect: () => void; ondoubleclick: () => void } = $props();
</script>

<button type="button" class="ribbon-tab" class:active onclick={onselect} ondblclick={ondoubleclick}>
  {label}
</button>
```

- [ ] **Step 2: Write `src/ribbon/components/RibbonBar.svelte`**

```svelte
<script lang="ts">
  import { TABS } from "../commands/registry";
  import type { TabId } from "../commands/registry";
  import type { EditorLike } from "../commands/actions/types";
  import Tab from "./Tab.svelte";
  import RibbonPanel from "./RibbonPanel.svelte";

  let { editor, defaultCollapsed }: { editor: EditorLike | null; defaultCollapsed: boolean } = $props();

  let activeTab = $state<TabId>(TABS[0].id);
  let collapsed = $state(defaultCollapsed);

  function selectTab(tab: TabId) {
    activeTab = tab;
  }

  function toggleCollapsed() {
    collapsed = !collapsed;
  }
</script>

<div class="ribbon-bar" class:collapsed>
  <div class="ribbon-tab-strip">
    {#each TABS as tab (tab.id)}
      <Tab
        label={tab.label}
        active={tab.id === activeTab}
        onselect={() => selectTab(tab.id)}
        ondoubleclick={toggleCollapsed}
      />
    {/each}
  </div>
  {#if !collapsed}
    <RibbonPanel tab={activeTab} {editor} />
  {/if}
</div>
```

- [ ] **Step 3: Replace `styles.css` with full theme-native ribbon styling**

```css
.ribbon-bar-host {
  display: block;
}

.ribbon-bar {
  border-bottom: 1px solid var(--background-modifier-border);
  background-color: var(--background-secondary);
  font-size: var(--font-ui-small);
  user-select: none;
}

.ribbon-tab-strip {
  display: flex;
  gap: 2px;
  padding: 2px 8px 0;
}

.ribbon-tab {
  background: transparent;
  border: none;
  border-radius: 4px 4px 0 0;
  padding: 4px 12px;
  color: var(--text-muted);
  cursor: pointer;
}

.ribbon-tab:hover {
  background-color: var(--background-modifier-hover);
  color: var(--text-normal);
}

.ribbon-tab.active {
  background-color: var(--background-primary);
  color: var(--text-normal);
  font-weight: var(--font-weight-bold, 600);
}

.ribbon-panel {
  display: flex;
  gap: 4px;
  padding: 6px 8px;
  background-color: var(--background-primary);
  overflow-x: auto;
}

.ribbon-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border-right: 1px solid var(--background-modifier-border);
}

.ribbon-group:last-child {
  border-right: none;
}

.ribbon-group-buttons {
  display: flex;
  gap: 2px;
}

.ribbon-group-label {
  font-size: var(--font-ui-smaller);
  color: var(--text-faint);
}

.ribbon-button,
.ribbon-dropdown .ribbon-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 4px 6px;
  color: var(--text-normal);
  cursor: pointer;
  box-shadow: none;
}

.ribbon-button:hover:not(:disabled) {
  background-color: var(--background-modifier-hover);
  border-color: var(--background-modifier-border);
}

.ribbon-button:disabled {
  color: var(--text-faint);
  cursor: not-allowed;
}

.ribbon-button-icon {
  width: 16px;
  height: 16px;
}

.ribbon-button-label {
  font-size: var(--font-ui-smaller);
  white-space: nowrap;
}

.ribbon-dropdown {
  position: relative;
}

.ribbon-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: var(--layer-menu);
  margin: 2px 0 0;
  padding: 4px;
  list-style: none;
  background-color: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  box-shadow: var(--shadow-s);
  min-width: 120px;
}

.ribbon-dropdown-menu li button {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  padding: 4px 8px;
  color: var(--text-normal);
  cursor: pointer;
  box-shadow: none;
}

.ribbon-dropdown-menu li button:hover {
  background-color: var(--background-modifier-hover);
}

.ribbon-bar.collapsed .ribbon-tab-strip {
  padding-bottom: 2px;
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -noEmit -skipLibCheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/ribbon/components/Tab.svelte src/ribbon/components/RibbonBar.svelte styles.css
git commit -m "feat: add Tab and RibbonBar components with theme-native styling"
```

---

### Task 12: RibbonManager — leaf lifecycle and DOM injection

**Files:**
- Create: `src/ribbon/injectionPoint.ts`
- Create: `src/ribbon/RibbonManager.ts`
- Test: `tests/ribbon/injectionPoint.test.ts`

**Interfaces:**
- Consumes: `RibbonBar.svelte` (Task 11), `EditorLike` from `./commands/actions/types`
  (Task 2), Svelte 5's `mount`/`unmount` from the `svelte` package.
- Produces: `findInjectionPoint(containerEl: HTMLElement): HTMLElement | null` (pure,
  in its own file so it stays testable without pulling in Svelte component
  compilation); `class RibbonManager` with `constructor(options: { enabled: boolean;
  defaultCollapsed: boolean })`, `attach(view: MarkdownView): void`, `detach(view:
  MarkdownView): void`, `syncAllLeaves(views: MarkdownView[]): void`,
  `detachAll(views: MarkdownView[]): void`, `setEnabled(enabled: boolean): void`.
  Consumed by `src/main.ts` (Task 13).

- [ ] **Step 1: Write the failing test `tests/ribbon/injectionPoint.test.ts`**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { findInjectionPoint } from "../../src/ribbon/injectionPoint";

describe("findInjectionPoint", () => {
  it("finds the .view-content element within a container", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<div class="view-header"></div><div class="view-content"><div class="markdown-source-view"></div></div>';
    const result = findInjectionPoint(container);
    expect(result).not.toBeNull();
    expect(result?.className).toBe("view-content");
  });

  it("returns null when there is no .view-content element", () => {
    const container = document.createElement("div");
    container.innerHTML = '<div class="view-header"></div>';
    expect(findInjectionPoint(container)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ribbon/injectionPoint.test.ts`
Expected: FAIL — `injectionPoint.ts` does not exist yet.

- [ ] **Step 3: Write `src/ribbon/injectionPoint.ts`**

```ts
export function findInjectionPoint(containerEl: HTMLElement): HTMLElement | null {
  return containerEl.querySelector<HTMLElement>(".view-content");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/ribbon/injectionPoint.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Write `src/ribbon/RibbonManager.ts`**

```ts
import type { MarkdownView } from "obsidian";
import { mount, unmount } from "svelte";
import RibbonBar from "./components/RibbonBar.svelte";
import type { EditorLike } from "./commands/actions/types";
import { findInjectionPoint } from "./injectionPoint";

interface RibbonInstance {
  host: HTMLElement;
  component: object;
}

export class RibbonManager {
  private instances = new WeakMap<MarkdownView, RibbonInstance>();
  private enabled: boolean;
  private defaultCollapsed: boolean;

  constructor(options: { enabled: boolean; defaultCollapsed: boolean }) {
    this.enabled = options.enabled;
    this.defaultCollapsed = options.defaultCollapsed;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  syncAllLeaves(views: MarkdownView[]): void {
    for (const view of views) {
      if (this.enabled) this.attach(view);
      else this.detach(view);
    }
  }

  attach(view: MarkdownView): void {
    if (!this.enabled || this.instances.has(view)) return;

    const target = findInjectionPoint(view.containerEl);
    if (!target) {
      console.warn("Ribbon Bar: could not find injection point for view", view);
      return;
    }

    const host = document.createElement("div");
    host.addClass("ribbon-bar-host");
    target.prepend(host);

    const component = mount(RibbonBar, {
      target: host,
      props: {
        editor: (view.editor as unknown as EditorLike) ?? null,
        defaultCollapsed: this.defaultCollapsed,
      },
    });

    this.instances.set(view, { host, component });
  }

  detach(view: MarkdownView): void {
    const instance = this.instances.get(view);
    if (!instance) return;
    unmount(instance.component);
    instance.host.remove();
    this.instances.delete(view);
  }

  detachAll(views: MarkdownView[]): void {
    for (const view of views) this.detach(view);
  }
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc -noEmit -skipLibCheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/ribbon/injectionPoint.ts src/ribbon/RibbonManager.ts tests/ribbon/injectionPoint.test.ts
git commit -m "feat: add RibbonManager for per-leaf ribbon mount/unmount lifecycle"
```

---

### Task 13: Wire main.ts and verify end-to-end in a real Obsidian vault

**Files:**
- Modify: `src/main.ts`
- Test: manual verification in a real Obsidian development vault (no automated test —
  per the spec, DOM-injection/mode-switching/multi-pane behavior is verified by
  exercising the real app rather than mocked, since a meaningful mock would just
  re-implement Obsidian's workspace).

**Interfaces:**
- Consumes: `DEFAULT_SETTINGS`, `RibbonBarSettings` from `./settings` (Task 8);
  `RibbonBarSettingTab` from `./settings-tab` (Task 8); `RibbonBarPluginLike` from
  `./plugin-contract` (Task 8); `RibbonManager` from `./ribbon/RibbonManager`
  (Task 12).
- Produces: the complete `RibbonBarPlugin` class, `implements RibbonBarPluginLike`, the
  final deliverable of this plan.

- [ ] **Step 1: Rewrite `src/main.ts`**

```ts
import { MarkdownView, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, type RibbonBarSettings } from "./settings";
import { RibbonBarSettingTab } from "./settings-tab";
import type { RibbonBarPluginLike } from "./plugin-contract";
import { RibbonManager } from "./ribbon/RibbonManager";

export default class RibbonBarPlugin extends Plugin implements RibbonBarPluginLike {
  settings: RibbonBarSettings = DEFAULT_SETTINGS;
  ribbonManager!: RibbonManager;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.ribbonManager = new RibbonManager({
      enabled: this.settings.ribbonEnabled,
      defaultCollapsed: this.settings.defaultCollapsed,
    });

    this.addSettingTab(new RibbonBarSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => this.syncRibbons());
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.syncRibbons()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.syncRibbons()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.syncRibbons()));
  }

  onunload(): void {
    this.ribbonManager.detachAll(this.markdownViews());
  }

  syncRibbons(): void {
    this.ribbonManager.syncAllLeaves(this.markdownViews());
  }

  setRibbonEnabled(enabled: boolean): void {
    this.ribbonManager.setEnabled(enabled);
    this.syncRibbons();
  }

  private markdownViews(): MarkdownView[] {
    return this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view as MarkdownView);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — all tests from Tasks 2-8 and 12 pass (33 tests total: 5 helpers + 12
home + 10 insert + 14 layout + 2 references + 4 registry + 1 settings + 2
injectionPoint... — count may vary slightly by final assertions, but no failures).

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: `tsc -noEmit` passes with no errors, esbuild reports a successful bundle,
`main.js` is created/updated in the project root.

- [ ] **Step 4: Load the plugin in a real Obsidian vault**

If you don't already have an Obsidian vault for plugin development:
1. Create a new empty vault in Obsidian (any location outside this repo), e.g.
   `~/obsidian-dev-vault`.
2. Create the plugin folder: `mkdir -p ~/obsidian-dev-vault/.obsidian/plugins/ribbon-bar`.
3. Symlink the build output into it:
   ```bash
   ln -sf "$(pwd)/main.js" ~/obsidian-dev-vault/.obsidian/plugins/ribbon-bar/main.js
   ln -sf "$(pwd)/manifest.json" ~/obsidian-dev-vault/.obsidian/plugins/ribbon-bar/manifest.json
   ln -sf "$(pwd)/styles.css" ~/obsidian-dev-vault/.obsidian/plugins/ribbon-bar/styles.css
   ```
4. In Obsidian: Settings → Community plugins → turn off Restricted mode → enable
   "Ribbon Bar" in the installed plugins list.

- [ ] **Step 5: Manually verify the golden path**

With the vault open and the plugin enabled:
1. Open any Markdown note. Confirm a ribbon bar appears above the editor content with
   four tabs: Home, Insert, Layout, References.
2. On the Home tab, select some text and click Bold, then Italic. Confirm `**`/`*`
   markers are applied and match what a manual keystroke would produce.
3. Click the Heading dropdown, choose "Heading 2". Confirm the current line becomes
   `## `-prefixed.
4. Switch to the Insert tab, click Table with the cursor on an empty line. Confirm a
   2x2 markdown table is inserted.
5. Switch to the Layout tab on a note with a few headings, click Table of Contents.
   Confirm a nested list of heading links is inserted.
6. Switch to the References tab, click Footnote. Confirm `[^1]` is inserted at the
   cursor and a `[^1]: ` definition is appended at the end of the note.
7. Double-click a tab. Confirm the ribbon collapses to just the tab strip, and
   double-clicking again expands it.
8. Split the pane (right-click a tab → "Split right") and open a different note in the
   new pane. Confirm each pane has its own ribbon and that formatting actions in one
   pane don't affect the other.
9. Switch a pane to Reading view (via the view-mode toggle). Confirm the ribbon stays
   visible and its buttons are disabled (no click response) in Reading view.
10. Open Settings → Ribbon Bar. Toggle "Enable ribbon" off. Confirm all open ribbons
    disappear immediately. Toggle it back on. Confirm they reappear. Toggle "Collapse
    ribbon by default" on, then open a new note. Confirm its ribbon starts collapsed.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire RibbonManager and settings into the plugin entry point"
```
