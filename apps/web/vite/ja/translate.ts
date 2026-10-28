// Build-time Japanese localization: rewrites English UI literals using ja.json so upstream
// source stays untouched. Keys are the English text; `{0}`, `{1}` stand for interpolations
// in source order (template expressions or non-text JSX children).
// @effect-diagnostics nodeBuiltinImport:off - Build tooling, runs in Node before any Effect runtime.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import { parseSync } from "vite-plus";

type AstNode = { type: string; start: number; end: number; [key: string]: unknown };
type Edit = { start: number; end: number; text: string };

export type Dictionary = Readonly<Record<string, string>>;
export interface TranslateResult {
  code: string;
  changed: boolean;
  missing: string[];
  /** Literals used as keys or comparands; translating them elsewhere would break lookups. */
  compared: string[];
}

const SKIP_ATTRIBUTES = new Set([
  "className",
  "id",
  "key",
  "href",
  "to",
  "src",
  "type",
  "name",
  "value",
  "defaultValue",
  "role",
  "htmlFor",
  "rel",
  "target",
  "method",
  "variant",
  "size",
  "side",
  "align",
  "lang",
  "autoComplete",
  "inputMode",
  "d",
  "transform",
  "viewBox",
  "points",
  "fill",
  "stroke",
  "xmlns",
]);
const SKIP_PROPERTIES = new Set([
  "id",
  "key",
  "type",
  "kind",
  "value",
  "to",
  "href",
  "className",
  "variant",
  "size",
  "mode",
  "status",
  "role",
  "icon",
  "path",
  "route",
  "_tag",
  "code",
]);
// Properties whose untranslated values are reported as missing; other literals are only
// replaced when the dictionary already has them.
const TEXT_PROPERTIES = new Set([
  "label",
  "title",
  "description",
  "message",
  "placeholder",
  "tooltip",
  "text",
  "heading",
  "subtitle",
  "detail",
  "hint",
  "emptyText",
  "ariaLabel",
  "confirmLabel",
  "cancelLabel",
  "actionLabel",
  "summary",
]);
// Arguments to these methods are keys, selectors or comparands, never displayed text.
const NON_TEXT_METHODS = new Set([
  "includes",
  "has",
  "get",
  "set",
  "delete",
  "startsWith",
  "endsWith",
  "indexOf",
  "addEventListener",
  "removeEventListener",
  "getAttribute",
  "createElement",
  "querySelector",
  "querySelectorAll",
  "getItem",
  "setItem",
  "removeItem",
  "matches",
  "closest",
  "postMessage",
  "dispatchEvent",
  "on",
  "off",
  "emit",
]);
const COMPARISON_OPERATORS = new Set(["==", "===", "!=", "!==", "in"]);
const LOOKS_LIKE_TEXT = /[A-Za-z]{2}/;
const isReportable = (text: string) => {
  const words = text.replace(/&\w+;|\{\d+\}/g, "");
  return /[A-Za-z][a-z]+/.test(words) && /^[^a-z]|\s/.test(words.trim());
};
// Capitalized text with a space, e.g. a confirm prompt or toast message outside JSX.
const isSentence = (text: string) => /^[A-Z][a-z]*\s+\S/.test(text);
const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  quot: '"',
  lt: "<",
  gt: ">",
  nbsp: "\u00a0",
  rsquo: "\u2019",
  lsquo: "\u2018",
  rdquo: "\u201d",
  ldquo: "\u201c",
  hellip: "\u2026",
  middot: "\u00b7",
  mdash: "\u2014",
  ndash: "\u2013",
};
const decodeEntities = (text: string) =>
  text.replace(/&(\w+);/g, (match, name: string) => ENTITIES[name] ?? match);

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
const isNode = (value: unknown): value is AstNode =>
  typeof value === "object" && value !== null && typeof (value as AstNode).type === "string";

function stringLiteralValue(node: AstNode): string | undefined {
  return node.type === "Literal" && typeof node.value === "string" ? node.value : undefined;
}

function templateKey(node: AstNode): string | undefined {
  const quasis = node.quasis as Array<{ value: { cooked: string | null } }>;
  if (quasis.some((quasi) => quasi.value.cooked === null)) return undefined;
  return quasis
    .map((quasi, index) => (index === 0 ? "" : `{${index - 1}}`) + quasi.value.cooked)
    .join("");
}

function attributeName(node: AstNode): string | undefined {
  const name = node.name as AstNode;
  if (name.type === "JSXIdentifier") return name.name as string;
  return undefined;
}

function propertyName(node: AstNode): string | undefined {
  if (node.computed) return undefined;
  const key = node.key as AstNode;
  if (key.type === "Identifier") return key.name as string;
  return stringLiteralValue(key);
}

const escapeTemplateText = (text: string) => text.replace(/[\\`]|\$\{/g, (match) => `\\${match}`);

// Splits a translation into literal text and `{n}` placeholder indexes.
function splitPlaceholders(translation: string, count: number): Array<string | number> | undefined {
  const parts: Array<string | number> = [];
  const pattern = /\{(\d+)\}/g;
  let last = 0;
  for (const match of translation.matchAll(pattern)) {
    const index = Number(match[1]);
    if (index >= count) return undefined;
    parts.push(translation.slice(last, match.index), index);
    last = match.index + match[0].length;
  }
  parts.push(translation.slice(last));
  return parts.filter((part) => part !== "");
}

export function translateSource(
  code: string,
  filename: string,
  dictionary: Dictionary,
  comparedLiterals: ReadonlySet<string> = new Set(),
): TranslateResult {
  let program: AstNode;
  try {
    const parsed = parseSync(filename, code, { lang: filename.endsWith(".tsx") ? "tsx" : "ts" });
    if (parsed.errors.length > 0) return { code, changed: false, missing: [], compared: [] };
    program = parsed.program as unknown as AstNode;
  } catch {
    return { code, changed: false, missing: [], compared: [] };
  }

  const edits: Edit[] = [];
  const missing: string[] = [];
  const compared: string[] = [];
  // Text inside a sentence that was already reported as one key.
  const reportedInSentence = new Set<AstNode>();
  const source = (node: AstNode) => code.slice(node.start, node.end);

  const replaceTemplate = (node: AstNode, translation: string): boolean => {
    const expressions = node.expressions as AstNode[];
    const parts = splitPlaceholders(translation, expressions.length);
    if (!parts) return false;
    const body = parts
      .map((part) => {
        if (typeof part === "string") return escapeTemplateText(part);
        const expression = expressions[part];
        return expression ? `\${${source(expression)}}` : "";
      })
      .join("");
    edits.push({ start: node.start, end: node.end, text: `\`${body}\`` });
    return true;
  };

  // Translates a run of JSX children such as `Open {name} in the browser` as one sentence.
  // Icons and other elements before the first or after the last text stay outside the run.
  const translateChildren = (node: AstNode): boolean => {
    const children = (node.children as AstNode[]).filter(
      (child) =>
        !(
          child.type === "JSXExpressionContainer" &&
          (child.expression as AstNode).type === "JSXEmptyExpression"
        ),
    );
    const textOf = (child: AstNode): string | undefined =>
      child.type === "JSXText"
        ? decodeEntities(child.value as string)
        : child.type === "JSXExpressionContainer"
          ? stringLiteralValue(child.expression as AstNode)
          : undefined;
    const isWords = (child: AstNode) => LOOKS_LIKE_TEXT.test(textOf(child) ?? "");
    const firstIndex = children.findIndex(isWords);
    const lastIndex = children.findLastIndex(isWords);
    if (firstIndex === -1) return false;
    const run = children.slice(firstIndex, lastIndex + 1);
    const placeholders = run.filter((child) => textOf(child) === undefined);
    if (placeholders.length === 0) return false;
    const key = normalize(
      run.map((child) => textOf(child) ?? `{${placeholders.indexOf(child)}}`).join(""),
    );
    const translation = dictionary[key];
    const parts =
      translation === undefined ? undefined : splitPlaceholders(translation, placeholders.length);
    const first = run[0];
    const last = run.at(-1);
    if (!parts || !first || !last) {
      if (translation === undefined && isReportable(key)) {
        missing.push(key);
        for (const child of run) reportedInSentence.add(child);
      }
      return false;
    }
    const text = parts
      .map((part) => {
        if (typeof part === "string") return `{${JSON.stringify(part)}}`;
        const placeholder = placeholders[part];
        return placeholder ? source(placeholder) : "";
      })
      .join("");
    edits.push({ start: first.start, end: last.end, text });
    for (const child of [...children.slice(0, firstIndex), ...children.slice(lastIndex + 1)]) {
      walk(child, node, "children");
    }
    return true;
  };

  // Returns true when the node was rewritten as a whole and its children must be skipped.
  const visit = (node: AstNode, parent: AstNode | undefined, parentKey: string): boolean => {
    if (
      node.type.startsWith("TS") &&
      node.type !== "TSAsExpression" &&
      node.type !== "TSSatisfiesExpression" &&
      node.type !== "TSNonNullExpression"
    ) {
      return true;
    }
    if ((node.type === "JSXElement" || node.type === "JSXFragment") && translateChildren(node))
      return true;

    if (node.type === "JSXText") {
      const raw = node.value as string;
      const key = normalize(decodeEntities(raw));
      if (!LOOKS_LIKE_TEXT.test(key)) return true;
      const translation = dictionary[key];
      if (translation === undefined) {
        if (isReportable(key) && !reportedInSentence.has(node)) missing.push(key);
        return true;
      }
      const leading = raw.match(/^\s*/)?.[0] ?? "";
      const trailing = raw.match(/\s*$/)?.[0] ?? "";
      edits.push({
        start: node.start,
        end: node.end,
        text: `${leading}{${JSON.stringify(translation)}}${trailing}`,
      });
      return true;
    }

    if (node.type === "JSXAttribute") {
      const name = attributeName(node);
      const value = node.value as AstNode | null;
      if (!name || !value || SKIP_ATTRIBUTES.has(name) || /^data-|ClassName$/.test(name))
        return true;
      const literal = stringLiteralValue(value);
      if (literal === undefined) return false;
      const translation = dictionary[literal];
      if (translation !== undefined) {
        edits.push({
          start: value.start,
          end: value.end,
          text: `{${JSON.stringify(translation)}}`,
        });
      } else if (isReportable(literal) && /[A-Z ]/.test(literal)) {
        missing.push(literal);
      }
      return true;
    }

    const isTextProperty =
      parent?.type === "Property" &&
      parentKey === "value" &&
      TEXT_PROPERTIES.has(propertyName(parent) ?? "");

    if (node.type === "TemplateLiteral") {
      if (parent?.type === "TaggedTemplateExpression") return true;
      const key = templateKey(node);
      if (key === undefined || !LOOKS_LIKE_TEXT.test(key)) return false;
      const translation = dictionary[key];
      if (translation !== undefined && replaceTemplate(node, translation)) return true;
      const isUiTemplate =
        isTextProperty || parent?.type === "JSXExpressionContainer" || isSentence(key);
      if (translation === undefined && isUiTemplate && isReportable(key)) {
        missing.push(key);
      }
      return false;
    }

    const literal = stringLiteralValue(node);
    if (literal === undefined) return false;
    // Outside JSX and text properties, lowercase single words are usually ids or enum values.
    const isUiPosition = isTextProperty || parent?.type === "JSXExpressionContainer";
    if (!isUiPosition && !/^[A-Z]|\s/.test(literal)) return true;
    if (comparedLiterals.has(literal) && parent?.type !== "JSXExpressionContainer") return true;
    const translation = dictionary[literal];
    if (translation !== undefined) {
      edits.push({ start: node.start, end: node.end, text: JSON.stringify(translation) });
    } else if (
      (isTextProperty || isSentence(literal)) &&
      isReportable(literal) &&
      /[A-Z ]/.test(literal)
    ) {
      missing.push(literal);
    }
    return true;
  };

  const isSkippedPosition = (parent: AstNode, parentKey: string): boolean => {
    switch (parent.type) {
      case "ImportDeclaration":
      case "ExportNamedDeclaration":
      case "ExportAllDeclaration":
      case "ImportExpression":
        return parentKey === "source";
      case "Property":
        return parentKey === "key" || SKIP_PROPERTIES.has(propertyName(parent) ?? "");
      case "MemberExpression":
        return parentKey === "property";
      case "BinaryExpression":
        return COMPARISON_OPERATORS.has(parent.operator as string);
      case "CallExpression": {
        const callee = parent.callee as AstNode;
        if (parentKey !== "arguments" || callee.type !== "MemberExpression" || callee.computed)
          return false;
        return NON_TEXT_METHODS.has((callee.property as AstNode).name as string);
      }
      case "SwitchCase":
        return parentKey === "test";
      case "ExpressionStatement":
        return typeof parent.directive === "string";
      default:
        return false;
    }
  };

  function walk(node: AstNode, parent: AstNode | undefined, parentKey: string): void {
    if (parent && isSkippedPosition(parent, parentKey)) {
      const literal = stringLiteralValue(node);
      if (literal !== undefined && parentKey !== "source") compared.push(literal);
      return;
    }
    if (visit(node, parent, parentKey)) return;
    for (const [key, value] of Object.entries(node)) {
      if (Array.isArray(value)) {
        for (const item of value) if (isNode(item)) walk(item, node, key);
      } else if (isNode(value)) {
        walk(value, node, key);
      }
    }
  }
  walk(program, undefined, "");

  if (edits.length === 0) return { code, changed: false, missing, compared };
  let output = code;
  for (const edit of edits.toSorted((a, b) => b.start - a.start)) {
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  }
  return { code: output, changed: true, missing, compared };
}

const SOURCE_ROOTS = ["apps/web/src", "packages/client-runtime/src"];

export const isTranslatedSource = (path: string) =>
  SOURCE_ROOTS.some((root) => path.includes(`/${root}/`)) &&
  /\.tsx?$/.test(path) &&
  !/\.test\.tsx?$/.test(path);

export function listSourceFiles(repoRoot: string): string[] {
  return SOURCE_ROOTS.flatMap((root) =>
    NodeFS.readdirSync(NodePath.join(repoRoot, root), { recursive: true, encoding: "utf8" }).map(
      (file) => NodePath.join(repoRoot, root, file),
    ),
  ).filter(isTranslatedSource);
}

export function collectComparedLiterals(files: ReadonlyArray<string>): Set<string> {
  return new Set(
    files.flatMap((file) => translateSource(NodeFS.readFileSync(file, "utf8"), file, {}).compared),
  );
}
