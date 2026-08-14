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

  it("toggleChecklist converts an existing bullet line instead of stacking markers", () => {
    const editor = createMockEditor("- item");
    toggleChecklist(editor);
    expect(editor.getValue()).toBe("- [ ] item");
  });

  it("toggleBulletList converts an existing checklist line instead of stacking markers", () => {
    const editor = createMockEditor("- [ ] item");
    toggleBulletList(editor);
    expect(editor.getValue()).toBe("- item");
  });

  it("toggleNumberedList converts an existing bullet line", () => {
    const editor = createMockEditor("- item");
    toggleNumberedList(editor);
    expect(editor.getValue()).toBe("1. item");
  });

  it("toggleBulletList converts an existing numbered line regardless of its digits", () => {
    const editor = createMockEditor("5. item");
    toggleBulletList(editor);
    expect(editor.getValue()).toBe("- item");
  });

  it("toggleChecklist toggles off when the line is already a checklist item", () => {
    const editor = createMockEditor("- [ ] item");
    toggleChecklist(editor);
    expect(editor.getValue()).toBe("item");
  });

  it("lands the cursor after the new marker, not inside it, when the old cursor was within the replaced marker", () => {
    const editor = createMockEditor("- item", { line: 0, ch: 0 });
    toggleChecklist(editor);
    expect(editor.getValue()).toBe("- [ ] item");
    expect(editor.getCursor().ch).toBe(6);
  });

  it("preserves the cursor's offset into the line content when converting marker kinds", () => {
    const editor = createMockEditor("- item", { line: 0, ch: 4 });
    toggleChecklist(editor);
    expect(editor.getValue()).toBe("- [ ] item");
    expect(editor.getCursor().ch).toBe(8);
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
