// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, modals, notices, obsidianLog } from "obsidian";
import { openExternalLinkModal } from "../../../../src/ribbon/commands/actions/externalLinkModal";
import { openBlockIdModal } from "../../../../src/ribbon/commands/actions/blockIdModal";
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

describe("block ID modal", () => {
  function open(text: string, line = 0) {
    notices.length = 0;
    const editor = createMockEditor(text, { line, ch: 0 });
    const focus = vi.spyOn(editor, "focus");
    openBlockIdModal(editor, new App() as never);
    const modal = modals.at(-1)!;
    return {
      editor,
      focus,
      modal,
      input: modal.contentEl.querySelector<HTMLInputElement>("input")!,
      insert: modal.contentEl.querySelector("button")!,
    };
  }

  beforeEach(() => {
    modals.length = 0;
  });

  it("prefills a suggested ID, focuses and selects it", () => {
    const focused = spyOnFocus();
    const select = vi.spyOn(HTMLInputElement.prototype, "select").mockImplementation(() => {});
    const ui = open("Some text");
    expect(ui.modal.titleEl.textContent).toBe("Insert block ID");
    expect(ui.input.value).toMatch(/^[a-z0-9]{6}$/);
    expect(focused).toEqual([ui.input]);
    expect(select).toHaveBeenCalled();
  });

  it("inserts the suggested ID when accepted as-is", () => {
    const ui = open("Some text");
    const suggestion = ui.input.value;
    ui.insert.click();
    expect(ui.editor.getValue()).toBe(`Some text ^${suggestion}`);
    expect(ui.modal.opened).toBe(false);
    expect(ui.focus).toHaveBeenCalled();
  });

  it("inserts a custom ID, submitting with Enter", () => {
    const ui = open("Some text");
    setValue(ui.input, "  ^my-id ");
    const event = press(ui.input, "Enter");
    expect(event.defaultPrevented).toBe(true);
    expect(ui.editor.getValue()).toBe("Some text ^my-id");
    expect(ui.modal.opened).toBe(false);
  });

  it("falls back to the suggestion when the field is cleared", () => {
    const ui = open("Some text");
    const suggestion = ui.input.value;
    setValue(ui.input, "   ");
    ui.insert.click();
    expect(ui.editor.getValue()).toBe(`Some text ^${suggestion}`);
  });

  it("keeps the dialog open with a message for an invalid or already used ID", () => {
    const ui = open("Para\n\nOther ^taken", 0);
    setValue(ui.input, "bad id");
    ui.insert.click();
    expect(ui.modal.opened).toBe(true);
    expect(notices.at(-1)).toContain("letters, numbers and hyphens");

    setValue(ui.input, "taken");
    ui.insert.click();
    expect(ui.modal.opened).toBe(true);
    expect(notices.at(-1)).toContain("^taken is already used");
    expect(ui.editor.getValue()).toBe("Para\n\nOther ^taken");
  });

  it("does not open, and explains why, when the cursor is not in a block that can take an ID", () => {
    const editor = createMockEditor("# Heading");
    notices.length = 0;
    openBlockIdModal(editor, new App() as never);
    expect(modals).toHaveLength(0);
    expect(notices.at(-1)).toContain("Heading Link");
    expect(editor.getValue()).toBe("# Heading");
  });
});
