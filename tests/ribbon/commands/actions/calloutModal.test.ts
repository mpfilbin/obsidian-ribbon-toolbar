// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, modals, obsidianLog } from "obsidian";
import { openCalloutModal } from "../../../../src/ribbon/commands/actions/calloutModal";
import { createMockEditor } from "../../../support/mockEditor";

const PREVIEW_DELAY_MS = 150;

function open(text = "", selection?: [number, number]) {
  const editor = createMockEditor(text);
  if (selection) editor.setSelection({ line: 0, ch: selection[0] }, { line: 0, ch: selection[1] });
  const focus = vi.spyOn(editor, "focus");
  openCalloutModal(editor, new App() as never);
  const modal = modals[0];
  const root = modal.contentEl;
  return {
    editor,
    focus,
    modal,
    type: root.querySelector<HTMLInputElement>('input[list]')!,
    title: root.querySelectorAll<HTMLInputElement>('input[type="text"]')[1],
    content: root.querySelector<HTMLTextAreaElement>("textarea")!,
    preview: root.querySelector<HTMLElement>(".ribbon-bar-callout-preview")!,
    insert: [...root.querySelectorAll("button")].find((b) => b.textContent === "Insert")!,
  };
}

function type(input: HTMLInputElement | HTMLTextAreaElement, value: string, eventName = "input") {
  input.value = value;
  input.dispatchEvent(new Event(eventName, { bubbles: true }));
}

function press(el: HTMLElement, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  obsidianLog.reset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("callout modal", () => {
  it("opens with the title, a datalist of known callout types, and prefilled selected text", () => {
    const { modal, content } = open("some text", [0, 4]);
    expect(modal.titleEl.textContent).toBe("Insert callout");
    expect(modal.contentEl.querySelectorAll("datalist option").length).toBeGreaterThan(10);
    expect(content.value).toBe("some");
  });

  it("starts with empty content when nothing is selected", () => {
    expect(open("some text").content.value).toBe("");
  });

  it("renders an initial preview immediately", async () => {
    open();
    await vi.advanceTimersByTimeAsync(0);
    expect(obsidianLog.renders.at(-1)?.markdown).toBe("> [!note]\n> ");
  });

  describe("live preview", () => {
    it.each([
      ["type", "warning", "> [!warning]\n> "],
      ["title", "Heads up", "> [!note] Heads up\n> "],
      ["content", "line one\nline two", "> [!note]\n> line one\n> line two"],
    ])("re-renders after the %s changes, debounced", async (field, value, expected) => {
      const ui = open();
      await vi.advanceTimersByTimeAsync(0);
      const before = obsidianLog.renders.length;

      type(ui[field as "type" | "title" | "content"], value);
      await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS - 1);
      expect(obsidianLog.renders.length).toBe(before);

      await vi.advanceTimersByTimeAsync(1);
      expect(obsidianLog.renders.at(-1)?.markdown).toBe(expected);
      expect(ui.preview.textContent).toBe(expected);
    });

    it.each(["change", "blur"])("also refreshes the type preview on %s (dropdown selection)", async (eventName) => {
      const ui = open();
      await vi.advanceTimersByTimeAsync(0);
      type(ui.type, "tip", eventName);
      await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS);
      expect(obsidianLog.renders.at(-1)?.markdown).toBe("> [!tip]\n> ");
    });

    it("coalesces rapid edits into a single render of the latest value", async () => {
      const ui = open();
      await vi.advanceTimersByTimeAsync(0);
      const before = obsidianLog.renders.length;
      type(ui.content, "a");
      await vi.advanceTimersByTimeAsync(50);
      type(ui.content, "ab");
      await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS);
      expect(obsidianLog.renders.length).toBe(before + 1);
      expect(obsidianLog.renders.at(-1)?.markdown).toContain("> ab");
    });

    it("discards a slow render that a newer one has overtaken", async () => {
      const ui = open();
      await vi.advanceTimersByTimeAsync(0);
      // Start two renders in the same tick: the first resumes after the second began.
      type(ui.content, "old");
      vi.advanceTimersByTime(PREVIEW_DELAY_MS);
      type(ui.content, "new");
      vi.advanceTimersByTime(PREVIEW_DELAY_MS);
      await vi.advanceTimersByTimeAsync(0);
      expect(ui.preview.textContent).toBe("> [!note]\n> new");
    });

    it("cancels a pending render when the modal closes", async () => {
      const ui = open();
      await vi.advanceTimersByTimeAsync(0);
      const before = obsidianLog.renders.length;
      type(ui.content, "late");
      ui.modal.close();
      await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS * 2);
      expect(obsidianLog.renders.length).toBe(before);
    });
  });

  describe("submitting", () => {
    it("inserts the callout when Insert is clicked, then closes and refocuses the editor", () => {
      const ui = open("", undefined);
      type(ui.type, "info");
      type(ui.title, "FYI");
      type(ui.content, "body");
      ui.insert.click();
      expect(ui.editor.getValue()).toBe("> [!info] FYI\n> body");
      expect(ui.modal.opened).toBe(false);
      expect(ui.focus).toHaveBeenCalled();
    });

    it("replaces the selection that prefilled the content", () => {
      const ui = open("keep SELECTED keep", [5, 13]);
      ui.insert.click();
      expect(ui.editor.getValue()).toBe("keep > [!note]\n> SELECTED keep");
    });

    it("submits on Enter from a single-line field", () => {
      const ui = open();
      const event = press(ui.title, "Enter");
      expect(event.defaultPrevented).toBe(true);
      expect(ui.editor.getValue()).toBe("> [!note]\n> ");
      expect(ui.modal.opened).toBe(false);
    });

    it.each([
      ["ctrl", { ctrlKey: true }],
      ["meta", { metaKey: true }],
    ])("submits on %s+Enter from the content textarea", (_name, modifier) => {
      const ui = open();
      type(ui.content, "x");
      press(ui.content, "Enter", modifier);
      expect(ui.editor.getValue()).toBe("> [!note]\n> x");
    });

    it("lets a plain Enter in the textarea insert a newline instead of submitting", () => {
      const ui = open();
      const event = press(ui.content, "Enter");
      expect(event.defaultPrevented).toBe(false);
      expect(ui.modal.opened).toBe(true);
      expect(ui.editor.getValue()).toBe("");
    });

    it("ignores other keys", () => {
      const ui = open();
      press(ui.type, "a");
      expect(ui.modal.opened).toBe(true);
    });
  });
});
