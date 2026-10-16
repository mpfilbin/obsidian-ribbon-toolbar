import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import {
  insertAtCursor,
  toggleListPrefix,
  togglePrefix,
  wrapSelection,
} from "../../../../src/ribbon/commands/actions/helpers";

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

describe("toggleListPrefix with a multi-line selection", () => {
  it("adds the marker to every non-blank selected line when any line lacks it", () => {
    const editor = createMockEditor("one\ntwo\nthree");
    editor.setSelection({ line: 0, ch: 0 }, { line: 2, ch: 5 });
    toggleListPrefix(editor, "bullet", "- ");
    expect(editor.getValue()).toBe("- one\n- two\n- three");
  });

  it("removes the marker from every selected line when all already have it", () => {
    const editor = createMockEditor("- one\n- two\n- three");
    editor.setSelection({ line: 0, ch: 0 }, { line: 2, ch: 7 });
    toggleListPrefix(editor, "bullet", "- ");
    expect(editor.getValue()).toBe("one\ntwo\nthree");
  });

  it("normalizes a mixed selection to the toggled kind instead of leaving old markers", () => {
    const editor = createMockEditor("- one\n2. two\nthree");
    editor.setSelection({ line: 0, ch: 0 }, { line: 2, ch: 5 });
    toggleListPrefix(editor, "numbered", "1. ");
    expect(editor.getValue()).toBe("1. one\n1. two\n1. three");
  });

  it("skips blank lines within the selection", () => {
    const editor = createMockEditor("one\n\ntwo");
    editor.setSelection({ line: 0, ch: 0 }, { line: 2, ch: 3 });
    toggleListPrefix(editor, "bullet", "- ");
    expect(editor.getValue()).toBe("- one\n\n- two");
  });
});

describe("insertAtCursor", () => {
  it("inserts multi-line text at the cursor", () => {
    const editor = createMockEditor("");
    insertAtCursor(editor, "---\n");
    expect(editor.getValue()).toBe("---\n");
  });
});
