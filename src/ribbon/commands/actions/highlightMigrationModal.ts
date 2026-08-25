import { App, ButtonComponent, Modal, Notice, Setting, TFile, ToggleComponent } from "obsidian";
import { countHighlights, migrateHighlightsInText } from "./highlightMigration";

export interface HighlightMigrationCandidate {
  file: TFile;
  count: number;
}

export async function scanVaultForHighlights(app: App): Promise<HighlightMigrationCandidate[]> {
  const files = app.vault.getMarkdownFiles();
  const candidates: HighlightMigrationCandidate[] = [];
  for (const file of files) {
    const content = await app.vault.cachedRead(file);
    const count = countHighlights(content);
    if (count > 0) candidates.push({ file, count });
  }
  return candidates;
}

class HighlightMigrationModal extends Modal {
  private candidates: HighlightMigrationCandidate[] = [];
  private selected = new Set<string>();
  private toggles = new Map<string, ToggleComponent>();
  private migrateButton: ButtonComponent | undefined;

  constructor(
    app: App,
    private color: string
  ) {
    super(app);
    this.setTitle("Migrate highlights to <mark> tags");
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.addClass("ribbon-bar-highlight-migration-modal");
    contentEl.createEl("p", { text: "Scanning vault for ==highlights==..." });

    this.candidates = await scanVaultForHighlights(this.app);
    contentEl.empty();

    if (this.candidates.length === 0) {
      contentEl.createEl("p", { text: "No ==highlights== found in this vault." });
      return;
    }

    for (const candidate of this.candidates) this.selected.add(candidate.file.path);

    new Setting(contentEl)
      .addButton((button) => button.setButtonText("Select All").onClick(() => this.setAllSelected(true)))
      .addButton((button) => button.setButtonText("Deselect All").onClick(() => this.setAllSelected(false)));

    const listEl = contentEl.createDiv();
    for (const candidate of this.candidates) {
      new Setting(listEl)
        .setName(candidate.file.path)
        .setDesc(`${candidate.count} highlight${candidate.count === 1 ? "" : "s"}`)
        .addToggle((toggle) => {
          this.toggles.set(candidate.file.path, toggle);
          toggle.setValue(true).onChange((value) => {
            if (value) this.selected.add(candidate.file.path);
            else this.selected.delete(candidate.file.path);
            this.updateMigrateButtonLabel();
          });
        });
    }

    new Setting(contentEl).addButton((button) => {
      this.migrateButton = button;
      button.setCta().onClick(() => void this.migrateSelected());
      this.updateMigrateButtonLabel();
    });
  }

  private setAllSelected(value: boolean): void {
    for (const candidate of this.candidates) {
      if (value) this.selected.add(candidate.file.path);
      else this.selected.delete(candidate.file.path);
      this.toggles.get(candidate.file.path)?.setValue(value);
    }
    this.updateMigrateButtonLabel();
  }

  private updateMigrateButtonLabel(): void {
    this.migrateButton?.setButtonText(
      `Migrate ${this.selected.size} file${this.selected.size === 1 ? "" : "s"}`
    );
  }

  private async migrateSelected(): Promise<void> {
    let migrated = 0;
    for (const candidate of this.candidates) {
      if (!this.selected.has(candidate.file.path)) continue;
      try {
        const content = await this.app.vault.read(candidate.file);
        const rewritten = migrateHighlightsInText(content, this.color);
        await this.app.vault.modify(candidate.file, rewritten);
        migrated++;
      } catch (error) {
        console.error("Ribbon Bar: failed to migrate highlights in", candidate.file.path, error);
      }
    }
    new Notice(`Migrated highlights in ${migrated} file${migrated === 1 ? "" : "s"}.`);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export function openHighlightMigrationModal(app: App, color: string): void {
  new HighlightMigrationModal(app, color).open();
}
