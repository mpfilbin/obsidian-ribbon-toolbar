// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App, obsidianLog } from "obsidian";
import { addPropertyToNote } from "../../../../src/ribbon/commands/actions/addProperty";
import { createMockEditor } from "../../../support/mockEditor";
import { makeFile } from "../../../support/vault";

beforeEach(() => obsidianLog.reset());

function appWith(options: { file?: boolean; process?: (file: unknown, fn: (fm: Record<string, unknown>) => void) => Promise<void>; save?: () => Promise<void> }) {
  const app = new App() as any;
  app.workspace = {
    getActiveFile: () => (options.file === false ? null : makeFile("note.md")),
    getActiveViewOfType: () => ({ save: options.save ?? (async () => {}) }),
  };
  app.fileManager = options.process ? { processFrontMatter: options.process } : {};
  return app;
}

const lines = ["status: open"];

describe("addPropertyToNote", () => {
  it("saves, then sets the value through processFrontMatter and focuses the editor", async () => {
    const order: string[] = [];
    const fm: Record<string, unknown> = {};
    const app = appWith({
      save: async () => void order.push("save"),
      process: async (_f, fn) => {
        order.push("process");
        fn(fm);
      },
    });
    const editor = createMockEditor("body");
    const focus = vi.spyOn(editor, "focus");
    await addPropertyToNote(app, editor, "tags", ["a", "b"], ["tags:", "  - a", "  - b"]);
    expect(order).toEqual(["save", "process"]);
    expect(fm).toEqual({ tags: ["a", "b"] });
    expect(editor.getValue()).toBe("body");
    expect(focus).toHaveBeenCalled();
  });

  it("writes text into the editor when there is no active file", async () => {
    const editor = createMockEditor("body");
    await addPropertyToNote(appWith({ file: false, process: async () => {} }), editor, "status", "open", lines);
    expect(editor.getValue()).toBe("---\nstatus: open\n---\nbody");
  });

  it("writes text into the editor when the frontmatter API is missing", async () => {
    const editor = createMockEditor("body");
    await addPropertyToNote(appWith({}), editor, "status", "open", lines);
    expect(editor.getValue()).toContain("status: open");
  });

  it("works without a markdown view to save", async () => {
    const app = appWith({ process: async (_f, fn) => fn({}) });
    app.workspace.getActiveViewOfType = () => null;
    await expect(addPropertyToNote(app, createMockEditor("body"), "status", "open", lines)).resolves.toBeUndefined();
  });

  it("falls back to text and warns when saving or the API fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const editor = createMockEditor("body");
    await addPropertyToNote(appWith({ process: async () => Promise.reject(new Error("nope")) }), editor, "status", "open", lines);
    expect(editor.getValue()).toContain("status: open");
    await addPropertyToNote(appWith({ save: async () => Promise.reject(new Error("disk")), process: async () => {} }), createMockEditor("x"), "a", "b", ["a: b"]);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
