import type { EditorLike } from "./actions/types";
import * as home from "./actions/home";
import * as insertActions from "./actions/insert";
import * as layout from "./actions/layout";
import * as references from "./actions/references";

export type TabId = "home" | "insert" | "layout" | "references";

export interface CommandOption {
  id: string;
  label: string;
  action: (editor: EditorLike) => void;
}

export interface CommandEntry {
  id: string;
  tab: TabId;
  group: string;
  icon: string;
  label: string;
  action?: (editor: EditorLike) => void;
  options?: CommandOption[];
}

export const TABS: { id: TabId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "insert", label: "Insert" },
  { id: "layout", label: "Layout" },
  { id: "references", label: "References" },
];

export const COMMAND_REGISTRY: CommandEntry[] = [
  // Home
  { id: "bold", tab: "home", group: "Font", icon: "bold", label: "Bold", action: home.toggleBold },
  { id: "italic", tab: "home", group: "Font", icon: "italic", label: "Italic", action: home.toggleItalic },
  {
    id: "strikethrough",
    tab: "home",
    group: "Font",
    icon: "strikethrough",
    label: "Strikethrough",
    action: home.toggleStrikethrough,
  },
  {
    id: "highlight",
    tab: "home",
    group: "Font",
    icon: "highlighter",
    label: "Highlight",
    action: home.toggleHighlight,
  },
  { id: "inline-code", tab: "home", group: "Font", icon: "code", label: "Code", action: home.toggleInlineCode },
  {
    id: "clear-formatting",
    tab: "home",
    group: "Font",
    icon: "eraser",
    label: "Clear Formatting",
    action: home.clearFormatting,
  },
  {
    id: "heading",
    tab: "home",
    group: "Paragraph",
    icon: "heading",
    label: "Heading",
    options: [
      { id: "heading-1", label: "Heading 1", action: home.setHeading(1) },
      { id: "heading-2", label: "Heading 2", action: home.setHeading(2) },
      { id: "heading-3", label: "Heading 3", action: home.setHeading(3) },
    ],
  },
  {
    id: "bullet-list",
    tab: "home",
    group: "Paragraph",
    icon: "list",
    label: "Bulleted List",
    action: home.toggleBulletList,
  },
  {
    id: "numbered-list",
    tab: "home",
    group: "Paragraph",
    icon: "list-ordered",
    label: "Numbered List",
    action: home.toggleNumberedList,
  },
  {
    id: "checklist",
    tab: "home",
    group: "Paragraph",
    icon: "list-checks",
    label: "Checklist",
    action: home.toggleChecklist,
  },
  {
    id: "blockquote",
    tab: "home",
    group: "Paragraph",
    icon: "quote",
    label: "Quote",
    action: home.toggleBlockquote,
  },

  // Insert
  { id: "link", tab: "insert", group: "Links", icon: "link", label: "Link", action: insertActions.insertLink },
  {
    id: "internal-link",
    tab: "insert",
    group: "Links",
    icon: "file-symlink",
    label: "Internal Link",
    action: insertActions.insertInternalLink,
  },
  { id: "tag", tab: "insert", group: "Links", icon: "tag", label: "Tag", action: insertActions.insertTag },
  { id: "image", tab: "insert", group: "Media", icon: "image", label: "Image", action: insertActions.insertImage },
  { id: "table", tab: "insert", group: "Tables", icon: "table", label: "Table", action: insertActions.insertTable },
  {
    id: "code-block",
    tab: "insert",
    group: "Code",
    icon: "square-code",
    label: "Code Block",
    action: insertActions.insertCodeBlock,
  },
  {
    id: "horizontal-rule",
    tab: "insert",
    group: "Illustrations",
    icon: "minus",
    label: "Horizontal Rule",
    action: insertActions.insertHorizontalRule,
  },
  {
    id: "callout",
    tab: "insert",
    group: "Illustrations",
    icon: "message-square",
    label: "Callout",
    action: insertActions.insertCallout,
  },

  // Layout
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

  // References
  {
    id: "footnote",
    tab: "references",
    group: "Citations",
    icon: "asterisk",
    label: "Footnote",
    action: references.insertFootnote,
  },
  {
    id: "ref-internal-link",
    tab: "references",
    group: "Links",
    icon: "file-symlink",
    label: "Internal Link",
    action: insertActions.insertInternalLink,
  },
  {
    id: "ref-tag",
    tab: "references",
    group: "Links",
    icon: "tag",
    label: "Tag",
    action: insertActions.insertTag,
  },
  {
    id: "ref-callout",
    tab: "references",
    group: "Callouts",
    icon: "message-square",
    label: "Callout",
    action: insertActions.insertCallout,
  },
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
