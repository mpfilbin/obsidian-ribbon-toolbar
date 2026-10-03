// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createdSettings, obsidianLog } from "obsidian";
import { renderFilterEditor, renderFiltersSection } from "../../../../src/ribbon/bases/ui/filtersSection";
import type { BaseConfig } from "../../../../src/ribbon/bases/model";
import { buttonLabeled, choose, click, harness, settingNamed, settingsNamed, texts, typeInto } from "../../../support/sections";

beforeEach(() => obsidianLog.reset());

const config = (): BaseConfig => ({
  filters: { and: ['file.hasTag("a")', { or: ["x", "y"] }] },
  views: [
    { type: "table", name: "Table" },
    { type: "cards", name: "Cards", filters: 'note.status == "open"' },
  ],
});

const warning = (el: HTMLElement) => el.querySelector(".mod-warning")!.textContent;

describe("filters section", () => {
  it("explains base-wide versus per-view filters and lists scopes", () => {
    const h = harness(renderFiltersSection, config(), "filters");
    expect(texts(h.el, "p")[0]).toContain("apply to every view");
    const scope = settingNamed("Filters for").dropdowns[0];
    expect([...scope.options.entries()]).toEqual([
      ["base", "All views"],
      ["0", "View: Table"],
      ["1", "View: Cards"],
    ]);
    expect(scope.getValue()).toBe("base");
  });

  it("switches scope and shows that scope's conditions", () => {
    const h = harness(renderFiltersSection, config(), "filters");
    choose(settingNamed("Filters for").dropdowns[0], "1");
    expect(h.state.filterScope).toBe(1);
    expect(settingNamed('note.status == "open"')).toBeDefined();
    choose(settingNamed("Filters for").dropdowns[0], "base");
    expect(h.state.filterScope).toBe("base");
  });

  it("falls back to the whole base when the scoped view is gone", () => {
    const h = harness(renderFiltersSection, config(), "filters");
    h.state.filterScope = 7;
    h.redraw();
    expect(h.state.filterScope).toBe("base");
  });
});

describe("filter list", () => {
  const render = (c: BaseConfig, scope: "base" | number = "base") =>
    harness((el, ctx) => renderFilterEditor(el, ctx, scope), c);

  it("shows each condition, describing nested groups briefly", () => {
    render(config());
    expect(settingNamed('file.hasTag("a")')).toBeDefined();
    expect(settingNamed("any of 2 nested conditions")).toBeDefined();
  });

  it("changes the match mode", () => {
    const h = render(config());
    const mode = settingNamed("Match").dropdowns[0];
    expect(mode.getValue()).toBe("and");
    expect([...mode.options.keys()]).toEqual(["and", "or", "not"]);
    choose(mode, "or");
    expect(h.state.config.filters).toEqual({ or: ['file.hasTag("a")', { or: ["x", "y"] }] });
  });

  it("removes a condition, and the filter when it was the last", () => {
    const h = render({ filters: { and: ["a"] }, views: [] });
    click(settingNamed("a").extraButtons[0]);
    expect(h.state.config.filters).toBeUndefined();
    expect(texts(h.el, "p")[0]).toBe("No filters: every note matches.");
    expect(settingsNamed("Match")).toHaveLength(0);
  });
});

describe("condition builder", () => {
  const render = (c: BaseConfig = { views: [{ type: "table", name: "T" }] }) =>
    harness((el, ctx) => renderFilterEditor(el, ctx, "base"), c);

  const add = () => click(buttonLabeled("Add condition"));

  it("builds a text condition from property, operator and value", () => {
    const h = render();
    choose(settingNamed("Property").dropdowns[0], "note.status");
    expect([...settingNamed("Condition").dropdowns[0].options.keys()]).toContain("starts-with");
    choose(settingNamed("Condition").dropdowns[0], "contains");
    typeInto(settingNamed("Value").texts[0], "open");
    add();
    expect(h.state.config.filters).toEqual({ and: ['note.status.contains("open")'] });
  });

  it("adapts the operators to the property's type", () => {
    render();
    choose(settingNamed("Property").dropdowns[0], "file.size");
    expect([...settingNamed("Condition").dropdowns[0].options.keys()]).toContain("gt");
    choose(settingNamed("Property").dropdowns[0], "note.done");
    expect([...settingNamed("Condition").dropdowns[0].options.keys()]).toEqual(["true", "false"]);
    // Checkbox conditions need no value, so the form ends at the operator.
    expect(createdSettings.at(-1)!.name).toBe("Condition");
    choose(settingNamed("Property").dropdowns[0], "file.mtime");
    expect(settingNamed("Value").texts[0].inputEl.placeholder).toBe("YYYY-MM-DD");
  });

  it("builds number, date and checkbox conditions", () => {
    const h = render();
    choose(settingNamed("Property").dropdowns[0], "file.size");
    choose(settingNamed("Condition").dropdowns[0], "gt");
    typeInto(settingNamed("Value").texts[0], "100");
    add();
    choose(settingNamed("Property").dropdowns[0], "file.mtime");
    choose(settingNamed("Condition").dropdowns[0], "last-days");
    typeInto(settingNamed("Value").texts[0], "7");
    add();
    choose(settingNamed("Property").dropdowns[0], "note.done");
    add();
    expect(h.state.config.filters).toEqual({ and: ["file.size > 100", 'file.mtime > now() - "7 days"', "note.done == true"] });
  });

  it("shows why a condition can't be added, and doesn't add it", () => {
    const h = render();
    add();
    expect(warning(h.el)).toBe("Enter a value.");
    choose(settingNamed("Property").dropdowns[0], "file.size");
    typeInto(settingNamed("Value").texts[0], "abc");
    add();
    expect(warning(h.el)).toBe("Enter a number.");
    expect(h.applied).toEqual([]);
  });

  it.each([
    ["tag", "Tags", "project, work", 'file.hasTag("project", "work")'],
    ["folder", "Folder", "Projects", 'file.inFolder("Projects")'],
    ["hasProperty", "Property name", "due", 'file.hasProperty("due")'],
    ["raw", "Expression", "a > 1", "a > 1"],
  ])("builds a %s condition", (type, label, input, expected) => {
    const h = render();
    choose(settingNamed("Add a condition").dropdowns[0], type);
    typeInto(settingNamed(label).texts[0], input);
    add();
    expect(h.state.config.filters).toEqual({ and: [expected] });
  });

  it.each([
    ["linksToThis", "file.hasLink(this.file)"],
    ["linkedFromThis", "this.file.hasLink(file)"],
  ])("builds the input-free %s condition", (type, expected) => {
    const h = render();
    choose(settingNamed("Add a condition").dropdowns[0], type);
    add();
    expect(h.state.config.filters).toEqual({ and: [expected] });
  });

  it.each([
    ["modified", 'file.mtime > now() - "30 days"'],
    ["created", 'file.ctime > now() - "30 days"'],
  ])("builds a %s-in-the-last-days condition", (type, expected) => {
    const h = render();
    choose(settingNamed("Add a condition").dropdowns[0], type);
    typeInto(settingNamed("Days").texts[0], "30");
    add();
    expect(h.state.config.filters).toEqual({ and: [expected] });
  });

  it("clears an earlier error when the form changes", () => {
    const h = render();
    add();
    expect(warning(h.el)).not.toBe("");
    choose(settingNamed("Add a condition").dropdowns[0], "folder");
    expect(warning(h.el)).toBe("");
  });

  it("targets the selected view's filters when scoped to a view", () => {
    const h = harness((el, ctx) => renderFilterEditor(el, ctx, 0), { views: [{ type: "table", name: "T" }] });
    choose(settingNamed("Add a condition").dropdowns[0], "linksToThis");
    add();
    expect(h.state.config.views![0].filters).toEqual({ and: ["file.hasLink(this.file)"] });
  });
});
