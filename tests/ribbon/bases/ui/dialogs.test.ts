// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createdSettings, modals, notices, obsidianLog } from "obsidian";
import { openBaseManager } from "../../../../src/ribbon/bases/ui/BaseManagerModal";
import { openNewBaseModal } from "../../../../src/ribbon/bases/ui/NewBaseModal";
import { openEmbedBaseModal } from "../../../../src/ribbon/bases/ui/EmbedBaseModal";
import { createMockEditor } from "../../../support/mockEditor";
import { makeBaseApp } from "../../../support/baseEnv";
import { buttonLabeled, choose, click, settingNamed, typeInto } from "../../../support/sections";
import { makeFile } from "../../../support/vault";

beforeEach(() => obsidianLog.reset());

const latest = () => modals.at(-1) as any;
const tabLabels = (m: any) => [...m.contentEl.querySelectorAll(".ribbon-bar-base-tab")].map((t: Element) => t.textContent);
const activeTab = (m: any) => m.contentEl.querySelector(".ribbon-bar-base-tab.is-active")?.textContent;
const problems = (m: any) => [...m.contentEl.querySelectorAll(".ribbon-bar-base-problems li")].map((li: Element) => li.textContent);

describe("base editor dialog", () => {
  const note = "```base\nviews:\n  - type: table\n    name: Table\n```";

  async function open(text = note, section: "views" | "filters" | "formulas" | "properties" | "summaries" = "views", line = 1) {
    const { app } = makeBaseApp();
    const editor = createMockEditor(text, { line, ch: 0 });
    const focus = vi.spyOn(editor, "focus");
    await openBaseManager(editor, app, section);
    return { editor, focus, modal: latest() };
  }

  it("opens on the requested section with a tab per section", async () => {
    const { modal } = await open(note, "formulas");
    expect(modal.titleEl.textContent).toBe("Edit base · inline base");
    expect(tabLabels(modal)).toEqual(["Views", "Filters", "Formulas", "Properties", "Summaries"]);
    expect(activeTab(modal)).toBe("Formulas");
  });

  it("widens the dialog itself, since Obsidian sizes the modal rather than its content", async () => {
    const { modal } = await open();
    expect(modal.modalEl.classList.contains("ribbon-bar-base-modal")).toBe(true);
  });

  it("switches sections from the tabs", async () => {
    const { modal } = await open();
    modal.contentEl.querySelectorAll(".ribbon-bar-base-tab")[1].click();
    expect(activeTab(modal)).toBe("Filters");
    expect(modal.contentEl.querySelector(".ribbon-bar-base-body")!.textContent).toContain("apply to every view");
  });

  it("saves edits made in a section back into the code block", async () => {
    const { modal, editor, focus } = await open(note, "formulas");
    const row = settingNamed("Name and expression");
    typeInto(row.texts[0], "double");
    typeInto(row.textAreas[0], "price * 2");
    click(row.buttons[0]);
    expect(editor.getValue()).toBe(note); // nothing written yet

    click(buttonLabeled("Save"));
    await vi.waitFor(() => expect(modal.opened).toBe(false));
    expect(editor.getValue()).toContain("formulas:\n  double: price * 2");
    expect(editor.getValue()).toContain("name: Table");
    expect(notices).toContain("Base saved.");
    expect(focus).toHaveBeenCalled();
  });

  it("leaves the note alone on Cancel", async () => {
    const { modal, editor } = await open(note, "formulas");
    const row = settingNamed("Name and expression");
    typeInto(row.texts[0], "x");
    typeInto(row.textAreas[0], "1");
    click(row.buttons[0]);
    click(buttonLabeled("Cancel"));
    expect(modal.opened).toBe(false);
    expect(editor.getValue()).toBe(note);
  });

  it("lists problems with the base as it is edited", async () => {
    const { modal } = await open("```base\nviews:\n  - type: timeline\n    name: T\n```", "views", 1);
    expect(problems(modal)).toEqual(['View 1 (T): Unknown view type "timeline".']);
    expect(modal.contentEl.querySelector(".ribbon-bar-base-problems")!.textContent).toContain("Check these before saving");
  });

  it("shows no problem list for a sound base", async () => {
    const { modal } = await open();
    expect(problems(modal)).toEqual([]);
  });

  it("refreshes the problem list as edits are made, without leaving the section", async () => {
    const { modal } = await open(note, "formulas");
    const row = settingNamed("Name and expression");
    typeInto(row.texts[0], "bad");
    typeInto(row.textAreas[0], "1");
    click(row.buttons[0]);
    typeInto(settingNamed("formula.bad").textAreas[0], "f(");
    expect(problems(modal)).toEqual(['Formula "bad": Missing ")".']);
  });

  it("saves a base file through the vault", async () => {
    const { app, contents } = makeBaseApp({ "Tasks.base": "views:\n  - type: table\n    name: Table\n" });
    const editor = createMockEditor("![[Tasks.base]]", { line: 0, ch: 3 });
    await openBaseManager(editor, app, "formulas");
    const row = settingNamed("Name and expression");
    typeInto(row.texts[0], "n");
    typeInto(row.textAreas[0], "1 + 1");
    click(row.buttons[0]);
    click(buttonLabeled("Save"));
    await vi.waitFor(() => expect(contents.get("Tasks.base")).toContain("n: 1 + 1"));
    expect(editor.getValue()).toBe("![[Tasks.base]]");
  });

  it("opens an embed pinned to a view on that view", async () => {
    const { app } = makeBaseApp({ "Tasks.base": "views:\n  - type: table\n    name: A\n  - type: cards\n    name: B\n" });
    const editor = createMockEditor("![[Tasks.base#B]]", { line: 0, ch: 3 });
    await openBaseManager(editor, app, "views");
    expect(latest().state.viewIndex).toBe(1);
  });

  it("reports a save failure and stays open", async () => {
    const { modal, editor } = await open(note, "formulas");
    // The block disappears while the dialog is open.
    editor.replaceRange("", { line: 0, ch: 0 }, { line: 4, ch: 4 });
    click(buttonLabeled("Save"));
    await vi.waitFor(() => expect(notices.some((n) => n.startsWith("Couldn't save the base"))).toBe(true));
    expect(modal.opened).toBe(true);
  });

  it("won't open for YAML it can't read", async () => {
    await open("```base\nviews: [unclosed\n```");
    expect(notices[0]).toContain("can't be read");
    expect(modals).toHaveLength(0);
  });

  it("won't open for a non-mapping base", async () => {
    await open("```base\n- a\n- b\n```");
    expect(notices[0]).toContain("must be a YAML mapping");
    expect(modals).toHaveLength(0);
  });

  it("opens an empty block as an empty base", async () => {
    const { modal } = await open("```base\n```", "views", 0);
    expect(modal.state.config).toEqual({});
  });

  it("does nothing when there is no base to edit", async () => {
    await open("no base here", "views", 0);
    expect(modals).toHaveLength(0);
    expect(notices[0]).toContain("No base in this note yet");
  });

  it("explains a missing file when reading fails", async () => {
    const { app } = makeBaseApp({ "Tasks.base": "views: []" });
    app.vault.read = async () => {
      throw new Error("disk error");
    };
    await openBaseManager(createMockEditor("![[Tasks.base]]", { line: 0, ch: 3 }), app, "views");
    expect(notices[0]).toBe("Couldn't read the base: disk error");
  });

  it("returns focus to the editor when closed", async () => {
    const { modal, focus } = await open();
    modal.close();
    expect(focus).toHaveBeenCalled();
  });
});

describe("new base dialog", () => {
  function open(text = "", notePath = "Projects/Note.md", folder = "Projects") {
    const env = makeBaseApp({}, notePath, folder);
    const editor = createMockEditor(text);
    openNewBaseModal(editor, env.app);
    return { ...env, editor, modal: latest() };
  }

  it("inserts an inline base block with a table view by default", () => {
    const { modal, editor } = open();
    expect(modal.titleEl.textContent).toBe("New base");
    click(buttonLabeled("Create"));
    expect(editor.getValue()).toBe("```base\nviews:\n  - type: table\n    name: Table\n    order:\n      - file.name\n```");
    expect(modal.opened).toBe(false);
  });

  it("takes the view type and name, and a first filter", () => {
    const { editor } = open();
    const dropdowns = (name: string) => settingNamed(name).dropdowns[0];
    choose(dropdowns("First view"), "cards");
    typeInto(settingNamed("View name").texts[0], "Gallery");
    choose(dropdowns("Start with"), "folder");
    click(buttonLabeled("Create"));
    const text = editor.getValue();
    expect(text).toContain("type: cards");
    expect(text).toContain("name: Gallery");
    expect(text).toContain('file.inFolder("Projects")');
  });

  it("asks for a tag only when starting with a tag", () => {
    const { editor } = open();
    choose(settingNamed("Start with").dropdowns[0], "tag");
    typeInto(settingNamed("Tag").texts[0], "#work");
    click(buttonLabeled("Create"));
    expect(editor.getValue()).toContain('file.hasTag("work")');
  });

  it("creates a separate .base file and embeds it", async () => {
    const { editor, contents, modal } = open("", "Projects/Note.md", "Projects");
    choose(settingNamed("Store as").dropdowns[0], "file");
    typeInto(settingNamed("File name").texts[0], "Tasks");
    click(buttonLabeled("Create"));
    await vi.waitFor(() => expect(modal.opened).toBe(false));
    expect(contents.get("Projects/Tasks.base")).toContain("type: table");
    expect(contents.get("Projects/Tasks.base")!.endsWith("\n")).toBe(true);
    expect(editor.getValue()).toBe("![[Projects/Tasks.base]]");
  });

  it("creates files at the vault root when that is where new notes go", async () => {
    const { contents, modal } = open("", "Note.md", "/");
    choose(settingNamed("Store as").dropdowns[0], "file");
    click(buttonLabeled("Create"));
    await vi.waitFor(() => expect(modal.opened).toBe(false));
    expect([...contents.keys()]).toEqual(["Untitled.base"]);
  });

  it("won't overwrite an existing file", async () => {
    const { editor, modal, contents } = open("", "Note.md", "/");
    contents.set("Tasks.base", "old");
    (modal.app.vault as any).getAbstractFileByPath = (path: string) => (path === "Tasks.base" ? makeFile(path) : null);
    choose(settingNamed("Store as").dropdowns[0], "file");
    typeInto(settingNamed("File name").texts[0], "Tasks");
    click(buttonLabeled("Create"));
    await vi.waitFor(() => expect(notices.length).toBe(1));
    expect(notices[0]).toContain("already exists");
    expect(contents.get("Tasks.base")).toBe("old");
    expect(modal.opened).toBe(true);
    expect(editor.getValue()).toBe("");
  });

  it("reports a failure to create the file", async () => {
    const { modal } = open("", "Note.md", "/");
    (modal.app.vault as any).create = async () => {
      throw new Error("read-only");
    };
    choose(settingNamed("Store as").dropdowns[0], "file");
    click(buttonLabeled("Create"));
    await vi.waitFor(() => expect(notices[0]).toBe("Couldn't create the base file: read-only"));
    expect(modal.opened).toBe(true);
  });

  it("submits from the Enter key in a field", () => {
    const { editor } = open();
    const input = settingNamed("View name").texts[0].inputEl;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(editor.getValue().startsWith("```base")).toBe(true);
  });

  it("hides file and tag fields when they don't apply", () => {
    open();
    expect(createdSettings.map((s) => s.name)).not.toContain("File name");
    expect(createdSettings.map((s) => s.name)).not.toContain("Tag");
  });
});

describe("embed base dialog", () => {
  const files = {
    "Tasks.base": "views:\n  - type: table\n    name: Table\n  - type: cards\n    name: Board\n",
    "Folder/Single.base": "views:\n  - type: table\n    name: Only\n",
    "Folder/Broken.base": "views: [unclosed",
    "Note.md": "# note",
  };

  function open(selection?: string) {
    const env = makeBaseApp(files);
    const editor = createMockEditor(selection ?? "");
    const focus = vi.spyOn(editor, "focus");
    openEmbedBaseModal(editor, env.app);
    return { ...env, editor, focus, modal: latest() };
  }

  it("lists .base files, plus a view entry for files with several views", async () => {
    const { modal } = open();
    expect(modal.placeholder).toBe("Find a .base file to embed...");
    const names = (await modal.getSuggestions("")).map((c: any) => `${c.file.name}${c.view ? `#${c.view}` : ""}`);
    expect(names).toEqual(["Tasks.base", "Tasks.base#Table", "Tasks.base#Board", "Single.base", "Broken.base"]);
  });

  it("filters by file or view name", async () => {
    const { modal } = open();
    const results = await modal.getSuggestions("board");
    expect(results.map((c: any) => c.view)).toEqual(["Board"]);
  });

  it("renders file and view rows", async () => {
    const { modal } = open();
    const [whole, view, , single] = await modal.getSuggestions("");
    const render = (c: any) => {
      const el = document.createElement("div");
      modal.renderSuggestion(c, el);
      return el.textContent;
    };
    expect(render(whole)).toBe("Tasks.base");
    expect(render(view)).toBe("Tasks › Table");
    expect(render(single)).toBe("Single.baseFolder");
  });

  it("embeds the chosen file, or file and view", async () => {
    const { modal, editor, focus } = open();
    const results = await modal.getSuggestions("");
    modal.onChooseSuggestion(results[0]);
    expect(editor.getValue()).toBe("![[Tasks.base]]");
    modal.onChooseSuggestion(results[2]);
    expect(editor.getValue()).toBe("![[Tasks.base]]![[Tasks.base#Board]]");
    expect(focus).toHaveBeenCalled();
  });
});

describe("failure and edge cases", () => {
  it("still offers a base file whose contents can't be read", async () => {
    const env = makeBaseApp({ "Locked.base": "views: []" });
    env.app.vault.read = async () => {
      throw new Error("denied");
    };
    openEmbedBaseModal(createMockEditor(""), env.app);
    const results = await latest().getSuggestions("");
    expect(results.map((c: any) => c.file.name)).toEqual(["Locked.base"]);
  });

  it("reports a non-Error failure to read a base", async () => {
    const env = makeBaseApp({ "T.base": "views: []" });
    env.app.vault.read = async () => Promise.reject("plain string");
    await openBaseManager(createMockEditor("![[T.base]]", { line: 0, ch: 3 }), env.app, "views");
    expect(notices[0]).toBe("Couldn't read the base: plain string");
  });

  it("reports a non-Error failure to save a base", async () => {
    const env = makeBaseApp({ "T.base": "views: []" });
    await openBaseManager(createMockEditor("![[T.base]]", { line: 0, ch: 3 }), env.app, "views");
    env.app.vault.process = async () => Promise.reject("nope");
    click(buttonLabeled("Save"));
    await vi.waitFor(() => expect(notices).toContain("Couldn't save the base: nope"));
  });

  it("creates a file base when no note is active", async () => {
    const env = makeBaseApp();
    env.app.workspace.getActiveFile = () => null;
    const editor = createMockEditor("");
    openNewBaseModal(editor, env.app);
    choose(settingNamed("Store as").dropdowns[0], "file");
    typeInto(settingNamed("File name").texts[0], "Loose");
    click(buttonLabeled("Create"));
    await vi.waitFor(() => expect(editor.getValue()).toBe("![[Loose.base]]"));
  });

  it("opens a base in a note when no note is active, resolving embeds from the vault root", async () => {
    const env = makeBaseApp({ "T.base": "views: []" });
    env.app.workspace.getActiveFile = () => null;
    await openBaseManager(createMockEditor("![[T.base]]", { line: 0, ch: 3 }), env.app, "views");
    expect(latest().titleEl.textContent).toBe("Edit base · T.base");
  });
});
