import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MonacoEditor from "@monaco-editor/react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CodeTestData {
  comp_id: string;
  caption?: string;
  functionName?: string;
  additionalFiles?: {
    [language: string]: {
      [fileName: string]: {
        codeContents: {
          content: string;
          language: string;
        };
        hidden?: boolean;
      };
    };
  };
  languageContents?: {
    [key: string]: {
      codeContents: {
        content: string;
        language: string;
      };
      mainFileName: string;
    };
  };
  selectedLanguage?: string;
  publicTestCases?: {
    content: string;
  };
  privateTestCases?: {
    content: string;
  };
}

interface ParsedTestCase {
  name: string;
  inputRaws: string[];
  expectedRaws: string[];
  inputValues: unknown[];
  expectedValues: unknown[];
  inputRaw: string;
  expectedRaw: string;
  inputValue: unknown;
  expectedValue: unknown;
}

interface RunCaseResult {
  name: string;
  input: unknown;
  expected: unknown;
  actual: unknown;
  passed: boolean;
  error?: string;
}

interface Judge0Status {
  id: number;
  description: string;
}

interface Judge0ExecuteResponse {
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  memory?: number | null;
  status?: Judge0Status;
}

interface Judge0BatchExecuteResponse {
  submissions?: Array<Judge0ExecuteResponse | { error?: string; details?: unknown }>;
}

interface Judge0LanguageInfo {
  id: number;
  name: string;
}

interface EditableCodeFile {
  content: string;
  language: string;
  hidden: boolean;
  isMain: boolean;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M5 3l14 9-14 9V3z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ResultsIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function HelpIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}

function ResetIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
}

function FullScreenIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M16 4h4v4M4 16v4h4M20 16v4h-4" /></svg>;
}

function ExitFullScreenIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 3v4a1 1 0 01-1 1H3m18 0h-4a1 1 0 01-1-1V3m0 18v-4a1 1 0 011-1h4M3 16h4a1 1 0 011 1v4" /></svg>;
}

function CloudCheckIcon() {
  return <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" /></svg>;
}

function ChevronUpIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>;
}

function ErrorIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeJsonParse(value: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(value) as unknown };
  } catch {
    return { ok: false };
  }
}

function parseDataLiteral(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const direct = safeJsonParse(trimmed);
  if (direct.ok) return direct.value;

  const normalized = trimmed
    .replace(/\bNone\b/g, "null")
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/'/g, '"');

  const fallback = safeJsonParse(normalized);
  if (fallback.ok) return fallback.value;

  return trimmed;
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "undefined") return "undefined";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return String(a) === String(b);
  }
}

function parseIndexedYamlValues(section: string): string[] {
  const indexedValues = new Map<number, string>();
  const valueRegex = /-\s*(\d+)\s*:\s*([^\n\r]+)/g;

  let match: RegExpExecArray | null;
  while ((match = valueRegex.exec(section)) !== null) {
    const index = Number(match[1]);
    const raw = (match[2] ?? "").trim();
    if (Number.isNaN(index) || !raw) continue;
    indexedValues.set(index, raw);
  }

  return Array.from(indexedValues.entries())
    .sort((a, b) => a[0] - b[0])
    .map((entry) => entry[1]);
}

function summarizeIndexedValues(rawValues: string[]): string {
  if (!rawValues.length) return "";
  if (rawValues.length === 1) return rawValues[0];

  return rawValues
    .map((value, idx) => `${idx + 1}: ${value}`)
    .join("\n");
}

function buildStdinPayloadFromCase(testCase: ParsedTestCase): string {
  if (!testCase.inputValues.length) return "";
  if (testCase.inputValues.length === 1) return testCase.inputRaws[0] ?? "";

  try {
    return JSON.stringify(testCase.inputValues);
  } catch {
    return testCase.inputRaws.join("\n");
  }
}

function parseYamlTestCases(content: string): ParsedTestCase[] {
  if (!content?.trim()) return [];

  const cases: ParsedTestCase[] = [];
  const caseRegex = /-\s*name:\s*"([^"]+)"([\s\S]*?)(?=\n\s*-\s*name:|$)/g;

  let match: RegExpExecArray | null;
  while ((match = caseRegex.exec(content)) !== null) {
    const name = match[1]?.trim() || `Case ${cases.length + 1}`;
    const block = match[2] ?? "";
    const inputSection = block.match(/inputs:\s*([\s\S]*?)(?:\n\s*output:|$)/)?.[1] ?? "";
    const outputSection = block.match(/output:\s*([\s\S]*?)$/)?.[1] ?? "";

    const inputRaws = parseIndexedYamlValues(inputSection);
    const expectedRaws = parseIndexedYamlValues(outputSection);

    if (!inputRaws.length || !expectedRaws.length) continue;

    const inputValues = inputRaws.map((raw) => parseDataLiteral(raw));
    const expectedValues = expectedRaws.map((raw) => parseDataLiteral(raw));

    const inputRaw = summarizeIndexedValues(inputRaws);
    const expectedRaw = summarizeIndexedValues(expectedRaws);

    const inputValue = inputValues.length === 1 ? inputValues[0] : inputValues;
    const expectedValue = expectedValues.length === 1 ? expectedValues[0] : expectedValues;

    cases.push({
      name,
      inputRaws,
      expectedRaws,
      inputValues,
      expectedValues,
      inputRaw,
      expectedRaw,
      inputValue,
      expectedValue,
    });
  }

  return cases;
}

function normalizeLang(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()_.-]/g, "");
}

function getLanguageBucket<T>(
  buckets: Record<string, T> | undefined,
  selectedLanguage: string,
  runtimeLanguage: string,
): T | undefined {
  if (!buckets) return undefined;

  if (selectedLanguage in buckets) {
    return buckets[selectedLanguage];
  }

  const selectedNorm = normalizeLang(selectedLanguage);
  const runtimeNorm = normalizeLang(runtimeLanguage);

  const matched = Object.entries(buckets).find(([languageKey]) => {
    const keyNorm = normalizeLang(languageKey);
    return (
      keyNorm === selectedNorm ||
      keyNorm === runtimeNorm ||
      keyNorm.includes(selectedNorm) ||
      selectedNorm.includes(keyNorm) ||
      keyNorm.includes(runtimeNorm) ||
      runtimeNorm.includes(keyNorm)
    );
  });

  return matched?.[1];
}

function buildDefaultEditableFiles(
  additionalFiles: CodeTestData["additionalFiles"],
  selectedLanguage: string,
  runtimeLanguage: string,
  mainFileName: string,
  mainContent: string,
): Record<string, EditableCodeFile> {
  const files: Record<string, EditableCodeFile> = {};

  files[mainFileName] = {
    content: mainContent,
    language: runtimeLanguage,
    hidden: false,
    isMain: true,
  };

  const additionalFilesForLanguage = getLanguageBucket(additionalFiles, selectedLanguage, runtimeLanguage);
  if (!additionalFilesForLanguage) {
    return files;
  }

  for (const [fileName, fileData] of Object.entries(additionalFilesForLanguage)) {
    if (fileName === mainFileName) continue;

    files[fileName] = {
      content: fileData.codeContents?.content ?? "",
      language: fileData.codeContents?.language ?? runtimeLanguage,
      hidden: Boolean(fileData.hidden),
      isMain: false,
    };
  }

  return files;
}

function buildAdditionalFilesPayload(
  files: Record<string, EditableCodeFile>,
  mainFileName: string,
): Record<string, string> {
  const payload: Record<string, string> = {};

  for (const [fileName, file] of Object.entries(files)) {
    if (fileName === mainFileName) continue;
    payload[fileName] = file.content;
  }

  return payload;
}

function resolveLanguageEditorConfig(
  languageContents: CodeTestData["languageContents"],
  additionalFiles: CodeTestData["additionalFiles"],
  selectedLanguage: string,
): {
  mainFileName: string;
  mainContent: string;
  runtimeLanguage: string;
} {
  const fromLanguageContents = getLanguageBucket(languageContents, selectedLanguage, selectedLanguage);
  if (fromLanguageContents) {
    return {
      mainFileName: fromLanguageContents.mainFileName || "main.py",
      mainContent: fromLanguageContents.codeContents?.content || "",
      runtimeLanguage: fromLanguageContents.codeContents?.language || "python3",
    };
  }

  const fromAdditionalFiles = getLanguageBucket(additionalFiles, selectedLanguage, selectedLanguage);
  if (fromAdditionalFiles) {
    const entries = Object.entries(fromAdditionalFiles);
    const firstVisible = entries.find(([, file]) => !file.hidden) ?? entries[0];
    if (firstVisible) {
      const [fileName, file] = firstVisible;
      return {
        mainFileName: fileName,
        mainContent: file.codeContents?.content || "",
        runtimeLanguage: file.codeContents?.language || "python3",
      };
    }
  }

  return {
    mainFileName: "main.py",
    mainContent: "",
    runtimeLanguage: "python3",
  };
}

function buildLanguageCandidates(selectedLanguage: string, runtimeLanguage: string): string[] {
  const candidates = new Set<string>();

  for (const raw of [runtimeLanguage, selectedLanguage]) {
    const normalized = normalizeLang(raw || "");
    if (!normalized) continue;

    candidates.add(normalized);

    const noVersion = normalized.replace(/[0-9]+/g, "");
    if (noVersion) candidates.add(noVersion);
  }

  return Array.from(candidates).sort((a, b) => b.length - a.length);
}

function resolveJudge0LanguageId(
  languages: Judge0LanguageInfo[],
  selectedLanguage: string,
  runtimeLanguage: string,
): number | null {
  const candidates = buildLanguageCandidates(selectedLanguage, runtimeLanguage);
  const normalizedLanguages = languages.map((language) => ({
    ...language,
    normalizedName: normalizeLang(language.name),
  }));

  for (const candidate of candidates) {
    const exactMatch = normalizedLanguages.find((language) => language.normalizedName === candidate);
    if (exactMatch) return exactMatch.id;
  }

  for (const candidate of candidates) {
    const includesMatch = normalizedLanguages.find((language) =>
      language.normalizedName.includes(candidate) || candidate.includes(language.normalizedName),
    );
    if (includesMatch) return includesMatch.id;
  }

  return null;
}

async function fetchJudge0Languages(): Promise<Judge0LanguageInfo[]> {
  const response = await fetch("/api/code-test/execute", { method: "GET" });
  const payload = (await response.json().catch(() => ({}))) as
    | { languages?: unknown; error?: string; details?: unknown }
    | Record<string, unknown>;

  if (!response.ok) {
    const details = typeof payload.details === "string"
      ? payload.details
      : payload.details
        ? JSON.stringify(payload.details)
        : "";
    throw new Error([payload.error || "Failed to fetch supported languages.", details].filter(Boolean).join("\n"));
  }

  const languagesRaw = payload.languages;
  if (!Array.isArray(languagesRaw)) {
    throw new Error("Language metadata response is invalid.");
  }

  const languages: Judge0LanguageInfo[] = [];
  for (const item of languagesRaw) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as { id?: unknown; name?: unknown };
    if (typeof row.id === "number" && typeof row.name === "string") {
      languages.push({ id: row.id, name: row.name });
    }
  }

  return languages;
}

function detectLegacyFunctionName(code: string, runtimeLanguage: string, provided?: string): string | null {
  if (provided?.trim()) return provided.trim();

  const runtime = normalizeLang(runtimeLanguage);

  if (runtime.includes("python") || runtime === "py") {
    const match = code.match(/def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
    return match?.[1] ?? null;
  }

  if (runtime.includes("javascript") || runtime.includes("typescript") || runtime === "js" || runtime === "ts") {
    const fnDecl = code.match(/function\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (fnDecl?.[1]) return fnDecl[1];

    const arrow = code.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/);
    return arrow?.[1] ?? null;
  }

  return null;
}

function hasPythonStdinHandling(code: string): boolean {
  return /\binput\s*\(|sys\.stdin|stdin\.read\s*\(/.test(code) || /if\s+__name__\s*==\s*["']__main__["']/.test(code);
}

function hasJavascriptStdinHandling(code: string): boolean {
  return /fs\.readFileSync\s*\(\s*0\s*,|process\.stdin/.test(code);
}

function escapePythonString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function toCamelCaseIdentifier(value: string): string {
  return value.replace(/[_-]+([a-zA-Z0-9])/g, (_, ch: string) => ch.toUpperCase());
}

function detectJavaClassName(code: string, fileName: string): string {
  const classMatch = code.match(/\bclass\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
  if (classMatch?.[1]) return classMatch[1];

  const fromFileName = fileName.replace(/\.java$/i, "").trim();
  return fromFileName || "Solution";
}

function buildJavaMethodCandidates(code: string, provided?: string): string[] {
  const candidates = new Set<string>();

  if (provided?.trim()) {
    const normalized = provided.trim();
    candidates.add(normalized);
    candidates.add(toCamelCaseIdentifier(normalized));
    candidates.add(normalized.replace(/_/g, ""));
  }

  const methodRegex = /\b(?:public|protected|private)?\s*(?:static\s+)?(?:final\s+)?[A-Za-z_][\w<>\[\], ?]*\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = methodRegex.exec(code)) !== null) {
    const methodName = match[1];
    if (!methodName || methodName === "main") continue;
    candidates.add(methodName);
  }

  return Array.from(candidates).filter(Boolean);
}

function hasJavaMainEntrypoint(code: string): boolean {
  return /\bclass\s+Main\b/.test(code) && /\bpublic\s+static\s+void\s+main\s*\(/.test(code);
}

function escapeJavaStringLiteral(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
}

function buildJavaCompatibilityMainSource(targetClassName: string, methodCandidates: string[]): string {
  const safeClassName = /^[A-Za-z_][A-Za-z0-9_]*$/.test(targetClassName)
    ? targetClassName
    : "Solution";
  const escapedClassName = escapeJavaStringLiteral(safeClassName);
  const methodCandidatesLiteral = methodCandidates
    .map((name) => `"${escapeJavaStringLiteral(name)}"`)
    .join(", ");

  return `import java.io.*;
import java.lang.reflect.*;
import java.util.*;

public class Main {
  private static final String TARGET_CLASS = "${escapedClassName}";
  private static final String[] METHOD_CANDIDATES = new String[] { ${methodCandidatesLiteral} };

  public static void main(String[] args) throws Exception {
    String rawInput = readAll(System.in).trim();
    Object parsedInput = rawInput.isEmpty() ? null : new JsonParser(rawInput).parseValue();

    Class<?> targetClass = ${safeClassName}.class;
    Method targetMethod = null;
    List<?> rawArgs;

    if (parsedInput instanceof List<?>) {
      List<?> parsedList = (List<?>) parsedInput;
      Method asManyArgs = resolveMethod(targetClass, parsedList.size(), METHOD_CANDIDATES);
      if (asManyArgs != null) {
        targetMethod = asManyArgs;
        rawArgs = parsedList;
      } else {
        targetMethod = resolveMethod(targetClass, 1, METHOD_CANDIDATES);
        rawArgs = Collections.singletonList(parsedInput);
      }
    } else if (parsedInput == null) {
      targetMethod = resolveMethod(targetClass, 0, METHOD_CANDIDATES);
      rawArgs = Collections.emptyList();
    } else {
      targetMethod = resolveMethod(targetClass, 1, METHOD_CANDIDATES);
      rawArgs = Collections.singletonList(parsedInput);
    }

    if (targetMethod == null) {
      throw new RuntimeException("Could not resolve an executable method in class '" + TARGET_CLASS + "'.");
    }

    Object targetInstance = Modifier.isStatic(targetMethod.getModifiers())
      ? null
      : targetClass.getDeclaredConstructor().newInstance();

    Object[] convertedArgs = convertArgs(rawArgs, targetMethod.getParameterTypes());
    Object result = targetMethod.invoke(targetInstance, convertedArgs);
    System.out.print(toJson(result));
  }

  private static String readAll(InputStream in) throws IOException {
    StringBuilder sb = new StringBuilder();
    byte[] buffer = new byte[4096];
    int read;
    while ((read = in.read(buffer)) != -1) {
      sb.append(new String(buffer, 0, read, java.nio.charset.StandardCharsets.UTF_8));
    }
    return sb.toString();
  }

  private static Method resolveMethod(Class<?> cls, int argCount, String[] candidates) {
    for (String candidate : candidates) {
      if (candidate == null || candidate.isEmpty()) continue;

      for (Method method : cls.getDeclaredMethods()) {
        if (!method.getName().equals(candidate)) continue;
        if (method.getParameterCount() != argCount) continue;
        method.setAccessible(true);
        return method;
      }
    }

    for (Method method : cls.getDeclaredMethods()) {
      if ("main".equals(method.getName())) continue;
      if (method.getParameterCount() != argCount) continue;
      method.setAccessible(true);
      return method;
    }

    return null;
  }

  private static Object[] convertArgs(List<?> rawArgs, Class<?>[] paramTypes) {
    Object[] converted = new Object[paramTypes.length];
    for (int i = 0; i < paramTypes.length; i++) {
      Object raw = i < rawArgs.size() ? rawArgs.get(i) : null;
      converted[i] = convertValue(raw, paramTypes[i]);
    }
    return converted;
  }

  private static Object convertValue(Object value, Class<?> targetType) {
    if (targetType == Object.class) return value;

    if (value == null) {
      return defaultValueForPrimitive(targetType);
    }

    if (targetType.isArray()) {
      if (!(value instanceof List<?>)) {
        throw new RuntimeException("Expected array-like input for " + targetType.getTypeName());
      }

      List<?> list = (List<?>) value;
      Class<?> componentType = targetType.getComponentType();
      Object array = Array.newInstance(componentType, list.size());

      for (int i = 0; i < list.size(); i++) {
        Array.set(array, i, convertValue(list.get(i), componentType));
      }

      return array;
    }

    if (List.class.isAssignableFrom(targetType)) {
      if (value instanceof List<?>) {
        return new ArrayList<>((List<?>) value);
      }
      return new ArrayList<>(Collections.singletonList(value));
    }

    if (Map.class.isAssignableFrom(targetType)) {
      if (value instanceof Map<?, ?>) {
        return new LinkedHashMap<>((Map<?, ?>) value);
      }
      throw new RuntimeException("Expected object-like input for " + targetType.getTypeName());
    }

    if (targetType == String.class) {
      return String.valueOf(value);
    }

    if (targetType == char.class || targetType == Character.class) {
      String s = String.valueOf(value);
      return s.isEmpty() ? '\\0' : s.charAt(0);
    }

    if (targetType == boolean.class || targetType == Boolean.class) {
      if (value instanceof Boolean) return value;
      if (value instanceof Number) return ((Number) value).doubleValue() != 0.0;
      return Boolean.parseBoolean(String.valueOf(value));
    }

    if (targetType == int.class || targetType == Integer.class) {
      return toNumber(value).intValue();
    }

    if (targetType == long.class || targetType == Long.class) {
      return toNumber(value).longValue();
    }

    if (targetType == double.class || targetType == Double.class) {
      return toNumber(value).doubleValue();
    }

    if (targetType == float.class || targetType == Float.class) {
      return toNumber(value).floatValue();
    }

    if (targetType == short.class || targetType == Short.class) {
      return toNumber(value).shortValue();
    }

    if (targetType == byte.class || targetType == Byte.class) {
      return toNumber(value).byteValue();
    }

    return value;
  }

  private static Number toNumber(Object value) {
    if (value instanceof Number) return (Number) value;
    return Double.parseDouble(String.valueOf(value));
  }

  private static Object defaultValueForPrimitive(Class<?> targetType) {
    if (!targetType.isPrimitive()) return null;
    if (targetType == boolean.class) return false;
    if (targetType == char.class) return '\\0';
    if (targetType == byte.class) return (byte) 0;
    if (targetType == short.class) return (short) 0;
    if (targetType == int.class) return 0;
    if (targetType == long.class) return 0L;
    if (targetType == float.class) return 0f;
    if (targetType == double.class) return 0d;
    return null;
  }

  private static String toJson(Object value) {
    if (value == null) return "null";

    if (value instanceof String) {
      return "\\\"" + escapeJson((String) value) + "\\\"";
    }

    if (value instanceof Number || value instanceof Boolean) {
      return String.valueOf(value);
    }

    Class<?> cls = value.getClass();
    if (cls.isArray()) {
      int length = Array.getLength(value);
      StringBuilder sb = new StringBuilder("[");
      for (int i = 0; i < length; i++) {
        if (i > 0) sb.append(',');
        sb.append(toJson(Array.get(value, i)));
      }
      sb.append(']');
      return sb.toString();
    }

    if (value instanceof Iterable<?>) {
      StringBuilder sb = new StringBuilder("[");
      boolean first = true;
      for (Object item : (Iterable<?>) value) {
        if (!first) sb.append(',');
        sb.append(toJson(item));
        first = false;
      }
      sb.append(']');
      return sb.toString();
    }

    if (value instanceof Map<?, ?>) {
      StringBuilder sb = new StringBuilder("{");
      boolean first = true;
      for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {
        if (!first) sb.append(',');
        sb.append("\\\"").append(escapeJson(String.valueOf(entry.getKey()))).append("\\\":");
        sb.append(toJson(entry.getValue()));
        first = false;
      }
      sb.append('}');
      return sb.toString();
    }

    return "\\\"" + escapeJson(String.valueOf(value)) + "\\\"";
  }

  private static String escapeJson(String value) {
    return value
      .replace("\\\\", "\\\\\\\\")
      .replace("\\\"", "\\\\\\\"")
      .replace("\\n", "\\\\n")
      .replace("\\r", "\\\\r")
      .replace("\\t", "\\\\t");
  }

  private static final class JsonParser {
    private final String text;
    private int index;

    JsonParser(String text) {
      this.text = text;
      this.index = 0;
    }

    Object parseValue() {
      skipWhitespace();
      if (index >= text.length()) return null;

      char ch = text.charAt(index);
      if (ch == '"') return parseString();
      if (ch == '[') return parseArray();
      if (ch == '{') return parseObject();
      if (ch == 't') {
        expectLiteral("true");
        return Boolean.TRUE;
      }
      if (ch == 'f') {
        expectLiteral("false");
        return Boolean.FALSE;
      }
      if (ch == 'n') {
        expectLiteral("null");
        return null;
      }
      return parseNumber();
    }

    private List<Object> parseArray() {
      expect('[');
      List<Object> values = new ArrayList<>();
      skipWhitespace();
      if (peek(']')) {
        expect(']');
        return values;
      }

      while (true) {
        values.add(parseValue());
        skipWhitespace();
        if (peek(',')) {
          expect(',');
          continue;
        }
        expect(']');
        break;
      }

      return values;
    }

    private Map<String, Object> parseObject() {
      expect('{');
      Map<String, Object> values = new LinkedHashMap<>();
      skipWhitespace();
      if (peek('}')) {
        expect('}');
        return values;
      }

      while (true) {
        String key = parseString();
        skipWhitespace();
        expect(':');
        Object val = parseValue();
        values.put(key, val);
        skipWhitespace();
        if (peek(',')) {
          expect(',');
          continue;
        }
        expect('}');
        break;
      }

      return values;
    }

    private String parseString() {
      expect('"');
      StringBuilder sb = new StringBuilder();

      while (index < text.length()) {
        char ch = text.charAt(index++);
        if (ch == '"') {
          return sb.toString();
        }

        if (ch == '\\\\') {
          if (index >= text.length()) break;
          char esc = text.charAt(index++);
          switch (esc) {
            case '"': sb.append('"'); break;
            case '\\\\': sb.append('\\\\'); break;
            case '/': sb.append('/'); break;
            case 'b': sb.append('\\b'); break;
            case 'f': sb.append('\\f'); break;
            case 'n': sb.append('\\n'); break;
            case 'r': sb.append('\\r'); break;
            case 't': sb.append('\\t'); break;
            case 'u':
              String hex = text.substring(index, Math.min(index + 4, text.length()));
              index += Math.min(4, text.length() - index);
              sb.append((char) Integer.parseInt(hex, 16));
              break;
            default:
              sb.append(esc);
          }
        } else {
          sb.append(ch);
        }
      }

      throw new RuntimeException("Unterminated string literal in JSON input.");
    }

    private Number parseNumber() {
      int start = index;

      if (peek('-')) index++;
      while (index < text.length() && Character.isDigit(text.charAt(index))) index++;

      boolean isFloat = false;
      if (peek('.')) {
        isFloat = true;
        index++;
        while (index < text.length() && Character.isDigit(text.charAt(index))) index++;
      }

      if (peek('e') || peek('E')) {
        isFloat = true;
        index++;
        if (peek('+') || peek('-')) index++;
        while (index < text.length() && Character.isDigit(text.charAt(index))) index++;
      }

      String token = text.substring(start, index);
      try {
        if (isFloat) {
          return Double.parseDouble(token);
        }
        return Integer.parseInt(token);
      } catch (NumberFormatException intEx) {
        try {
          return Long.parseLong(token);
        } catch (NumberFormatException longEx) {
          return Double.parseDouble(token);
        }
      }
    }

    private void skipWhitespace() {
      while (index < text.length()) {
        char ch = text.charAt(index);
        if (ch == ' ' || ch == '\\n' || ch == '\\r' || ch == '\\t') {
          index++;
          continue;
        }
        break;
      }
    }

    private void expect(char expected) {
      skipWhitespace();
      if (index >= text.length() || text.charAt(index) != expected) {
        throw new RuntimeException("Invalid JSON input.");
      }
      index++;
    }

    private void expectLiteral(String literal) {
      skipWhitespace();
      if (!text.startsWith(literal, index)) {
        throw new RuntimeException("Invalid JSON input.");
      }
      index += literal.length();
    }

    private boolean peek(char expected) {
      return index < text.length() && text.charAt(index) == expected;
    }
  }
}
`;
}

function buildPythonLegacyCompatSource(sourceCode: string, functionName: string): string {
  const escapedFnName = escapePythonString(functionName);

  return `${sourceCode}

if __name__ == "__main__":
    import ast
    import json
    import sys

    __edu_raw = sys.stdin.read().strip()
    if __edu_raw:
        try:
            __edu_input = json.loads(__edu_raw)
        except Exception:
            try:
                __edu_input = ast.literal_eval(__edu_raw)
            except Exception:
                __edu_input = __edu_raw
    else:
        __edu_input = None

    __edu_fn = globals().get("${escapedFnName}")
    if callable(__edu_fn):
        import inspect
        __edu_sig = inspect.signature(__edu_fn)
        __edu_params = list(__edu_sig.parameters.values())
        __edu_positional = [
            p for p in __edu_params
            if p.kind in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD)
        ]
        __edu_has_varargs = any(p.kind == inspect.Parameter.VAR_POSITIONAL for p in __edu_params)

        if isinstance(__edu_input, dict):
            try:
                __edu_result = __edu_fn(**__edu_input)
            except TypeError:
                __edu_result = __edu_fn(__edu_input)
        elif isinstance(__edu_input, list):
            if __edu_has_varargs or len(__edu_positional) > 1:
                __edu_result = __edu_fn(*__edu_input)
            else:
                __edu_result = __edu_fn(__edu_input)
        elif __edu_input is None:
            __edu_result = __edu_fn()
        else:
            __edu_result = __edu_fn(__edu_input)

        if isinstance(__edu_result, (dict, list, tuple, bool, int, float, str)) or __edu_result is None:
            print(json.dumps(__edu_result, ensure_ascii=False))
        else:
            print(str(__edu_result))
`;
}

function buildJavascriptLegacyCompatSource(sourceCode: string, functionName: string): string {
  const quotedFnName = JSON.stringify(functionName);

  return `${sourceCode}

;(async () => {
  const __edu_fn_name = ${quotedFnName};

  let __edu_raw = "";
  try {
    __edu_raw = require("fs").readFileSync(0, "utf8").trim();
  } catch {
    __edu_raw = "";
  }

  let __edu_input = null;
  if (__edu_raw.length) {
    try {
      __edu_input = JSON.parse(__edu_raw);
    } catch {
      __edu_input = __edu_raw;
    }
  }

  let __edu_fn;
  try {
    __edu_fn = eval(__edu_fn_name);
  } catch {
    __edu_fn = undefined;
  }

  if (typeof __edu_fn === "function") {
    let __edu_result;

    if (Array.isArray(__edu_input)) {
      if (__edu_fn.length <= 1) {
        __edu_result = await __edu_fn(__edu_input);
      } else {
        __edu_result = await __edu_fn(...__edu_input);
      }
    } else if (typeof __edu_input === "undefined" || __edu_input === null) {
      __edu_result = await __edu_fn();
    } else {
      __edu_result = await __edu_fn(__edu_input);
    }

    if (typeof __edu_result === "string") {
      console.log(__edu_result);
      return;
    }

    try {
      console.log(JSON.stringify(__edu_result));
    } catch {
      console.log(String(__edu_result));
    }
  }
})();
`;
}

function buildExecutionSource(code: string, runtimeLanguage: string, functionName?: string): string {
  const runtime = normalizeLang(runtimeLanguage);
  const legacyFunctionName = detectLegacyFunctionName(code, runtimeLanguage, functionName);

  if (!legacyFunctionName) return code;

  if ((runtime.includes("python") || runtime === "py") && !hasPythonStdinHandling(code)) {
    return buildPythonLegacyCompatSource(code, legacyFunctionName);
  }

  if ((runtime.includes("javascript") || runtime.includes("typescript") || runtime === "js" || runtime === "ts") && !hasJavascriptStdinHandling(code)) {
    return buildJavascriptLegacyCompatSource(code, legacyFunctionName);
  }

  return code;
}

function normalizeStdoutValue(stdout: string | null | undefined): unknown {
  const value = (stdout ?? "").replace(/\r\n/g, "\n").trim();
  if (!value) return "";
  return parseDataLiteral(value);
}

function formatSubmissionError(payload: Judge0ExecuteResponse | { error?: string; details?: unknown }): string {
  if ("error" in payload && payload.error) {
    if (typeof payload.details === "string") {
      return `${payload.error}\n${payload.details}`;
    }
    if (payload.details) {
      return `${payload.error}\n${JSON.stringify(payload.details)}`;
    }
    return payload.error;
  }

  const runPayload = payload as Judge0ExecuteResponse;
  const statusDesc = runPayload.status?.description ?? "Execution failed";
  return runPayload.compile_output || runPayload.stderr || runPayload.message || statusDesc;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CodeTest({ data }: { data: CodeTestData }) {
  const [activeTab, setActiveTab] = useState<"testCases" | "results" | "feedback">("testCases");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const editorRef = useRef<{ setValue: (value: string) => void } | null>(null);

  const preferredLanguage = useMemo(() => {
    if (data.selectedLanguage) return data.selectedLanguage;
    const first = Object.keys(data.languageContents ?? {})[0] || Object.keys(data.additionalFiles ?? {})[0];
    return first || "Python";
  }, [data.additionalFiles, data.selectedLanguage, data.languageContents]);

  const availableLanguages = useMemo(
    () => Array.from(new Set([
      ...Object.keys(data.languageContents ?? {}),
      ...Object.keys(data.additionalFiles ?? {}),
    ])),
    [data.additionalFiles, data.languageContents],
  );

  const [selectedLanguage, setSelectedLanguage] = useState(preferredLanguage);

  useEffect(() => {
    if (!availableLanguages.length) {
      if (selectedLanguage !== preferredLanguage) {
        setSelectedLanguage(preferredLanguage);
      }
      return;
    }

    if (!availableLanguages.includes(selectedLanguage)) {
      setSelectedLanguage(preferredLanguage);
    }
  }, [availableLanguages, preferredLanguage, selectedLanguage]);

  const languageEditorConfig = useMemo(
    () => resolveLanguageEditorConfig(data.languageContents, data.additionalFiles, selectedLanguage),
    [data.additionalFiles, data.languageContents, selectedLanguage],
  );

  const defaultMainCode = languageEditorConfig.mainContent;
  const runtimeLanguage = languageEditorConfig.runtimeLanguage;
  const mainFileName = languageEditorConfig.mainFileName;

  const defaultEditableFiles = useMemo(
    () => buildDefaultEditableFiles(data.additionalFiles, selectedLanguage, runtimeLanguage, mainFileName, defaultMainCode),
    [data.additionalFiles, selectedLanguage, runtimeLanguage, mainFileName, defaultMainCode],
  );

  const [editorFiles, setEditorFiles] = useState<Record<string, EditableCodeFile>>(defaultEditableFiles);
  const [activeFileName, setActiveFileName] = useState(mainFileName);

  const visibleFileNames = useMemo(() => {
    const names = Object.entries(editorFiles)
      .filter(([, file]) => !file.hidden)
      .map(([name]) => name);

    if (names.includes(mainFileName)) {
      return [mainFileName, ...names.filter((name) => name !== mainFileName)];
    }

    return names;
  }, [editorFiles, mainFileName]);

  const activeFile = editorFiles[activeFileName] ?? editorFiles[mainFileName] ?? null;
  const activeEditorCode = activeFile?.content ?? "";
  const activeEditorLanguage = activeFile?.language ?? runtimeLanguage;

  const [runState, setRunState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [runError, setRunError] = useState<string | null>(null);
  const [runResults, setRunResults] = useState<RunCaseResult[]>([]);
  const [runtimeSeconds, setRuntimeSeconds] = useState<string | null>(null);
  const [memoryKb, setMemoryKb] = useState<number | null>(null);

  const publicCases = useMemo(
    () => parseYamlTestCases(data.publicTestCases?.content || ""),
    [data.publicTestCases?.content],
  );

  const privateCases = useMemo(
    () => parseYamlTestCases(data.privateTestCases?.content || ""),
    [data.privateTestCases?.content],
  );

  const testCases = useMemo(() => [...publicCases, ...privateCases], [publicCases, privateCases]);

  const [activeTestIndex, setActiveTestIndex] = useState(0);

  useEffect(() => {
    setEditorFiles(defaultEditableFiles);
    setActiveFileName(mainFileName);
    setRunState("idle");
    setRunError(null);
    setRunResults([]);
    setRuntimeSeconds(null);
    setMemoryKb(null);
    setActiveTestIndex(0);
  }, [defaultEditableFiles, data.comp_id, mainFileName]);

  useEffect(() => {
    if (activeFileName in editorFiles) {
      return;
    }

    const fallback = visibleFileNames[0] || mainFileName;
    if (fallback) {
      setActiveFileName(fallback);
    }
  }, [activeFileName, editorFiles, mainFileName, visibleFileNames]);

  useEffect(() => {
    if (activeTestIndex >= testCases.length && testCases.length > 0) {
      setActiveTestIndex(0);
    }
  }, [activeTestIndex, testCases.length]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  const handleReset = () => {
    setEditorFiles(defaultEditableFiles);
    setActiveFileName(mainFileName);
    setRunState("idle");
    setRunError(null);
    setRunResults([]);
    setRuntimeSeconds(null);
    setMemoryKb(null);
  };

  const passedCount = useMemo(
    () => runResults.filter((r) => r.passed).length,
    [runResults],
  );

  const handleRun = useCallback(async () => {
    setActiveTab("results");
    setRunState("running");
    setRunError(null);
    setRuntimeSeconds(null);
    setMemoryKb(null);
    setRunResults([]);

    if (!testCases.length) {
      setRunState("error");
      setRunError("No test cases found in the component JSON.");
      return;
    }

    try {
      const judge0Languages = await fetchJudge0Languages();
      const languageId = resolveJudge0LanguageId(judge0Languages, selectedLanguage, runtimeLanguage);
      if (!languageId) {
        throw new Error(
          `Could not match '${selectedLanguage}' (${runtimeLanguage}) with a supported Judge0 language.`,
        );
      }

      const mainFile = editorFiles[mainFileName];
      if (!mainFile) {
        throw new Error(`Main file '${mainFileName}' is missing from the editor bundle.`);
      }

      const runtime = normalizeLang(runtimeLanguage);
      let sourceForExecution = buildExecutionSource(mainFile.content, runtimeLanguage, data.functionName);
      let sharedAdditionalFiles = buildAdditionalFilesPayload(editorFiles, mainFileName);

      if (runtime.includes("java") && !hasJavaMainEntrypoint(sourceForExecution)) {
        const javaClassName = detectJavaClassName(mainFile.content, mainFileName);
        const javaMethodCandidates = buildJavaMethodCandidates(mainFile.content, data.functionName);
        const javaSourceFileName = `${javaClassName}.java`;

        sourceForExecution = buildJavaCompatibilityMainSource(javaClassName, javaMethodCandidates);
        sharedAdditionalFiles = {
          ...sharedAdditionalFiles,
          [javaSourceFileName]: mainFile.content,
        };
      }

      const batchResponse = await fetch("/api/code-test/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sharedAdditionalFiles: Object.keys(sharedAdditionalFiles).length
            ? sharedAdditionalFiles
            : undefined,
          submissions: testCases.map((tc) => ({
            language_id: languageId,
            source_code: sourceForExecution,
            stdin: buildStdinPayloadFromCase(tc),
          })),
        }),
      });

      const batchPayload = (await batchResponse.json().catch(() => ({}))) as
        | Judge0BatchExecuteResponse
        | { error?: string; details?: unknown };

      if (!batchResponse.ok) {
        const errorPayload = batchPayload as { error?: string; details?: unknown };
        const details = typeof errorPayload.details === "string"
          ? errorPayload.details
          : errorPayload.details
            ? JSON.stringify(errorPayload.details)
            : "";
        throw new Error([errorPayload.error || "Execution request failed.", details].filter(Boolean).join("\n"));
      }

      const submissions = (batchPayload as Judge0BatchExecuteResponse).submissions;
      if (!Array.isArray(submissions) || submissions.length !== testCases.length) {
        throw new Error("Execution succeeded, but batch results are incomplete.");
      }

      let totalRuntime = 0;
      let hasRuntime = false;
      let peakMemory = 0;
      let hasMemory = false;

      const parsedResults: RunCaseResult[] = submissions.map((submission, idx) => {
        const tc = testCases[idx];
        const output = submission as Judge0ExecuteResponse;

        if (typeof output.time === "string") {
          const numeric = Number(output.time);
          if (!Number.isNaN(numeric)) {
            totalRuntime += numeric;
            hasRuntime = true;
          }
        }

        if (typeof output.memory === "number") {
          peakMemory = Math.max(peakMemory, output.memory);
          hasMemory = true;
        }

        const statusId = output.status?.id ?? 0;
        const actualValue = normalizeStdoutValue(output.stdout);

        if (statusId !== 3) {
          return {
            name: tc.name,
            input: tc.inputValue,
            expected: tc.expectedValue,
            actual: actualValue,
            passed: false,
            error: formatSubmissionError(submission),
          };
        }

        const passed = deepEqual(actualValue, tc.expectedValue);
        return {
          name: tc.name,
          input: tc.inputValue,
          expected: tc.expectedValue,
          actual: actualValue,
          passed,
        };
      });

      setRuntimeSeconds(hasRuntime ? totalRuntime.toFixed(3) : null);
      setMemoryKb(hasMemory ? peakMemory : null);
      setRunResults(parsedResults);
      setRunState("done");

      const firstFailed = parsedResults.findIndex((r) => !r.passed);
      setActiveTestIndex(firstFailed >= 0 ? firstFailed : 0);
    } catch (error) {
      setRunState("error");
      setRunError(error instanceof Error ? error.message : "Unknown execution error");
    }
  }, [data.functionName, editorFiles, mainFileName, runtimeLanguage, selectedLanguage, testCases]);

  const activeResult = runResults[activeTestIndex];

  return (
    <div className={isFullscreen
      ? "fixed inset-0 z-50 flex flex-col overflow-hidden bg-white dark:bg-gray-900 shadow-sm font-sans"
      : "w-full max-w-5xl mx-auto rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 shadow-sm font-sans flex flex-col"
    }>
      {/* ─── Top Bar ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
        <div className="flex items-center gap-2">
          <div className="text-yellow-500 w-5 h-5 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8" /></svg>
          </div>
          {availableLanguages.length > 1 ? (
            <select
              value={selectedLanguage}
              onChange={(event) => setSelectedLanguage(event.target.value)}
              className="text-sm font-medium bg-transparent border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-gray-700 dark:text-gray-200"
            >
              {availableLanguages.map((language) => (
                <option key={language} value={language}>{language}</option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {selectedLanguage}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
          <button title="Help" className="hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors">
            <HelpIcon />
          </button>
          <button title="Reset Code" onClick={handleReset} className="hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors">
            <ResetIcon />
          </button>
          <button title="Toggle Fullscreen" onClick={() => setIsFullscreen((v) => !v)} className="hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors">
            {isFullscreen ? <ExitFullScreenIcon /> : <FullScreenIcon />}
          </button>
        </div>
      </div>

      {/* ─── Editor Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e1e] border-b border-[#333] text-gray-400 text-xs font-mono">
        <div className="flex items-center gap-2">
          <CodeIcon />
          <span className="text-gray-200 font-medium">{activeFileName}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="text-gray-500 font-bold">{"{}"}</span> <CloudCheckIcon /> <span className="text-gray-400">Saved</span></span>
          <span className="text-gray-600">|</span>
          <ChevronUpIcon />
        </div>
      </div>

      {/* ─── Monaco Editor ──────────────────────────────────────── */}
      <div className="h-80 w-full flex border-b border-[#333]">
        <div className="w-52 shrink-0 bg-[#171921] border-r border-[#2a2d3a] overflow-y-auto">
          <div className="px-4 py-3 text-xs uppercase tracking-wide text-gray-400 border-b border-[#2a2d3a]">Files</div>
          <div className="p-2 space-y-1">
            {visibleFileNames.map((name) => {
              const isActive = name === activeFileName;

              return (
                <button
                  key={name}
                  onClick={() => setActiveFileName(name)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors cursor-pointer ${isActive
                    ? "bg-[#2a304a] text-gray-100"
                    : "text-gray-300 hover:bg-[#20253e]"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 relative group">
          <MonacoEditor
            height="100%"
            language={activeEditorLanguage === "python3" ? "python" : activeEditorLanguage}
            theme="vs-dark"
            value={activeEditorCode}
            onChange={(v) => {
              const value = v || "";
              setEditorFiles((prev) => {
                const current = prev[activeFileName];
                if (!current) return prev;

                return {
                  ...prev,
                  [activeFileName]: {
                    ...current,
                    content: value,
                  },
                };
              });
            }}
            onMount={(editor) => {
              editorRef.current = editor as unknown as { setValue: (value: string) => void };
            }}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 14,
              padding: { top: 16 },
            }}
          />

          <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleRun}
              disabled={runState === "running"}
              className="px-4 py-2 bg-[#20253e] hover:bg-[#2a304a] disabled:opacity-60 disabled:cursor-not-allowed text-gray-200 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors border border-[#2a304a] cursor-pointer"
            >
              <PlayIcon /> {runState === "running" ? "Running" : "Run"}
            </button>
            <button
              onClick={handleRun}
              disabled={runState === "running"}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors border border-indigo-700 cursor-pointer"
            >
              Submit
            </button>
          </div>
        </div>
      </div>

      {/* ─── Bottom Tabs ────────────────────────────────────────── */}
      <div className={`border-t border-gray-200 dark:border-[#333] bg-white dark:bg-gray-900 flex flex-col ${isFullscreen ? "flex-1" : "h-64"}`}>
        <div className="flex border-b border-gray-200 dark:border-[#333]">
          <button
            onClick={() => setActiveTab("testCases")}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${activeTab === "testCases" ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
          >
            <CheckIcon /> Test Cases
          </button>
          <button
            onClick={() => setActiveTab("results")}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${activeTab === "results" ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" : "border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"}`}
          >
            <ResultsIcon /> Results
          </button>
          <button
            onClick={() => setActiveTab("feedback")}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${activeTab === "feedback" ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" : "border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"}`}
          >
            <CodeIcon /> Code Feedback
          </button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === "testCases" && (
            <div className="space-y-6">
              <div className="flex gap-2 flex-wrap">
                {testCases.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveTestIndex(idx)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors border cursor-pointer ${activeTestIndex === idx ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-600/50" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-[#1a1f35] dark:text-gray-300 dark:border-[#2a304a] dark:hover:bg-[#20253e]"}`}
                  >
                    Case {idx + 1}
                  </button>
                ))}
              </div>

              {testCases[activeTestIndex] ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Inputs</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded font-mono text-sm dark:bg-gray-800 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                      {testCases[activeTestIndex].inputRaw}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Expected Output</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded font-mono text-sm dark:bg-gray-800 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                      {testCases[activeTestIndex].expectedRaw}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">No test cases found in JSON.</div>
              )}
            </div>
          )}

          {activeTab === "results" && (
            <div className="space-y-4">
              {runState === "idle" && (
                <div className="h-40 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm italic">
                  Run the code to see results.
                </div>
              )}

              {runState === "running" && (
                <div className="h-40 flex items-center justify-center text-indigo-500 text-sm animate-pulse">
                  Running tests...
                </div>
              )}

              {runState === "error" && (
                <div className="border border-red-200 dark:border-red-900/50 bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
                  <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-500 font-medium text-sm">
                      <ErrorIcon /> Execution Error
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="px-3 py-2 bg-red-50/50 text-red-600 border border-red-200 rounded font-mono text-sm whitespace-pre-wrap dark:bg-red-500/5 dark:text-red-400 dark:border-red-900/40">
                      {runError || "Execution failed."}
                    </div>
                  </div>
                </div>
              )}

              {runState === "done" && (
                <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
                  <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <div className={`flex items-center gap-2 font-medium text-sm ${passedCount === runResults.length ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-500"}`}>
                      {passedCount === runResults.length ? <CheckIcon /> : <ErrorIcon />} {passedCount} / {runResults.length} Test Cases Passed
                    </div>
                    <div className="flex items-center gap-3">
                      {runtimeSeconds && <span className="text-xs text-gray-500">Runtime: {runtimeSeconds}s</span>}
                      {typeof memoryKb === "number" && <span className="text-xs text-gray-500">Memory: {memoryKb} KB</span>}
                    </div>
                  </div>

                  {activeResult && (
                    <div className="p-5 space-y-4">
                      <div className="flex border-b border-gray-100 dark:border-gray-800 pb-3">
                        <span className="w-24 text-sm font-medium text-gray-700 dark:text-gray-300 pt-1">Input</span>
                        <div className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded font-mono text-sm dark:bg-gray-950 dark:border-gray-800 text-gray-600 dark:text-gray-400 font-normal whitespace-pre-wrap break-all">
                          {stringifyValue(activeResult.input)}
                        </div>
                      </div>

                      <div className="flex border-b border-gray-100 dark:border-gray-800 pb-3">
                        <span className="w-24 text-sm font-medium text-gray-700 dark:text-gray-300 pt-1">Output</span>
                        <div className={`flex-1 px-3 py-2 border rounded font-mono text-sm whitespace-pre-wrap break-all ${activeResult.passed
                          ? "bg-green-50/50 text-green-700 border-green-200 dark:bg-green-500/5 dark:text-green-400 dark:border-green-800/40"
                          : "bg-red-50/50 text-red-600 border-red-200 dark:bg-red-500/5 dark:text-red-400 dark:border-red-900/40"
                        }`}>
                          {activeResult.error ? `Error: ${activeResult.error}` : stringifyValue(activeResult.actual)}
                        </div>
                      </div>

                      <div className="flex pb-1">
                        <span className="w-24 text-sm font-medium text-gray-700 dark:text-gray-300 pt-1">Expected</span>
                        <div className="flex-1 px-3 py-2 bg-green-50/50 text-green-700 border border-green-200 rounded font-mono text-sm whitespace-pre-wrap break-all dark:bg-green-500/5 dark:text-green-400 dark:border-green-800/40">
                          {stringifyValue(activeResult.expected)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "feedback" && (
            <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm italic">
              AI Code Feedback will appear here.
            </div>
          )}
        </div>
      </div>

      {data.caption && (
        <div className="p-3 bg-gray-50 border-t border-gray-200 dark:bg-gray-900 dark:border-[#333] flex justify-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{data.caption}</span>
        </div>
      )}
    </div>
  );
}
