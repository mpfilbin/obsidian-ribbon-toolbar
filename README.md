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

### Home tab

Bold, Italic, Strikethrough, Highlight, Code, Clear Formatting, Heading (dropdown: H1–H3), Bulleted List, Numbered List, Checklist, Quote

### Insert tab

Link, Internal Link, Tag, Image, Table, Code Block, Horizontal Rule, Callout

### Layout tab

Promote/Demote Heading, Indent/Outdent, Move Line Up/Down, Table of Contents

### References tab

Footnote, Internal Link, Tag, Callout

### Collapsing the ribbon

Double-click any tab to collapse the ribbon to just the tab strip. Double-click again to expand it.

## Settings

| Setting | Description | Default |
|---|---|---|
| Enable ribbon | Show or hide the ribbon on all open panes | On |
| Collapse ribbon by default | New panes start with their ribbon collapsed | Off |

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

### Run tests

```bash
npm run test
```

### Bump version and prepare a release

```bash
npm run release patch     # or minor / major
git push
```

The release GitHub Action automatically builds and publishes a GitHub release, with `main.js`, `manifest.json`, and `styles.css` attached, whenever it detects a `manifest.json` change on `master`.

## License

MIT
