// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { obsidianLog } from "obsidian";
import { renderFormulasSection } from "../../../../src/ribbon/bases/ui/formulasSection";
import { renderPropertiesSection, usedProperties } from "../../../../src/ribbon/bases/ui/propertiesSection";
import { renderSummariesSection } from "../../../../src/ribbon/bases/ui/summariesSection";
import { NONE } from "../../../../src/ribbon/bases/ui/context";
import { FUNCTIONS } from "../../../../src/ribbon/bases/functions";
import type { BaseConfig } from "../../../../src/ribbon/bases/model";
import { buttonLabeled, choose, click, harness, settingNamed, settingsNamed, texts, typeInto } from "../../../support/sections";

beforeEach(() => obsidianLog.reset());

const warnings = (el: HTMLElement) => [...el.querySelectorAll(".mod-warning")].map((n) => n.textContent);

describe("formulas section", () => {
  const config = (): BaseConfig => ({
    formulas: { total: "price * qty", broken: "f(" },
    views: [{ type: "table", name: "T", order: ["formula.total"] }],
  });

  it("lists formulas with their expressions and flags broken ones", () => {
    const h = harness(renderFormulasSection, config(), "formulas");
    const row = settingNamed("formula.total");
    expect(row.texts[0].getValue()).toBe("total");
    expect(row.textAreas[0].getValue()).toBe("price * qty");
    expect(warnings(h.el)).toContain('Missing ")".');
  });

  it("says so when there are no formulas", () => {
    const h = harness(renderFormulasSection, { views: [] }, "formulas");
    expect(texts(h.el, "p")).toContain("No formulas yet.");
  });

  it("edits an expression without redrawing, warning as it goes wrong", () => {
    const h = harness(renderFormulasSection, config(), "formulas");
    typeInto(settingNamed("formula.total").textAreas[0], "price * (qty");
    expect(h.state.config.formulas!.total).toBe("price * (qty");
    expect(h.applied.at(-1)!.rerender).toBe(false);
    expect(warnings(h.el)).toContain('Missing ")".');
    typeInto(settingNamed("formula.total").textAreas[0], "price * qty");
    expect(warnings(h.el).filter(Boolean)).toHaveLength(1); // only "broken" remains
  });

  it("renames a formula and its references when the name field is committed", () => {
    const h = harness(renderFormulasSection, config(), "formulas");
    const input = settingNamed("formula.total").texts[0].inputEl;
    input.value = " sum ";
    input.dispatchEvent(new Event("change"));
    expect(h.state.config.formulas).toEqual({ sum: "price * qty", broken: "f(" });
    expect(h.state.config.views![0].order).toEqual(["formula.sum"]);
  });

  it.each(["", "a.b", "total"])("ignores the invalid or unchanged rename %j", (name) => {
    const h = harness(renderFormulasSection, config(), "formulas");
    const field = settingNamed("formula.total").texts[0];
    field.inputEl.value = name;
    field.inputEl.dispatchEvent(new Event("change"));
    expect(h.applied).toEqual([]);
    expect(field.inputEl.value).toBe("total");
  });

  it("deletes a formula along with its column", () => {
    const h = harness(renderFormulasSection, config(), "formulas");
    click(settingNamed("formula.total").extraButtons[0]);
    expect(h.state.config.formulas).toEqual({ broken: "f(" });
    expect(h.state.config.views![0].order).toBeUndefined();
  });

  describe("function picker", () => {
    const pick = (name: string, group: string) => String(FUNCTIONS.findIndex((f) => f.group === group && f.name === name));

    it("inserts a function at the caret of an existing formula", () => {
      const h = harness(renderFormulasSection, config(), "formulas");
      const row = settingNamed("formula.total");
      const area = row.textAreas[0].inputEl;
      area.setSelectionRange(0, 5); // "price"
      choose(row.dropdowns[0], pick("round", "Number"));
      expect(area.value).toBe("price.round() * qty");
      expect(h.state.config.formulas!.total).toBe("price.round() * qty");
      expect(row.dropdowns[0].getValue()).toBe(NONE);
    });

    it("lists every function with its group and signature", () => {
      harness(renderFormulasSection, config(), "formulas");
      const options = settingNamed("formula.total").dropdowns[0].options;
      expect(options.size).toBe(FUNCTIONS.length + 1);
      expect(options.get(pick("hasTag", "File"))).toBe('File: file.hasTag(tag, …)');
    });

    it("ignores the placeholder entry", () => {
      const h = harness(renderFormulasSection, config(), "formulas");
      choose(settingNamed("formula.total").dropdowns[0], NONE);
      expect(h.applied).toEqual([]);
    });
  });

  describe("adding a formula", () => {
    const add = (h: ReturnType<typeof harness>, name: string, expression: string) => {
      const row = settingNamed("Name and expression");
      typeInto(row.texts[0], name);
      typeInto(row.textAreas[0], expression);
      click(row.buttons[0]);
      return h;
    };

    it("adds a valid formula", () => {
      const h = add(harness(renderFormulasSection, config(), "formulas"), " double ", " formula.total * 2 ");
      expect(h.state.config.formulas!.double).toBe("formula.total * 2");
    });

    it.each([
      ["", "1", "Give the formula a name without a period."],
      ["a.b", "1", "Give the formula a name without a period."],
      ["total", "1", 'A formula named "total" already exists.'],
      ["x", "", "The expression is empty."],
      ["x", "f(", 'Missing ")".'],
    ])("rejects %j / %j", (name, expression, message) => {
      const h = add(harness(renderFormulasSection, config(), "formulas"), name, expression);
      expect(h.applied).toEqual([]);
      expect(warnings(h.el).at(-1)).toBe(message);
    });

    it("lets the function picker fill the new formula's expression", () => {
      const h = harness(renderFormulasSection, config(), "formulas");
      const row = settingNamed("Name and expression");
      choose(row.dropdowns[0], String(FUNCTIONS.findIndex((f) => f.group === "Global" && f.name === "today")));
      typeInto(row.texts[0], "now");
      click(row.buttons[0]);
      expect(h.state.config.formulas!.now).toBe("today()");
    });
  });
});

describe("properties section", () => {
  const config = (): BaseConfig => ({
    formulas: { total: "1" },
    properties: { "note.status": { displayName: "State" } },
    views: [{ type: "table", name: "T", order: ["file.name"], sort: [{ property: "file.mtime", direction: "ASC" }], groupBy: { property: "note.done", direction: "ASC" } }],
  });

  it("lists every property the base uses, with its display name", () => {
    expect(usedProperties(config()).sort()).toEqual(["file.mtime", "file.name", "formula.total", "note.done", "note.status"]);
    harness(renderPropertiesSection, config(), "properties");
    expect(settingNamed("note.status").texts[0].getValue()).toBe("State");
    expect(settingNamed("file.name").texts[0].getValue()).toBe("");
  });

  it("sets and clears display names without redrawing", () => {
    const h = harness(renderPropertiesSection, config(), "properties");
    typeInto(settingNamed("file.name").texts[0], "Note");
    expect(h.state.config.properties!["file.name"]).toEqual({ displayName: "Note" });
    expect(h.applied.at(-1)!.rerender).toBe(false);
    typeInto(settingNamed("note.status").texts[0], "");
    expect(h.state.config.properties).toEqual({ "file.name": { displayName: "Note" } });
  });

  it("names a property that isn't used yet", () => {
    const h = harness(renderPropertiesSection, config(), "properties");
    const row = settingNamed("Name another property");
    expect(row.dropdowns[0].options.has("file.name")).toBe(false);
    choose(row.dropdowns[0], "file.size");
    typeInto(row.texts[0], "Bytes");
    click(row.buttons[0]);
    expect(h.state.config.properties!["file.size"]).toEqual({ displayName: "Bytes" });
  });

  it("ignores a blank name for another property", () => {
    const h = harness(renderPropertiesSection, config(), "properties");
    click(settingNamed("Name another property").buttons[0]);
    expect(h.applied).toEqual([]);
  });

  it("points to Views when nothing is used yet", () => {
    const h = harness(renderPropertiesSection, {}, "properties");
    expect(texts(h.el, "p").join(" ")).toContain("Add columns in Views");
  });
});

describe("summaries section", () => {
  const config = (): BaseConfig => ({ summaries: { Mine: "values.sum()", Bad: "f(" }, views: [{ type: "table", name: "T" }] });

  it("lists the built-ins in its help text and the custom summaries", () => {
    const h = harness(renderSummariesSection, config(), "summaries");
    expect(texts(h.el, "p")[0]).toContain("Average");
    expect(settingNamed("Mine").texts[0].getValue()).toBe("values.sum()");
    expect(warnings(h.el)).toContain('Missing ")".');
  });

  it("edits a summary live and deletes it", () => {
    const h = harness(renderSummariesSection, config(), "summaries");
    typeInto(settingNamed("Mine").texts[0], "values.max()");
    expect(h.state.config.summaries!.Mine).toBe("values.max()");
    expect(h.applied.at(-1)!.rerender).toBe(false);
    click(settingNamed("Mine").extraButtons[0]);
    expect(h.state.config.summaries).toEqual({ Bad: "f(" });
  });

  it("adds a custom summary", () => {
    const h = harness(renderSummariesSection, config(), "summaries");
    const row = settingNamed("Add a custom summary");
    typeInto(row.texts[0], " Total ");
    typeInto(row.texts[1], " values.sum() ");
    click(row.buttons[0]);
    expect(h.state.config.summaries!.Total).toBe("values.sum()");
  });

  it.each([
    ["", "values.sum()", "Give the summary a name."],
    ["Sum", "values.sum()", '"Sum" is already a summary.'],
    ["Mine", "values.sum()", '"Mine" is already a summary.'],
    ["New", "", "The expression is empty."],
    ["New", "f(", 'Missing ")".'],
  ])("rejects %j / %j", (name, expression, message) => {
    const h = harness(renderSummariesSection, config(), "summaries");
    const row = settingNamed("Add a custom summary");
    typeInto(row.texts[0], name);
    typeInto(row.texts[1], expression);
    click(row.buttons[0]);
    expect(h.applied).toEqual([]);
    expect(warnings(h.el).at(-1)).toBe(message);
  });

  it("says so when there are none", () => {
    const h = harness(renderSummariesSection, { views: [] }, "summaries");
    expect(texts(h.el, "p")).toContain("No custom summaries.");
  });
});
