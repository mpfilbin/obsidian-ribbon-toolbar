import { App, Modal, Setting } from "obsidian";
import type { EditorLike } from "./types";
import { CALLOUT_TYPES, calloutInsertText } from "./calloutTypes";

const TYPE_DATALIST_ID = "ribbon-bar-callout-type-options";

class CalloutFormModal extends Modal {
  private typeInput!: HTMLInputElement;
  private titleInput!: HTMLInputElement;
  private contentInput!: HTMLTextAreaElement;

  constructor(
    app: App,
    private editor: EditorLike
  ) {
    super(app);
    this.setTitle("Insert callout");
  }

  onOpen(): void {
    const { contentEl } = this;

    const datalist = contentEl.createEl("datalist", { attr: { id: TYPE_DATALIST_ID } });
    for (const type of CALLOUT_TYPES) {
      datalist.createEl("option", { value: type });
    }

    new Setting(contentEl).setName("Type").addText((text) => {
      this.typeInput = text.inputEl;
      text.inputEl.setAttribute("list", TYPE_DATALIST_ID);
      text.setPlaceholder("note");
      text.inputEl.addEventListener("keydown", (event) => this.handleFieldKeydown(event));
    });

    new Setting(contentEl).setName("Title").addText((text) => {
      this.titleInput = text.inputEl;
      text.inputEl.addEventListener("keydown", (event) => this.handleFieldKeydown(event));
    });

    const initialContent = this.editor.somethingSelected() ? this.editor.getSelection() : "";
    new Setting(contentEl).setName("Content").addTextArea((textArea) => {
      this.contentInput = textArea.inputEl;
      textArea.setValue(initialContent);
      textArea.inputEl.addEventListener("keydown", (event) => this.handleFieldKeydown(event));
    });

    new Setting(contentEl).addButton((button) =>
      button
        .setButtonText("Insert")
        .setCta()
        .onClick(() => this.submit())
    );

    this.typeInput.focus();
  }

  private handleFieldKeydown(event: KeyboardEvent): void {
    const isTextarea = event.target instanceof HTMLTextAreaElement;
    const isSubmitCombo = event.key === "Enter" && (isTextarea ? event.ctrlKey || event.metaKey : true);
    if (!isSubmitCombo) {
      return;
    }
    event.preventDefault();
    this.submit();
  }

  private submit(): void {
    const text = calloutInsertText(this.typeInput.value, this.titleInput.value, this.contentInput.value);
    this.editor.replaceSelection(text);
    this.close();
  }

  onClose(): void {
    this.editor.focus();
  }
}

export function openCalloutModal(editor: EditorLike, app: App): void {
  new CalloutFormModal(app, editor).open();
}
