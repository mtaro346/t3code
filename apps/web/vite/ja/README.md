# 日本語版 fork

公式 [pingdotgg/t3code](https://github.com/pingdotgg/t3code) の UI を日本語にした fork です。
元のコードは変更しません。`plugin.ts` がビルド時に `ja.json`（英語 → 日本語）で UI 文言を置き換えます。
公式との差分は、このディレクトリ、`apps/web/vite.config.ts` の登録 2 行、`CLAUDE.md` の 1 行だけです。

## 公式リリースへの追従

`ja` ブランチは公式の stable タグに日本語化コミットを重ねたものです。公式が `vX.Y.Z` を出したら:

1. `git fetch https://github.com/pingdotgg/t3code.git tag vX.Y.Z` → `git merge vX.Y.Z`（`ja` ブランチ上）
2. コンフリクトは `vite.config.ts` の `japanesePlugin()` 登録だけのはず。公式側を採用してから登録を戻す
3. `node apps/web/vite/ja/extract.ts` で未訳を出し、下のルールで `ja.json` に追加する（キー順を保つ）
4. `node apps/web/vite/ja/translate.check.ts` と `vp run typecheck`（apps/web）と `vp build`（apps/web）を通す
5. `git push origin ja` → `git tag -a vX.Y.Z-ja && git push origin vX.Y.Z-ja`
6. Mac で `apps/web/vite/ja/release.sh vX.Y.Z-ja` を実行する。VMPal のビルド用 VM の使い捨てクローンで arm64 の dmg をビルドし、fork の Releases に公開する。`DRY_RUN=1` を付けるとビルドだけ行う

## ビルド用 VM

`release.sh` は、停止中の macOS VM「T3 Code ja build」を `vmpal run` で複製してビルドし、終わったら複製を消します。
作り直すときは、VMPal で macOS VM を作り、その中に次のものを入れて停止しておきます。

- Xcode Command Line Tools（`softwareupdate -i "Command Line Tools for Xcode …"`）
- Node（`package.json` の `engines.node` と同じ版を `~/.local/node` に置き、`~/.zprofile` で PATH を通す）と `npm i -g vite-plus`
- Rust（rustup、`aarch64-apple-darwin` ターゲット。`~/.zprofile` で `~/.cargo/env` を読む）

一度 VM の中でビルドしておくと、pnpm と cargo のキャッシュが残り、次回から複製でのビルドが速くなります（約 3 分）。公式が Node の版を上げたら、ビルド用 VM の Node も合わせます。

配布する dmg は署名していないため、アプリ内の自動更新は無効にしてあります（Squirrel.Mac は署名のないアプリを更新できない）。利用者は Releases から新しい dmg を入れ直します。

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

`translate.ts` は `apps/web/src` と `packages/client-runtime/src` の JSX テキスト、表示用の JSX 属性と
プロパティ（`aria-label`、`title`、`placeholder`、`〜Label` など）、そこから三項演算子などで渡る値、
大文字で始まる文に見える文字列とテンプレートを置き換えます。それ以外の 1 単語は ID や enum 値とみなして置き換えません。
比較やキーに使われている文字列（`=== "Files"`、`.includes("Files")` など）は、JSX の外では置き換えません。
サーバーが返すメッセージ、Electron のネイティブメニュー、モバイルアプリは対象外です。
