// Lists UI text the dictionary does not cover yet: `node apps/web/vite/ja/extract.ts`.
// Prints a JSON array of English keys; an empty array means the build is fully translated.
// @effect-diagnostics nodeBuiltinImport:off - Standalone maintenance script.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import dictionary from "./ja.json" with { type: "json" };
import { collectComparedLiterals, listSourceFiles, translateSource } from "./translate.ts";

const files = listSourceFiles(NodePath.resolve(import.meta.dirname, "../../../.."));
const compared = collectComparedLiterals(files);
const missing = new Set(
  files.flatMap(
    (file) =>
      translateSource(NodeFS.readFileSync(file, "utf8"), file, dictionary, compared).missing,
  ),
);
console.log(JSON.stringify([...missing].toSorted(), null, 2));
