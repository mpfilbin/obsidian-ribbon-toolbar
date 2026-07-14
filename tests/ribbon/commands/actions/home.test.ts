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
