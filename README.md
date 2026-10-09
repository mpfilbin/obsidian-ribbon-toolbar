# Ribbon Bar for Obsidian

An Obsidian plugin that adds a Microsoft Office-style, multi-tab editing ribbon docked above your Markdown notes.

## Features

- **Four tabs** — Home, Insert, Layout, References — each grouping related formatting and document commands
- **~30 commands** — bold/italic/strikethrough/highlight/code, headings, lists, quotes, links, images, tables, callouts, footnotes, table of contents, line move/indent, and more
- **Collapsible** — double-click any tab to collapse the ribbon down to just the tab strip
- **Theme aware** — uses Obsidian's CSS variables, so it matches your active light/dark/community theme
- **Per-pane** — split panes each get their own independent ribbon, bound to that pane's own editor
- **Desktop only** — not available on Obsidian Mobile

## Prerequisites

- Obsidian desktop (Windows, macOS, Linux)

## Installation via BRAT

1. Install the [BRAT plugin](https://obsidian.md/plugins?id=obsidian42-brat) from the Obsidian community plugins
2. In BRAT settings, click **Add Beta Plugin** and enter `mpfilbin/obsidian-ribbon-toolbar`
3. Enable **Ribbon Bar** in Settings → Community Plugins

## Usage

The ribbon appears above every open Markdown pane, in Source, Live Preview, and Reading view (buttons are disabled in Reading view, since there's no live editor to act on there). Most buttons wrap your current selection in the relevant Markdown syntax, or — if nothing is selected — insert a placeholder with the new text pre-selected so you can start typing immediately.

### File tab

New (an untitled note in the default new-note folder), Open (Obsidian's quick switcher), Open File (pick a Markdown or text file from disk with the system dialog; it is copied into the vault and opened), Save As (save a copy of the current note under a new vault path), Move (Obsidian's move-file dialog), Export PDF (Obsidian's built-in PDF export), Export HTML (renders the note to a standalone page and asks where to save it; local images and embeds are not inlined)

### Home tab

Bold, Italic, Strikethrough, Highlight (dropdown: Default plus Obsidian's native red/orange/green/blue/purple), Code, Clear Formatting, Heading (dropdown: H1–H3), Bulleted List, Numbered List, Checklist, Quote

### Insert tab

Link, Internal Link, Tag, Image, Table, Code Block (dropdown: Plain text plus common languages such as JavaScript, TypeScript, HTML, HTTP, C#, Java, C, C++, CSS, Bash / Shell, PHP, Ruby), Horizontal Rule, Callout

### Layout tab

Promote/Demote Heading, Indent/Outdent, Move Line Up/Down, Table of Contents

### References tab

Footnote, Internal Link, Tag, Heading Link, Callout, and the **Properties** group for the note's frontmatter:

- **Properties** is a single dropdown of your predefined properties (managed in the plugin's settings, by default `tags`, `description`, `cssclasses` and `source`). Choosing one adds it to the note's frontmatter, creating the frontmatter block if needed, and never duplicates a property the note already has.
- **Add Property** opens a dialog for any property: choose its type (Text, List, Number, Checkbox, Date, Date & time), give it a name (existing property names from your vault are suggested, and choosing one selects its usual type) and a value. Values YAML would misread, such as the text `007` or `key: value`, are quoted automatically, and the dialog won't overwrite a property the note already has.

### Bases tab

Tools for [Obsidian Bases](https://obsidian.md/help/bases), working on both kinds of embedded base: a ```base code block inside the note, and a standalone `.base` file embedded with `![[Name.base]]` (optionally pinned to a view with `![[Name.base#View]]`). Commands act on the base the cursor is in or on; with the cursor elsewhere they use the note's only base, or ask which one when there are several.

- **Base**: *New Base* creates an inline block or a separate `.base` file (first view type and name, optionally pre-filtered to this note's folder, a tag, or notes linking here) and embeds it. *Embed Base* embeds an existing `.base` file or one of its views. *Edit Base* opens the editor below.
- **Views**: *Add View* adds a Table, Cards, List or Map view in one click. *Edit Views* renames, reorders, duplicates and deletes views and sets each view's columns, sorting, grouping, limit, per-column summaries, filters, and any other view-specific options.
- **Filters**: *Quick Filter* adds a ready-made condition (this note's folder, links to or from this note, recently created or modified). *Filters* builds conditions from a property, operator and value, or from tags, folders, links and dates, for the whole base or one view, matching all, any or none of them.
- **Formulas**: *Formulas* adds, edits, renames and deletes formulas, warning about unbalanced brackets or quotes, with an insert-a-function picker. The **Functions** menus (Functions, Text, Number, List, Date, File) insert a function call at the cursor; hover a cell for its signature.
- **Columns**: *Properties* sets friendlier column names. *Summaries* manages custom summary formulas.

The editor works on a copy and only writes the base when you press Save. Unrecognised keys in the base are preserved. Bases whose YAML can't be parsed are left alone.

### Collapsing the ribbon

Double-click any tab to collapse the ribbon to just the tab strip. Double-click again to expand it.

### Hotkeys and the command palette

Ribbon commands are also available in Obsidian's command palette (search for "Ribbon Bar") and can be bound to hotkeys under Settings → Hotkeys. They are named by tab, for example "Home: Bold" or "Insert: Delete Row", run in an editable Markdown editor, and include each option of the ordinary dropdowns such as "Home: Highlight: Red". The size-picker (Table) and the Symbols grid are ribbon-only.

## Settings

| Setting | Description | Default |
|---|---|---|
| Enable ribbon | Show or hide the ribbon on all open panes | On |
| Collapse ribbon by default | New panes start with their ribbon collapsed | Off |
| Frontmatter properties | The predefined properties offered in the References tab's Properties menu, each with a type and optional default value | `tags`, `description`, `cssclasses`, `source` |

## Development

### Setup

```bash
git clone git@github.com:mpfilbin/obsidian-ribbon-toolbar.git ribbon-bar
cd ribbon-bar
npm install
```

### Run in dev mode (watches for changes, outputs main.js)

```bash
npm run dev
```

### Install to a local vault for testing

```bash
./scripts/install.sh /path/to/your/vault
```

On Windows, see [Working on Windows](#working-on-windows).

### Run tests

```bash
npm run test            # run once
npm run test:coverage   # with a coverage report
```

Tests run under [Vitest](https://vitest.dev/). Pure editing logic is tested
against a mock editor (`tests/support/mockEditor.ts`). The `obsidian` package
ships types only, so tests alias it to a small stand-in
(`tests/support/obsidian.ts`) that models modals, settings, and the plugin base
class. UI tests mount the Svelte components and modals in jsdom, marked with a
`// @vitest-environment jsdom` comment at the top of the file.

### Working on Windows

Prerequisites: [Node.js](https://nodejs.org/) (includes `npm`) and Git. The
PowerShell scripts work with the Windows PowerShell 5.1 that ships with
Windows, or with PowerShell 7+.

Setup, dev mode, and tests use the same `npm` commands as above and run fine
from PowerShell or Command Prompt:

```powershell
npm install
npm run dev
npm run test
```

Install the plugin into a test vault, and remove it again, with the
PowerShell equivalents of `install.sh` and `uninstall.sh`:

```powershell
.\scripts\install.ps1 C:\path\to\your\vault
.\scripts\uninstall.ps1 C:\path\to\your\vault
```

`install.ps1` builds the plugin and copies `main.js`, `manifest.json`, and
`styles.css` to `<vault>\.obsidian\plugins\ribbon-bar`. `uninstall.ps1`
deletes that folder and removes the plugin from the vault's
`community-plugins.json`. After either, reload Obsidian's community plugins
(or restart Obsidian) to pick up the change.

If PowerShell refuses to run the scripts because of the execution policy, run
them for a single invocation with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 C:\path\to\your\vault
```

`npm run release` runs a bash script, so run it from Git Bash or WSL rather
than PowerShell.

### Bump version and prepare a release

```bash
npm run release patch     # or minor / major
git push
```

The release GitHub Action automatically builds and publishes a GitHub release, with `main.js`, `manifest.json`, and `styles.css` attached, whenever it detects a `manifest.json` change on `master`.

## License

MIT
