import { App, Setting } from "obsidian";
import type { EditorLike } from "./types";
import { FormModal } from "./formModal";
import { addPropertyToNote } from "./addProperty";
import { hasProperty } from "./frontmatter";
import {
  buildPropertyEntry,
  localDate,
  localDateTime,
  PROPERTY_ENTRY_TYPES,
  type PropertyEntryType,
} from "./propertyEntry";
import { collectNoteProperties } from "../../bases/catalog";
import type { ValueKind } from "../../bases/filters";

const NAME_LIST_ID = "ribbon-bar-property-name-options";

const TYPE_FOR_KIND: Record<ValueKind, PropertyEntryType> = {
  text: "text",
  number: "number",
  date: "date",
  boolean: "checkbox",
  list: "list",
};

/** What a field of this type holds before the user types anything. */
function defaultValue(type: PropertyEntryType): string {
  if (type === "date") return localDate();
  if (type === "datetime") return localDateTime();
  if (type === "checkbox") return "false";
  return "";
}

class AddPropertyModal extends FormModal {
  private draft = { type: "text" as PropertyEntryType, name: "", value: "" };
  private typeChosenByUser = false;
  private knownTypes = new Map<string, PropertyEntryType>();
  private typeDropdown?: { setValue(value: string): unknown };
  private valueEl!: HTMLElement;
  private errorEl!: HTMLElement;
  private nameInput!: HTMLInputElement;

  constructor(app: App, editor: EditorLike) {
    super(app, editor, "Add property");
    for (const property of collectNoteProperties(app)) {
      this.knownTypes.set(property.id.replace(/^note\./, ""), TYPE_FOR_KIND[property.kind]);
    }
    this.draft.value = defaultValue(this.draft.type);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("ribbon-bar-property-modal");

    new Setting(contentEl).setName("Type").addDropdown((dropdown) => {
      this.typeDropdown = dropdown;
      PROPERTY_ENTRY_TYPES.forEach((t) => dropdown.addOption(t.id, t.label));
      dropdown.setValue(this.draft.type);
      dropdown.onChange((value) => {
        this.typeChosenByUser = true;
        this.setType(value as PropertyEntryType);
      });
    });

    const names = contentEl.createEl("datalist", { attr: { id: NAME_LIST_ID } });
    for (const name of this.knownTypes.keys()) names.createEl("option", { value: name });

    new Setting(contentEl)
      .setName("Name")
      .setDesc("Pick an existing property from your vault, or type a new name.")
      .addText((text) => {
        text.inputEl.setAttribute("list", NAME_LIST_ID);
        text.setPlaceholder("status");
        text.onChange((value) => {
          this.draft.name = value;
          this.followKnownType(value.trim());
        });
        this.submitOnEnter(text.inputEl);
        this.nameInput = text.inputEl;
      });

    this.valueEl = contentEl.createDiv();
    this.errorEl = contentEl.createEl("p", { cls: "setting-item-description mod-warning" });
    this.drawValue();
    this.addInsertButton("Add");

    this.nameInput.focus();
  }

  private setType(type: PropertyEntryType): void {
    if (type === this.draft.type) return;
    this.draft.type = type;
    this.draft.value = defaultValue(type);
    this.drawValue();
  }

  /** Typing the name of a property the vault already has selects its usual type, until the user picks one. */
  private followKnownType(name: string): void {
    const known = this.knownTypes.get(name);
    if (!known || this.typeChosenByUser) return;
    this.typeDropdown?.setValue(known);
    this.setType(known);
  }

  private drawValue(): void {
    this.valueEl.empty();
    this.errorEl.setText("");
    const { type } = this.draft;
    const row = new Setting(this.valueEl).setName("Value");

    if (type === "list") {
      row.setDesc("One item per line.");
      row.addTextArea((area) => {
        area.inputEl.rows = 4;
        area.setPlaceholder("first item\nsecond item");
        area.setValue(this.draft.value);
        area.onChange((value) => (this.draft.value = value));
        this.submitOnEnter(area.inputEl);
      });
    } else if (type === "checkbox") {
      row.addToggle((toggle) => {
        toggle.setValue(this.draft.value === "true");
        toggle.onChange((value) => (this.draft.value = value ? "true" : "false"));
      });
    } else {
      row.addText((text) => {
        if (type === "date") text.inputEl.type = "date";
        if (type === "datetime") text.inputEl.type = "datetime-local";
        text.setPlaceholder(type === "number" ? "0" : "");
        text.setValue(this.draft.value);
        text.onChange((value) => (this.draft.value = value));
        this.submitOnEnter(text.inputEl);
      });
    }
  }

  protected submit(): void {
    const entry = buildPropertyEntry({ name: this.draft.name, type: this.draft.type, value: this.draft.value });
    if (!entry.ok) {
      this.errorEl.setText(entry.error);
      return;
    }
    if (hasProperty(this.editor, entry.name)) {
      this.errorEl.setText(`This note already has a property named "${entry.name}".`);
      return;
    }
    // Close first so the editor is back in place when the property is written.
    this.close();
    void addPropertyToNote(this.app, this.editor, entry.name, entry.value, entry.lines);
  }
}

export function openAddPropertyModal(editor: EditorLike, app: App): void {
  new AddPropertyModal(app, editor).open();
}
