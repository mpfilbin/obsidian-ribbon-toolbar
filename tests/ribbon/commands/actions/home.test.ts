import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import {
  clearFormatting,
  setHeading,
  toggleBlockquote,
  toggleBold,
  toggleBulletList,
  toggleChecklist,
  toggleComment,
  toggleHighlight,
  toggleInlineCode,
  toggleItalic,
  toggleNumberedList,
  toggleStrikethrough,
  toggleSubscript,
  toggleSuperscript,
  toggleUnderline,
  toLowerCase,
  toSentenceCase,
  toTitleCase,
  toUpperCase,
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

  it("toggleUnderline wraps the selection", () => {
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    toggleUnderline(editor);
    expect(editor.getValue()).toBe("<u>hi</u>");
  });

  it("toggleSuperscript wraps the selection", () => {
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    toggleSuperscript(editor);
    expect(editor.getValue()).toBe("<sup>hi</sup>");
  });

  it("toggleSubscript wraps the selection", () => {
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    toggleSubscript(editor);
    expect(editor.getValue()).toBe("<sub>hi</sub>");
  });

  it("toggleComment wraps the selection in %%", () => {
    const editor = createMockEditor("hi");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
    toggleComment(editor);
    expect(editor.getValue()).toBe("%%hi%%");
  });

  it("toggleComment inserts a placeholder and selects it when nothing is selected", () => {
    const editor = createMockEditor("");
    toggleComment(editor);
    expect(editor.getValue()).toBe("%%comment%%");
    expect(editor.getSelection()).toBe("comment");
  });

  it("toUpperCase uppercases the selection", () => {
    const editor = createMockEditor("hello World");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 11 });
    toUpperCase(editor);
    expect(editor.getValue()).toBe("HELLO WORLD");
  });

  it("toUpperCase does nothing when there is no selection", () => {
    const editor = createMockEditor("hello World");
    toUpperCase(editor);
    expect(editor.getValue()).toBe("hello World");
  });

  it("toLowerCase lowercases the selection", () => {
    const editor = createMockEditor("hello World");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 11 });
    toLowerCase(editor);
    expect(editor.getValue()).toBe("hello world");
  });

  it("toTitleCase capitalizes each word of the selection", () => {
    const editor = createMockEditor("the quick BROWN fox");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 20 });
    toTitleCase(editor);
    expect(editor.getValue()).toBe("The Quick Brown Fox");
  });

  it("toSentenceCase capitalizes the first letter of each sentence in the selection", () => {
    const editor = createMockEditor("hello world. how ARE you? i am fine!");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 37 });
    toSentenceCase(editor);
    expect(editor.getValue()).toBe("Hello world. How are you? I am fine!");
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

  it("clearFormatting strips underline/superscript/subscript markers from the selection", () => {
    const editor = createMockEditor("<u>under</u> and <sup>sup</sup> and <sub>sub</sub>");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: editor.getValue().length });
    clearFormatting(editor);
    expect(editor.getValue()).toBe("under and sup and sub");
  });

  it("clearFormatting does nothing when there is no selection", () => {
    const editor = createMockEditor("**bold**");
    clearFormatting(editor);
    expect(editor.getValue()).toBe("**bold**");
  });

  it("clearFormatting strips links down to their visible text", () => {
    const editor = createMockEditor("see [the docs](https://example.com) for more");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: editor.getValue().length });
    clearFormatting(editor);
    expect(editor.getValue()).toBe("see the docs for more");
  });

  it("clearFormatting strips images down to their alt text", () => {
    const editor = createMockEditor("![a cat](https://example.com/cat.png)");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: editor.getValue().length });
    clearFormatting(editor);
    expect(editor.getValue()).toBe("a cat");
  });

  it("clearFormatting strips arbitrary HTML tags, keeping inner text", () => {
    const editor = createMockEditor("<mark>highlighted</mark> and <span class=\"x\">span</span>");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: editor.getValue().length });
    clearFormatting(editor);
    expect(editor.getValue()).toBe("highlighted and span");
  });

  it("clearFormatting strips a footnote ref from the selection", () => {
    const editor = createMockEditor("see this[^1] here");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: editor.getValue().length });
    clearFormatting(editor);
    expect(editor.getValue()).toBe("see this here");
  });

  it("clearFormatting also deletes the footnote's definition line elsewhere in the document", () => {
    const editor = createMockEditor("see this[^1] here\n\nsome other text\n\n[^1]: a note about this");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: editor.getLine(0).length });
    clearFormatting(editor);
    expect(editor.getValue()).toBe("see this here\n\nsome other text");
  });

  it("clearFormatting strips a leading heading marker from selected lines", () => {
    const editor = createMockEditor("# Heading");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: editor.getValue().length });
    clearFormatting(editor);
    expect(editor.getValue()).toBe("Heading");
  });

  it("clearFormatting strips a leading blockquote marker from selected lines", () => {
    const editor = createMockEditor("> Quote");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: editor.getValue().length });
    clearFormatting(editor);
    expect(editor.getValue()).toBe("Quote");
  });

  it("clearFormatting strips a leading checklist marker from selected lines", () => {
    const editor = createMockEditor("- [ ] task");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: editor.getValue().length });
    clearFormatting(editor);
    expect(editor.getValue()).toBe("task");
  });

  it("clearFormatting strips a leading numbered list marker from selected lines", () => {
    const editor = createMockEditor("1. item");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: editor.getValue().length });
    clearFormatting(editor);
    expect(editor.getValue()).toBe("item");
  });

  it("clearFormatting strips a leading bullet marker from selected lines", () => {
    const editor = createMockEditor("- item");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: editor.getValue().length });
    clearFormatting(editor);
    expect(editor.getValue()).toBe("item");
  });
});
