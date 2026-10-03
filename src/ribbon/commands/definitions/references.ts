import type { CommandEntry } from "../types";
import * as insertActions from "../actions/insert";
import { openCallout, openInternalLink, openFootnote, openHeadingLink } from "../modalLoaders";

export const REFERENCES_COMMANDS: CommandEntry[] = [
  {
    id: "footnote",
    tab: "references",
    group: "Citations",
    icon: "asterisk",
    label: "Footnote",
    modal: openFootnote,
  },
  {
    id: "ref-internal-link",
    tab: "references",
    group: "Links",
    icon: "file-symlink",
    label: "Internal Link",
    modal: openInternalLink,
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
    id: "ref-heading-link",
    tab: "references",
    group: "Links",
    icon: "list-tree",
    label: "Heading Link",
    modal: openHeadingLink,
  },
  {
    id: "ref-callout",
    tab: "references",
    group: "Callouts",
    icon: "message-square",
    label: "Callout",
    modal: openCallout,
  },
];
