import { App, Notice, Setting } from "obsidian";
import type { EditorLike } from "./types";
import { planBlockId, uniqueBlockId, validateBlockId } from "./blockId";
import { FormModal } from "./formModal";

class BlockIdFormModal extends FormModal {
  private idInput!: HTMLInputElement;

  constructor(
    app: App,
    editor: EditorLike,
    private readonly taken: Set<string>,
    private readonly insertId: (id: string) => void,
    private readonly suggestion: string
  ) {
    super(app, editor, "Insert block ID");
  }

  onOpen(): void {
    new Setting(this.contentEl)
      .setName("Block ID")
      .setDesc("Letters, numbers and hyphens. Keep the suggestion or type your own.")
      .addText((text) => {
        this.idInput = text.inputEl;
        text.setValue(this.suggestion);
        this.submitOnEnter(text.inputEl);
      });

    this.addInsertButton();

    this.idInput.focus();
    this.idInput.select();
  }

  protected submit(): void {
    // A blank field falls back to the suggestion rather than inserting nothing.
    const result = validateBlockId(this.idInput.value.trim() === "" ? this.suggestion : this.idInput.value, this.taken);
    if ("error" in result) {
      new Notice(`Ribbon Bar: ${result.error}`);
      return;
    }
    this.insertId(result.id);
    this.close();
  }
}

export function openBlockIdModal(editor: EditorLike, app: App): void {
  const plan = planBlockId(editor);
  if (plan.type === "skip") {
    new Notice(`Ribbon Bar: ${plan.reason}`);
    return;
  }
  new BlockIdFormModal(app, editor, plan.taken, plan.insert, uniqueBlockId(plan.taken)).open();
}
