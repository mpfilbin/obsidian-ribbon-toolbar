import type { FrontmatterPropertyConfig } from "./actions/frontmatter";
import { insertProperty } from "./actions/frontmatter";
import type { CommandEntry, TabId } from "./types";
import { HOME_COMMANDS } from "./definitions/home";
import { INSERT_COMMANDS } from "./definitions/insert";
import { LAYOUT_COMMANDS } from "./definitions/layout";
import { REFERENCES_COMMANDS } from "./definitions/references";
import { LATEX_COMMANDS } from "./definitions/latex";
import { BASES_COMMANDS } from "./definitions/bases";

export type { CommandEntry, CommandOption, TabId } from "./types";

export const TABS: { id: TabId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "insert", label: "Insert" },
  { id: "layout", label: "Layout" },
  { id: "references", label: "References" },
  { id: "latex", label: "LaTeX" },
  { id: "bases", label: "Bases" },
];

// Within a tab, groups and commands appear in the order they are listed here.
export const COMMAND_REGISTRY: CommandEntry[] = [
  ...HOME_COMMANDS,
  ...INSERT_COMMANDS,
  ...LAYOUT_COMMANDS,
  ...REFERENCES_COMMANDS,
  ...LATEX_COMMANDS,
  ...BASES_COMMANDS,
];

export function commandsForTab(tab: TabId): CommandEntry[] {
  return COMMAND_REGISTRY.filter((entry) => entry.tab === tab);
}

export function groupsForTab(tab: TabId): string[] {
  const groups: string[] = [];
  for (const entry of commandsForTab(tab)) {
    if (!groups.includes(entry.group)) groups.push(entry.group);
  }
  return groups;
}

export function buildPropertyCommands(properties: FrontmatterPropertyConfig[]): CommandEntry[] {
  return properties.map((property) => ({
    id: `property-${property.name}`,
    tab: "references",
    group: "Properties",
    icon: "list-plus",
    label: property.name,
    action: insertProperty(property),
  }));
}

