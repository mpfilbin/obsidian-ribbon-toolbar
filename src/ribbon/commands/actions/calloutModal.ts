import { App, Component, MarkdownRenderer, Setting } from "obsidian";
import type { EditorLike } from "./types";
import { CALLOUT_TYPES, calloutInsertText } from "./calloutTypes";
import { FormModal } from "./formModal";

const TYPE_DATALIST_ID = "ribbon-bar-callout-type-options";

class CalloutFormModal extends FormModal {
  private typeInput!: HTMLInputElement;
  private titleInput!: HTMLInputElement;
  private contentInput!: HTMLTextAreaElement;
  private previewEl!: HTMLElement;
  private previewComponent = new Component();
  private previewTimer: number | undefined;
  private previewVersion = 0;

  constructor(app: App, editor: EditorLike) {
    super(app, editor, "Insert callout");
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("ribbon-bar-callout-modal");
    this.previewComponent.load();

    const datalist = contentEl.createEl("datalist", { attr: { id: TYPE_DATALIST_ID } });
    for (const type of CALLOUT_TYPES) {
      datalist.createEl("option", { value: type });
    }

    new Setting(contentEl).setName("Type").addText((text) => {
      this.typeInput = text.inputEl;
      text.inputEl.setAttribute("list", TYPE_DATALIST_ID);
      text.setPlaceholder("note");
      this.submitOnEnter(text.inputEl);
      // Picking an entry from the datalist dropdown doesn't reliably fire
      // "input", so also refresh on "change" and when the dropdown closes.
      for (const eventName of ["input", "change", "blur"]) {
        text.inputEl.addEventListener(eventName, () => this.schedulePreview());
      }
    });

    new Setting(contentEl).setName("Title").addText((text) => {
      this.titleInput = text.inputEl;
      this.submitOnEnter(text.inputEl);
      text.inputEl.addEventListener("input", () => this.schedulePreview());
    });

    const initialContent = this.editor.somethingSelected() ? this.editor.getSelection() : "";
    new Setting(contentEl).setName("Content").addTextArea((textArea) => {
      this.contentInput = textArea.inputEl;
      textArea.setValue(initialContent);
      textArea.inputEl.rows = 8;
      textArea.inputEl.addClass("ribbon-bar-callout-content");
      this.submitOnEnter(textArea.inputEl);
      textArea.inputEl.addEventListener("input", () => this.schedulePreview());
    });

    new Setting(contentEl).setName("Preview");
    this.previewEl = contentEl.createDiv({ cls: "ribbon-bar-callout-preview markdown-rendered" });
    void this.renderPreview();

    this.addInsertButton();

    this.typeInput.focus();
  }

  private currentMarkdown(): string {
    return calloutInsertText(this.typeInput.value, this.titleInput.value, this.contentInput.value);
  }

  private schedulePreview(): void {
    window.clearTimeout(this.previewTimer);
    this.previewTimer = window.setTimeout(() => void this.renderPreview(), 150);
  }

  private async renderPreview(): Promise<void> {
    const version = ++this.previewVersion;
    const rendered = createDiv();
    await MarkdownRenderer.render(this.app, this.currentMarkdown(), rendered, "", this.previewComponent);
    if (version !== this.previewVersion) {
      return;
    }
    this.previewEl.empty();
    this.previewEl.append(...Array.from(rendered.childNodes));
  }

  protected submit(): void {
    const text = this.currentMarkdown();
    this.editor.replaceSelection(text);
    this.close();
  }

  onClose(): void {
    window.clearTimeout(this.previewTimer);
    this.previewComponent.unload();
    super.onClose();
  }
}

export function openCalloutModal(editor: EditorLike, app: App): void {
  new CalloutFormModal(app, editor).open();
}
