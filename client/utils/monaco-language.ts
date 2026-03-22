import hljs from "highlight.js/lib/common";

const MONACO_LANGUAGE_ALIASES: Record<string, string> = {
  "c++": "cpp",
  js: "javascript",
  node: "javascript",
  "javascript-es2024": "javascript",
  "javascript-esnext": "javascript",
  ts: "typescript",
  "typescript-esnext": "typescript",
  sh: "shell",
  shellscript: "shell",
  text: "plaintext",
};

const KNOWN_MONACO_LANGUAGES = new Set<string>([
  "bat",
  "c",
  "clojure",
  "cpp",
  "csharp",
  "css",
  "dockerfile",
  "fsharp",
  "go",
  "graphql",
  "handlebars",
  "html",
  "ini",
  "java",
  "javascript",
  "json",
  "kotlin",
  "less",
  "lua",
  "markdown",
  "objective-c",
  "pascal",
  "perl",
  "php",
  "plaintext",
  "postiats",
  "powershell",
  "python",
  "r",
  "razor",
  "ruby",
  "rust",
  "scala",
  "scss",
  "shell",
  "sql",
  "swift",
  "typescript",
  "vb",
  "xml",
  "yaml",
]);

export function normalizeMonacoLanguage(language?: string): string {
  const normalized = (language ?? "").trim().toLowerCase();
  if (!normalized) return "";
  return MONACO_LANGUAGE_ALIASES[normalized] ?? normalized;
}

function isKnownMonacoLanguage(language: string): boolean {
  return KNOWN_MONACO_LANGUAGES.has(language);
}

function detectMonacoLanguageFromCode(code: string): string | null {
  if (!code || !code.trim()) return null;

  const result = hljs.highlightAuto(code);
  if (!result.language) return null;

  const normalized = normalizeMonacoLanguage(result.language);
  return isKnownMonacoLanguage(normalized) ? normalized : null;
}

export function resolveMonacoLanguage(preferredLanguage: string | undefined, code: string): string {
  const normalizedPreferred = normalizeMonacoLanguage(preferredLanguage);

  if (normalizedPreferred && isKnownMonacoLanguage(normalizedPreferred)) {
    return normalizedPreferred;
  }

  const detected = detectMonacoLanguageFromCode(code);
  if (detected) return detected;

  if (normalizedPreferred) return normalizedPreferred;
  return "plaintext";
}
