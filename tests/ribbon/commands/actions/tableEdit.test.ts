import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import { deleteRow, insertColumnLeft, insertColumnRight, insertRowAbove, insertRowBelow } from "../../../../src/ribbon/commands/actions/tableEdit";

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

describe("insertColumnLeft", () => {
  it("inserts an empty column to the left of the column the cursor is on", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 2, ch: 4 });
    insertColumnLeft(editor);
    expect(editor.getValue()).toBe(
      "|   | Name  | Age |\n| - | ----- | --- |\n|   | Alice | 30  |\n|   | Bob   | 25  |"
    );
    expect(editor.getCursor()).toEqual({ line: 2, ch: 1 });
  });

  it("works when the cursor is on the header row", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 0, ch: 3 });
    insertColumnLeft(editor);
    expect(editor.getValue()).toBe(
      "|   | Name  | Age |\n| - | ----- | --- |\n|   | Alice | 30  |\n|   | Bob   | 25  |"
    );
    expect(editor.getCursor()).toEqual({ line: 0, ch: 1 });
  });

  it("does nothing when the cursor is not inside a table", () => {
    const editor = createMockEditor("just a paragraph", { line: 0, ch: 0 });
    insertColumnLeft(editor);
    expect(editor.getValue()).toBe("just a paragraph");
  });
});

describe("insertColumnRight", () => {
  it("inserts an empty column to the right of the column the cursor is on", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 2, ch: 4 });
    insertColumnRight(editor);
    expect(editor.getValue()).toBe(
      "| Name  |   | Age |\n| ----- | - | --- |\n| Alice |   | 30  |\n| Bob   |   | 25  |"
    );
    expect(editor.getCursor()).toEqual({ line: 2, ch: 9 });
  });

  it("does nothing when the cursor is not inside a table", () => {
    const editor = createMockEditor("just a paragraph", { line: 0, ch: 0 });
    insertColumnRight(editor);
    expect(editor.getValue()).toBe("just a paragraph");
  });
});

describe("deleteRow", () => {
  it("deletes the data row the cursor is on, landing on the row that shifted into its place", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 2, ch: 0 });
    deleteRow(editor);
    expect(editor.getValue()).toBe("| Name | Age |\n| ---- | --- |\n| Bob  | 25  |");
    expect(editor.getCursor()).toEqual({ line: 2, ch: 0 });
  });

  it("deletes the last data row, landing on the previous row", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 3, ch: 0 });
    deleteRow(editor);
    expect(editor.getValue()).toBe("| Name  | Age |\n| ----- | --- |\n| Alice | 30  |");
    expect(editor.getCursor()).toEqual({ line: 2, ch: 0 });
  });

  it("deletes the header row, promoting the next data row to header", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 0, ch: 0 });
    deleteRow(editor);
    expect(editor.getValue()).toBe("| Alice | 30 |\n| ----- | -- |\n| Bob   | 25 |");
    expect(editor.getCursor()).toEqual({ line: 0, ch: 0 });
  });

  it("does nothing on the separator row", () => {
    const editor = createMockEditor(BASE_TABLE, { line: 1, ch: 0 });
    deleteRow(editor);
    expect(editor.getValue()).toBe(BASE_TABLE);
  });

  it("does nothing when it would leave zero data rows (deleting the only data row)", () => {
    const oneRow = "| Name | Age |\n| --- | --- |\n| Alice | 30 |";
    const editor = createMockEditor(oneRow, { line: 2, ch: 0 });
    deleteRow(editor);
    expect(editor.getValue()).toBe(oneRow);
  });

  it("does nothing when it would leave zero data rows (deleting the header with only one data row left)", () => {
    const oneRow = "| Name | Age |\n| --- | --- |\n| Alice | 30 |";
    const editor = createMockEditor(oneRow, { line: 0, ch: 0 });
    deleteRow(editor);
    expect(editor.getValue()).toBe(oneRow);
  });

  it("does nothing when the cursor is not inside a table", () => {
    const editor = createMockEditor("just a paragraph", { line: 0, ch: 0 });
    deleteRow(editor);
    expect(editor.getValue()).toBe("just a paragraph");
  });
});
