import { App, TFile } from "obsidian";
import type { EditorLike } from "./types";
import { buildLinkText } from "./linkText";
import { EditorSuggestModal } from "./editorSuggestModal";
import { suggestNotes, type NoteSuggestion } from "./fuzzySuggest";

class LinkSuggestModal extends EditorSuggestModal<NoteSuggestion> {
  constructor(app: App, editor: EditorLike) {
    super(app, editor, "Find or create a note...");
  }

  getSuggestions(query: string): NoteSuggestion[] {
    return suggestNotes(this.app.vault.getMarkdownFiles(), query);
  }

  renderSuggestion(item: NoteSuggestion, el: HTMLElement): void {
    if (item.type === "create") {
      el.createEl("div", { text: `Create new note: "${item.name}"` });
      return;
    }
    el.createEl("div", { text: item.file.basename });
    if (item.file.parent && !item.file.parent.isRoot()) {
      el.createEl("small", { text: item.file.parent.path, cls: "ribbon-bar-link-modal-path" });
    }
  }

  onChooseSuggestion(item: NoteSuggestion): void {
    const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
    const target =
      item.type === "file" ? this.app.metadataCache.fileToLinktext(item.file, sourcePath) : item.name;
    this.insert(buildLinkText(target, this.alias));
  }
}

export function openLinkModal(editor: EditorLike, app: App): void {
  new LinkSuggestModal(app, editor).open();
}
