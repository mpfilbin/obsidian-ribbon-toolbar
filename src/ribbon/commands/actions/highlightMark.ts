import type { EditorLike } from "./types";
import { wrapSelection } from "./helpers";

export interface HighlightColorConfig {
  name: string;
  color: string;
}

// The border-radius/padding "look" lives in the plugin's shipped styles.css
// (see .ribbon-bar-highlight) so it can be shared instead of repeated inline.
// The background-color stays inline since it's per-instance (an arbitrary
// user-configured hex value, not a fixed set the stylesheet could cover) and
// this way a highlight still shows its color even where the plugin's CSS
// isn't loaded (e.g. exported/published notes, or the plugin disabled) - it
// just loses the rounded-corner styling in that case.
export function buildMarkOpenTag(color: string): string {
  return `<mark class="ribbon-bar-highlight" style="background-color: ${color};">`;
}

export function highlightWithColor(color: string): (editor: EditorLike) => void {
  return (editor: EditorLike): void =>
    wrapSelection(editor, buildMarkOpenTag(color), "</mark>", "highlighted text");
}
