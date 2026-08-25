import type { FrontmatterPropertyConfig } from "./ribbon/commands/actions/frontmatter";
import type { HighlightColorConfig } from "./ribbon/commands/actions/highlightMark";

export interface RibbonBarSettings {
  ribbonEnabled: boolean;
  defaultCollapsed: boolean;
  frontmatterProperties: FrontmatterPropertyConfig[];
  highlightColors: HighlightColorConfig[];
}

export const DEFAULT_SETTINGS: RibbonBarSettings = {
  ribbonEnabled: true,
  defaultCollapsed: false,
  frontmatterProperties: [
    { name: "tags", type: "list" },
    { name: "description", type: "text" },
    { name: "cssclasses", type: "list" },
    { name: "source", type: "text" },
  ],
  highlightColors: [
    { name: "Yellow", color: "#ffd700" },
    { name: "Green", color: "#7bed9f" },
    { name: "Blue", color: "#70a1ff" },
    { name: "Pink", color: "#ff6b81" },
    { name: "Purple", color: "#c9a0ff" },
  ],
};

function cloneDefaultSettings(): RibbonBarSettings {
  return {
    ...DEFAULT_SETTINGS,
    frontmatterProperties: DEFAULT_SETTINGS.frontmatterProperties.map((property) => ({ ...property })),
    highlightColors: DEFAULT_SETTINGS.highlightColors.map((color) => ({ ...color })),
  };
}

/**
 * Merges persisted settings over a fresh copy of the defaults. Cloning
 * matters: a plain shallow merge (Object.assign({}, DEFAULT_SETTINGS,
 * stored)) would let a missing field - e.g. a fresh install with no saved
 * frontmatterProperties - alias the module-level DEFAULT_SETTINGS array by
 * reference, so later in-place mutations (adding/removing a property in the
 * settings tab) would leak into the shared default.
 */
export function mergeSettings(stored: Partial<RibbonBarSettings> | null | undefined): RibbonBarSettings {
  return Object.assign(cloneDefaultSettings(), stored);
}
