import { describe, expect, it } from "vitest";
import {
  addCondition,
  addView,
  checkExpression,
  describeCondition,
  duplicateView,
  emptyBase,
  filterGroup,
  getPropertyDisplayName,
  moveView,
  parseOptionValue,
  moveViewColumn,
  removeCondition,
  removeCustomSummary,
  removeFormula,
  removeView,
  renameFormula,
  replaceCondition,
  setCustomSummary,
  setFilterMode,
  setFormula,
  setPropertyDisplayName,
  setViewColumns,
  setViewGroupBy,
  setViewLimit,
  setViewName,
  setViewOption,
  setViewSort,
  setViewSummary,
  toggleViewColumn,
  uniqueViewName,
  updateView,
  validateBase,
} from "../../../src/ribbon/bases/ops";
import type { BaseConfig } from "../../../src/ribbon/bases/model";

const twoViews = (): BaseConfig => ({
  views: [
    { type: "table", name: "Table" },
    { type: "cards", name: "Cards" },
  ],
});

describe("emptyBase", () => {
  it("is a single table view", () => {
    expect(emptyBase()).toEqual({ views: [{ type: "table", name: "Table" }] });
    expect(emptyBase("cards")).toEqual({ views: [{ type: "cards", name: "Cards" }] });
    expect(emptyBase("list", "Tasks").views![0].name).toBe("Tasks");
  });
});

describe("views", () => {
  it("never mutates its input", () => {
    const original = twoViews();
    const snapshot = JSON.stringify(original);
    addView(original, "list");
    removeView(original, 0);
    setViewName(original, 0, "x");
    moveView(original, 0, 1);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it("adds a view with a default or given name, unique among views", () => {
    const first = addView(twoViews(), "list");
    expect(first.config.views!.map((v) => v.name)).toEqual(["Table", "Cards", "List"]);
    expect(first.index).toBe(2);
    const second = addView(first.config, "list");
    expect(second.config.views![3].name).toBe("List 2");
    expect(addView(twoViews(), "table", "  Mine ").config.views![2].name).toBe("Mine");
  });

  it("creates the views list when missing", () => {
    expect(addView({}, "table").config.views).toEqual([{ type: "table", name: "Table" }]);
  });

  it("uniqueViewName appends the next free number", () => {
    const config: BaseConfig = { views: [{ type: "table", name: "A" }, { type: "table", name: "A 2" }] };
    expect(uniqueViewName(config, "A")).toBe("A 3");
    expect(uniqueViewName(config, "B")).toBe("B");
  });

  it("removes, duplicates and reorders views", () => {
    expect(removeView(twoViews(), 0).views!.map((v) => v.name)).toEqual(["Cards"]);

    const dup = duplicateView(twoViews(), 0);
    expect(dup.config.views!.map((v) => v.name)).toEqual(["Table", "Table copy", "Cards"]);
    expect(dup.index).toBe(1);

    const moved = moveView(twoViews(), 0, 1);
    expect(moved.config.views!.map((v) => v.name)).toEqual(["Cards", "Table"]);
    expect(moved.index).toBe(1);
    expect(moveView(twoViews(), 0, -1).index).toBe(0);
    expect(moveView(twoViews(), 1, 1).config.views!.map((v) => v.name)).toEqual(["Table", "Cards"]);
  });

  it("renames a view, keeping names unique and ignoring blanks", () => {
    expect(setViewName(twoViews(), 0, "Board").views![0].name).toBe("Board");
    expect(setViewName(twoViews(), 0, "Cards").views![0].name).toBe("Cards 2");
    expect(setViewName(twoViews(), 0, "Table").views![0].name).toBe("Table");
    expect(setViewName(twoViews(), 0, "   ").views![0].name).toBe("Table");
  });

  it("updateView merges keys and removes ones set to undefined or empty arrays", () => {
    let config = updateView(twoViews(), 0, { limit: 5, order: ["file.name"] });
    expect(config.views![0]).toMatchObject({ limit: 5, order: ["file.name"] });
    config = updateView(config, 0, { limit: undefined, order: [] });
    expect(config.views![0]).toEqual({ type: "table", name: "Table" });
    expect(updateView(twoViews(), 9, { limit: 1 })).toEqual(twoViews());
  });

  it("sets sort, group, limit and options", () => {
    let config = setViewSort(twoViews(), 0, [{ property: "file.mtime", direction: "DESC" }]);
    expect(config.views![0].sort).toEqual([{ property: "file.mtime", direction: "DESC" }]);
    config = setViewSort(config, 0, []);
    expect(config.views![0].sort).toBeUndefined();

    config = setViewGroupBy(config, 0, "note.status", "DESC");
    expect(config.views![0].groupBy).toEqual({ property: "note.status", direction: "DESC" });
    expect(setViewGroupBy(config, 0, null).views![0].groupBy).toBeUndefined();

    expect(setViewLimit(config, 0, 10.7).views![0].limit).toBe(10);
    expect(setViewLimit(setViewLimit(config, 0, 10), 0, 0).views![0].limit).toBeUndefined();
    expect(setViewLimit(config, 0, null).views![0].limit).toBeUndefined();
    expect(setViewLimit(config, 0, NaN).views![0].limit).toBeUndefined();

    config = setViewOption(config, 1, "cardSize", 200);
    expect(config.views![1].cardSize).toBe(200);
    expect(setViewOption(config, 1, "cardSize", "").views![1].cardSize).toBeUndefined();
  });

  it("manages columns", () => {
    let config = setViewColumns(twoViews(), 0, ["file.name"]);
    config = toggleViewColumn(config, 0, "note.status", true);
    expect(config.views![0].order).toEqual(["file.name", "note.status"]);
    config = toggleViewColumn(config, 0, "file.name", true);
    expect(config.views![0].order).toEqual(["note.status", "file.name"]);
    config = moveViewColumn(config, 0, "file.name", -1);
    expect(config.views![0].order).toEqual(["file.name", "note.status"]);
    expect(moveViewColumn(config, 0, "file.name", -1).views![0].order).toEqual(["file.name", "note.status"]);
    config = toggleViewColumn(config, 0, "file.name", false);
    expect(config.views![0].order).toEqual(["note.status"]);
  });

  it("sets and clears per-column summaries", () => {
    let config = setViewSummary(twoViews(), 0, "note.price", "Sum");
    expect(config.views![0].summaries).toEqual({ "note.price": "Sum" });
    config = setViewSummary(config, 0, "note.price", null);
    expect(config.views![0].summaries).toBeUndefined();
  });
});

describe("filters", () => {
  it("builds an and-group from the first condition, then appends", () => {
    let config = addCondition({}, "base", 'file.hasTag("a")');
    expect(config.filters).toEqual({ and: ['file.hasTag("a")'] });
    config = addCondition(config, "base", "x > 1");
    expect(config.filters).toEqual({ and: ['file.hasTag("a")', "x > 1"] });
  });

  it("wraps a bare string filter when adding", () => {
    expect(addCondition({ filters: "a" }, "base", "b").filters).toEqual({ and: ["a", "b"] });
  });

  it("scopes filters to a view", () => {
    const config = addCondition(twoViews(), 1, "x");
    expect(config.views![1].filters).toEqual({ and: ["x"] });
    expect(config.filters).toBeUndefined();
    expect(config.views![0].filters).toBeUndefined();
  });

  it("removes conditions and clears the filter when none remain", () => {
    let config = addCondition(addCondition({}, "base", "a"), "base", "b");
    config = removeCondition(config, "base", 0);
    expect(config.filters).toEqual({ and: ["b"] });
    config = removeCondition(config, "base", 0);
    expect(config.filters).toBeUndefined();
    expect("filters" in config).toBe(false);
  });

  it("replaces a condition in place and ignores bad indexes", () => {
    const config = addCondition(addCondition({}, "base", "a"), "base", "b");
    expect(replaceCondition(config, "base", 1, "c").filters).toEqual({ and: ["a", "c"] });
    expect(replaceCondition(config, "base", 5, "c").filters).toEqual({ and: ["a", "b"] });
  });

  it("switches the group mode, keeping the conditions", () => {
    const config = addCondition(addCondition({}, "base", "a"), "base", "b");
    expect(setFilterMode(config, "base", "or").filters).toEqual({ or: ["a", "b"] });
    expect(setFilterMode(config, "base", "not").filters).toEqual({ not: ["a", "b"] });
    expect(setFilterMode({}, "base", "or").filters).toBeUndefined();
  });

  it("filterGroup normalises strings, groups and unknown shapes", () => {
    expect(filterGroup(undefined)).toBeNull();
    expect(filterGroup("a")).toEqual({ mode: "and", items: ["a"] });
    expect(filterGroup({ or: ["a", "b"] })).toEqual({ mode: "or", items: ["a", "b"] });
    expect(filterGroup({} as never)).toBeNull();
  });

  it("describes nested groups briefly", () => {
    expect(describeCondition("a > 1")).toBe("a > 1");
    expect(describeCondition({ or: ["a", "b"] })).toBe("any of 2 nested conditions");
    expect(describeCondition({ not: ["a"] })).toBe("none of 1 nested condition");
    expect(describeCondition({ and: ["a"] })).toBe("all of 1 nested condition");
  });
});

describe("formulas", () => {
  const withFormulas = (): BaseConfig => ({
    formulas: { total: "price * qty", double: "formula.total * 2" },
    properties: { "formula.total": { displayName: "Total" } },
    views: [
      {
        type: "table",
        name: "T",
        order: ["file.name", "formula.total"],
        sort: [{ property: "formula.total", direction: "DESC" }],
        groupBy: { property: "formula.total", direction: "ASC" },
        summaries: { "formula.total": "Sum" },
      },
    ],
  });

  it("adds and overwrites formulas", () => {
    expect(setFormula({}, " total ", "a + b").formulas).toEqual({ total: "a + b" });
    expect(setFormula(withFormulas(), "total", "x").formulas!.total).toBe("x");
  });

  it("removing a formula also removes its column, sort, group, summary and display name", () => {
    const config = removeFormula(withFormulas(), "total");
    expect(config.formulas).toEqual({ double: "formula.total * 2" });
    expect(config.properties).toBeUndefined();
    expect(config.views![0]).toEqual({ type: "table", name: "T", order: ["file.name"] });
  });

  it("removing the last formula drops the formulas key", () => {
    expect("formulas" in removeFormula({ formulas: { a: "1" } }, "a")).toBe(false);
  });

  it("renaming a formula updates every reference", () => {
    const config = renameFormula(withFormulas(), "total", "sum");
    expect(config.formulas).toEqual({ sum: "price * qty", double: "formula.sum * 2" });
    expect(config.properties).toEqual({ "formula.sum": { displayName: "Total" } });
    const view = config.views![0];
    expect(view.order).toEqual(["file.name", "formula.sum"]);
    expect(view.sort).toEqual([{ property: "formula.sum", direction: "DESC" }]);
    expect(view.groupBy).toEqual({ property: "formula.sum", direction: "ASC" });
    expect(view.summaries).toEqual({ "formula.sum": "Sum" });
  });

  it("renaming leaves similarly named formulas alone and ignores no-ops", () => {
    const config = renameFormula({ formulas: { a: "1", ab: "formula.a + formula.ab" } }, "a", "z");
    expect(config.formulas).toEqual({ z: "1", ab: "formula.z + formula.ab" });
    const same = withFormulas();
    expect(renameFormula(same, "total", "total")).toEqual(same);
    expect(renameFormula(same, "missing", "x")).toEqual(same);
    expect(renameFormula(same, "total", "  ")).toEqual(same);
  });

  it("renames formulas whose names contain regex characters", () => {
    const config = renameFormula({ formulas: { "a+b": "1", c: "formula.a+b" } }, "a+b", "ab");
    expect(config.formulas).toEqual({ ab: "1", c: "formula.ab" });
  });
});

describe("properties", () => {
  it("sets, reads and clears display names, pruning empty objects", () => {
    let config = setPropertyDisplayName({}, "note.status", "  State ");
    expect(config.properties).toEqual({ "note.status": { displayName: "State" } });
    expect(getPropertyDisplayName(config, "note.status")).toBe("State");
    expect(getPropertyDisplayName(config, "note.other")).toBe("");
    config = setPropertyDisplayName(config, "note.status", "");
    expect("properties" in config).toBe(false);
  });

  it("keeps other settings on the property when clearing the display name", () => {
    const config = setPropertyDisplayName({ properties: { p: { displayName: "x", width: 3 } } }, "p", "");
    expect(config.properties).toEqual({ p: { width: 3 } });
  });
});

describe("custom summaries", () => {
  it("adds and removes them, clearing view references to a removed summary", () => {
    let config = setCustomSummary({ views: [{ type: "table", name: "T", summaries: { "note.x": "Mine", "note.y": "Sum" } }] }, "Mine", "values.sum()");
    expect(config.summaries).toEqual({ Mine: "values.sum()" });
    config = removeCustomSummary(config, "Mine");
    expect("summaries" in config).toBe(false);
    expect(config.views![0].summaries).toEqual({ "note.y": "Sum" });
    expect(removeCustomSummary({ views: [{ type: "table", name: "T", summaries: { a: "Mine" } }] }, "Mine").views![0].summaries).toBeUndefined();
  });
});

describe("checkExpression", () => {
  it.each([
    ['file.hasTag("a")', null],
    ['status == "a (b"', null],
    ["list(1, [2, 3])", null],
    ["", "The expression is empty."],
    ["   ", "The expression is empty."],
    ["f(1", 'Missing ")".'],
    ["f(1))", 'Unexpected ")".'],
    ['"open', "A quote is never closed."],
    ["[1, 2)", 'Unexpected ")".'],
    ['say("a \\" b")', null],
  ])("%j -> %j", (expression, expected) => {
    expect(checkExpression(expression)).toBe(expected);
  });
});

describe("validateBase", () => {
  it("accepts a sound base", () => {
    expect(validateBase({ filters: { and: ['file.hasTag("a")'] }, formulas: { total: "a * b" }, views: [{ type: "table", name: "T" }] })).toEqual([]);
  });

  it("flags a base with no views", () => {
    expect(validateBase({}).map((p) => p.where)).toContain("Views");
  });

  it("flags unknown view types, missing and duplicate names", () => {
    const problems = validateBase({
      views: [
        { type: "timeline", name: "A" },
        { type: "table", name: "" },
        { type: "table", name: "A" },
      ],
    });
    const messages = problems.map((p) => p.message);
    expect(messages).toContain('Unknown view type "timeline".');
    expect(messages).toContain("A view needs a name.");
    expect(messages).toContain("Another view has the same name.");
  });

  it("flags broken formulas, summaries and filters, including nested ones", () => {
    const problems = validateBase({
      filters: { and: ["a == (", { or: ['b == "x'] }] },
      formulas: { "bad.name": "1", empty: "", open: "f(" },
      summaries: { S: "values.sum(" },
      views: [{ type: "table", name: "T", filters: "x ==)" }],
    });
    const where = problems.map((p) => p.where);
    expect(where).toContain("Filters");
    expect(where).toContain('Formula "bad.name"');
    expect(where).toContain('Formula "empty"');
    expect(where).toContain('Formula "open"');
    expect(where).toContain('Summary "S"');
    expect(where).toContain("View 1 (T)");
    expect(problems.filter((p) => p.where === "Filters")).toHaveLength(2);
  });

  it("flags an unrecognised filter group", () => {
    expect(validateBase({ filters: {} as never, views: [{ type: "table", name: "T" }] }).map((p) => p.message)).toContain(
      "A filter group must be and / or / not with a list of conditions."
    );
  });
});

describe("parseOptionValue", () => {
  it.each([
    ["true", true],
    [" false ", false],
    ["42", 42],
    ["-1.5", -1.5],
    ["cover", "cover"],
    ["", ""],
    ["12px", "12px"],
  ])("%j -> %j", (input, expected) => {
    expect(parseOptionValue(input)).toBe(expected);
  });
});
