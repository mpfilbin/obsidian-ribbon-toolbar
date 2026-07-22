import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import { findEnclosingTable } from "../../../../src/ribbon/commands/actions/tableParsing";

describe("findEnclosingTable", () => {
  const table = "| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |";

  it("finds the block when the cursor is on a data row", () => {
    const editor = createMockEditor(table, { line: 2, ch: 0 });
    expect(findEnclosingTable(editor, 2)).toEqual({ start: 0, end: 4, align: ["", ""] });
  });

  it("finds the block when the cursor is on the header row", () => {
    const editor = createMockEditor(table, { line: 0, ch: 0 });
    expect(findEnclosingTable(editor, 0)).toEqual({ start: 0, end: 4, align: ["", ""] });
  });

  it("finds the block when the cursor is on the separator row", () => {
    const editor = createMockEditor(table, { line: 1, ch: 0 });
    expect(findEnclosingTable(editor, 1)).toEqual({ start: 0, end: 4, align: ["", ""] });
  });

  it("returns null when the cursor is outside any table", () => {
    const editor = createMockEditor("just a paragraph", { line: 0, ch: 0 });
    expect(findEnclosingTable(editor, 0)).toBeNull();
  });

  it("returns the correct block among multiple tables in one document", () => {
    const doc = "| A | B |\n| - | - |\n| 1 | 2 |\ntext\n| X | Y |\n| - | - |\n| 3 | 4 |";
    const editor = createMockEditor(doc, { line: 6, ch: 0 });
    expect(findEnclosingTable(editor, 6)).toEqual({ start: 4, end: 7, align: ["", ""] });
    expect(findEnclosingTable(editor, 3)).toBeNull();
  });

  it("parses colon alignment markers from the separator row", () => {
    const aligned = "| Name | Age |\n|:--|--:|\n| Alice | 30 |";
    const editor = createMockEditor(aligned, { line: 0, ch: 0 });
    expect(findEnclosingTable(editor, 0)).toEqual({ start: 0, end: 3, align: ["l", "r"] });
  });

  it("returns null when the cursor line is beyond the document bounds", () => {
    const doc = "| A | B |\n| - | - |\n| 1 | 2 |";
    const editor = createMockEditor(doc, { line: 0, ch: 0 });
    expect(findEnclosingTable(editor, 5)).toBeNull();
    expect(findEnclosingTable(editor, 100)).toBeNull();
  });
});
