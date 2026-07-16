import type { FrontmatterPropertyConfig } from "./ribbon/commands/actions/frontmatter";

export interface RibbonBarSettings {
  ribbonEnabled: boolean;
  defaultCollapsed: boolean;
  frontmatterProperties: FrontmatterPropertyConfig[];
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
};
