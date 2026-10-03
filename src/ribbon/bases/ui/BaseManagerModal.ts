import { App, Modal, Notice, Setting } from "obsidian";
import type { EditorLike } from "../../commands/actions/types";
import type { BaseConfig } from "../model";
import { collectNoteProperties, propertyOptions, type PropertyOption } from "../catalog";
import { validateBase } from "../ops";
import { parseBase, serializeBase } from "../yaml";
import { resolveBaseTarget, type BaseTarget } from "../target";
import { SECTIONS, type EditorState, type SectionContext, type SectionId } from "./context";
import { renderViewsSection } from "./viewsSection";
import { renderFiltersSection } from "./filtersSection";
import { renderFormulasSection } from "./formulasSection";
import { renderPropertiesSection } from "./propertiesSection";
import { renderSummariesSection } from "./summariesSection";

const RENDERERS: Record<SectionId, (el: HTMLElement, ctx: SectionContext) => void> = {
  views: renderViewsSection,
  filters: renderFiltersSection,
  formulas: renderFormulasSection,
  properties: renderPropertiesSection,
  summaries: renderSummariesSection,
};

/**
 * One dialog for everything about a base: views, filters, formulas, property
 * names and summaries. Edits accumulate in memory and are written back only on Save.
 */
export class BaseManagerModal extends Modal {
  private state: EditorState;
  private tabsEl!: HTMLElement;
  private bodyEl!: HTMLElement;
  private problemsEl!: HTMLElement;

  constructor(
    app: App,
    private editor: EditorLike,
    private target: BaseTarget,
    config: BaseConfig,
    section: SectionId,
    private noteProperties: PropertyOption[]
  ) {
    super(app);
    const viewIndex = Math.max(0, (config.views ?? []).findIndex((v) => v.name === target.viewName));
    this.state = { config, section, viewIndex, filterScope: "base" };
    this.setTitle(`Edit base · ${target.label}`);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("ribbon-bar-base-modal");
    this.tabsEl = contentEl.createDiv({ cls: "ribbon-bar-base-tabs" });
    this.bodyEl = contentEl.createDiv({ cls: "ribbon-bar-base-body" });
    this.problemsEl = contentEl.createDiv({ cls: "ribbon-bar-base-problems" });

    new Setting(contentEl)
      .addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((button) =>
        button
          .setButtonText("Save")
          .setCta()
          .onClick(() => void this.save())
      );

    this.renderAll();
  }

  private context(): SectionContext {
    return {
      app: this.app,
      state: this.state,
      properties: propertyOptions(this.state.config, this.noteProperties),
      apply: (next, options) => {
        this.state.config = next;
        if (options?.rerender === false) this.renderProblems();
        else this.renderAll();
      },
      rerender: () => this.renderAll(),
    };
  }

  private renderAll(): void {
    this.renderTabs();
    this.bodyEl.empty();
    RENDERERS[this.state.section](this.bodyEl, this.context());
    this.renderProblems();
  }

  private renderTabs(): void {
    this.tabsEl.empty();
    for (const section of SECTIONS) {
      const tab = this.tabsEl.createEl("button", { text: section.label, cls: "ribbon-bar-base-tab" });
      tab.type = "button";
      if (section.id === this.state.section) tab.addClass("is-active");
      tab.addEventListener("click", () => {
        this.state.section = section.id;
        this.renderAll();
      });
    }
  }

  private renderProblems(): void {
    this.problemsEl.empty();
    const problems = validateBase(this.state.config);
    if (problems.length === 0) return;
    this.problemsEl.createEl("strong", { text: "Check these before saving:" });
    const list = this.problemsEl.createEl("ul");
    for (const problem of problems) list.createEl("li", { text: `${problem.where}: ${problem.message}` });
  }

  private async save(): Promise<void> {
    try {
      await this.target.save(serializeBase(this.state.config));
    } catch (error) {
      new Notice(`Couldn't save the base: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    new Notice("Base saved.");
    this.close();
  }

  onClose(): void {
    this.editor.focus();
  }
}

/** Opens the base editor on a section, for the base the cursor is in or on. */
export async function openBaseManager(editor: EditorLike, app: App, section: SectionId): Promise<void> {
  const target = await resolveBaseTarget(editor, app);
  if (!target) return;

  let text: string;
  try {
    text = await target.load();
  } catch (error) {
    new Notice(`Couldn't read the base: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  const parsed = parseBase(text);
  if (!parsed.ok) {
    new Notice(`This base's YAML can't be read, so it can't be edited here: ${parsed.error}`);
    return;
  }
  new BaseManagerModal(app, editor, target, parsed.config, section, collectNoteProperties(app)).open();
}
