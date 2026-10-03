import { App, Setting } from "obsidian";
import type { EditorLike } from "./types";
import { insertFootnote } from "./references";
import { FormModal } from "./formModal";

class FootnoteFormModal extends FormModal {
  private textInput!: HTMLTextAreaElement;

  constructor(app: App, editor: EditorLike) {
    super(app, editor, "Insert footnote");
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("ribbon-bar-footnote-modal");

    new Setting(contentEl).setName("Footnote text:").addTextArea((textArea) => {
      this.textInput = textArea.inputEl;
      textArea.inputEl.rows = 3;
      textArea.inputEl.addClass("ribbon-bar-footnote-content");
      this.submitOnEnter(textArea.inputEl);
    });

    this.addInsertButton();

    this.textInput.focus();
  }

  protected submit(): void {
    insertFootnote(this.editor, this.textInput.value.trim());
    this.close();
  }
}

export function openFootnoteModal(editor: EditorLike, app: App): void {
  new FootnoteFormModal(app, editor).open();
}
