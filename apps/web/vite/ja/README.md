# 日本語版 fork

公式 [pingdotgg/t3code](https://github.com/pingdotgg/t3code) の UI を日本語にした fork です。
元のコードは変更しません。`plugin.ts` がビルド時に `ja.json`（英語 → 日本語）で UI 文言を置き換えます。
公式との差分は、このディレクトリ、`apps/web/vite.config.ts` の登録 2 行、`.github/workflows/ja-release.yml`、`CLAUDE.md` の 1 行だけです。

## 公式リリースへの追従

`ja` ブランチは公式の stable タグに日本語化コミットを重ねたものです。公式が `vX.Y.Z` を出したら:

1. `git fetch https://github.com/pingdotgg/t3code.git tag vX.Y.Z` → `git merge vX.Y.Z`（`ja` ブランチ上）
2. コンフリクトは `vite.config.ts` の `japanesePlugin()` 登録だけのはず。公式側を採用してから登録を戻す
3. `node apps/web/vite/ja/extract.ts` で未訳を出し、下のルールで `ja.json` に追加する（キー順を保つ）
4. `node apps/web/vite/ja/translate.check.ts` と `vp run typecheck`（apps/web）と `vp build`（apps/web）を通す
5. `git push origin ja` → `git tag vX.Y.Z-ja && git push origin vX.Y.Z-ja`。タグで `Release (ja)` が dmg を作って公開する

`extract.ts` が `[]` を返せば翻訳は完了です。英語のまま残す文言は、値をキーと同じ文字列にします（再抽出されなくなる）。

## 翻訳ルール

- 訳すのはユーザーに見える文言だけ。エージェント（LLM）に送るプロンプト、ログ専用のメッセージ、識別子、製品名・固有名詞、`{0}` に英単語が入って日本語の文が壊れるものは英語のまま
- 迷ったら英語のまま。誤訳でプロンプトやロジックが変わる方が害が大きい
- `{0}` `{1}` はソースの `${...}` や JSX の子要素を出現順に表す。全部残し、語順に合わせて動かしてよい。新しく作らない
- 長音を付ける: フォルダー、ブラウザー、サーバー、ユーザー、プロバイダー、エディター
- 文はです・ます調。ボタンやメニューは体言止め（Save → 保存、Delete thread → スレッドを削除）
- 英数字と日本語の間に半角スペース（GitHub で開く）
- 用語: thread=スレッド, project=プロジェクト, environment=環境, provider=プロバイダー, worktree=ワークツリー, branch=ブランチ, pull request=プルリクエスト, diff=差分, commit=コミット, turn=ターン, agent=エージェント, composer=入力欄, settings=設定, archive=アーカイブ, snooze=スヌーズ, settle=完了にする（settled=完了済み, un-settle=未完了に戻す）, pin=ピン留め, steer=ステア, queue=キュー, checkpoint=チェックポイント, terminal=ターミナル, model=モデル, skill=スキル, scheduled task=スケジュールタスク, pairing=ペアリング, relay=リレー

## 置き換えの範囲

`translate.ts` は `apps/web/src` と `packages/client-runtime/src` の JSX テキスト、JSX 属性、
`label` / `title` などのテキスト用プロパティ、文に見える文字列とテンプレートを置き換えます。
比較やキーに使われている文字列（`=== "Files"`、`.includes("Files")` など）は、JSX の外では置き換えません。
サーバーが返すメッセージ、Electron のネイティブメニュー、モバイルアプリは対象外です。
