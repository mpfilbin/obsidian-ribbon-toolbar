#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# Read the id from manifest.json so the install folder always matches the plugin.
PLUGIN_ID="$(node -e 'const fs = require("node:fs"); const path = require("node:path"); const manifest = JSON.parse(fs.readFileSync(path.join(process.argv[1], "manifest.json"), "utf8")); if (typeof manifest.id !== "string" || manifest.id.length === 0) { throw new Error("manifest.json is missing a valid plugin id"); } process.stdout.write(manifest.id);' "$REPO_ROOT")"

if [ $# -eq 0 ]; then
  echo "Usage: $0 <path-to-obsidian-vault>"
  echo ""
  echo "Example: $0 ~/Documents/MyVault"
  exit 1
fi

VAULT_PATH="$1"

if [ ! -d "$VAULT_PATH" ]; then
  echo "Error: Vault path does not exist: $VAULT_PATH"
  exit 1
fi

PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/$PLUGIN_ID"

echo "→ Building plugin..."
npm run build

echo "→ Installing to $PLUGIN_DIR..."
mkdir -p "$PLUGIN_DIR"
cp main.js manifest.json styles.css "$PLUGIN_DIR/"

echo "✓ Done. In Obsidian: Settings → Community Plugins → reload and enable 'Ribbon Bar'."
