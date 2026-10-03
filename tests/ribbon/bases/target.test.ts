// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { modals, notices, obsidianLog } from "obsidian";
import { fileTarget, inlineTarget, resolveBaseTarget } from "../../../src/ribbon/bases/target";
import { createMockEditor } from "../../support/mockEditor";
import { makeBaseApp } from "../../support/baseEnv";
import { parseBase, serializeBase } from "../../../src/ribbon/bases/yaml";

beforeEach(() => obsidianLog.reset());

describe("yaml helpers", () => {
  it("parses a mapping, treating empty text and null as an empty base", () => {
    expect(parseBase("views:\n  - type: table\n    name: T")).toEqual({
      ok: true,
      config: { views: [{ type: "table", name: "T" }] },
    });
    expect(parseBase("")).toEqual({ ok: true, config: {} });
    expect(parseBase("   \n")).toEqual({ ok: true, config: {} });
    expect(parseBase("~")).toEqual({ ok: true, config: {} });
  });

  it("rejects non-mapping YAML and reports syntax errors", () => {
    expect(parseBase("- a\n- b").ok).toBe(false);
    expect(parseBase("just text").ok).toBe(false);
    const broken = parseBase("views: [unclosed");
    expect(broken.ok).toBe(false);
    expect((broken as { error: string }).error).not.toBe("");
  });

  it("round-trips a config without a trailing newline", () => {
    const config = { formulas: { total: "price * qty" }, views: [{ type: "table", name: "T", limit: 3 }] };
    const text = serializeBase(config);
    expect(text.endsWith("\n")).toBe(false);
    expect(parseBase(text)).toEqual({ ok: true, config });
  });
});

describe("inlineTarget", () => {
  const note = "intro\n```base\nviews: []\n```\noutro";

  it("loads the YAML between the fences", async () => {
    expect(await inlineTarget(createMockEditor(note), 1).load()).toBe("views: []");
  });

  it("replaces only the block's contents on save", async () => {
    const editor = createMockEditor(note);
    await inlineTarget(editor, 1).save("views:\n  - type: table");
    expect(editor.getValue()).toBe("intro\n```base\nviews:\n  - type: table\n```\noutro");
  });

  it("saves into an empty block and can empty one", async () => {
    const editor = createMockEditor("```base\n```");
    await inlineTarget(editor, 0).save("a: 1\n");
    expect(editor.getValue()).toBe("```base\na: 1\n```");
    await inlineTarget(editor, 0).save("");
    expect(editor.getValue()).toBe("```base\n```");
  });

  it("refuses to touch text that is no longer a base block", async () => {
    const editor = createMockEditor("moved\n```base\nviews: []\n```");
    const target = inlineTarget(editor, 0);
    await expect(target.load()).rejects.toThrow("moved or been removed");
    await expect(target.save("x: 1")).rejects.toThrow("moved or been removed");
    expect(editor.getValue()).toBe("moved\n```base\nviews: []\n```");
  });
});

describe("fileTarget", () => {
  it("reads and rewrites the file, ending it with a newline", async () => {
    const { app, contents, tfiles } = makeBaseApp({ "Tasks.base": "views: []\n" });
    const target = fileTarget(app, tfiles.get("Tasks.base")!, "Board");
    expect(target.label).toBe("Tasks.base");
    expect(target.viewName).toBe("Board");
    expect(await target.load()).toBe("views: []\n");
    await target.save("views:\n  - type: list\n\n");
    expect(contents.get("Tasks.base")).toBe("views:\n  - type: list\n");
  });
});

describe("resolveBaseTarget", () => {
  const blockNote = "```base\nviews: []\n```";

  it("explains when the note has no base", async () => {
    const { app } = makeBaseApp();
    expect(await resolveBaseTarget(createMockEditor("plain"), app)).toBeNull();
    expect(notices[0]).toContain("No base in this note yet");
  });

  it("uses the base the cursor is in", async () => {
    const { app } = makeBaseApp();
    const editor = createMockEditor(`${blockNote}\n![[A.base]]`, { line: 1, ch: 3 });
    const target = await resolveBaseTarget(editor, app);
    expect(target?.label).toBe("inline base");
  });

  it("uses an embed on the cursor line, resolving the file and view", async () => {
    const { app } = makeBaseApp({ "Folder/Tasks.base": "views: []" });
    const editor = createMockEditor(`${blockNote}\n![[Tasks.base#Board]]`, { line: 3, ch: 2 });
    const target = await resolveBaseTarget(editor, app);
    expect(target?.label).toBe("Tasks.base");
    expect(target?.viewName).toBe("Board");
    expect(await target!.load()).toBe("views: []");
  });

  it("falls back to the note's only base when the cursor is elsewhere", async () => {
    const { app } = makeBaseApp();
    const editor = createMockEditor(`text\n${blockNote}`, { line: 0, ch: 0 });
    expect((await resolveBaseTarget(editor, app))?.label).toBe("inline base");
  });

  it("reports a missing base file", async () => {
    const { app } = makeBaseApp();
    const editor = createMockEditor("![[Gone.base]]", { line: 0, ch: 0 });
    expect(await resolveBaseTarget(editor, app)).toBeNull();
    expect(notices[0]).toContain('Can\'t find the base file "Gone.base"');
  });

  describe("with several bases and the cursor outside them", () => {
    const text = `${blockNote}\n![[B.base]]\nplain text`;
    const open = async () => {
      const { app } = makeBaseApp({ "B.base": "views: []" });
      const editor = createMockEditor(text, { line: 4, ch: 0 });
      const result = resolveBaseTarget(editor, app);
      await vi.waitFor(() => expect(modals).toHaveLength(1));
      return { result, modal: modals[0] as any };
    };

    it("lets the user pick one", async () => {
      const { result, modal } = await open();
      expect(modal.placeholder).toBe("Which base do you want to edit?");
      const suggestions = modal.getSuggestions("");
      expect(suggestions.map((s: any) => s.type)).toEqual(["block", "embed"]);
      expect(modal.getSuggestions("b.base")).toHaveLength(1);

      const row = document.createElement("div");
      modal.renderSuggestion(suggestions[1], row);
      expect(row.textContent).toBe("B.base (line 4)");

      modal.opened = true;
      modal.close(); // Obsidian closes before reporting the choice
      modal.onChooseSuggestion(suggestions[1]);
      expect((await result)?.label).toBe("B.base");
    });

    it("returns null when the picker is dismissed", async () => {
      const { result, modal } = await open();
      modal.opened = true;
      modal.close();
      expect(await result).toBeNull();
    });
  });
});
