import type { CommandEntry } from "../types";
import * as layout from "../actions/layout";

export const LAYOUT_COMMANDS: CommandEntry[] = [
  {
    id: "promote-heading",
    tab: "layout",
    group: "Headings",
    icon: "chevron-left",
    label: "Promote Heading",
    action: layout.promoteHeading,
  },
  {
    id: "demote-heading",
    tab: "layout",
    group: "Headings",
    icon: "chevron-right",
    label: "Demote Heading",
    action: layout.demoteHeading,
  },
  {
    id: "indent",
    tab: "layout",
    group: "Indentation",
    icon: "indent",
    label: "Indent",
    action: layout.indentList,
  },
  {
    id: "outdent",
    tab: "layout",
    group: "Indentation",
    icon: "outdent",
    label: "Outdent",
    action: layout.outdentList,
  },
  {
    id: "move-line-up",
    tab: "layout",
    group: "Arrange",
    icon: "arrow-up",
    label: "Move Line Up",
    action: layout.moveLineUp,
  },
  {
    id: "move-line-down",
    tab: "layout",
    group: "Arrange",
    icon: "arrow-down",
    label: "Move Line Down",
    action: layout.moveLineDown,
  },
  {
    id: "table-of-contents",
    tab: "layout",
    group: "Arrange",
    icon: "list-tree",
    label: "Table of Contents",
    action: layout.insertTableOfContents,
  },
  {
    id: "format-document",
    tab: "layout",
    group: "Formatting",
    icon: "sparkles",
    label: "Format Document",
    action: layout.formatDocument,
  },
];
