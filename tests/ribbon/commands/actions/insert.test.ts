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
