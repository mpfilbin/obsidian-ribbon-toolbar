import { App, Notice, Setting } from "obsidian";
import type { EditorLike } from "../../commands/actions/types";
import { FormModal } from "../../commands/actions/formModal";
import { VIEW_TYPES } from "../model";
import { buildStarterBase, baseFileName, type StarterScope } from "../starter";
import { formatBaseBlock, formatBaseEmbed } from "../locate";
import { serializeBase } from "../yaml";

type Placement = "inline" | "file";

const SCOPES: [StarterScope, string][] = [
  ["all", "All notes"],
  ["folder", "Notes in this note's folder"],
  ["tag", "Notes with a tag"],
  ["links", "Notes that link to this note"],
];

class NewBaseModal extends FormModal {
  private draft = { placement: "inline" as Placement, fileName: "", viewType: VIEW_TYPES[0].id, viewName: "", scope: "all" as StarterScope, tag: "" };
  private optionsEl!: HTMLElement;

  constructor(app: App, editor: EditorLike) {
    super(app, editor, "New base");
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("ribbon-bar-base-new-modal");

    new Setting(contentEl)
      .setName("Store as")
      .setDesc("Inline keeps the base inside this note. A separate file can be embedded in several notes.")
      .addDropdown((dropdown) => {
        dropdown.addOption("inline", "Inline in this note");
        dropdown.addOption("file", "Separate .base file");
        dropdown.setValue(this.draft.placement);
        dropdown.onChange((value) => {
          this.draft.placement = value as Placement;
          this.drawOptions();
        });
      });

    new Setting(contentEl).setName("First view").addDropdown((dropdown) => {
      VIEW_TYPES.forEach((t) => dropdown.addOption(t.id, t.label));
      dropdown.setValue(this.draft.viewType);
      dropdown.onChange((value) => (this.draft.viewType = value));
    });

    new Setting(contentEl).setName("View name").addText((text) => {
      text.setPlaceholder("Optional");
      text.onChange((value) => (this.draft.viewName = value));
      this.submitOnEnter(text.inputEl);
    });

    new Setting(contentEl).setName("Start with").addDropdown((dropdown) => {
      SCOPES.forEach(([id, label]) => dropdown.addOption(id, label));
      dropdown.setValue(this.draft.scope);
      dropdown.onChange((value) => {
        this.draft.scope = value as StarterScope;
        this.drawOptions();
      });
    });

    this.optionsEl = contentEl.createDiv();
    this.drawOptions();
    this.addInsertButton("Create");
  }

  /** The fields that depend on earlier choices: the file name and the tag. */
  private drawOptions(): void {
    this.optionsEl.empty();
    if (this.draft.scope === "tag") {
      new Setting(this.optionsEl).setName("Tag").addText((text) => {
        text.setPlaceholder("project");
        text.setValue(this.draft.tag);
        text.onChange((value) => (this.draft.tag = value));
        this.submitOnEnter(text.inputEl);
      });
    }
    if (this.draft.placement === "file") {
      new Setting(this.optionsEl).setName("File name").addText((text) => {
        text.setPlaceholder("Projects");
        text.setValue(this.draft.fileName);
        text.onChange((value) => (this.draft.fileName = value));
        this.submitOnEnter(text.inputEl);
      });
    }
  }

  protected submit(): void {
    void this.create();
  }

  private async create(): Promise<void> {
    const notePath = this.app.workspace.getActiveFile()?.path ?? "";
    const yaml = serializeBase(
      buildStarterBase({ viewType: this.draft.viewType, viewName: this.draft.viewName, scope: this.draft.scope, notePath, tag: this.draft.tag })
    );

    if (this.draft.placement === "inline") {
      this.editor.replaceSelection(formatBaseBlock(yaml));
      this.close();
      return;
    }

    const name = baseFileName(this.draft.fileName);
    const folder = this.app.fileManager.getNewFileParent(notePath).path;
    const path = folder === "/" || folder === "" ? name : `${folder}/${name}`;
    if (this.app.vault.getAbstractFileByPath(path)) {
      new Notice(`"${path}" already exists. Pick another name, or use Embed Base.`);
      return;
    }
    try {
      const file = await this.app.vault.create(path, `${yaml}\n`);
      this.editor.replaceSelection(formatBaseEmbed(this.app.metadataCache.fileToLinktext(file, notePath)));
      this.close();
    } catch (error) {
      new Notice(`Couldn't create the base file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export function openNewBaseModal(editor: EditorLike, app: App): void {
  new NewBaseModal(app, editor).open();
}
