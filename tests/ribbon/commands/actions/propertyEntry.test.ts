import { describe, expect, it } from "vitest";
import {
  buildPropertyEntry,
  localDate,
  localDateTime,
  PROPERTY_ENTRY_TYPES,
  yamlKey,
  yamlText,
  type PropertyEntryInput,
  type PropertyEntryType,
} from "../../../../src/ribbon/commands/actions/propertyEntry";

describe("yamlKey", () => {
  it.each([
    ["status", "status"],
    ["due date", "due date"],
    ["my-prop_2", "my-prop_2"],
    ["a.b", "a.b"],
    ["a: b", '"a: b"'],
    ["#tag", '"#tag"'],
    [" lead", '" lead"'],
    ["trail ", '"trail "'],
    ["quote\"d", '"quote\\"d"'],
    ["émoji", '"émoji"'],
  ])("%j -> %s", (name, expected) => {
    expect(yamlKey(name)).toBe(expected);
  });
});

describe("yamlText", () => {
  it.each(["plain text", "hello, world", "a-b", "path/to/file", "it's fine", "100%", "email@x.com"])("leaves %j plain", (value) => {
    expect(yamlText(value)).toBe(value);
  });

  it.each([
    ["true", '"true"'],
    ["No", '"No"'],
    ["null", '"null"'],
    ["~", '"~"'],
    ["123", '"123"'],
    ["-4.5", '"-4.5"'],
    ["1e3", '"1e3"'],
    ["0x1F", '"0x1F"'],
    ["2025-01-31", '"2025-01-31"'],
    ["2025-01-31T10:00", '"2025-01-31T10:00"'],
    ["key: value", '"key: value"'],
    ["ends with:", '"ends with:"'],
    ["a #comment", '"a #comment"'],
    ["[list]", '"[list]"'],
    ["{map}", '"{map}"'],
    ["- item", '"- item"'],
    ["*bold*", '"*bold*"'],
    ["&anchor", '"&anchor"'],
    ["!tag", '"!tag"'],
    ["> quote", '"> quote"'],
    ["'single", '"\'single"'],
    ['"double', '"\\"double"'],
    ["line\nbreak", '"line\\nbreak"'],
    [" padded", '" padded"'],
  ])("quotes %j", (value, expected) => {
    expect(yamlText(value)).toBe(expected);
  });

  it("returns an empty value as nothing", () => {
    expect(yamlText("")).toBe("");
  });
});

describe("local date helpers", () => {
  const moment = new Date(2025, 0, 5, 9, 7); // local time: 5 Jan 2025 09:07
  it("formats the user's own date and time, zero-padded", () => {
    expect(localDate(moment)).toBe("2025-01-05");
    expect(localDateTime(moment)).toBe("2025-01-05T09:07");
  });

  it("defaults to now", () => {
    expect(localDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(localDateTime()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe("buildPropertyEntry", () => {
  const build = (input: Partial<PropertyEntryInput>) =>
    buildPropertyEntry({ name: "prop", type: "text", value: "", ...input });
  const lines = (input: Partial<PropertyEntryInput>) => {
    const result = build(input);
    if (!result.ok) throw new Error(result.error);
    return result.lines;
  };

  it("offers the six property types", () => {
    expect(PROPERTY_ENTRY_TYPES.map((t) => t.id)).toEqual(["text", "list", "number", "checkbox", "date", "datetime"]);
  });

  describe("names", () => {
    it("trims the name and rejects blank or multi-line names", () => {
      expect(build({ name: "  status  " })).toMatchObject({ ok: true, name: "status" });
      expect(build({ name: "   " })).toEqual({ ok: false, error: "Give the property a name." });
      expect(build({ name: "a\nb" })).toEqual({ ok: false, error: "A property name can't contain a line break." });
    });

    it("quotes unusual names as keys", () => {
      expect(lines({ name: "a: b", value: "x" })).toEqual(['"a: b": x']);
    });
  });

  describe("text", () => {
    it("writes the value, quoting what YAML would misread", () => {
      expect(lines({ value: "hello" })).toEqual(["prop: hello"]);
      expect(lines({ value: "12" })).toEqual(['prop: "12"']);
      expect(lines({ value: "a: b" })).toEqual(['prop: "a: b"']);
    });

    it("leaves an empty value empty, without trailing spaces", () => {
      expect(lines({ value: "" })).toEqual(["prop:"]);
      expect(lines({ value: "   " })).toEqual(["prop:"]);
    });
  });

  describe("number", () => {
    it("normalises numbers and allows empty", () => {
      expect(lines({ type: "number", value: " 007.50 " })).toEqual(["prop: 7.5"]);
      expect(lines({ type: "number", value: "-3" })).toEqual(["prop: -3"]);
      expect(lines({ type: "number", value: "" })).toEqual(["prop:"]);
    });

    it.each(["abc", "1,5", "Infinity", "1 2"])("rejects %j", (value) => {
      expect(build({ type: "number", value })).toEqual({ ok: false, error: "Enter a number." });
    });
  });

  describe("checkbox", () => {
    it("writes true only for 'true', otherwise false", () => {
      expect(lines({ type: "checkbox", value: "true" })).toEqual(["prop: true"]);
      expect(lines({ type: "checkbox", value: "false" })).toEqual(["prop: false"]);
      expect(lines({ type: "checkbox", value: "" })).toEqual(["prop: false"]);
    });
  });

  describe("date and date & time", () => {
    it("accepts well-formed values and allows empty", () => {
      expect(lines({ type: "date", value: "2025-01-31" })).toEqual(["prop: 2025-01-31"]);
      expect(lines({ type: "date", value: "" })).toEqual(["prop:"]);
      expect(lines({ type: "datetime", value: "2025-01-31T09:30" })).toEqual(["prop: 2025-01-31T09:30"]);
      expect(lines({ type: "datetime", value: "" })).toEqual(["prop:"]);
    });

    it("rejects malformed values", () => {
      expect(build({ type: "date", value: "31/01/2025" })).toEqual({ ok: false, error: "Enter a date as YYYY-MM-DD." });
      expect(build({ type: "date", value: "2025-01-31T09:30" })).toEqual({ ok: false, error: "Enter a date as YYYY-MM-DD." });
      expect(build({ type: "datetime", value: "2025-01-31" })).toEqual({
        ok: false,
        error: "Enter a date and time as YYYY-MM-DDTHH:mm.",
      });
    });
  });

  describe("list", () => {
    it("writes one item per line, skipping blanks and quoting items as needed", () => {
      expect(lines({ type: "list", value: "alpha\n\n  beta  \r\n1\nnote: x" })).toEqual([
        "prop:",
        "  - alpha",
        "  - beta",
        '  - "1"',
        '  - "note: x"',
      ]);
    });

    it("leaves an empty item to fill in when there are none", () => {
      expect(lines({ type: "list", value: "" })).toEqual(["prop:", "  - "]);
      expect(lines({ type: "list", value: " \n " })).toEqual(["prop:", "  - "]);
    });
  });
});

describe("typed values for the frontmatter API", () => {
  const valueOf = (type: PropertyEntryType, value: string) => {
    const result = buildPropertyEntry({ name: "p", type, value });
    return result.ok ? result.value : undefined;
  };
  it("gives each type its natural value", () => {
    expect(valueOf("text", " 007 ")).toBe("007");
    expect(valueOf("number", "3.5")).toBe(3.5);
    expect(valueOf("number", "")).toBeNull();
    expect(valueOf("checkbox", "true")).toBe(true);
    expect(valueOf("checkbox", "false")).toBe(false);
    expect(valueOf("date", "2025-01-31")).toBe("2025-01-31");
    expect(valueOf("datetime", "2025-01-31T09:30")).toBe("2025-01-31T09:30");
    expect(valueOf("list", "a\n\n b ")).toEqual(["a", "b"]);
    expect(valueOf("list", "")).toEqual([]);
  });
});
