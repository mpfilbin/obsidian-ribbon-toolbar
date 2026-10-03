import { App, TFile } from "obsidian";
import type { EditorLike } from "../../commands/actions/types";
import { EditorSuggestModal } from "../../commands/actions/editorSuggestModal";
import { fuzzyFilter } from "../../commands/actions/fuzzySuggest";
import { formatBaseEmbed } from "../locate";
import { parseBase } from "../yaml";

interface BaseChoice {
  file: TFile;
  /** Set for the "file › view" entries that pin the embed to one view. */
  view?: string;
}

class EmbedBaseModal extends EditorSuggestModal<BaseChoice> {
  private choices: Promise<BaseChoice[]>;

  constructor(app: App, editor: EditorLike) {
    super(app, editor, "Find a .base file to embed...");
    this.choices = this.loadChoices();
  }

  /** Every .base file, plus one entry per named view so a single view can be embedded. */
  private async loadChoices(): Promise<BaseChoice[]> {
    const choices: BaseChoice[] = [];
    const files = this.app.vault.getFiles().filter((file) => file.extension === "base");
    for (const file of files) {
      choices.push({ file });
      try {
        const parsed = parseBase(await this.app.vault.read(file));
        const views = parsed.ok ? (parsed.config.views ?? []) : [];
        if (views.length > 1) for (const view of views) choices.push({ file, view: view.name });
      } catch {
        // An unreadable file is still embeddable as a whole.
      }
    }
    return choices;
  }

  async getSuggestions(query: string): Promise<BaseChoice[]> {
    return fuzzyFilter(await this.choices, query, (choice) => `${choice.file.basename} ${choice.view ?? ""}`);
  }

  renderSuggestion(choice: BaseChoice, el: HTMLElement): void {
    el.createEl("div", { text: choice.view ? `${choice.file.basename} › ${choice.view}` : choice.file.name });
    if (choice.file.parent && !choice.file.parent.isRoot()) {
      el.createEl("small", { text: choice.file.parent.path, cls: "ribbon-bar-link-modal-path" });
    }
  }

  onChooseSuggestion(choice: BaseChoice): void {
    const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
    this.insert(formatBaseEmbed(this.app.metadataCache.fileToLinktext(choice.file, sourcePath), choice.view));
  }
}

export function openEmbedBaseModal(editor: EditorLike, app: App): void {
  new EmbedBaseModal(app, editor).open();
}
