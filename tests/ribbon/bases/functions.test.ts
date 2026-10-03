import { describe, expect, it } from "vitest";
import { FUNCTION_GROUPS, FUNCTIONS, functionsInGroup, splitTemplate } from "../../../src/ribbon/bases/functions";
import { checkExpression } from "../../../src/ribbon/bases/ops";

describe("function catalog", () => {
  it("has a populated entry for every group", () => {
    for (const group of FUNCTION_GROUPS) expect(functionsInGroup(group).length, group).toBeGreaterThan(3);
  });

  it("gives every function a signature, description and a single cursor marker", () => {
    for (const f of FUNCTIONS) {
      expect(f.signature, f.name).not.toBe("");
      expect(f.description, f.name).not.toBe("");
      expect((f.template.match(/\$0/g) ?? []).length, `${f.group}.${f.name}`).toBeLessThanOrEqual(1);
    }
  });

  it("has no duplicate names within a group", () => {
    for (const group of FUNCTION_GROUPS) {
      const names = functionsInGroup(group).map((f) => f.name);
      expect(new Set(names).size, group).toBe(names.length);
    }
  });

  it("includes the commonly used functions", () => {
    const names = (group: Parameters<typeof functionsInGroup>[0]) => functionsInGroup(group).map((f) => f.name);
    expect(names("Global")).toEqual(expect.arrayContaining(["if", "now", "today", "date", "duration", "link", "list", "number"]));
    expect(names("File")).toEqual(expect.arrayContaining(["hasTag", "inFolder", "hasLink"]));
    expect(names("List")).toEqual(expect.arrayContaining(["contains", "filter", "map", "join"]));
  });

  it("produces balanced expressions once a template is inserted", () => {
    for (const f of FUNCTIONS) {
      const { before, after } = splitTemplate(f.template);
      expect(checkExpression(`x${before}${after}`), `${f.group}.${f.name}`).toBeNull();
    }
  });
});

describe("splitTemplate", () => {
  it("splits around the cursor marker", () => {
    expect(splitTemplate('date("$0")')).toEqual({ before: 'date("', after: '")' });
    expect(splitTemplate("now()$0")).toEqual({ before: "now()", after: "" });
  });

  it("treats a template without a marker as all-before", () => {
    expect(splitTemplate("x")).toEqual({ before: "x", after: "" });
  });
});
