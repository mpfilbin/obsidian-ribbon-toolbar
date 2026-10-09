import type { FrontmatterPropertyConfig } from "./actions/frontmatter";
import { insertProperty } from "./actions/frontmatter";
import type { CommandEntry, TabId } from "./types";
import { FILE_COMMANDS } from "./definitions/file";
import { HOME_COMMANDS } from "./definitions/home";
import { INSERT_COMMANDS } from "./definitions/insert";
import { LAYOUT_COMMANDS } from "./definitions/layout";
import { REFERENCES_COMMANDS } from "./definitions/references";
import { LATEX_COMMANDS } from "./definitions/latex";
import { BASES_COMMANDS } from "./definitions/bases";

export type { CommandEntry, CommandOption, TabId } from "./types";

export const TABS: { id: TabId; label: string }[] = [
  { id: "file", label: "File" },
  { id: "home", label: "Home" },
  { id: "insert", label: "Insert" },
  { id: "layout", label: "Layout" },
  { id: "references", label: "References" },
  { id: "latex", label: "LaTeX" },
  { id: "bases", label: "Bases" },
];

// The tab a ribbon opens on when none has been chosen yet. File comes first in the
// row, as in Office, but Home is where editing starts.
export const DEFAULT_TAB: TabId = "home";

// Within a tab, groups and commands appear in the order they are listed here.
export const COMMAND_REGISTRY: CommandEntry[] = [
  ...FILE_COMMANDS,
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

/** Group names in the order they first appear in a list of commands. */
export function groupsOf(commands: CommandEntry[]): string[] {
  const groups: string[] = [];
  for (const entry of commands) {
    if (!groups.includes(entry.group)) groups.push(entry.group);
  }
  return groups;
}

export function groupsForTab(tab: TabId): string[] {
  return groupsOf(commandsForTab(tab));
}

/**
 * The commands for a tab, including the Properties menu that is built from the
 * user's predefined frontmatter properties. The menu sits first in the Properties
 * group, ahead of the Add Property button.
 */
export function commandsForTabWithProperties(tab: TabId, properties: FrontmatterPropertyConfig[]): CommandEntry[] {
  const commands = commandsForTab(tab);
  if (tab !== "references") return commands;

  const menu = buildPropertyCommands(properties);
  if (menu.length === 0) return commands;
  const at = commands.findIndex((entry) => entry.group === "Properties");
  return at === -1 ? [...commands, ...menu] : [...commands.slice(0, at), ...menu, ...commands.slice(at)];
}

/** One "Properties" menu listing the predefined properties; none when none are configured. */
export function buildPropertyCommands(properties: FrontmatterPropertyConfig[]): CommandEntry[] {
  if (properties.length === 0) return [];
  return [
    {
      id: "property-menu",
      tab: "references",
      group: "Properties",
      icon: "list-plus",
      label: "Properties",
      options: properties.map((property) => ({
        id: `property-${property.name}`,
        label: property.name,
        action: insertProperty(property),
      })),
    },
  ];
}
