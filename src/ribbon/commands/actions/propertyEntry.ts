/**
 * Builds the frontmatter lines for a property the user typed in (name, type and
 * value), quoting anything YAML would otherwise misread, and validates the input.
 * Predefined properties from settings use formatValueLines in frontmatter.ts,
 * which inserts their default values verbatim.
 */

export type PropertyEntryType = "text" | "list" | "number" | "checkbox" | "date" | "datetime";

export const PROPERTY_ENTRY_TYPES: { id: PropertyEntryType; label: string }[] = [
  { id: "text", label: "Text" },
  { id: "list", label: "List" },
  { id: "number", label: "Number" },
  { id: "checkbox", label: "Checkbox" },
  { id: "date", label: "Date" },
  { id: "datetime", label: "Date & time" },
];

/** The typed value, as the frontmatter API wants it. */
export type PropertyValue = string | number | boolean | string[] | null;

export interface PropertyEntryInput {
  name: string;
  type: PropertyEntryType;
  /** text/number/date/datetime: the typed value. list: one item per line. checkbox: "true" or "false". */
  value: string;
}

export type PropertyEntryResult = { ok: true; name: string; lines: string[]; value: PropertyValue } | { ok: false; error: string };

const PLAIN_KEY = /^[A-Za-z0-9_][A-Za-z0-9_ .-]*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** A property name as a YAML key, quoted when it holds anything but plain characters. */
export function yamlKey(name: string): string {
  return PLAIN_KEY.test(name) && !/\s$/.test(name) ? name : JSON.stringify(name);
}

/**
 * A text value as YAML. Quoted when left plain it would be read as something
 * else: a number, date, boolean or null, a mapping or comment, a list or flow
 * marker, or text with leading/trailing spaces or line breaks.
 */
export function yamlText(value: string): string {
  if (value === "") return "";
  const looksLikeOtherType =
    /^(true|false|null|yes|no|on|off|~)$/i.test(value) ||
    /^[-+]?(\d[\d_]*\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(value) ||
    /^0[xob][0-9a-f_]+$/i.test(value) ||
    /^\d{4}-\d{2}-\d{2}/.test(value);
  const unsafe =
    /^\s|\s$/.test(value) ||
    /^[-?:,[\]{}#&*!|>'"%@`]/.test(value) ||
    /:(\s|$)|\s#/.test(value) ||
    /[\r\n]/.test(value);
  return looksLikeOtherType || unsafe ? JSON.stringify(value) : value;
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** Today's date in the user's own time zone, as YYYY-MM-DD. */
export function localDate(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The current local date and time, as YYYY-MM-DDTHH:mm. */
export function localDateTime(now: Date = new Date()): string {
  return `${localDate(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function buildPropertyEntry(input: PropertyEntryInput): PropertyEntryResult {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Give the property a name." };
  if (/[\r\n]/.test(name)) return { ok: false, error: "A property name can't contain a line break." };
  const key = yamlKey(name);
  const value = input.value.trim();

  switch (input.type) {
    case "text":
      return { ok: true, name, lines: [`${key}: ${yamlText(input.value.trim())}`.trimEnd()], value: input.value.trim() };

    case "number": {
      if (value === "") return { ok: true, name, lines: [`${key}:`], value: null };
      if (!Number.isFinite(Number(value))) return { ok: false, error: "Enter a number." };
      return { ok: true, name, lines: [`${key}: ${Number(value)}`], value: Number(value) };
    }

    case "checkbox":
      return { ok: true, name, lines: [`${key}: ${input.value === "true" ? "true" : "false"}`], value: input.value === "true" };

    case "date":
      if (value !== "" && !DATE.test(value)) return { ok: false, error: "Enter a date as YYYY-MM-DD." };
      return { ok: true, name, lines: [`${key}: ${value}`.trimEnd()], value };

    case "datetime":
      if (value !== "" && !DATE_TIME.test(value)) return { ok: false, error: "Enter a date and time as YYYY-MM-DDTHH:mm." };
      return { ok: true, name, lines: [`${key}: ${value}`.trimEnd()], value };

    case "list": {
      const items = input.value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      if (items.length === 0) return { ok: true, name, lines: [`${key}:`, "  - "], value: [] };
      return { ok: true, name, lines: [`${key}:`, ...items.map((item) => `  - ${yamlText(item)}`)], value: items };
    }
  }
}
