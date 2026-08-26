import type { RibbonBarSettings } from "./settings";
import type { FrontmatterPropertyConfig } from "./ribbon/commands/actions/frontmatter";
import type { HighlightColorConfig } from "./ribbon/commands/actions/highlightMark";

export interface RibbonBarPluginLike {
  settings: RibbonBarSettings;
  saveSettings(): Promise<void>;
  setRibbonEnabled(enabled: boolean): void;
  setDefaultCollapsed(defaultCollapsed: boolean): void;
  setFrontmatterProperties(properties: FrontmatterPropertyConfig[]): void;
  setHighlightColors(colors: HighlightColorConfig[]): void;
}
