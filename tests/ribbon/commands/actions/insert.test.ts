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
