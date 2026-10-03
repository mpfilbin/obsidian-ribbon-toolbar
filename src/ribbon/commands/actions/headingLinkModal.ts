import { App } from "obsidian";
import type { EditorLike } from "./types";
import { buildHeadingLinkText, collectHeadings, type HeadingEntry } from "./headingLinkText";
import { EditorSuggestModal } from "./editorSuggestModal";
import { fuzzyFilter } from "./fuzzySuggest";

class HeadingLinkSuggestModal extends EditorSuggestModal<HeadingEntry> {
  constructor(app: App, editor: EditorLike) {
    super(app, editor, "Find a heading in this note...");
  }

  getSuggestions(query: string): HeadingEntry[] {
    return fuzzyFilter(collectHeadings(this.editor), query, (heading) => heading.text);
  }

  renderSuggestion(item: HeadingEntry, el: HTMLElement): void {
    const row = el.createEl("div", { text: item.text });
    row.style.paddingLeft = `${(item.level - 1) * 16}px`;
  }

  onChooseSuggestion(item: HeadingEntry): void {
    this.insert(buildHeadingLinkText(item.text, this.alias));
  }
}

export function openHeadingLinkModal(editor: EditorLike, app: App): void {
  new HeadingLinkSuggestModal(app, editor).open();
}
