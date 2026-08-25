import type { App } from "obsidian";
import type { EditorLike } from "./actions/types";
import * as home from "./actions/home";
import * as insertActions from "./actions/insert";
import * as layout from "./actions/layout";
import * as tableEdit from "./actions/tableEdit";
import * as latex from "./actions/latex";
import type { FrontmatterPropertyConfig } from "./actions/frontmatter";
import { insertProperty } from "./actions/frontmatter";

export type TabId = "home" | "insert" | "layout" | "references" | "latex";

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
  modal?: (editor: EditorLike, app: App) => void;
  grid?: (editor: EditorLike, columns: number, rows: number) => void;
  compact?: boolean;
}

export const TABS: { id: TabId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "insert", label: "Insert" },
  { id: "layout", label: "Layout" },
  { id: "references", label: "References" },
  { id: "latex", label: "LaTeX" },
];

function openCallout(editor: EditorLike, app: App): void {
  void import("./actions/calloutModal")
    .then((module) => module.openCalloutModal(editor, app))
    .catch((error) => console.error("Ribbon Bar: failed to open callout modal", error));
}

function openExternalLink(editor: EditorLike, app: App): void {
  void import("./actions/externalLinkModal")
    .then((module) => module.openExternalLinkModal(editor, app))
    .catch((error) => console.error("Ribbon Bar: failed to open external link modal", error));
}

function openInternalLink(editor: EditorLike, app: App): void {
  void import("./actions/linkModal")
    .then((module) => module.openLinkModal(editor, app))
    .catch((error) => console.error("Ribbon Bar: failed to open internal link modal", error));
}

function openEmbed(editor: EditorLike, app: App): void {
  void import("./actions/embedModal")
    .then((module) => module.openEmbedModal(editor, app))
    .catch((error) => console.error("Ribbon Bar: failed to open embed modal", error));
}

function openFootnote(editor: EditorLike, app: App): void {
  void import("./actions/footnoteModal")
    .then((module) => module.openFootnoteModal(editor, app))
    .catch((error) => console.error("Ribbon Bar: failed to open footnote modal", error));
}

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
    id: "underline",
    tab: "home",
    group: "Font",
    icon: "underline",
    label: "Underline",
    action: home.toggleUnderline,
  },
  {
    id: "superscript",
    tab: "home",
    group: "Font",
    icon: "superscript",
    label: "Superscript",
    action: home.toggleSuperscript,
  },
  {
    id: "subscript",
    tab: "home",
    group: "Font",
    icon: "subscript",
    label: "Subscript",
    action: home.toggleSubscript,
  },
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
  { id: "link", tab: "insert", group: "Links", icon: "link", label: "Link", modal: openExternalLink },
  {
    id: "internal-link",
    tab: "insert",
    group: "Links",
    icon: "file-symlink",
    label: "Internal Link",
    modal: openInternalLink,
  },
  { id: "tag", tab: "insert", group: "Links", icon: "tag", label: "Tag", action: insertActions.insertTag },
  { id: "image", tab: "insert", group: "Media", icon: "image", label: "Image", action: insertActions.insertImage },
  {
    id: "embed",
    tab: "insert",
    group: "Media",
    icon: "layout-template",
    label: "Embed",
    modal: openEmbed,
  },
  { id: "table", tab: "insert", group: "Tables", icon: "table", label: "Table", grid: insertActions.insertTableGrid },
  {
    id: "table-insert-row-above",
    tab: "insert",
    group: "Tables",
    icon: "arrow-up-to-line",
    label: "Insert Row Above",
    action: tableEdit.insertRowAbove,
    compact: true,
  },
  {
    id: "table-insert-column-left",
    tab: "insert",
    group: "Tables",
    icon: "arrow-left-to-line",
    label: "Insert Column Left",
    action: tableEdit.insertColumnLeft,
    compact: true,
  },
  {
    id: "table-delete-row",
    tab: "insert",
    group: "Tables",
    icon: "rows-3",
    label: "Delete Row",
    action: tableEdit.deleteRow,
    compact: true,
  },
  {
    id: "table-insert-row-below",
    tab: "insert",
    group: "Tables",
    icon: "arrow-down-to-line",
    label: "Insert Row Below",
    action: tableEdit.insertRowBelow,
    compact: true,
  },
  {
    id: "table-insert-column-right",
    tab: "insert",
    group: "Tables",
    icon: "arrow-right-to-line",
    label: "Insert Column Right",
    action: tableEdit.insertColumnRight,
    compact: true,
  },
  {
    id: "table-delete-column",
    tab: "insert",
    group: "Tables",
    icon: "columns-3",
    label: "Delete Column",
    action: tableEdit.deleteColumn,
    compact: true,
  },
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
    modal: openCallout,
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
  {
    id: "format-document",
    tab: "layout",
    group: "Formatting",
    icon: "sparkles",
    label: "Format Document",
    action: layout.formatDocument,
  },

  // References
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
    id: "ref-callout",
    tab: "references",
    group: "Callouts",
    icon: "message-square",
    label: "Callout",
    modal: openCallout,
  },

  // LaTeX
  {
    id: "latex-inline-math",
    tab: "latex",
    group: "Math",
    icon: "dollar-sign",
    label: "Inline Math",
    action: latex.toggleInlineMath,
  },
  {
    id: "latex-block-math",
    tab: "latex",
    group: "Math",
    icon: "square-function",
    label: "Block Math",
    action: latex.toggleBlockMath,
  },
  {
    id: "latex-fraction",
    tab: "latex",
    group: "Structures",
    icon: "divide",
    label: "Fraction",
    action: latex.insertFraction,
  },
  {
    id: "latex-sqrt",
    tab: "latex",
    group: "Structures",
    icon: "radical",
    label: "Square Root",
    action: latex.insertSquareRoot,
  },
  {
    id: "latex-superscript",
    tab: "latex",
    group: "Structures",
    icon: "superscript",
    label: "Superscript",
    action: latex.toggleLatexSuperscript,
  },
  {
    id: "latex-subscript",
    tab: "latex",
    group: "Structures",
    icon: "subscript",
    label: "Subscript",
    action: latex.toggleLatexSubscript,
  },
  {
    id: "latex-sum",
    tab: "latex",
    group: "Structures",
    icon: "sigma",
    label: "Summation",
    action: latex.insertSummation,
  },
  {
    id: "latex-integral",
    tab: "latex",
    group: "Structures",
    icon: "waves",
    label: "Integral",
    action: latex.insertIntegral,
  },
  {
    id: "latex-limit",
    tab: "latex",
    group: "Structures",
    icon: "arrow-down-right",
    label: "Limit",
    action: latex.insertLimit,
  },
  {
    id: "latex-matrix",
    tab: "latex",
    group: "Environments",
    icon: "grid-3x3",
    label: "Matrix",
    grid: latex.insertMatrixGrid,
  },
  {
    id: "latex-cases",
    tab: "latex",
    group: "Environments",
    icon: "split",
    label: "Cases",
    action: latex.insertCases,
  },
  {
    id: "latex-align",
    tab: "latex",
    group: "Environments",
    icon: "align-center",
    label: "Align",
    action: latex.insertAlign,
  },
  {
    id: "latex-greek",
    tab: "latex",
    group: "Greek Letters",
    icon: "pi",
    label: "Greek Letters",
    options: [
      { id: "greek-alpha", label: "α  alpha", action: latex.insertLatexSymbol("\\alpha") },
      { id: "greek-beta", label: "β  beta", action: latex.insertLatexSymbol("\\beta") },
      { id: "greek-gamma", label: "γ  gamma", action: latex.insertLatexSymbol("\\gamma") },
      { id: "greek-delta", label: "δ  delta", action: latex.insertLatexSymbol("\\delta") },
      { id: "greek-epsilon", label: "ε  epsilon", action: latex.insertLatexSymbol("\\epsilon") },
      { id: "greek-theta", label: "θ  theta", action: latex.insertLatexSymbol("\\theta") },
      { id: "greek-lambda", label: "λ  lambda", action: latex.insertLatexSymbol("\\lambda") },
      { id: "greek-mu", label: "μ  mu", action: latex.insertLatexSymbol("\\mu") },
      { id: "greek-pi", label: "π  pi", action: latex.insertLatexSymbol("\\pi") },
      { id: "greek-sigma", label: "σ  sigma", action: latex.insertLatexSymbol("\\sigma") },
      { id: "greek-phi", label: "φ  phi", action: latex.insertLatexSymbol("\\phi") },
      { id: "greek-omega", label: "ω  omega", action: latex.insertLatexSymbol("\\omega") },
      { id: "greek-Delta", label: "Δ  Delta", action: latex.insertLatexSymbol("\\Delta") },
      { id: "greek-Gamma", label: "Γ  Gamma", action: latex.insertLatexSymbol("\\Gamma") },
      { id: "greek-Omega", label: "Ω  Omega", action: latex.insertLatexSymbol("\\Omega") },
      { id: "greek-Sigma", label: "Σ  Sigma", action: latex.insertLatexSymbol("\\Sigma") },
      { id: "greek-Theta", label: "Θ  Theta", action: latex.insertLatexSymbol("\\Theta") },
    ],
  },
  {
    id: "latex-operators",
    tab: "latex",
    group: "Operators",
    icon: "equal",
    label: "Operators",
    options: [
      { id: "op-times", label: "×  times", action: latex.insertLatexSymbol("\\times") },
      { id: "op-div", label: "÷  div", action: latex.insertLatexSymbol("\\div") },
      { id: "op-pm", label: "±  pm", action: latex.insertLatexSymbol("\\pm") },
      { id: "op-mp", label: "∓  mp", action: latex.insertLatexSymbol("\\mp") },
      { id: "op-cdot", label: "·  cdot", action: latex.insertLatexSymbol("\\cdot") },
      { id: "op-leq", label: "≤  leq", action: latex.insertLatexSymbol("\\leq") },
      { id: "op-geq", label: "≥  geq", action: latex.insertLatexSymbol("\\geq") },
      { id: "op-neq", label: "≠  neq", action: latex.insertLatexSymbol("\\neq") },
      { id: "op-approx", label: "≈  approx", action: latex.insertLatexSymbol("\\approx") },
      { id: "op-equiv", label: "≡  equiv", action: latex.insertLatexSymbol("\\equiv") },
      { id: "op-in", label: "∈  in", action: latex.insertLatexSymbol("\\in") },
      { id: "op-notin", label: "∉  notin", action: latex.insertLatexSymbol("\\notin") },
      { id: "op-subset", label: "⊂  subset", action: latex.insertLatexSymbol("\\subset") },
      { id: "op-cup", label: "∪  cup", action: latex.insertLatexSymbol("\\cup") },
      { id: "op-cap", label: "∩  cap", action: latex.insertLatexSymbol("\\cap") },
      { id: "op-infty", label: "∞  infty", action: latex.insertLatexSymbol("\\infty") },
    ],
  },
  {
    id: "latex-arrows",
    tab: "latex",
    group: "Arrows",
    icon: "arrow-right",
    label: "Arrows",
    options: [
      { id: "arrow-rightarrow", label: "→  rightarrow", action: latex.insertLatexSymbol("\\rightarrow") },
      { id: "arrow-leftarrow", label: "←  leftarrow", action: latex.insertLatexSymbol("\\leftarrow") },
      { id: "arrow-Rightarrow", label: "⇒  Rightarrow", action: latex.insertLatexSymbol("\\Rightarrow") },
      { id: "arrow-Leftarrow", label: "⇐  Leftarrow", action: latex.insertLatexSymbol("\\Leftarrow") },
      {
        id: "arrow-leftrightarrow",
        label: "↔  leftrightarrow",
        action: latex.insertLatexSymbol("\\leftrightarrow"),
      },
      {
        id: "arrow-Leftrightarrow",
        label: "⇔  Leftrightarrow",
        action: latex.insertLatexSymbol("\\Leftrightarrow"),
      },
      { id: "arrow-mapsto", label: "↦  mapsto", action: latex.insertLatexSymbol("\\mapsto") },
    ],
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
