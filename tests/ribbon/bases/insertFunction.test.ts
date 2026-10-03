import { describe, expect, it } from "vitest";
import { insertFunction, insertIntoText } from "../../../src/ribbon/bases/insertFunction";
import { FUNCTIONS, type BaseFunction } from "../../../src/ribbon/bases/functions";
import { createMockEditor } from "../../support/mockEditor";

const find = (group: string, name: string): BaseFunction => FUNCTIONS.find((f) => f.group === group && f.name === name)!;

describe("insertFunction", () => {
  it("inserts a call and leaves the cursor in the first argument", () => {
    const editor = createMockEditor("formula: ", { line: 0, ch: 9 });
    insertFunction(find("Global", "date"))(editor);
    expect(editor.getValue()).toBe('formula: date("")');
    expect(editor.getCursor()).toEqual({ line: 0, ch: 15 });
  });

  it("leaves the cursor after a call that takes no arguments", () => {
    const editor = createMockEditor("");
    insertFunction(find("Global", "now"))(editor);
    expect(editor.getValue()).toBe("now()");
    expect(editor.getCursor()).toEqual({ line: 0, ch: 5 });
  });

  it("replaces a selection with a function call", () => {
    const editor = createMockEditor("old");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 3 });
    insertFunction(find("Global", "today"))(editor);
    expect(editor.getValue()).toBe("today()");
  });

  it("attaches a method to the end of the selection instead of replacing it", () => {
    const editor = createMockEditor("tags and more");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 4 });
    insertFunction(find("List", "contains"))(editor);
    expect(editor.getValue()).toBe("tags.contains() and more");
    expect(editor.getCursor()).toEqual({ line: 0, ch: 14 });
  });

  it("inserts a method at the cursor when nothing is selected", () => {
    const editor = createMockEditor("price", { line: 0, ch: 5 });
    insertFunction(find("Number", "round"))(editor);
    expect(editor.getValue()).toBe("price.round()");
    expect(editor.getCursor()).toEqual({ line: 0, ch: 12 });
  });

  it("works on later lines", () => {
    const editor = createMockEditor("a\nb: ", { line: 1, ch: 3 });
    insertFunction(find("File", "hasTag"))(editor);
    expect(editor.getValue()).toBe('a\nb: file.hasTag("")');
    expect(editor.getCursor()).toEqual({ line: 1, ch: 16 });
  });
});

describe("insertIntoText", () => {
  it("inserts at the caret and reports where it should go", () => {
    expect(insertIntoText("a + ", 4, 4, find("Global", "number"))).toEqual({ text: "a + number()", caret: 11 });
  });

  it("replaces a selection for global functions", () => {
    expect(insertIntoText("x old y", 2, 5, find("Global", "now"))).toEqual({ text: "x now() y", caret: 7 });
  });

  it("appends a method after a selection", () => {
    expect(insertIntoText("price + 1", 0, 5, find("Number", "round"))).toEqual({ text: "price.round() + 1", caret: 12 });
  });

  it("inserts a method at a bare caret", () => {
    expect(insertIntoText("name", 4, 4, find("Text", "lower"))).toEqual({ text: "name.lower()", caret: 12 });
  });
});
