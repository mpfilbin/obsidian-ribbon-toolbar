// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, modals, obsidianLog } from "obsidian";
import { openExternalLinkModal } from "../../../../src/ribbon/commands/actions/externalLinkModal";
import { openFootnoteModal } from "../../../../src/ribbon/commands/actions/footnoteModal";
import { createMockEditor } from "../../../support/mockEditor";

function press(el: HTMLElement, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(event);
  return event;
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// Modal content is never attached to the document in these tests, so focus()
// is a no-op in jsdom; record which element was asked to take focus instead.
function spyOnFocus(): HTMLElement[] {
  const focused: HTMLElement[] = [];
  vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (this: HTMLElement) {
    focused.push(this);
  });
  return focused;
}

beforeEach(() => obsidianLog.reset());
afterEach(() => vi.restoreAllMocks());

describe("external link modal", () => {
  function open(text: string, selection?: [number, number]) {
    const editor = createMockEditor(text);
    if (selection) editor.setSelection({ line: 0, ch: selection[0] }, { line: 0, ch: selection[1] });
    const focus = vi.spyOn(editor, "focus");
    openExternalLinkModal(editor, new App() as never);
    const modal = modals[0];
    const inputs = modal.contentEl.querySelectorAll<HTMLInputElement>("input");
    return {
      editor,
      focus,
      modal,
      text: inputs[0],
      url: inputs[1],
      insert: modal.contentEl.querySelector("button")!,
    };
  }

  it("prefills the text field from the selection and focuses the URL field", () => {
    const focused = spyOnFocus();
    const ui = open("click here please", [0, 10]);
    expect(focused).toEqual([ui.url]);
    expect(ui.modal.titleEl.textContent).toBe("Insert link");
    expect(ui.text.value).toBe("click here");
    expect(ui.url.placeholder).toBe("https://example.com");
  });

  it("focuses the text field when nothing is selected", () => {
    const focused = spyOnFocus();
    const ui = open("");
    expect(focused).toEqual([ui.text]);
  });

  it("builds a markdown link from the two fields and closes", () => {
    const ui = open("");
    setValue(ui.text, " docs ");
    setValue(ui.url, " https://example.com/docs ");
    ui.insert.click();
    expect(ui.editor.getValue()).toBe("[docs](https://example.com/docs)");
    expect(ui.modal.opened).toBe(false);
    expect(ui.focus).toHaveBeenCalled();
  });

  it("falls back to placeholder text and url when the fields are empty", () => {
    const ui = open("");
    ui.insert.click();
    expect(ui.editor.getValue()).toBe("[link text](url)");
  });

  it("submits on Enter in either field and ignores other keys", () => {
    const ui = open("");
    press(ui.text, "a");
    expect(ui.modal.opened).toBe(true);
    const event = press(ui.url, "Enter");
    expect(event.defaultPrevented).toBe(true);
    expect(ui.modal.opened).toBe(false);
  });
});

describe("footnote modal", () => {
  function open(text: string) {
    const editor = createMockEditor(text);
    const focus = vi.spyOn(editor, "focus");
    openFootnoteModal(editor, new App() as never);
    const modal = modals[0];
    return {
      editor,
      focus,
      modal,
      textarea: modal.contentEl.querySelector("textarea")!,
      insert: modal.contentEl.querySelector("button")!,
    };
  }

  it("inserts a reference at the cursor and a definition at the end of the note", () => {
    const ui = open("Body");
    ui.editor.setCursor({ line: 0, ch: 4 });
    setValue(ui.textarea, "  The note.  ");
    ui.insert.click();
    expect(ui.editor.getValue()).toBe("Body[^1]\n\n[^1]: The note.");
    expect(ui.modal.opened).toBe(false);
    expect(ui.focus).toHaveBeenCalled();
  });

  it("numbers the new footnote after existing ones", () => {
    const ui = open("A[^3]");
    setValue(ui.textarea, "x");
    ui.insert.click();
    expect(ui.editor.getValue()).toContain("[^4]: x");
  });

  it("submits on Ctrl/Cmd+Enter but not on a plain Enter", () => {
    const ui = open("Body");
    const plain = press(ui.textarea, "Enter");
    expect(plain.defaultPrevented).toBe(false);
    expect(ui.modal.opened).toBe(true);

    const combo = press(ui.textarea, "Enter", { metaKey: true });
    expect(combo.defaultPrevented).toBe(true);
    expect(ui.modal.opened).toBe(false);
  });
});
