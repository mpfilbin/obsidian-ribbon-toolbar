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
