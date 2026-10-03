/**
 * Builds filter condition strings (the expressions found under `filters:` in a
 * base) from structured input, so the UI never asks users to write syntax.
 */

export type ValueKind = "text" | "number" | "date" | "boolean" | "list";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** A string literal with double quotes, escaping what would end or break it. */
export function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * How a property is written inside an expression. Bare names are note
 * properties; file./formula./note. prefixes pass through, and names that
 * aren't plain identifiers use bracket access.
 */
export function propertyRef(property: string): string {
  const prefixed = /^(file|formula|note)\.(.+)$/.exec(property);
  if (prefixed) {
    const [, scope, name] = prefixed;
    if (scope === "file" || IDENTIFIER.test(name)) return property;
    return `${scope}[${quote(name)}]`;
  }
  return IDENTIFIER.test(property) ? property : `note[${quote(property)}]`;
}

export interface OperatorDef {
  id: string;
  label: string;
  kinds: ValueKind[];
  /** "none": no value; "text": free text; "number"; "date" (YYYY-MM-DD); "days". */
  input: "none" | "text" | "number" | "date" | "days";
  build(ref: string, value: string): string;
}

const num = (value: string): string => String(Number(value));

export const OPERATORS: OperatorDef[] = [
  { id: "is", label: "is", kinds: ["text"], input: "text", build: (p, v) => `${p} == ${quote(v)}` },
  { id: "is-not", label: "is not", kinds: ["text"], input: "text", build: (p, v) => `${p} != ${quote(v)}` },
  { id: "contains", label: "contains", kinds: ["text", "list"], input: "text", build: (p, v) => `${p}.contains(${quote(v)})` },
  { id: "not-contains", label: "does not contain", kinds: ["text", "list"], input: "text", build: (p, v) => `!${p}.contains(${quote(v)})` },
  { id: "starts-with", label: "starts with", kinds: ["text"], input: "text", build: (p, v) => `${p}.startsWith(${quote(v)})` },
  { id: "ends-with", label: "ends with", kinds: ["text"], input: "text", build: (p, v) => `${p}.endsWith(${quote(v)})` },
  { id: "eq", label: "=", kinds: ["number"], input: "number", build: (p, v) => `${p} == ${num(v)}` },
  { id: "neq", label: "≠", kinds: ["number"], input: "number", build: (p, v) => `${p} != ${num(v)}` },
  { id: "gt", label: ">", kinds: ["number"], input: "number", build: (p, v) => `${p} > ${num(v)}` },
  { id: "gte", label: "≥", kinds: ["number"], input: "number", build: (p, v) => `${p} >= ${num(v)}` },
  { id: "lt", label: "<", kinds: ["number"], input: "number", build: (p, v) => `${p} < ${num(v)}` },
  { id: "lte", label: "≤", kinds: ["number"], input: "number", build: (p, v) => `${p} <= ${num(v)}` },
  { id: "on", label: "is on", kinds: ["date"], input: "date", build: (p, v) => `${p} == date(${quote(v)})` },
  { id: "before", label: "is before", kinds: ["date"], input: "date", build: (p, v) => `${p} < date(${quote(v)})` },
  { id: "after", label: "is after", kinds: ["date"], input: "date", build: (p, v) => `${p} > date(${quote(v)})` },
  { id: "last-days", label: "is within the last … days", kinds: ["date"], input: "days", build: (p, v) => `${p} > now() - ${quote(`${num(v)} days`)}` },
  { id: "next-days", label: "is within the next … days", kinds: ["date"], input: "days", build: (p, v) => `${p} < now() + ${quote(`${num(v)} days`)}` },
  { id: "true", label: "is checked", kinds: ["boolean"], input: "none", build: (p) => `${p} == true` },
  { id: "false", label: "is not checked", kinds: ["boolean"], input: "none", build: (p) => `${p} == false` },
  { id: "empty", label: "is empty", kinds: ["text", "number", "date", "list"], input: "none", build: (p) => `${p}.isEmpty()` },
  { id: "not-empty", label: "is not empty", kinds: ["text", "number", "date", "list"], input: "none", build: (p) => `!${p}.isEmpty()` },
];

export function operatorsFor(kind: ValueKind): OperatorDef[] {
  return OPERATORS.filter((op) => op.kinds.includes(kind));
}

export const VALUE_KIND_LABELS: Record<ValueKind, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  boolean: "Checkbox",
  list: "List",
};

/** Properties that are always a particular kind; everything else is inferred. */
const KNOWN_KINDS: Record<string, ValueKind> = {
  "file.name": "text",
  "file.basename": "text",
  "file.path": "text",
  "file.folder": "text",
  "file.ext": "text",
  "file.size": "number",
  "file.ctime": "date",
  "file.mtime": "date",
  "file.tags": "list",
  "file.links": "list",
  "file.backlinks": "list",
  "file.embeds": "list",
};

/** Guesses how to filter a property from a sample frontmatter value. */
export function inferKind(property: string, sample?: unknown): ValueKind {
  if (KNOWN_KINDS[property]) return KNOWN_KINDS[property];
  if (Array.isArray(sample)) return "list";
  if (typeof sample === "number") return "number";
  if (typeof sample === "boolean") return "boolean";
  if (typeof sample === "string" && /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}.*)?$/.test(sample)) return "date";
  return "text";
}

export type ConditionSpec =
  | { kind: "property"; property: string; operator: string; value?: string }
  | { kind: "tag"; tags: string[] }
  | { kind: "folder"; folder: string }
  | { kind: "linksToThis" }
  | { kind: "linkedFromThis" }
  | { kind: "modified" | "created"; days: number }
  | { kind: "hasProperty"; name: string }
  | { kind: "raw"; expression: string };

export type BuildResult = { ok: true; expression: string } | { ok: false; error: string };

const fail = (error: string): BuildResult => ({ ok: false, error });
const done = (expression: string): BuildResult => ({ ok: true, expression });

export function buildCondition(spec: ConditionSpec): BuildResult {
  switch (spec.kind) {
    case "property": {
      const operator = OPERATORS.find((op) => op.id === spec.operator);
      if (!spec.property.trim()) return fail("Choose a property.");
      if (!operator) return fail("Choose an operator.");
      const value = (spec.value ?? "").trim();
      if (operator.input !== "none" && !value) return fail("Enter a value.");
      if ((operator.input === "number" || operator.input === "days") && !Number.isFinite(Number(value))) {
        return fail("Enter a number.");
      }
      if (operator.input === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fail("Enter a date as YYYY-MM-DD.");
      return done(operator.build(propertyRef(spec.property.trim()), value));
    }
    case "tag": {
      const tags = spec.tags.map((t) => t.trim().replace(/^#/, "")).filter(Boolean);
      return tags.length ? done(`file.hasTag(${tags.map(quote).join(", ")})`) : fail("Enter at least one tag.");
    }
    case "folder":
      return spec.folder.trim() ? done(`file.inFolder(${quote(spec.folder.trim())})`) : fail("Enter a folder.");
    case "linksToThis":
      return done("file.hasLink(this.file)");
    case "linkedFromThis":
      return done("this.file.hasLink(file)");
    case "modified":
    case "created": {
      if (!Number.isFinite(spec.days) || spec.days <= 0) return fail("Enter a number of days.");
      const property = spec.kind === "modified" ? "file.mtime" : "file.ctime";
      return done(`${property} > now() - ${quote(`${Math.floor(spec.days)} days`)}`);
    }
    case "hasProperty":
      return spec.name.trim() ? done(`file.hasProperty(${quote(spec.name.trim())})`) : fail("Enter a property name.");
    case "raw":
      return spec.expression.trim() ? done(spec.expression.trim()) : fail("Enter an expression.");
  }
}

/** Ready-made conditions offered as one-click quick filters. */
export const QUICK_FILTERS: { id: string; label: string; spec: ConditionSpec }[] = [
  { id: "links-to-this", label: "Links to this note", spec: { kind: "linksToThis" } },
  { id: "linked-from-this", label: "Linked from this note", spec: { kind: "linkedFromThis" } },
  { id: "modified-7", label: "Modified in the last 7 days", spec: { kind: "modified", days: 7 } },
  { id: "created-7", label: "Created in the last 7 days", spec: { kind: "created", days: 7 } },
  { id: "modified-30", label: "Modified in the last 30 days", spec: { kind: "modified", days: 30 } },
];

/** The condition that restricts a base to the folder the current note is in. */
export function folderOfNoteCondition(notePath: string): ConditionSpec | null {
  const slash = notePath.lastIndexOf("/");
  return slash > 0 ? { kind: "folder", folder: notePath.slice(0, slash) } : null;
}
