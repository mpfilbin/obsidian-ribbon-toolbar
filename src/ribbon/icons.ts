import { addIcon } from "obsidian";

// Obsidian's icon set has no "delete table row/column" glyphs, so these are
// drawn here. addIcon expects the inner SVG of a 0 0 100 100 viewBox.
const TABLE_FRAME =
  '<g opacity="0.45" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round">' +
  '<rect x="12" y="12" width="76" height="76" rx="9"/>' +
  '<path d="M12 38.5H88M12 61.5H88M38.5 12V88M61.5 12V88"/></g>';
const DELETE_MARK =
  '<path d="M34 34L66 66M66 34L34 66" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>';

export const DELETE_ROW_ICON = "ribbon-bar-table-delete-row";
export const DELETE_COLUMN_ICON = "ribbon-bar-table-delete-column";

export function registerCustomIcons(): void {
  addIcon(
    DELETE_ROW_ICON,
    `${TABLE_FRAME}<rect x="12" y="38.5" width="76" height="23" fill="currentColor" opacity="0.3"/>${DELETE_MARK}`
  );
  addIcon(
    DELETE_COLUMN_ICON,
    `${TABLE_FRAME}<rect x="38.5" y="12" width="23" height="76" fill="currentColor" opacity="0.3"/>${DELETE_MARK}`
  );
}
