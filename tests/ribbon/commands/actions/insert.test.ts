import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import {
  insertCodeBlock,
  insertCodeBlockWithLanguage,
  insertHorizontalRule,
  insertImage,
  insertSymbol,
  insertTableGrid,
  insertTag,
} from "../../../../src/ribbon/commands/actions/insert";

describe("Insert tab actions", () => {
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

  it("insertTableGrid replaces selected text and selects the placeholder space in the first header cell", () => {
    const editor = createMockEditor("some text here");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 9 });
    insertTableGrid(editor, 2, 2);
    expect(editor.getValue()).toBe("| | |\n| --- | --- |\n| | |\n here");
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

  it("insertCodeBlock puts the language on the opening fence when wrapping a selection", () => {
    const editor = createMockEditor("let x");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 5 });
    insertCodeBlock(editor, "typescript");
    expect(editor.getValue()).toBe("```typescript\nlet x\n```");
  });

  it("insertCodeBlock puts the language on the placeholder block and still selects the placeholder", () => {
    const editor = createMockEditor("");
    insertCodeBlock(editor, "csharp");
    expect(editor.getValue()).toBe("```csharp\ncode\n```");
    expect(editor.getSelection()).toBe("code");
  });

  it("insertCodeBlock selects the placeholder correctly mid-document", () => {
    const editor = createMockEditor("intro\n", { line: 1, ch: 0 });
    insertCodeBlock(editor, "bash");
    expect(editor.getSelection()).toBe("code");
    expect(editor.getValue()).toBe("intro\n```bash\ncode\n```");
  });

  it("insertCodeBlockWithLanguage returns an action bound to that language", () => {
    const editor = createMockEditor("");
    insertCodeBlockWithLanguage("python")(editor);
    expect(editor.getValue()).toBe("```python\ncode\n```");
  });

  it("insertTag inserts a placeholder tag and selects it", () => {
    const editor = createMockEditor("");
    insertTag(editor);
    expect(editor.getValue()).toBe("#tag");
    expect(editor.getSelection()).toBe("tag");
  });

  it("insertSymbol returns an action that inserts the given character at the cursor", () => {
    const editor = createMockEditor("");
    insertSymbol("—")(editor);
    expect(editor.getValue()).toBe("—");
  });

  it("insertSymbol replaces the current selection with the given character", () => {
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    insertSymbol("©")(editor);
    expect(editor.getValue()).toBe("©");
  });
});
