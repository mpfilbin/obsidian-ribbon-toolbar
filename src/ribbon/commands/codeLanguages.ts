// [fence id, label] for the Insert > Code Block menu. The fence id is what goes
// after the opening ``` and is the name Obsidian's syntax highlighter knows.
// Deliberately limited to widely used languages; "Plain text" (no language)
// comes first.
export const CODE_LANGUAGES: [string, string][] = [
  ["", "Plain text"],
  ["javascript", "JavaScript"],
  ["typescript", "TypeScript"],
  ["html", "HTML"],
  ["css", "CSS"],
  ["json", "JSON"],
  ["http", "HTTP"],
  ["bash", "Bash / Shell"],
  ["powershell", "PowerShell"],
  ["sql", "SQL"],
  ["python", "Python"],
  ["csharp", "C#"],
  ["java", "Java"],
  ["c", "C"],
  ["cpp", "C++"],
  ["go", "Go"],
  ["rust", "Rust"],
  ["php", "PHP"],
  ["ruby", "Ruby"],
  ["swift", "Swift"],
  ["kotlin", "Kotlin"],
  ["yaml", "YAML"],
  ["markdown", "Markdown"],
];
