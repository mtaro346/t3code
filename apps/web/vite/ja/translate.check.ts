// Self-check for the translator: `node apps/web/vite/ja/translate.check.ts`.
import * as NodeAssert from "node:assert/strict";

import { translateSource } from "./translate.ts";

const dictionary = {
  Save: "保存",
  "Open {0} in the browser": "{0} をブラウザーで開く",
  "Expires in {0}s": "あと {0} 秒で期限切れ",
  "Don't show this again": "今後表示しない",
  "Delete thread": "スレッドを削除",
  Files: "ファイル",
  default: "既定",
};
const run = (code: string, compared: ReadonlySet<string> = new Set()) =>
  translateSource(code, "/repo/apps/web/src/Example.tsx", dictionary, compared).code;

// JSX text, attributes, entities, and sentences with placeholders.
NodeAssert.equal(run(`<b> Save </b>`), `<b> {"保存"} </b>`);
NodeAssert.equal(
  run(`<b aria-label="Save" className="Save" />`),
  `<b aria-label={"保存"} className="Save" />`,
);
NodeAssert.equal(run(`<p>Don&apos;t show this again</p>`), `<p>{"今後表示しない"}</p>`);
NodeAssert.equal(
  run(`<p>Open <code>{name}</code> in the browser</p>`),
  `<p><code>{name}</code>{" をブラウザーで開く"}</p>`,
);
NodeAssert.equal(run(`<p><Icon />Save</p>`), `<p><Icon />{"保存"}</p>`);
NodeAssert.equal(
  run(`const s = "日本語 🎌"; <b>Save</b>`),
  `const s = "日本語 🎌"; <b>{"保存"}</b>`,
);

// Template literals keep their expressions in translated order.
NodeAssert.equal(run("const a = `Expires in ${n}s`;"), "const a = `あと ${n} 秒で期限切れ`;");

// Literals outside JSX translate only when they look like UI text and are not keys or comparands.
NodeAssert.equal(
  run(`const a = { title: "Delete thread" };`),
  `const a = { title: "スレッドを削除" };`,
);
NodeAssert.equal(run(`const mode = "default";`), `const mode = "default";`);
NodeAssert.equal(run(`if (kind === "Files") {}`), `if (kind === "Files") {}`);
NodeAssert.equal(run(`types.includes("Files");`), `types.includes("Files");`);
NodeAssert.equal(run(`const a = { type: "Save" };`), `const a = { type: "Save" };`);
NodeAssert.equal(run(`const label = "Files";`, new Set(["Files"])), `const label = "Files";`);
NodeAssert.equal(run(`import x from "Save";`), `import x from "Save";`);
NodeAssert.equal(run(`type A = "Save";`), `type A = "Save";`);

// Untranslated UI text is reported; ids are not.
const missing = translateSource(
  `<p title="Rename thread">Archive thread<span id="thread-row" /></p>`,
  "/repo/apps/web/src/Example.tsx",
  dictionary,
).missing;
NodeAssert.deepEqual(missing.toSorted(), ["Archive thread", "Rename thread"]);

console.log("translate.check: ok");
