/**
 * Functions available in Bases expressions (formulas, filters and summaries),
 * grouped for the "insert function" menus. `template` is the text inserted;
 * `$0` marks where the cursor lands (it is removed on insert).
 */

export type FunctionGroup = "Global" | "Text" | "Number" | "List" | "Date" | "File";

export interface BaseFunction {
  group: FunctionGroup;
  /** Display name, e.g. "contains" or "if". */
  name: string;
  signature: string;
  description: string;
  template: string;
}

const fn = (group: FunctionGroup, name: string, signature: string, description: string, template: string): BaseFunction => ({
  group,
  name,
  signature,
  description,
  template,
});

export const FUNCTIONS: BaseFunction[] = [
  // Global
  fn("Global", "if", "if(condition, trueResult, falseResult?)", "Returns one value or the other depending on a condition.", "if($0, , )"),
  fn("Global", "now", "now()", "The current date and time.", "now()$0"),
  fn("Global", "today", "today()", "The current date, without a time.", "today()$0"),
  fn("Global", "date", "date(text)", "Parses text such as \"2025-01-31\" into a date.", 'date("$0")'),
  fn("Global", "duration", "duration(text)", "Parses text such as \"3 days\" into a duration.", 'duration("$0")'),
  fn("Global", "number", "number(value)", "Converts a value to a number.", "number($0)"),
  fn("Global", "link", "link(path, display?)", "Creates a link to a file path.", 'link("$0")'),
  fn("Global", "file", "file(path)", "Gets a file by path or link.", 'file("$0")'),
  fn("Global", "list", "list(value)", "Wraps a value in a list if it isn't one already.", "list($0)"),
  fn("Global", "min", "min(a, b, …)", "The smallest of the given numbers.", "min($0)"),
  fn("Global", "max", "max(a, b, …)", "The largest of the given numbers.", "max($0)"),
  fn("Global", "image", "image(path)", "Shows an image.", 'image($0)'),
  fn("Global", "icon", "icon(name)", "Shows a Lucide icon.", 'icon("$0")'),
  fn("Global", "html", "html(text)", "Renders text as HTML.", "html($0)"),
  fn("Global", "escapeHTML", "escapeHTML(text)", "Escapes text so it is safe inside HTML.", "escapeHTML($0)"),

  // Text
  fn("Text", "contains", "text.contains(value)", "Whether the text contains a value.", '.contains("$0")'),
  fn("Text", "startsWith", "text.startsWith(value)", "Whether the text starts with a value.", '.startsWith("$0")'),
  fn("Text", "endsWith", "text.endsWith(value)", "Whether the text ends with a value.", '.endsWith("$0")'),
  fn("Text", "lower", "text.lower()", "Converts to lowercase.", ".lower()$0"),
  fn("Text", "title", "text.title()", "Converts to Title Case.", ".title()$0"),
  fn("Text", "trim", "text.trim()", "Removes whitespace from both ends.", ".trim()$0"),
  fn("Text", "replace", "text.replace(pattern, replacement)", "Replaces matches of a pattern.", '.replace("$0", "")'),
  fn("Text", "split", "text.split(separator)", "Splits into a list.", '.split("$0")'),
  fn("Text", "slice", "text.slice(start, end?)", "Takes part of the text.", ".slice($0)"),
  fn("Text", "repeat", "text.repeat(count)", "Repeats the text.", ".repeat($0)"),
  fn("Text", "reverse", "text.reverse()", "Reverses the characters.", ".reverse()$0"),
  fn("Text", "isEmpty", "text.isEmpty()", "Whether the text is empty.", ".isEmpty()$0"),
  fn("Text", "toString", "value.toString()", "Converts any value to text.", ".toString()$0"),
  fn("Text", "length", "text.length", "The number of characters.", ".length$0"),

  // Number
  fn("Number", "abs", "number.abs()", "Absolute value.", ".abs()$0"),
  fn("Number", "ceil", "number.ceil()", "Rounds up.", ".ceil()$0"),
  fn("Number", "floor", "number.floor()", "Rounds down.", ".floor()$0"),
  fn("Number", "round", "number.round(digits?)", "Rounds to the nearest value.", ".round($0)"),
  fn("Number", "toFixed", "number.toFixed(digits)", "Formats with a fixed number of decimals.", ".toFixed($0)"),
  fn("Number", "isEmpty", "number.isEmpty()", "Whether the number is empty.", ".isEmpty()$0"),

  // List
  fn("List", "contains", "list.contains(value)", "Whether the list contains a value.", ".contains($0)"),
  fn("List", "containsAll", "list.containsAll(a, b, …)", "Whether the list contains every value.", ".containsAll($0)"),
  fn("List", "containsAny", "list.containsAny(a, b, …)", "Whether the list contains any value.", ".containsAny($0)"),
  fn("List", "filter", "list.filter(condition)", "Keeps items where the condition (using `value`) is true.", ".filter($0)"),
  fn("List", "map", "list.map(expression)", "Transforms each item (using `value`).", ".map($0)"),
  fn("List", "reduce", "list.reduce(expression, initial)", "Combines items into one value (using `acc` and `value`).", ".reduce($0, )"),
  fn("List", "join", "list.join(separator)", "Joins items into text.", '.join(", ")$0'),
  fn("List", "sort", "list.sort()", "Sorts the items.", ".sort()$0"),
  fn("List", "unique", "list.unique()", "Removes duplicates.", ".unique()$0"),
  fn("List", "flat", "list.flat()", "Flattens nested lists.", ".flat()$0"),
  fn("List", "slice", "list.slice(start, end?)", "Takes part of the list.", ".slice($0)"),
  fn("List", "reverse", "list.reverse()", "Reverses the order.", ".reverse()$0"),
  fn("List", "isEmpty", "list.isEmpty()", "Whether the list is empty.", ".isEmpty()$0"),
  fn("List", "length", "list.length", "The number of items.", ".length$0"),

  // Date
  fn("Date", "format", "date.format(pattern)", "Formats a date, e.g. \"YYYY-MM-DD\".", '.format("$0")'),
  fn("Date", "date", "date.date()", "Removes the time, keeping the day.", ".date()$0"),
  fn("Date", "time", "date.time()", "The time of day as text.", ".time()$0"),
  fn("Date", "relative", "date.relative()", "Describes the date relative to now, e.g. \"3 days ago\".", ".relative()$0"),
  fn("Date", "year", "date.year", "The year.", ".year$0"),
  fn("Date", "month", "date.month", "The month (1–12).", ".month$0"),
  fn("Date", "day", "date.day", "The day of the month.", ".day$0"),
  fn("Date", "hour", "date.hour", "The hour.", ".hour$0"),
  fn("Date", "minute", "date.minute", "The minute.", ".minute$0"),
  fn("Date", "second", "date.second", "The second.", ".second$0"),
  fn("Date", "isEmpty", "date.isEmpty()", "Whether the date is empty.", ".isEmpty()$0"),

  // File
  fn("File", "hasTag", "file.hasTag(tag, …)", "Whether the file has any of the tags.", 'file.hasTag("$0")'),
  fn("File", "inFolder", "file.inFolder(folder)", "Whether the file is in the folder or a subfolder.", 'file.inFolder("$0")'),
  fn("File", "hasLink", "file.hasLink(file)", "Whether the file links to another file.", "file.hasLink($0)"),
  fn("File", "hasProperty", "file.hasProperty(name)", "Whether the file has a property.", 'file.hasProperty("$0")'),
  fn("File", "asLink", "file.asLink(display?)", "Turns the file into a link.", "file.asLink()$0"),
  fn("File", "linksTo", "link.linksTo(file)", "Whether a link points to a file.", ".linksTo($0)"),
  fn("File", "asFile", "link.asFile()", "Resolves a link to its file.", ".asFile()$0"),
];

export const FUNCTION_GROUPS: FunctionGroup[] = ["Global", "Text", "Number", "List", "Date", "File"];

export function functionsInGroup(group: FunctionGroup): BaseFunction[] {
  return FUNCTIONS.filter((f) => f.group === group);
}

/** Splits a template at its `$0` marker; the cursor belongs between the halves. */
export function splitTemplate(template: string): { before: string; after: string } {
  const at = template.indexOf("$0");
  if (at === -1) return { before: template, after: "" };
  return { before: template.slice(0, at), after: template.slice(at + 2) };
}
