import { App, Notice } from "obsidian";
import type { EditorLike } from "../commands/actions/types";
import type { BaseConfig } from "./model";
import { addCondition, addView } from "./ops";
import { buildCondition, folderOfNoteCondition, QUICK_FILTERS, type ConditionSpec } from "./filters";
import { resolveBaseTarget } from "./target";
import { parseBase, serializeBase } from "./yaml";

/**
 * Loads the base the cursor is in or on, applies `change`, and writes it back.
 * `change` returns the new config and a message, or null to leave things alone.
 */
export async function editBase(
  editor: EditorLike,
  app: App,
  change: (config: BaseConfig) => { config: BaseConfig; message: string } | null
): Promise<void> {
  const target = await resolveBaseTarget(editor, app);
  if (!target) return;

  try {
    const parsed = parseBase(await target.load());
    if (!parsed.ok) {
      new Notice(`This base's YAML can't be read, so it can't be edited here: ${parsed.error}`);
      return;
    }
    const result = change(parsed.config);
    if (!result) return;
    await target.save(serializeBase(result.config));
    new Notice(result.message);
  } catch (error) {
    new Notice(`Couldn't update the base: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Adds a view of the given type to the base, named after its type. */
export function addBaseView(type: string): (editor: EditorLike, app: App) => void {
  return (editor, app) => {
    void editBase(editor, app, (config) => {
      const result = addView(config, type);
      return { config: result.config, message: `Added the view "${result.config.views![result.index].name}".` };
    });
  };
}

/** Adds a condition to the base's own filters, so it applies to every view. */
export function addBaseFilter(specFor: (app: App) => ConditionSpec | null): (editor: EditorLike, app: App) => void {
  return (editor, app) => {
    const spec = specFor(app);
    const built = spec ? buildCondition(spec) : null;
    if (!built?.ok) {
      new Notice("That filter can't be added from here.");
      return;
    }
    void editBase(editor, app, (config) => ({
      config: addCondition(config, "base", built.expression),
      message: `Added the filter ${built.expression}`,
    }));
  };
}

export function quickFilterSpecs(): { id: string; label: string; specFor: (app: App) => ConditionSpec | null }[] {
  return [
    {
      id: "this-folder",
      label: "In this note's folder",
      specFor: (app) => folderOfNoteCondition(app.workspace.getActiveFile()?.path ?? ""),
    },
    ...QUICK_FILTERS.map((quick) => ({ id: quick.id, label: quick.label, specFor: () => quick.spec })),
  ];
}
