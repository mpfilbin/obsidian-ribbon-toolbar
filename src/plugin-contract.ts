import type { RibbonBarSettings } from "./settings";
import type { FrontmatterPropertyConfig } from "./ribbon/commands/actions/frontmatter";

export interface RibbonBarPluginLike {
  settings: RibbonBarSettings;
  saveSettings(): Promise<void>;
  setRibbonEnabled(enabled: boolean): void;
  setDefaultCollapsed(defaultCollapsed: boolean): void;
  setFrontmatterProperties(properties: FrontmatterPropertyConfig[]): void;
}
