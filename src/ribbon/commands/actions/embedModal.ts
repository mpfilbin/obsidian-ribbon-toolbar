import { App, TFile } from "obsidian";
import type { CachedMetadata } from "obsidian";
import type { EditorLike } from "./types";
import { buildEmbedText } from "./embedText";
import { collectBlockCandidates } from "./embedBlocks";
import { EditorSuggestModal } from "./editorSuggestModal";
import { fuzzyFilter, RESULT_LIMIT, suggestNotes, type NoteSuggestion } from "./fuzzySuggest";

type EmbedSuggestion =
  | NoteSuggestion
  | { type: "heading"; file: TFile; heading: string }
  | { type: "block"; file: TFile; blockId: string; preview: string }
  | { type: "raw"; target: string };

class EmbedSuggestModal extends EditorSuggestModal<EmbedSuggestion> {
  private blockContentCache: { file: TFile; lines: string[] } | null = null;

  constructor(app: App, editor: EditorLike) {
    super(app, editor, "Find a file, or type Note# for headings, Note#^ for blocks...");
  }

  async getSuggestions(query: string): Promise<EmbedSuggestion[]> {
    const hashIndex = query.indexOf("#");
    const results =
      hashIndex === -1
        ? this.getFileSuggestions(query)
        : await this.getFragmentSuggestions(query.slice(0, hashIndex).trim(), query.slice(hashIndex + 1));

    const trimmed = query.trim();
    const isBareFragmentDelimiter = trimmed.endsWith("#") || trimmed.endsWith("#^");
    if (results.length === 0 && trimmed && !isBareFragmentDelimiter) {
      return [{ type: "raw", target: trimmed }];
    }
    return results;
  }

  private getFileSuggestions(query: string): EmbedSuggestion[] {
    return suggestNotes(this.app.vault.getFiles(), query);
  }

  private async getFragmentSuggestions(filePart: string, fragmentPart: string): Promise<EmbedSuggestion[]> {
    const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
    const file = filePart
      ? this.app.metadataCache.getFirstLinkpathDest(filePart, sourcePath)
      : this.app.workspace.getActiveFile();

    if (!file || file.extension !== "md") {
      return [];
    }

    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache) {
      return [];
    }

    if (fragmentPart.startsWith("^")) {
      return this.getBlockSuggestions(file, cache, fragmentPart.slice(1));
    }
    return this.getHeadingSuggestions(file, cache, fragmentPart);
  }

  private getHeadingSuggestions(file: TFile, cache: CachedMetadata, headingQuery: string): EmbedSuggestion[] {
    const matches = fuzzyFilter(
      (cache.headings ?? []).map((h) => h.heading),
      headingQuery,
      (heading) => heading
    );

    return matches.slice(0, RESULT_LIMIT).map((heading) => ({ type: "heading" as const, file, heading }));
  }

  private async getBlockSuggestions(
    file: TFile,
    cache: CachedMetadata,
    blockQuery: string
  ): Promise<EmbedSuggestion[]> {
    const entries = collectBlockCandidates(cache);
    if (entries.length === 0) {
      return [];
    }

    if (!this.blockContentCache || this.blockContentCache.file !== file) {
      const content = await this.app.vault.cachedRead(file);
      this.blockContentCache = { file, lines: content.split("\n") };
    }
    const lines = this.blockContentCache.lines;

    const candidates = entries.map((entry) => ({
      id: entry.id,
      preview: lines[entry.line]?.trim() ?? "",
    }));

    const matches = fuzzyFilter(candidates, blockQuery, (candidate) => candidate.id);

    return matches
      .slice(0, RESULT_LIMIT)
      .map((c) => ({ type: "block" as const, file, blockId: c.id, preview: c.preview }));
  }

  renderSuggestion(item: EmbedSuggestion, el: HTMLElement): void {
    if (item.type === "raw") {
      el.createEl("div", { text: `Embed "${item.target}"` });
      el.createEl("small", { text: "No match found — inserted as typed", cls: "ribbon-bar-link-modal-path" });
      return;
    }
    if (item.type === "create") {
      el.createEl("div", { text: `Create new note: "${item.name}"` });
      return;
    }
    if (item.type === "file") {
      const displayName = item.file.extension === "md" ? item.file.basename : item.file.name;
      el.createEl("div", { text: displayName });
      if (item.file.parent && !item.file.parent.isRoot()) {
        el.createEl("small", { text: item.file.parent.path, cls: "ribbon-bar-link-modal-path" });
      }
      return;
    }
    if (item.type === "heading") {
      el.createEl("div", { text: item.heading });
      el.createEl("small", { text: item.file.basename, cls: "ribbon-bar-link-modal-path" });
      return;
    }
    el.createEl("div", { text: `^${item.blockId}` });
    el.createEl("small", { text: item.preview, cls: "ribbon-bar-link-modal-path" });
  }

  onChooseSuggestion(item: EmbedSuggestion): void {
    const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
    let target: string;
    switch (item.type) {
      case "file":
        target = this.app.metadataCache.fileToLinktext(item.file, sourcePath);
        break;
      case "heading":
        target = `${this.app.metadataCache.fileToLinktext(item.file, sourcePath)}#${item.heading}`;
        break;
      case "block":
        target = `${this.app.metadataCache.fileToLinktext(item.file, sourcePath)}#^${item.blockId}`;
        break;
      case "create":
        target = item.name;
        break;
      case "raw":
        target = item.target;
        break;
    }
    this.insert(buildEmbedText(target, this.alias));
  }
}

export function openEmbedModal(editor: EditorLike, app: App): void {
  new EmbedSuggestModal(app, editor).open();
}
