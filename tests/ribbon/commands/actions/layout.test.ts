import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import {
  demoteHeading,
  formatDocument,
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
    editor.setCursor({ line: 0, ch: 16 });
    insertTableOfContents(editor);
    expect(editor.getValue()).toBe("no headings here- (no headings found)\n");
  });

  it("formatDocument reformats the whole document", () => {
    const editor = createMockEditor("## Title ##\n* item");
    formatDocument(editor);
    expect(editor.getValue()).toBe("## Title\n\n- item\n");
  });

  it("formatDocument does nothing when the document is already formatted", () => {
    const editor = createMockEditor("# Title\n\nSome content.\n");
    const before = editor.getValue();
    formatDocument(editor);
    expect(editor.getValue()).toBe(before);
  });

  it("formatDocument clamps the cursor to the reformatted document's bounds", () => {
    const editor = createMockEditor("Para one.\n\n\n\nPara two.", { line: 4, ch: 3 });
    formatDocument(editor);
    expect(editor.getValue()).toBe("Para one.\n\nPara two.\n");
    expect(editor.getCursor()).toEqual({ line: 3, ch: 0 });
  });

  it("formatDocument preserves the cursor position on a line that survives formatting", () => {
    const editor = createMockEditor("Line one   \nLine two", { line: 1, ch: 5 });
    formatDocument(editor);
    expect(editor.getValue()).toBe("Line one\nLine two\n");
    expect(editor.getCursor()).toEqual({ line: 1, ch: 5 });
  });
});
