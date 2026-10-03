import { addIcon } from "obsidian";
import {
  DELETE_COLUMN_ICON,
  DELETE_ROW_ICON,
  INSERT_COLUMN_LEFT_ICON,
  INSERT_COLUMN_RIGHT_ICON,
  INSERT_ROW_ABOVE_ICON,
  INSERT_ROW_BELOW_ICON,
} from "./iconIds";

// Obsidian's icon set has no table row/column insert or delete glyphs, so
// these are drawn here. addIcon expects the inner SVG of a 0 0 100 100 viewBox.
const TABLE_FRAME =
  '<g opacity="0.45" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round">' +
  '<rect x="12" y="12" width="76" height="76" rx="9"/>' +
  '<path d="M12 38.5H88M12 61.5H88M38.5 12V88M61.5 12V88"/></g>';
const DELETE_MARK =
  '<path d="M34 34L66 66M66 34L34 66" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>';
const INSERT_MARK =
  '<path d="M50 32V68M32 50H68" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>';

// The strip of cells a command acts on or adds, drawn as a filled band.
const ROW_BAND = (y: number, opacity: number): string =>
  `<rect x="12" y="${y}" width="76" height="23" fill="currentColor" opacity="${opacity}"/>`;
const COLUMN_BAND = (x: number, opacity: number): string =>
  `<rect x="${x}" y="12" width="23" height="76" fill="currentColor" opacity="${opacity}"/>`;

const ICONS: Record<string, string> = {
  [DELETE_ROW_ICON]: TABLE_FRAME + ROW_BAND(38.5, 0.3) + DELETE_MARK,
  [DELETE_COLUMN_ICON]: TABLE_FRAME + COLUMN_BAND(38.5, 0.3) + DELETE_MARK,
  [INSERT_ROW_ABOVE_ICON]: TABLE_FRAME + ROW_BAND(12, 0.55) + INSERT_MARK,
  [INSERT_ROW_BELOW_ICON]: TABLE_FRAME + ROW_BAND(65, 0.55) + INSERT_MARK,
  [INSERT_COLUMN_LEFT_ICON]: TABLE_FRAME + COLUMN_BAND(12, 0.55) + INSERT_MARK,
  [INSERT_COLUMN_RIGHT_ICON]: TABLE_FRAME + COLUMN_BAND(65, 0.55) + INSERT_MARK,
};

export function registerCustomIcons(): void {
  for (const [id, svg] of Object.entries(ICONS)) {
    addIcon(id, svg);
  }
}
