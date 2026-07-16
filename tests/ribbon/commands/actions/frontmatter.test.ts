import { describe, expect, it } from "vitest";
import { createMockEditor } from "../../../support/mockEditor";
import { insertOrLocateProperty } from "../../../../src/ribbon/commands/actions/frontmatter";

describe("insertOrLocateProperty", () => {
  it("creates a frontmatter block when none exists (text, no default)", () => {
    const editor = createMockEditor("");
    insertOrLocateProperty({ name: "description", type: "text" })(editor);
    expect(editor.getValue()).toBe("---\ndescription: \n---\n");
  });

  it("inserts a default text value verbatim", () => {
    const editor = createMockEditor("");
    insertOrLocateProperty({ name: "source", type: "text", defaultValue: "https://example.com" })(editor);
    expect(editor.getValue()).toBe("---\nsource: https://example.com\n---\n");
  });

  it("creates an empty list property with one blank item", () => {
    const editor = createMockEditor("");
    insertOrLocateProperty({ name: "tags", type: "list" })(editor);
    expect(editor.getValue()).toBe("---\ntags:\n  - \n---\n");
  });

  it("splits a comma-separated default value into list items", () => {
    const editor = createMockEditor("");
    insertOrLocateProperty({ name: "tags", type: "list", defaultValue: "note, draft" })(editor);
    expect(editor.getValue()).toBe("---\ntags:\n  - note\n  - draft\n---\n");
  });

  it("defaults checkbox to false when no default value is set", () => {
    const editor = createMockEditor("");
    insertOrLocateProperty({ name: "archived", type: "checkbox" })(editor);
    expect(editor.getValue()).toBe("---\narchived: false\n---\n");
  });

  it("uses an explicit checkbox default value", () => {
    const editor = createMockEditor("");
    insertOrLocateProperty({ name: "archived", type: "checkbox", defaultValue: "true" })(editor);
    expect(editor.getValue()).toBe("---\narchived: true\n---\n");
  });

  it("defaults a date property to today's date in YYYY-MM-DD form", () => {
    const editor = createMockEditor("");
    insertOrLocateProperty({ name: "created", type: "date" })(editor);
    expect(editor.getValue()).toMatch(/^---\ncreated: \d{4}-\d{2}-\d{2}\n---\n$/);
  });

  it("defaults a datetime property to now in YYYY-MM-DDTHH:mm form", () => {
    const editor = createMockEditor("");
    insertOrLocateProperty({ name: "updated", type: "datetime" })(editor);
    expect(editor.getValue()).toMatch(/^---\nupdated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}\n---\n$/);
  });

  it("inserts a new property inside an existing frontmatter block, above the closing delimiter", () => {
    const editor = createMockEditor("---\ntags:\n  - foo\n---\nBody text");
    insertOrLocateProperty({ name: "description", type: "text" })(editor);
    expect(editor.getValue()).toBe("---\ntags:\n  - foo\ndescription: \n---\nBody text");
  });

  it("moves the cursor to an existing property's line instead of duplicating it", () => {
    const editor = createMockEditor("---\ntags:\n  - foo\n---\nBody text");
    insertOrLocateProperty({ name: "tags", type: "list" })(editor);
    expect(editor.getValue()).toBe("---\ntags:\n  - foo\n---\nBody text");
    expect(editor.getCursor()).toEqual({ line: 1, ch: 5 });
  });

  it("does not treat a property name containing regex metacharacters as a pattern error", () => {
    const editor = createMockEditor("---\na.b: 1\n---\nBody text");
    expect(() => insertOrLocateProperty({ name: "a.b", type: "text" })(editor)).not.toThrow();
    expect(editor.getValue()).toBe("---\na.b: 1\n---\nBody text");
    expect(editor.getCursor()).toEqual({ line: 1, ch: 6 });
  });
});
