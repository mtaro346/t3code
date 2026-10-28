// @effect-diagnostics nodeBuiltinImport:off - Vite plugin runs before any Effect runtime.
import * as NodePath from "node:path";

import type { Plugin } from "vite-plus";

import dictionary from "./ja.json" with { type: "json" };
import {
  collectComparedLiterals,
  isTranslatedSource,
  listSourceFiles,
  translateSource,
} from "./translate";

const repoRoot = NodePath.resolve(import.meta.dirname, "../../../..");

// Off under Vitest so upstream tests keep asserting the English source text.
export function japanesePlugin(): Plugin {
  let comparedLiterals = new Set<string>();
  return {
    name: "t3code-ja:translate",
    enforce: "pre",
    apply: () => !process.env.VITEST,
    buildStart() {
      comparedLiterals = collectComparedLiterals(listSourceFiles(repoRoot));
    },
    transform(code, id) {
      const path = id.split("?")[0] ?? id;
      if (!isTranslatedSource(path)) return null;
      const result = translateSource(code, path, dictionary, comparedLiterals);
      return result.changed ? { code: result.code, map: null } : null;
    },
    transformIndexHtml: (html) => html.replace('<html lang="en">', '<html lang="ja">'),
  };
}
