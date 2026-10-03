// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { obsidianLog } from "obsidian";
import { renderViewsSection } from "../../../../src/ribbon/bases/ui/viewsSection";
import { NONE } from "../../../../src/ribbon/bases/ui/context";
import type { BaseConfig } from "../../../../src/ribbon/bases/model";
import { buttonLabeled, choose, click, harness, settingNamed, settingsNamed, texts, typeInto } from "../../../support/sections";

beforeEach(() => obsidianLog.reset());

const base = (): BaseConfig => ({
  summaries: { Mine: "values.sum()" },
  views: [
    { type: "table", name: "Table", order: ["file.name", "note.status"], sort: [{ property: "file.mtime", direction: "DESC" }], limit: 5, cardSize: 200 },
    { type: "cards", name: "Cards" },
  ],
});

const views = (h: { state: { config: BaseConfig } }) => h.state.config.views!;

describe("view list", () => {
  it("lists each view with its type and marks the one being edited", () => {
    const h = harness(renderViewsSection, base());
    expect(settingNamed("Table").desc).toBe("Table · editing");
    expect(settingNamed("Cards").desc).toBe("Cards");
    expect(h.el.querySelector("h4")!.textContent).toBe("Views");
    expect(settingNamed("Table").settingEl.classList.contains("is-active")).toBe(true);
  });

  it("selects another view to edit", () => {
    const h = harness(renderViewsSection, base());
    click(settingNamed("Cards").buttons[0]);
    expect(h.state.viewIndex).toBe(1);
    expect(texts(h.el, "h4")).toContain('Settings for "Cards"');
  });

  it("moves views, keeping the edited view selected", () => {
    const h = harness(renderViewsSection, base());
    click(settingNamed("Table").extraButtons[1]); // down
    expect(views(h).map((v) => v.name)).toEqual(["Cards", "Table"]);
    expect(h.state.viewIndex).toBe(1);
    click(settingNamed("Table").extraButtons[0]); // up
    expect(views(h).map((v) => v.name)).toEqual(["Table", "Cards"]);
  });

  it("does nothing when moving past either end", () => {
    const h = harness(renderViewsSection, base());
    click(settingNamed("Table").extraButtons[0]);
    click(settingNamed("Cards").extraButtons[1]);
    expect(h.applied).toEqual([]);
  });

  it("duplicates a view and selects the copy", () => {
    const h = harness(renderViewsSection, base());
    click(settingNamed("Table").extraButtons[2]);
    expect(views(h).map((v) => v.name)).toEqual(["Table", "Table copy", "Cards"]);
    expect(h.state.viewIndex).toBe(1);
  });

  it("deletes a view but never the last one", () => {
    const h = harness(renderViewsSection, base());
    click(settingNamed("Cards").extraButtons[3]);
    expect(views(h).map((v) => v.name)).toEqual(["Table"]);
    click(settingNamed("Table").extraButtons[3]);
    expect(views(h)).toHaveLength(1);
  });

  it("adds a view of a chosen type, with an optional name, and selects it", () => {
    const h = harness(renderViewsSection, base());
    const row = settingNamed("Add a view");
    choose(row.dropdowns[0], "list");
    typeInto(row.texts[0], "Tasks");
    click(row.buttons[0]);
    expect(views(h)[2]).toEqual({ type: "list", name: "Tasks" });
    expect(h.state.viewIndex).toBe(2);
  });

  it("clamps the selection when the selected view no longer exists", () => {
    const h = harness(renderViewsSection, base());
    h.state.viewIndex = 9;
    h.redraw();
    expect(h.state.viewIndex).toBe(1);
  });

  it("copes with a base that has no views", () => {
    const h = harness(renderViewsSection, {});
    expect(settingNamed("Add a view")).toBeDefined();
    expect(h.state.viewIndex).toBe(0);
  });
});

describe("selected view settings", () => {
  it("renames without redrawing until focus leaves the field", () => {
    const h = harness(renderViewsSection, base());
    const name = settingNamed("Name");
    typeInto(name.texts[0], "Board");
    expect(views(h)[0].name).toBe("Board");
    expect(h.applied.at(-1)!.rerender).toBe(false);
  });

  it("changes the view type", () => {
    const h = harness(renderViewsSection, base());
    choose(settingNamed("Type").dropdowns[0], "list");
    expect(views(h)[0].type).toBe("list");
  });

  it("offers an unknown existing type so it isn't lost", () => {
    const h = harness(renderViewsSection, { views: [{ type: "timeline", name: "T" }] });
    expect(settingNamed("Type").dropdowns[0].options.has("timeline")).toBe(true);
    expect(h.state.config.views![0].type).toBe("timeline");
  });

  describe("columns", () => {
    it("lists, reorders and removes columns", () => {
      const h = harness(renderViewsSection, base());
      click(settingNamed("note.status", 0).extraButtons[0]); // up
      expect(views(h)[0].order).toEqual(["note.status", "file.name"]);
      click(settingNamed("note.status", 0).extraButtons[1]); // down
      expect(views(h)[0].order).toEqual(["file.name", "note.status"]);
      click(settingNamed("note.status", 0).extraButtons[2]); // remove
      expect(views(h)[0].order).toEqual(["file.name"]);
    });

    it("adds a column from the properties not yet shown", () => {
      const h = harness(renderViewsSection, base());
      const add = settingNamed("Add a column");
      expect(add.dropdowns[0].options.has("file.name")).toBe(false);
      choose(add.dropdowns[0], "note.done");
      click(add.buttons[0]);
      expect(views(h)[0].order).toEqual(["file.name", "note.status", "note.done"]);
    });

    it("adds the first available column by default", () => {
      const h = harness(renderViewsSection, base());
      click(settingNamed("Add a column").buttons[0]);
      expect(views(h)[0].order).toContain("file.mtime");
    });

    it("says so when no columns are chosen", () => {
      const h = harness(renderViewsSection, base());
      h.state.viewIndex = 1;
      h.redraw();
      expect(texts(h.el, "p").join(" ")).toContain("No columns chosen");
    });
  });

  describe("sort", () => {
    it("shows existing sorts and edits property, direction and removal", () => {
      const h = harness(renderViewsSection, base());
      const row = settingNamed("Sort by");
      expect(row.dropdowns[0].getValue()).toBe("file.mtime");
      expect(row.dropdowns[1].getValue()).toBe("DESC");

      choose(row.dropdowns[0], "file.size");
      expect(views(h)[0].sort).toEqual([{ property: "file.size", direction: "DESC" }]);
      choose(settingNamed("Sort by").dropdowns[1], "ASC");
      expect(views(h)[0].sort).toEqual([{ property: "file.size", direction: "ASC" }]);
      click(settingNamed("Sort by").extraButtons[0]);
      expect(views(h)[0].sort).toBeUndefined();
    });

    it("adds sorts, labelling later ones 'Then by'", () => {
      const h = harness(renderViewsSection, base());
      click(buttonLabeled("Add another sort"));
      expect(views(h)[0].sort).toHaveLength(2);
      expect(settingsNamed("Then by")).toHaveLength(1);
    });

    it("offers 'Add a sort' when there are none", () => {
      const h = harness(renderViewsSection, base());
      h.state.viewIndex = 1;
      h.redraw();
      click(buttonLabeled("Add a sort"));
      expect(views(h)[1].sort).toEqual([{ property: "file.name", direction: "ASC" }]);
    });
  });

  describe("grouping", () => {
    it("sets, re-directs and clears grouping", () => {
      const h = harness(renderViewsSection, base());
      expect(settingNamed("Group by").dropdowns[0].getValue()).toBe(NONE);
      choose(settingNamed("Group by").dropdowns[0], "note.status");
      expect(views(h)[0].groupBy).toEqual({ property: "note.status", direction: "ASC" });
      choose(settingNamed("Group by").dropdowns[1], "DESC");
      expect(views(h)[0].groupBy).toEqual({ property: "note.status", direction: "DESC" });
      choose(settingNamed("Group by").dropdowns[0], NONE);
      expect(views(h)[0].groupBy).toBeUndefined();
      expect(settingNamed("Group by").dropdowns).toHaveLength(1);
    });

    it("keeps a grouping property no note has as a choice", () => {
      harness(renderViewsSection, { views: [{ type: "table", name: "T", groupBy: { property: "note.gone", direction: "ASC" } }] });
      expect(settingNamed("Group by").dropdowns[0].options.has("note.gone")).toBe(true);
    });
  });

  it("sets and clears the limit without redrawing", () => {
    const h = harness(renderViewsSection, base());
    expect(settingNamed("Limit").texts[0].getValue()).toBe("5");
    typeInto(settingNamed("Limit").texts[0], "12");
    expect(views(h)[0].limit).toBe(12);
    expect(h.applied.at(-1)!.rerender).toBe(false);
    typeInto(settingNamed("Limit").texts[0], "");
    expect(views(h)[0].limit).toBeUndefined();
  });

  describe("summaries", () => {
    it("offers built-in and custom summaries per column and applies the choice", () => {
      const h = harness(renderViewsSection, base());
      const row = settingNamed("file.name", 1); // the summaries row (the first is the column row)
      const options = [...row.dropdowns[0].options.keys()];
      expect(options).toContain("Sum");
      expect(options).toContain("Mine");
      choose(row.dropdowns[0], "Sum");
      expect(views(h)[0].summaries).toEqual({ "file.name": "Sum" });
      choose(settingNamed("file.name", 1).dropdowns[0], NONE);
      expect(views(h)[0].summaries).toBeUndefined();
    });

    it("keeps an unknown existing summary selectable", () => {
      harness(renderViewsSection, { views: [{ type: "table", name: "T", order: ["file.name"], summaries: { "file.name": "Legacy" } }] });
      const row = settingNamed("file.name", 1);
      expect(row.dropdowns[0].options.has("Legacy")).toBe(true);
      expect(row.dropdowns[0].getValue()).toBe("Legacy");
    });

    it("is hidden when the view has no columns", () => {
      const h = harness(renderViewsSection, base());
      h.state.viewIndex = 1;
      h.redraw();
      expect(texts(h.el, "h4")).not.toContain("Summaries");
    });
  });

  it("edits the selected view's own filters", () => {
    const h = harness(renderViewsSection, base());
    expect(texts(h.el, "h4")).toContain('Filters for "Table"');
    const add = settingNamed("Add a condition");
    choose(add.dropdowns[0], "linksToThis");
    click(buttonLabeled("Add condition"));
    expect(views(h)[0].filters).toEqual({ and: ["file.hasLink(this.file)"] });
    expect(h.state.config.filters).toBeUndefined();
  });

  describe("other options", () => {
    it("shows view-specific keys and edits them with typed values", () => {
      const h = harness(renderViewsSection, base());
      const row = settingNamed("cardSize");
      expect(row.texts[0].getValue()).toBe("200");
      typeInto(row.texts[0], "240");
      expect(views(h)[0].cardSize).toBe(240);
      expect(h.applied.at(-1)!.rerender).toBe(false);
      click(settingNamed("cardSize").extraButtons[0]);
      expect(views(h)[0].cardSize).toBeUndefined();
    });

    it("adds an option, converting the value's type", () => {
      const h = harness(renderViewsSection, base());
      const add = settingNamed("Add an option");
      typeInto(add.texts[0], " wrap ");
      typeInto(add.texts[1], "true");
      click(add.buttons[0]);
      expect(views(h)[0].wrap).toBe(true);
    });

    it("refuses blank keys and keys the editor already has controls for", () => {
      const h = harness(renderViewsSection, base());
      const add = settingNamed("Add an option");
      typeInto(add.texts[1], "x");
      click(add.buttons[0]);
      typeInto(add.texts[0], "limit");
      click(add.buttons[0]);
      expect(h.applied).toEqual([]);
    });

    it("shows structured option values but doesn't let them be overwritten as text", () => {
      harness(renderViewsSection, { views: [{ type: "table", name: "T", columnSize: { "file.name": 200 } }] });
      const field = settingNamed("columnSize").texts[0];
      expect(field.getValue()).toBe('{"file.name":200}');
      expect(field.inputEl.disabled).toBe(true);
    });
  });
});
