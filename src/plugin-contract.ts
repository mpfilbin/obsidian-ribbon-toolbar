import type { RibbonBarSettings } from "./settings";

export interface RibbonBarPluginLike {
  settings: RibbonBarSettings;
  saveSettings(): Promise<void>;
  setRibbonEnabled(enabled: boolean): void;
  setDefaultCollapsed(defaultCollapsed: boolean): void;
}
