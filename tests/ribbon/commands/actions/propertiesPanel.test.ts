import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveAndRefreshPropertiesPanel } from "../../../../src/ribbon/commands/actions/propertiesPanel";
import { createMockEditor } from "../../../support/mockEditor";
import { makeFile } from "../../../support/vault";

// The real module needs a `window` for its timers; the logic itself is DOM-free.
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", globalThis);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** An app with a controllable metadata cache and an active markdown view. */
function fakeApp(options: { file?: string | null; save?: () => Promise<void>; noView?: boolean } = {}) {
  const log: string[] = [];
  const listeners = new Set<(file: { path: string }) => void>();
  const file = options.file === null ? null : makeFile(options.file ?? "Note.md");
  const save = options.save ?? (async () => void log.push("save"));
  const app = {
    workspace: {
      getActiveFile: () => file,
      getActiveViewOfType: () => (options.noView ? null : { save }),
    },
    metadataCache: {
      on: (_name: string, cb: (f: { path: string }) => void) => {
        listeners.add(cb);
        return cb;
      },
      offref: (ref: (f: { path: string }) => void) => {
        listeners.delete(ref);
        log.push("offref");
      },
    },
  };
  return {
    app: app as never,
    log,
    listenerCount: () => listeners.size,
    cacheChanged: (path = "Note.md") => listeners.forEach((cb) => cb({ path })),
  };
}

const run = async (promise: Promise<void>) => {
  await vi.advanceTimersByTimeAsync(0);
  return promise;
};

describe("saveAndRefreshPropertiesPanel", () => {
  it("saves the note, waits for the metadata cache to catch up, then makes a do-nothing edit", async () => {
    const env = fakeApp();
    const editor = createMockEditor("---\na: 1\n---\nbody");
    const replace = vi.spyOn(editor, "replaceRange");

    const done = saveAndRefreshPropertiesPanel(env.app, editor);
    await vi.advanceTimersByTimeAsync(0);
    expect(env.log).toEqual(["save"]);
    expect(replace).not.toHaveBeenCalled(); // still waiting for the cache

    env.cacheChanged();
    await done;
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("y", { line: 3, ch: 3 }, { line: 3, ch: 4 });
    expect(editor.getValue()).toBe("---\na: 1\n---\nbody"); // the note itself is unchanged
    expect(env.listenerCount()).toBe(0);
  });

  it("is not fooled by other notes changing", async () => {
    const env = fakeApp();
    const editor = createMockEditor("body");
    const replace = vi.spyOn(editor, "replaceRange");
    const done = saveAndRefreshPropertiesPanel(env.app, editor);
    await vi.advanceTimersByTimeAsync(0);
    env.cacheChanged("Other.md");
    await vi.advanceTimersByTimeAsync(0);
    expect(replace).not.toHaveBeenCalled();
    env.cacheChanged("Note.md");
    await done;
    expect(replace).toHaveBeenCalled();
  });

  it("refreshes anyway if the cache never reports back", async () => {
    const env = fakeApp();
    const editor = createMockEditor("body");
    const replace = vi.spyOn(editor, "replaceRange");
    const done = saveAndRefreshPropertiesPanel(env.app, editor);
    await vi.advanceTimersByTimeAsync(1499);
    expect(replace).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(replace).toHaveBeenCalled();
    expect(env.listenerCount()).toBe(0);
  });

  it("leaves the selection and cursor where they were", async () => {
    const env = fakeApp();
    const editor = createMockEditor("alpha beta");
    editor.setSelection({ line: 0, ch: 2 }, { line: 0, ch: 7 });
    const done = saveAndRefreshPropertiesPanel(env.app, editor);
    await vi.advanceTimersByTimeAsync(0);
    env.cacheChanged();
    await done;
    expect(editor.getCursor("from")).toEqual({ line: 0, ch: 2 });
    expect(editor.getCursor("to")).toEqual({ line: 0, ch: 7 });
    expect(editor.getSelection()).toBe("pha b");
  });

  it("uses the last non-empty line, skipping trailing blank ones", async () => {
    const env = fakeApp();
    const editor = createMockEditor("first\nlast line\n\n\n");
    const replace = vi.spyOn(editor, "replaceRange");
    const done = saveAndRefreshPropertiesPanel(env.app, editor);
    await vi.advanceTimersByTimeAsync(0);
    env.cacheChanged();
    await done;
    expect(replace).toHaveBeenCalledWith("e", { line: 1, ch: 8 }, { line: 1, ch: 9 });
    expect(editor.getValue()).toBe("first\nlast line\n\n\n");
  });

  it("does nothing to an empty note", async () => {
    const env = fakeApp();
    const editor = createMockEditor("");
    const replace = vi.spyOn(editor, "replaceRange");
    const done = saveAndRefreshPropertiesPanel(env.app, editor);
    await vi.advanceTimersByTimeAsync(0);
    env.cacheChanged();
    await done;
    expect(replace).not.toHaveBeenCalled();
  });

  it("still refreshes when there is no active file or markdown view to save", async () => {
    for (const options of [{ file: null }, { noView: true }]) {
      const env = fakeApp(options);
      const editor = createMockEditor("body");
      const replace = vi.spyOn(editor, "replaceRange");
      const done = saveAndRefreshPropertiesPanel(env.app, editor);
      await vi.advanceTimersByTimeAsync(0);
      env.cacheChanged();
      await vi.advanceTimersByTimeAsync(1500);
      await done;
      expect(replace).toHaveBeenCalled();
    }
  });

  it("warns instead of throwing when saving fails, and skips the edit", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = fakeApp({ save: async () => Promise.reject(new Error("disk full")) });
    const editor = createMockEditor("body");
    const replace = vi.spyOn(editor, "replaceRange");
    const done = saveAndRefreshPropertiesPanel(env.app, editor);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1500); // lets the wait time out
    await done;
    expect(warn).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });
});
