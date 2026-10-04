// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, createdSettings, modals, obsidianLog } from "obsidian";
import { openAddPropertyModal } from "../../../../src/ribbon/commands/actions/propertyModal";
import { localDate, localDateTime } from "../../../../src/ribbon/commands/actions/propertyEntry";
import { createMockEditor } from "../../../support/mockEditor";
import { makeFile } from "../../../support/vault";
import { buttonLabeled, choose, click, settingNamed, typeInto } from "../../../support/sections";

beforeEach(() => {
  obsidianLog.reset();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

/** The dialog closes first and writes to the note on the next tick. */
const flush = () => vi.advanceTimersByTime(0);

/** An app whose vault has these notes' frontmatter, so property names can be suggested. */
function appWith(frontmatters: Record<string, unknown>[] = []) {
  const files = frontmatters.map((_, i) => makeFile(`n${i}.md`));
  const app = new App() as any;
  app.vault = { getMarkdownFiles: () => files };
  app.metadataCache = { getFileCache: (file: { path: string }) => ({ frontmatter: frontmatters[Number(file.path.slice(1, -3))] }) };
  return app;
}

function open(text = "body", frontmatters: Record<string, unknown>[] = []) {
  const editor = createMockEditor(text);
  const focus = vi.spyOn(editor, "focus");
  openAddPropertyModal(editor, appWith(frontmatters));
  const modal = modals.at(-1) as any;
  return { editor, focus, modal };
}

const error = (modal: any) => modal.contentEl.querySelector(".mod-warning").textContent;
const add = () => {
  click(buttonLabeled("Add"));
  flush();
};
const valueField = () => settingNamed("Value");

describe("add property dialog", () => {
  it("asks for a type, a name and a value, defaulting to an empty text property", () => {
    const { modal } = open();
    expect(modal.titleEl.textContent).toBe("Add property");
    const type = settingNamed("Type").dropdowns[0];
    expect([...type.options.entries()]).toEqual([
      ["text", "Text"],
      ["list", "List"],
      ["number", "Number"],
      ["checkbox", "Checkbox"],
      ["date", "Date"],
      ["datetime", "Date & time"],
    ]);
    expect(type.getValue()).toBe("text");
    expect(settingNamed("Name").texts[0].inputEl.placeholder).toBe("status");
    expect(valueField().texts[0].getValue()).toBe("");
  });

  it("adds a text property to a note without frontmatter, creating the block", () => {
    const { modal, editor, focus } = open("body");
    typeInto(settingNamed("Name").texts[0], "status");
    typeInto(valueField().texts[0], "in progress");
    add();
    expect(editor.getValue()).toBe("---\nstatus: in progress\n---\nbody");
    expect(modal.opened).toBe(false);
    expect(focus).toHaveBeenCalled();
  });

  it("adds to the existing frontmatter", () => {
    const { editor } = open("---\na: 1\n---\nbody");
    typeInto(settingNamed("Name").texts[0], "b");
    typeInto(valueField().texts[0], "2x");
    add();
    expect(editor.getValue()).toBe("---\na: 1\nb: 2x\n---\nbody");
  });

  it("quotes a value YAML would read as another type", () => {
    const { editor } = open();
    typeInto(settingNamed("Name").texts[0], "code");
    typeInto(valueField().texts[0], "007");
    add();
    expect(editor.getValue()).toContain('code: "007"');
  });

  describe("value field by type", () => {
    const pick = (type: string) => choose(settingNamed("Type").dropdowns[0], type);

    it("uses a one-item-per-line box for lists", () => {
      const { editor } = open();
      pick("list");
      expect(valueField().desc).toBe("One item per line.");
      typeInto(settingNamed("Name").texts[0], "tags");
      typeInto(valueField().textAreas[0], "alpha\nbeta");
      add();
      expect(editor.getValue()).toBe("---\ntags:\n  - alpha\n  - beta\n---\nbody");
    });

    it("uses a toggle for checkboxes, starting unchecked", () => {
      const { editor } = open();
      pick("checkbox");
      expect(valueField().toggles[0].getValue()).toBe(false);
      typeInto(settingNamed("Name").texts[0], "done");
      choose(valueField().toggles[0], true as never);
      add();
      expect(editor.getValue()).toContain("done: true");
    });

    it("saves an untouched checkbox as false", () => {
      const { editor } = open();
      pick("checkbox");
      typeInto(settingNamed("Name").texts[0], "done");
      add();
      expect(editor.getValue()).toContain("done: false");
    });

    it("starts a date at today's date, in a date input", () => {
      const { editor } = open();
      pick("date");
      const input = valueField().texts[0];
      expect(input.inputEl.type).toBe("date");
      expect(input.getValue()).toBe(localDate());
      typeInto(settingNamed("Name").texts[0], "due");
      add();
      expect(editor.getValue()).toContain(`due: ${localDate()}`);
    });

    it("starts a date & time at the current time, in a datetime-local input", () => {
      const { editor } = open();
      pick("datetime");
      const input = valueField().texts[0];
      expect(input.inputEl.type).toBe("datetime-local");
      expect(input.getValue()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect(localDateTime().slice(0, 10)).toBe(input.getValue().slice(0, 10));
      typeInto(settingNamed("Name").texts[0], "when");
      typeInto(input, "2025-01-31T09:30");
      add();
      expect(editor.getValue()).toContain("when: 2025-01-31T09:30");
    });

    it("takes a number", () => {
      const { editor } = open();
      pick("number");
      expect(valueField().texts[0].inputEl.placeholder).toBe("0");
      typeInto(settingNamed("Name").texts[0], "rating");
      typeInto(valueField().texts[0], "4.50");
      add();
      expect(editor.getValue()).toContain("rating: 4.5");
    });

    it("resets the value when the type changes", () => {
      open();
      typeInto(valueField().texts[0], "some text");
      pick("number");
      expect(valueField().texts[0].getValue()).toBe("");
    });

    it("keeps the type when picked again", () => {
      open();
      pick("date");
      typeInto(valueField().texts[0], "2020-02-02");
      pick("date");
      expect(valueField().texts[0].getValue()).toBe("2020-02-02");
    });
  });

  describe("validation", () => {
    it("asks for a name", () => {
      const { modal, editor } = open();
      add();
      expect(error(modal)).toBe("Give the property a name.");
      expect(modal.opened).toBe(true);
      expect(editor.getValue()).toBe("body");
    });

    it("rejects a value of the wrong shape", () => {
      const { modal } = open();
      choose(settingNamed("Type").dropdowns[0], "number");
      typeInto(settingNamed("Name").texts[0], "n");
      typeInto(valueField().texts[0], "lots");
      add();
      expect(error(modal)).toBe("Enter a number.");
      expect(modal.opened).toBe(true);
    });

    it("won't overwrite a property the note already has", () => {
      const { modal, editor } = open("---\nstatus: open\n---\nbody");
      typeInto(settingNamed("Name").texts[0], "status");
      typeInto(valueField().texts[0], "done");
      add();
      expect(error(modal)).toBe('This note already has a property named "status".');
      expect(editor.getValue()).toBe("---\nstatus: open\n---\nbody");
      expect(modal.opened).toBe(true);
    });

    it("recognises an existing property whose key had to be quoted", () => {
      const { modal, editor } = open('---\n"a: b": 1\n---\nbody');
      typeInto(settingNamed("Name").texts[0], "a: b");
      typeInto(valueField().texts[0], "2");
      add();
      expect(error(modal)).toBe('This note already has a property named "a: b".');
      expect(editor.getValue()).toBe('---\n"a: b": 1\n---\nbody');
    });

    it("clears the message when the type changes", () => {
      const { modal } = open();
      add();
      expect(error(modal)).not.toBe("");
      choose(settingNamed("Type").dropdowns[0], "list");
      expect(error(modal)).toBe("");
    });
  });

  describe("writing through Obsidian", () => {
    function openWithApi(processFrontMatter: (file: unknown, fn: (fm: Record<string, unknown>) => void) => Promise<void>, save = vi.fn(async () => {})) {
      const editor = createMockEditor("body");
      const app = appWith();
      app.workspace = { getActiveFile: () => makeFile("note.md"), getActiveViewOfType: () => ({ save }) };
      app.fileManager = { processFrontMatter };
      openAddPropertyModal(editor, app);
      return { editor, modal: modals.at(-1) as any, save };
    }
    const apply = () => {
      const fm: Record<string, unknown> = {};
      return { fm, run: async (_file: unknown, fn: (fm: Record<string, unknown>) => void) => fn(fm) };
    };
    const fill = (value = "open") => {
      typeInto(settingNamed("Name").texts[0], "status");
      typeInto(valueField().texts[0], value);
      add();
    };

    it("saves the note, then sets the property with its typed value through the frontmatter API", async () => {
      const { fm, run } = apply();
      const { editor, save } = openWithApi(run);
      fill();
      await vi.advanceTimersByTimeAsync(0);
      expect(save).toHaveBeenCalledTimes(1);
      expect(fm).toEqual({ status: "open" });
      expect(editor.getValue()).toBe("body"); // the API writes the file, not the editor text
    });

    it("closes the dialog and refocuses the editor", async () => {
      const { fm, run } = apply();
      const { editor, modal } = openWithApi(run);
      const focus = vi.spyOn(editor, "focus");
      fill();
      expect(modal.opened).toBe(false);
      await vi.advanceTimersByTimeAsync(0);
      expect(focus).toHaveBeenCalled();
      expect(fm).toEqual({ status: "open" });
    });

    it("falls back to writing the text into the note, and warns, when the API fails", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { editor } = openWithApi(async () => Promise.reject(new Error("nope")));
      fill();
      await vi.advanceTimersByTimeAsync(0);
      expect(editor.getValue()).toContain("status: open");
      expect(warn).toHaveBeenCalled();
    });

    it("writes the text into the note when there is no active file", () => {
      const { editor } = open();
      fill();
      expect(editor.getValue()).toContain("status: open");
    });

    it("does not touch the note when validation fails", () => {
      const processFrontMatter = vi.fn(async () => {});
      const { save } = openWithApi(processFrontMatter);
      add(); // no name
      expect(save).not.toHaveBeenCalled();
      expect(processFrontMatter).not.toHaveBeenCalled();
    });
  });

  describe("suggesting names from the vault", () => {
    const vault = [{ status: "open", rating: 4, done: true, tags: ["a"], due: "2025-01-31", position: {} }, { status: "closed" }];

    it("offers the vault's property names", () => {
      const { modal } = open("body", vault);
      const names = [...modal.contentEl.querySelectorAll("datalist option")].map((o: Element) => (o as HTMLOptionElement).value);
      expect(names).toEqual(["done", "due", "rating", "status", "tags"]);
      expect(settingNamed("Name").texts[0].inputEl.getAttribute("list")).toBe(modal.contentEl.querySelector("datalist").id);
    });

    it.each([
      ["rating", "number"],
      ["done", "checkbox"],
      ["tags", "list"],
      ["due", "date"],
      ["status", "text"],
    ])("selects the usual type when you name %s", (name, type) => {
      open("body", vault);
      typeInto(settingNamed("Name").texts[0], name);
      expect(settingNamed("Type").dropdowns[0].getValue()).toBe(type);
    });

    it("redraws the value field for the selected type", () => {
      open("body", vault);
      typeInto(settingNamed("Name").texts[0], "tags");
      expect(valueField().textAreas).toHaveLength(1);
    });

    it("leaves the type alone for an unknown name", () => {
      open("body", vault);
      typeInto(settingNamed("Name").texts[0], "brand-new");
      expect(settingNamed("Type").dropdowns[0].getValue()).toBe("text");
    });

    it("respects a type the user chose, even for a known name", () => {
      open("body", vault);
      choose(settingNamed("Type").dropdowns[0], "list");
      typeInto(settingNamed("Name").texts[0], "rating");
      expect(valueField().textAreas).toHaveLength(1);
    });

    it("works in an empty vault", () => {
      const { modal } = open("body", []);
      expect(modal.contentEl.querySelectorAll("datalist option")).toHaveLength(0);
    });
  });

  describe("keyboard", () => {
    const key = (el: HTMLElement, init: KeyboardEventInit) =>
      el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));

    it("submits on Enter in the name or value field", () => {
      const { editor } = open();
      typeInto(settingNamed("Name").texts[0], "a");
      key(valueField().texts[0].inputEl, { key: "Enter" });
      flush();
      expect(editor.getValue()).toContain("a:");
    });

    it("needs Ctrl+Enter in the list box", () => {
      const { editor, modal } = open();
      choose(settingNamed("Type").dropdowns[0], "list");
      typeInto(settingNamed("Name").texts[0], "l");
      typeInto(valueField().textAreas[0], "x");
      key(valueField().textAreas[0].inputEl, { key: "Enter" });
      expect(modal.opened).toBe(true);
      key(valueField().textAreas[0].inputEl, { key: "Enter", ctrlKey: true });
      flush();
      expect(editor.getValue()).toContain("l:\n  - x");
    });
  });

  it("returns focus to the editor if closed without adding", () => {
    const { modal, focus, editor } = open();
    modal.close();
    expect(focus).toHaveBeenCalled();
    expect(editor.getValue()).toBe("body");
    expect(createdSettings.length).toBeGreaterThan(0);
  });
});
