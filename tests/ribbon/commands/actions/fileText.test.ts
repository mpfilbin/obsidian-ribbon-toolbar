import { describe, expect, it } from "vitest";
import {
  buildHtmlDocument,
  defaultSaveAsPath,
  joinPath,
  normalizeSaveAsPath,
  splitPath,
  uniquePath,
} from "../../../../src/ribbon/commands/actions/fileText";

describe("splitPath / joinPath", () => {
  it("splits folder, basename and extension", () => {
    expect(splitPath("a/b/Note.md")).toEqual({ folder: "a/b", basename: "Note", extension: "md" });
    expect(splitPath("Note.md")).toEqual({ folder: "", basename: "Note", extension: "md" });
    expect(splitPath("README")).toEqual({ folder: "", basename: "README", extension: "" });
  });

  it("joins without doubled or leading slashes", () => {
    expect(joinPath("", "x.md")).toBe("x.md");
    expect(joinPath("/a/", "x.md")).toBe("a/x.md");
  });
});

describe("uniquePath", () => {
  it("returns the plain name when free and numbers it when taken", () => {
    const taken = new Set(["Untitled.md", "Untitled 1.md"]);
    expect(uniquePath("", "Fresh", "md", (p) => taken.has(p))).toBe("Fresh.md");
    expect(uniquePath("", "Untitled", "md", (p) => taken.has(p))).toBe("Untitled 2.md");
    expect(uniquePath("notes", "Untitled", "md", (p) => taken.has(p))).toBe("notes/Untitled.md");
  });
});

describe("Save As paths", () => {
  it("suggests a copy beside the original", () => {
    expect(defaultSaveAsPath("a/Note.md")).toBe("a/Note copy.md");
    expect(defaultSaveAsPath("Note.md")).toBe("Note copy.md");
  });

  it("adds .md when missing, trims, and rejects empty or folder-only input", () => {
    expect(normalizeSaveAsPath("  a/Copy ")).toBe("a/Copy.md");
    expect(normalizeSaveAsPath("/a/Copy.txt")).toBe("a/Copy.txt");
    expect(normalizeSaveAsPath("   ")).toBe("");
    expect(normalizeSaveAsPath("a/")).toBe("");
  });
});

describe("buildHtmlDocument", () => {
  it("wraps the body in a page and escapes the title", () => {
    const html = buildHtmlDocument('A <b> & "c"', "<p>Hi</p>");
    expect(html).toContain("<title>A &lt;b&gt; &amp; &quot;c&quot;</title>");
    expect(html).toContain("<p>Hi</p>");
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
  });
});
