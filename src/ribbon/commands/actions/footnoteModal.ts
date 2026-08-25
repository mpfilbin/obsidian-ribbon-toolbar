import { App, Modal, Setting } from "obsidian";
import type { EditorLike } from "./types";
import { insertFootnote } from "./references";

class FootnoteFormModal extends Modal {
  private textInput!: HTMLTextAreaElement;

  constructor(
    app: App,
    private editor: EditorLike
  ) {
    super(app);
    this.setTitle("Insert footnote");
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("ribbon-bar-footnote-modal");

    new Setting(contentEl).setName("Footnote text:").addTextArea((textArea) => {
      this.textInput = textArea.inputEl;
      textArea.inputEl.rows = 3;
      textArea.inputEl.addClass("ribbon-bar-footnote-content");
      textArea.inputEl.addEventListener("keydown", (event) => this.handleFieldKeydown(event));
    });

    new Setting(contentEl).addButton((button) =>
      button
        .setButtonText("Insert")
        .setCta()
        .onClick(() => this.submit())
    );

    this.textInput.focus();
  }

  private handleFieldKeydown(event: KeyboardEvent): void {
    const isSubmitCombo = event.key === "Enter" && (event.ctrlKey || event.metaKey);
    if (!isSubmitCombo) {
      return;
    }
    event.preventDefault();
    this.submit();
  }

  private submit(): void {
    insertFootnote(this.editor, this.textInput.value.trim());
    this.close();
  }

  onClose(): void {
    this.editor.focus();
  }
}

export function openFootnoteModal(editor: EditorLike, app: App): void {
  new FootnoteFormModal(app, editor).open();
}
