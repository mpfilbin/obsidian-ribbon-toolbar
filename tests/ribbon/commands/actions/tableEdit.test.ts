import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import { insertRowAbove, insertRowBelow } from "../../../../src/ribbon/commands/actions/tableEdit";

const BASE_TABLE = "| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |";

describe("insertRowAbove", () => {
  it("inserts an empty row above the data row the cursor is on", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 2, ch: 0 });
    insertRowAbove(editor);
    expect(editor.getValue()).toBe(
      "| Name  | Age |\n| ----- | --- |\n|       |     |\n| Alice | 30  |\n| Bob   | 25  |"
    );
    expect(editor.getCursor()).toEqual({ line: 2, ch: 2 });
  });

  it("does nothing when the cursor is on the header row", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 0, ch: 0 });
    insertRowAbove(editor);
    expect(editor.getValue()).toBe(BASE_TABLE);
  });

  it("does nothing when the cursor is on the separator row", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 1, ch: 0 });
    insertRowAbove(editor);
    expect(editor.getValue()).toBe(BASE_TABLE);
  });

  it("does nothing when the cursor is not inside a table", () => {
    const editor = createMockEditor("just a paragraph", { line: 0, ch: 0 });
    insertRowAbove(editor);
    expect(editor.getValue()).toBe("just a paragraph");
  });
});

describe("insertRowBelow", () => {
  it("inserts an empty row below the data row the cursor is on", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 2, ch: 0 });
    insertRowBelow(editor);
    expect(editor.getValue()).toBe(
      "| Name  | Age |\n| ----- | --- |\n| Alice | 30  |\n|       |     |\n| Bob   | 25  |"
    );
    expect(editor.getCursor()).toEqual({ line: 3, ch: 2 });
  });

  it("inserts the first data row when triggered from the header row", () => {
    const headerOnly = "| Name | Age |\n| --- | --- |";
    const editor = createMockEditor(headerOnly, { line: 0, ch: 0 });
    insertRowBelow(editor);
    expect(editor.getValue()).toBe("| Name | Age |\n| ---- | --- |\n|      |     |");
    expect(editor.getCursor()).toEqual({ line: 2, ch: 2 });
  });

  it("inserts the first data row when triggered from the separator row", () => {
    const headerOnly = "| Name | Age |\n| --- | --- |";
    const editor = createMockEditor(headerOnly, { line: 1, ch: 0 });
    insertRowBelow(editor);
    expect(editor.getValue()).toBe("| Name | Age |\n| ---- | --- |\n|      |     |");
    expect(editor.getCursor()).toEqual({ line: 2, ch: 2 });
  });

  it("does nothing when the cursor is not inside a table", () => {
    const editor = createMockEditor("just a paragraph", { line: 0, ch: 0 });
    insertRowBelow(editor);
    expect(editor.getValue()).toBe("just a paragraph");
  });
});
