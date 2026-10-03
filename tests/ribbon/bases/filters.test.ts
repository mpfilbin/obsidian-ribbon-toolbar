import { describe, expect, it } from "vitest";
import {
  buildCondition,
  folderOfNoteCondition,
  inferKind,
  operatorsFor,
  OPERATORS,
  propertyRef,
  QUICK_FILTERS,
  quote,
} from "../../../src/ribbon/bases/filters";

const ok = (expression: string) => ({ ok: true, expression });

describe("quote", () => {
  it("wraps in double quotes, escaping quotes and backslashes", () => {
    expect(quote("plain")).toBe('"plain"');
    expect(quote('say "hi"')).toBe('"say \\"hi\\""');
    expect(quote("a\\b")).toBe('"a\\\\b"');
  });
});

describe("propertyRef", () => {
  it.each([
    ["status", "status"],
    ["note.status", "note.status"],
    ["file.mtime", "file.mtime"],
    ["formula.total", "formula.total"],
    ["Due date", 'note["Due date"]'],
    ["note.Due date", 'note["Due date"]'],
    ["formula.my total", 'formula["my total"]'],
    ["file.some thing", "file.some thing"],
  ])("%j -> %j", (input, expected) => {
    expect(propertyRef(input)).toBe(expected);
  });
});

describe("buildCondition: property conditions", () => {
  const prop = (operator: string, value?: string, property = "status") => buildCondition({ kind: "property", property, operator, value });

  it.each([
    ["is", "done", 'status == "done"'],
    ["is-not", "done", 'status != "done"'],
    ["contains", "x", 'status.contains("x")'],
    ["not-contains", "x", '!status.contains("x")'],
    ["starts-with", "x", 'status.startsWith("x")'],
    ["ends-with", "x", 'status.endsWith("x")'],
    ["eq", "5", "status == 5"],
    ["neq", "5", "status != 5"],
    ["gt", "5", "status > 5"],
    ["gte", "5", "status >= 5"],
    ["lt", "5", "status < 5"],
    ["lte", "5", "status <= 5"],
    ["on", "2025-01-31", 'status == date("2025-01-31")'],
    ["before", "2025-01-31", 'status < date("2025-01-31")'],
    ["after", "2025-01-31", 'status > date("2025-01-31")'],
    ["last-days", "7", 'status > now() - "7 days"'],
    ["next-days", "3", 'status < now() + "3 days"'],
    ["true", undefined, "status == true"],
    ["false", undefined, "status == false"],
    ["empty", undefined, "status.isEmpty()"],
    ["not-empty", undefined, "!status.isEmpty()"],
  ])("%s", (operator, value, expected) => {
    expect(prop(operator, value)).toEqual(ok(expected));
  });

  it("escapes quotes in values and references spaced property names safely", () => {
    expect(prop("is", 'a "b"')).toEqual(ok('status == "a \\"b\\""'));
    expect(prop("is", "x", "Due date")).toEqual(ok('note["Due date"] == "x"'));
  });

  it("normalises numbers", () => {
    expect(prop("gt", " 05.50 ")).toEqual(ok("status > 5.5"));
  });

  it.each([
    ["", "is", "x", "Choose a property."],
    ["status", "nope", "x", "Choose an operator."],
    ["status", "is", "  ", "Enter a value."],
    ["status", "gt", "abc", "Enter a number."],
    ["status", "last-days", "x", "Enter a number."],
    ["status", "on", "31/01/2025", "Enter a date as YYYY-MM-DD."],
  ])("rejects %j %j %j", (property, operator, value, error) => {
    expect(buildCondition({ kind: "property", property, operator, value })).toEqual({ ok: false, error });
  });
});

describe("buildCondition: special conditions", () => {
  it("builds tag filters, tolerating # prefixes and blanks", () => {
    expect(buildCondition({ kind: "tag", tags: ["#project", " work ", ""] })).toEqual(ok('file.hasTag("project", "work")'));
    expect(buildCondition({ kind: "tag", tags: ["", " "] })).toEqual({ ok: false, error: "Enter at least one tag." });
  });

  it("builds folder, link, date and property-exists filters", () => {
    expect(buildCondition({ kind: "folder", folder: " Projects/Active " })).toEqual(ok('file.inFolder("Projects/Active")'));
    expect(buildCondition({ kind: "folder", folder: "" })).toEqual({ ok: false, error: "Enter a folder." });
    expect(buildCondition({ kind: "linksToThis" })).toEqual(ok("file.hasLink(this.file)"));
    expect(buildCondition({ kind: "linkedFromThis" })).toEqual(ok("this.file.hasLink(file)"));
    expect(buildCondition({ kind: "modified", days: 7 })).toEqual(ok('file.mtime > now() - "7 days"'));
    expect(buildCondition({ kind: "created", days: 2.9 })).toEqual(ok('file.ctime > now() - "2 days"'));
    expect(buildCondition({ kind: "modified", days: 0 })).toEqual({ ok: false, error: "Enter a number of days." });
    expect(buildCondition({ kind: "hasProperty", name: " due " })).toEqual(ok('file.hasProperty("due")'));
    expect(buildCondition({ kind: "hasProperty", name: "" })).toEqual({ ok: false, error: "Enter a property name." });
  });

  it("passes a raw expression through trimmed", () => {
    expect(buildCondition({ kind: "raw", expression: "  a > 1  " })).toEqual(ok("a > 1"));
    expect(buildCondition({ kind: "raw", expression: " " })).toEqual({ ok: false, error: "Enter an expression." });
  });
});

describe("operators and kinds", () => {
  it("offers operators suited to each kind", () => {
    expect(operatorsFor("boolean").map((o) => o.id)).toEqual(["true", "false"]);
    expect(operatorsFor("number").map((o) => o.id)).toEqual(["eq", "neq", "gt", "gte", "lt", "lte", "empty", "not-empty"]);
    expect(operatorsFor("list").map((o) => o.id)).toEqual(["contains", "not-contains", "empty", "not-empty"]);
    expect(operatorsFor("date").map((o) => o.id)).toContain("last-days");
    expect(operatorsFor("text").map((o) => o.id)).toContain("starts-with");
  });

  it("has unique operator ids", () => {
    const ids = OPERATORS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("infers a kind from file properties and sample values", () => {
    expect(inferKind("file.size")).toBe("number");
    expect(inferKind("file.mtime")).toBe("date");
    expect(inferKind("file.tags")).toBe("list");
    expect(inferKind("file.name")).toBe("text");
    expect(inferKind("x", ["a"])).toBe("list");
    expect(inferKind("x", 3)).toBe("number");
    expect(inferKind("x", true)).toBe("boolean");
    expect(inferKind("x", "2025-01-31")).toBe("date");
    expect(inferKind("x", "2025-01-31T10:00")).toBe("date");
    expect(inferKind("x", "hello")).toBe("text");
    expect(inferKind("x")).toBe("text");
  });
});

describe("quick filters and folder helper", () => {
  it("every quick filter builds a valid condition", () => {
    for (const quick of QUICK_FILTERS) expect(buildCondition(quick.spec).ok, quick.id).toBe(true);
  });

  it("derives the folder condition from a note path", () => {
    expect(folderOfNoteCondition("Projects/Active/Note.md")).toEqual({ kind: "folder", folder: "Projects/Active" });
    expect(folderOfNoteCondition("Note.md")).toBeNull();
  });
});
