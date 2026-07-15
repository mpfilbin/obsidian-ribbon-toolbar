#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
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

OBSIDIAN_DIR="$VAULT_PATH/.obsidian"
PLUGIN_DIR="$OBSIDIAN_DIR/plugins/$PLUGIN_ID"
COMMUNITY_PLUGINS_FILE="$OBSIDIAN_DIR/community-plugins.json"

if [ -d "$PLUGIN_DIR" ]; then
  echo "→ Removing plugin directory $PLUGIN_DIR..."
  rm -rf "$PLUGIN_DIR"
else
  echo "→ Plugin directory not found at $PLUGIN_DIR; nothing to delete."
fi

if [ ! -d "$OBSIDIAN_DIR" ]; then
  echo "→ Obsidian config directory not found at $OBSIDIAN_DIR; skipping community plugin cleanup."
  echo "✓ Done."
  exit 0
fi

if [ ! -f "$COMMUNITY_PLUGINS_FILE" ]; then
  echo "→ community-plugins.json not found at $COMMUNITY_PLUGINS_FILE; skipping plugin list cleanup."
  echo "✓ Done."
  exit 0
fi

echo "→ Removing '$PLUGIN_ID' from $COMMUNITY_PLUGINS_FILE..."
if UPDATE_RESULT="$(PLUGIN_ID="$PLUGIN_ID" COMMUNITY_PLUGINS_FILE="$COMMUNITY_PLUGINS_FILE" node <<'NODE'
const fs = require('node:fs');

const pluginId = process.env.PLUGIN_ID;
const communityPluginsFile = process.env.COMMUNITY_PLUGINS_FILE;

const raw = fs.readFileSync(communityPluginsFile, 'utf8');
const parsed = JSON.parse(raw);

if (!Array.isArray(parsed)) {
  console.error(`Expected ${communityPluginsFile} to contain a JSON array.`);
  process.exit(1);
}

const filtered = parsed.filter((entry) => entry !== pluginId);

if (filtered.length !== parsed.length) {
  fs.writeFileSync(communityPluginsFile, `${JSON.stringify(filtered, null, 2)}\n`, 'utf8');
  process.stdout.write('removed');
} else {
  process.stdout.write('not-found');
}
NODE
)"; then
  if [ "$UPDATE_RESULT" = "removed" ]; then
    echo "✓ Done. Plugin files and community plugin entry removed."
  else
    echo "✓ Done. Plugin files removed; '$PLUGIN_ID' was not listed in community-plugins.json."
  fi
else
  echo "Error: Failed to update $COMMUNITY_PLUGINS_FILE. The plugin directory has been removed, but the community plugin list may still reference '$PLUGIN_ID'."
  exit 1
fi
