// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App, obsidianLog } from "obsidian";
import { FormModal } from "../../../../src/ribbon/commands/actions/formModal";
import { EditorSuggestModal } from "../../../../src/ribbon/commands/actions/editorSuggestModal";
import { createMockEditor } from "../../../support/mockEditor";

beforeEach(() => obsidianLog.reset());

class TestForm extends FormModal {
  submitted = 0;
  input!: HTMLInputElement;
  area!: HTMLTextAreaElement;
  constructor(app: App, editor: ReturnType<typeof createMockEditor>) {
    super(app, editor, "Test form");
  }
  onOpen(): void {
    this.input = this.contentEl.createEl("input") as HTMLInputElement;
    this.area = this.contentEl.createEl("textarea") as HTMLTextAreaElement;
    this.submitOnEnter(this.input);
    this.submitOnEnter(this.area);
    this.addInsertButton();
  }
  protected submit(): void {
    this.submitted++;
  }
}

function key(el: HTMLElement, init: KeyboardEventInit) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(event);
  return event;
}

describe("FormModal", () => {
  function open() {
    const editor = createMockEditor("");
    const focus = vi.spyOn(editor, "focus");
    const modal = new TestForm(new App() as never, editor);
    modal.open();
    return { modal, focus };
  }

  it("sets the title and renders an Insert call-to-action button that submits", () => {
    const { modal } = open();
    expect(modal.titleEl.textContent).toBe("Test form");
    const button = modal.contentEl.querySelector("button")!;
    expect(button.textContent).toBe("Insert");
    button.click();
    expect(modal.submitted).toBe(1);
  });

  it("submits on Enter in a single-line input, preventing the default", () => {
    const { modal } = open();
    const event = key(modal.input, { key: "Enter" });
    expect(event.defaultPrevented).toBe(true);
    expect(modal.submitted).toBe(1);
  });

  it("needs Ctrl or Cmd with Enter in a textarea", () => {
    const { modal } = open();
    expect(key(modal.area, { key: "Enter" }).defaultPrevented).toBe(false);
    expect(modal.submitted).toBe(0);
    key(modal.area, { key: "Enter", ctrlKey: true });
    key(modal.area, { key: "Enter", metaKey: true });
    expect(modal.submitted).toBe(2);
  });

  it("ignores other keys", () => {
    const { modal } = open();
    key(modal.input, { key: "a" });
    expect(modal.submitted).toBe(0);
  });

  it("returns focus to the editor on close", () => {
    const { modal, focus } = open();
    modal.close();
    expect(focus).toHaveBeenCalled();
  });
});

class TestSuggest extends EditorSuggestModal<string> {
  getSuggestions(): string[] {
    return [];
  }
  renderSuggestion(): void {}
  onChooseSuggestion(item: string): void {
    this.insert(`[${item}|${this.alias}]`);
  }
}

describe("EditorSuggestModal", () => {
  it("sets the placeholder and uses the selection as the alias", () => {
    const editor = createMockEditor("picked");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 6 });
    const modal = new TestSuggest(new App() as never, editor, "Search...");
    expect(modal.placeholder).toBe("Search...");
    modal.onChooseSuggestion("x");
    expect(editor.getValue()).toBe("[x|picked]");
  });

  it("has a null alias when nothing is selected, and refocuses the editor after inserting and closing", () => {
    const editor = createMockEditor("");
    const focus = vi.spyOn(editor, "focus");
    const modal = new TestSuggest(new App() as never, editor, "");
    modal.onChooseSuggestion("y");
    expect(editor.getValue()).toBe("[y|null]");
    expect(focus).toHaveBeenCalledTimes(1);
    modal.open();
    modal.close();
    expect(focus).toHaveBeenCalledTimes(2);
  });
});
