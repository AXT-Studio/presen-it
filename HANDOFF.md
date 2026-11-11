# Presen'it! v2 引き継ぎ

## 次の担当へ

この文書を最初に読み、`presenit-scenario.md`、`docs/v2-spec.md`、`docs/markdown-compatibility.md`を
確認してから着手してください。引き継ぎ時点で報告されていたViewerのデザイン・UXの4課題は対応済みです
（下の「Viewerのデザイン・UX（対応済み）」）。
レジストリ公開・GitHub Release・リモートpushは、所有者の明示的な許可なしに行わないでください。

## 目的と設計思想

Presen'it!は、通常のMarkdownに最小限のコメントディレクティブを加え、
無難で読みやすいプレゼンテーションを生成するツールです。
v2はTypeScript/ESMの**通常のViteプラグイン**で、JSR公開を想定しています。
独自CLIはありません。利用者が書くのはMarkdown・Vite設定・通常のパッケージ設定です。
ViewerのHTMLやTS/JSエントリーを手書きさせません。

パッケージ名・import名は`@ayaexptech/presen-it`。`mod.ts`からdefault/named `presenit`と
`PresenitOptions`を公開します。`package.json`/`jsr.json`は`2.0.0`ですが、これは実装上の
バージョン設定であり、v2のレジストリ公開が完了したという意味ではありません。

```ts
import { defineConfig } from "vite"; // Vite+プロジェクトでは "vite-plus"
import presenit from "@ayaexptech/presen-it";

export default defineConfig({
    plugins: [presenit({ includes: ["src/**/index.md"] })],
});
```

`includes`/`excludes`はVite root基準のglob、`root`はURLを導くMarkdown側の基準（既定`src`）。
`src/slides/example/index.md` → `/slides/example/` → `dist/slides/example/index.html`。
`src/talk.md` → `/talk/`。通常アプリのindex.htmlや明示的な入力との共存を保ちます。

## 実装済みの機能

- globによる複数デッキ、ディレクトリURL、Markdownと参照画像のdev更新、対象の追加・削除。
- Vite/Vite+のdev・build・preview、静的HTML、サブパス/相対base、相対画像とデッキ間リンク。
- frontmatter・コメントディレクティブ・GFM・Alerts・Shiki・KaTeX・Mermaid。
- スライド移動、キーボード、フルスクリーン、Reveal、Overview。
- 別タブのPresenter、ノート、次の表示、タイマー、ページ/Reveal/ブラックアウト/レーザーの同期。
- メニューの「PDFとして保存」からブラウザ印刷。全Reveal、1枚1ページ、ノートと操作UIを除外。

## 変更してはいけない契約

[Markdownの意味的互換性](docs/markdown-compatibility.md)と[v2仕様](docs/v2-spec.md)を維持します。

- frontmatterの全項目・値の解釈・既定値。未知キー無視、不正値の警告とフォールバック。
- `slide-break`・`column-break`・`reveal`とその全オプション。新ディレクティブは不要です。
- Revealは文書順でsticky、カラムをまたぎ、slide-breakで0に戻る。飛び番号もステップを消費する。
- 先頭breakで空ページを増やさない、先頭h2の扱い、カラム側の整列優先、空カラムの除去、連続breakの空ページ。
- 末尾の通常HTMLコメントをノートとして扱い、投影/印刷へ表示しない。
- Markdown拡張と`rawHTML`・`break`の意味。生HTMLは既定無効、`rawHTML: true`は著者が信頼するHTMLを許可する。
- dev/build/preview、複数デッキ、相対アセット、Presenter同期、全Revealを含む印刷を壊さない。

主な既定値はlight、hue 210、1920×1080、fontSize 32、M PLUS 1/M PLUS 1 Code、
pageTransition fade/0.2秒、animation 0.3秒、rawHTML false、break soft、footer空文字です。
title未指定の製品名のみv1から変更し、現在は`AXT Presen'it! — <deck path>`です。

旧CLI・内部API・ViewerのDOM構造や見た目の完全互換性は不要です。
Viewerの配色・アイコン・操作バー・画面構成は改善対象です。
ただしOverview、Presenter、レーザー、ブラックアウト、タイマー、ノート、PDFなどの機能は残してください。

## アーキテクチャ

```text
Markdown
  → parse/frontmatter + directive + reveal → Deck AST (types.ts)
  → render/html + rich + theme → スライドHTML/CSS
  → vite/plugin.ts → 仮想HTMLとViewer/CSS → Vite標準HTML・アセット処理
```

| ファイル/ディレクトリ | 役割 |
| --- | --- |
| `mod.ts` | 公開エントリー。プラグインとOptions型 |
| `src/vite/plugin.ts` | glob、URL、入力の合成、仮想HTML/JS/CSS、Markdownのコンパイル、相対アセット・リンク、watch、dev middleware |
| `src/types.ts` | Deck/Slide/Column/config/diagnosticsの型と既定値 |
| `src/parse/` | YAML、Markdown AST、ディレクティブ、ノート、sticky Reveal |
| `src/render/html.ts` | スライド/カラム/ヘッダー/フッター、rawHTML処理 |
| `src/render/rich.ts`・`highlighter.ts`・`alert.ts` | 数式・Mermaid・コード・Alerts |
| `src/render/theme.ts` | **スライド内容自体**のテーマ・文字・余白・カラム。Viewerの操作UIとは別 |
| `src/font-family.ts`・`src/shared/slide-padding.ts` | フォントと余白の共通処理 |
| `src/client/viewer.ts` | **Viewer操作UIと状態**。DOM生成、ナビゲーション、Reveal、Overview、Presenter、同期、レーザー、タイマー、印刷 |
| `src/client/viewer.css` | **Viewer外枠・操作UI**、ステージの拡縮/配置、レスポンシブ、印刷時の除外 |
| `src/generated/viewer.ts` | 配布に必要な生成済みJS/CSS文字列。手編集しない・削除しない |
| `scripts/build.mjs` | Viewerの生成、プラグインJS/型の出力、型定義のimport補正、ローカル配布用ステージング |
| `examples/slides/` | 現行の開発・目視確認用Viteプロジェクト |
| `tests/` | 互換性・描画単体テスト、実CLI/ブラウザ/ローカル配布の結合試験 |

HTMLはVite root内の**ファイル形状のID**で`resolveId`/`load`から供給し、Viteの標準HTMLビルドを通します。
テーマCSSは`<link>`で読まれるため、devではViteが`?direct`付きの別モジュールとして扱います。
Markdown変更時は`invalidateThemes()`でクエリ違いを含む全モジュールを無効化します（frontmatterの反映に必要）。
JS/CSSは仮想モジュールです。devのHTMLは`server.transformIndexHtml`へ渡し、previewは通常の静的配信です。
既存アプリのrootを専用Viewer rootへ変更しないでください。

Viewerの状態は主に`index`/`step`/`blackout`/`laser`です。
`update()`がDOMと同期状態を更新し、`navigate()`/`move()`が移動します。
BroadcastChannelは同じオリジン・デッキのタブ間で利用し、`#N`とsessionStorageはdev再読込の位置復元にも使います。
`fit()`/`resize()`とCSSのscaleでスライドの物理寸法を画面へ収めています。

## 開発環境とコマンド

- Node.js **22.18以上**。従来の実装検証環境はNode 26.13.1。
- パッケージマネージャーは**pnpm 11.11.0**（packageManagerフィールドとCIに固定）。
- Vite 8.1.5、Vite+ 1.6.0で検証。DenoはJSR dry-runに必要。
- 結合試験にはChrome/Chromium、npm、ネットワークアクセス（利用者環境への依存インストール）が必要。
- ブラウザは一般的なmacOS/Linuxのパスから検出。必要なら`CHROME_PATH=/path/to/chrome`を指定。

リポジトリルートで実行します。

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm dev
# 開発サーバーが表示するURLの /slides/example/ を開く
```

確認用デッキは`/slides/example/`（Reveal・コード・数式・図）、`/slides/team/`、
`/slides/test/`（所有者が追加したGinza.jsの実スライド）です。
静的出力は`pnpm build:example`で`examples/slides/dist/`へ作り、`pnpm preview`で確認します。

```sh
pnpm check              # format:check + lint + typecheck + Vitest
pnpm test:integration   # 別系統のnode:test + 実CLI/Chrome/tarball/Vite+
pnpm check:jsr          # deno publish --dry-run --allow-dirty
```

個別には`pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`を使えます。
`pnpm build`はライブラリ/Viewer生成であり、サンプルの静的ビルドは`build:example`です。

### Viewer編集時の重要事項

1. `src/client/viewer.ts`と`src/client/viewer.css`を編集する。
2. **`pnpm build`を実行**し、`src/generated/viewer.ts`を再生成する。
3. devサーバーを起動/再起動して表示を確認する。`pnpm dev`だけではclientソースの生成処理は走らない。
4. ソースと生成ファイルの両方をコミットする。

ビルドは`dist/`を作り直します。`dist/`はGit管理外ですが、ローカルパッケージのexportsと
`package.json#files`が参照する必要な配布出力です。`src/generated/viewer.ts`はGit管理対象です。

## JSRとローカル配布

- `jsr.json`はTSソースの`mod.ts`を公開エントリーとし、`src/client/**`は公開から除外する。
- Viewerは生成済みの文字列モジュールからViteへ供給する。配布後に存在しないTSX/HTML/CSSを探索する構成へ戻さない。
- 相対TS importの拡張子を維持し、公開APIの型を明示する（slow types対策）。
- `package.json`と`jsr.json`のversion・名前を揃える。
- `node scripts/build.mjs --package`は`tmp/package/`へJS/型のローカル配布形態を作る。
- 結合試験はtarballをリポジトリ外へnpm installし、symlinkでないこと、利用者側の型も検証する。
- 実JSRレジストリのnpm互換変換物を取得する試験はまだ行っていない。dry-run/ローカル配布の成功と区別する。
- Vite+の利用者プロジェクトは公式テンプレートのcore alias/overrideを使う。通常のViteを追加して混在させない。
  このリポジトリ自体の開発起動は`pnpm dev`を使う。詳細は`docs/publishing.md`。

`.github/workflows/ci.yml`はビルド・check・結合試験・JSR dry-runです。
`release.yml`も手動起動の**検証だけ**で、実公開はしません。
`.cursor/rules/release-policy.mdc`にも公開許可の制約を記載しています。

## テストと検証状況

| テスト | 内容 |
| --- | --- |
| `tests/parse.test.ts` | frontmatter、既定値、警告、全ディレクティブ、ページ/カラム/Revealの意味 |
| `tests/render.test.ts` | 生成HTML、整列、GFM、Alerts、rawHTML、改行、footer、Reveal、テーマ |
| `tests/rich.test.ts` | Mermaid、Shiki、KaTeXとCSS処理 |
| `tests/fonts.test.ts` | フォント文字列・配列・Google Fonts URL |
| `tests/compatibility.test.ts` | コード内のディレクティブ、生成Revealと生HTMLの区別、実デッキ |
| `tests/integration/scenario.test.ts` | tarball導入、利用者側tsc、Vite/Vite+のdev/build/preview、共存、glob、base、画像、発表操作、同期、印刷 |

単体テストは**5ファイル・53件**。結合試験は`node:test`の1シナリオ内で多数の操作を行います。
Vitestは`tests/integration/**`を除外しており、`pnpm check`だけでは結合試験を実行しません。
結合試験のPDF保存ボタンは`window.print`呼び出しを検査し、別途Chromeの`page.pdf()`でも印刷出力を生成します。
CI試験だけでOSの印刷ダイアログ操作・PDFの目視まですべて自動確認しているわけではありません。
以前のPDFKitによる寸法/テキスト検査・PNG目視を含む実装時の記録は`docs/v2-validation.md`です。
今回の整理後の再検証は`docs/handoff-validation.md`を参照してください。

`tests/fixtures/real-talk/`は互換性の固定データです。所有者が追加した`examples/slides/src/slides/test/`は
目視用サンプルとして保持しています。現時点でMarkdownと7画像は重複しますが、用途が異なるため統合していません。
後者には追加の画像もあります。片方を変更したときに自動的にもう片方へ反映させないでください。

### デザイン変更時のテストの扱い

`tests/render.test.ts`には色・クラス名など見た目に依存する期待値も残っています。
結合試験もボタンの日本語ラベル（`aria-label`）、`.presenit-counter`のページ表記と`.presenit-steps`の
`data-step`/`data-max`、`.presenit-*`セレクターを使います。
UI変更に伴いこれらを適切に更新できますが、機能/意味の検証を削除して通さないでください。
Presenterと投影、全Revealの印刷、ノート/UIの印刷除外も再確認します。

## 制限事項・未解決事項

- 通常のclient Viteアプリが対象。SSR専用framework、library build、複数Environmentは対応範囲外/未検証。
- Markdown更新はfull reload。差分HMRは未実装。
- タブ同期は同じブラウザ・オリジン内だけ。端末間同期ではない。
- Google Fontsは外部ネットワークに依存し、取得できなければフォールバックする。KaTeXのCSS/フォントはViteでローカル配布する。
- 印刷結果はブラウザの紙サイズ・余白・ヘッダー設定にも依存する。主な実ブラウザ検証はChrome。
- 実JSR配布物の取得、他OS・全ブラウザの網羅検証は未完了。
- 整理後の結合試験は、初回にglob追加直後の`html.presenit-ready`待ちでタイムアウトした。
  実装・テストを変更しない単独再実行は成功。原因は未特定で、watch反映とアクセスのタイミングが調査候補。
  この間欠的な失敗を、整理で修正済みの問題として扱わない。詳細は`docs/handoff-validation.md`。

## Viewerのデザイン・UX（対応済み）

引き継ぎ時に報告された4課題（テーマと操作UIの不一致、遷移時の白いフラッシュ、テキスト過多、
常設の操作バーによる表示領域の縮小）に対応しました。Viewerを変更するときは次の構造を前提にしてください。

- **テーマ連動**: プラグインが`<html>`へ`data-presenit-theme`と`--presenit-viewer-hue`を出力し、
  `viewer.css`の`--presenit-ui-*`トークンがlight/darkと色相から周囲・操作UIの色を決めます。
  スクリプト実行前の初回描画から一致させるためで、スライド自体の配色（`theme.ts`）とは独立です。
- **表示領域**: ステージはウィンドウ全体。操作バーは`position: fixed`で重なり、領域を確保しません。
  Presenterだけは操作バーをスライドの下に常時表示します（`.is-presenter`）。
- **操作バーの表示**: `html.presenit-toolbar-shown`（画面下部へのマウス接近、メニュー表示中、タップ、
  初回表示時の短いヒント）か、CSSの`.presenit-toolbar:has(:focus-visible)`（キーボードフォーカス）で表示。
  非表示時も`opacity`/`pointer-events`だけで隠すため、Tabで到達できます。Escで閉じます。
- **ページ遷移**: 新しいスライドを、旧スライド（`.is-leaving`）の上でフェード/スライドさせる。
  旧スライドは遷移完了まで表示され、Revealの状態も保持します。初回のPresenter同期・reduced motionでは省略。
- **メニュー/ツールチップ**: Popover API。ツールチップは`popover="manual"`の単一要素で、
  ホバー（タッチ以外）とキーボードフォーカスに表示し、`aria-hidden`（名前は各ボタンの`aria-label`）。
- **Revealの表示**: ページ番号の下の点は「最初の表示 + 各Revealステップ」の数（9段以上は`3/12`表記）。
  Revealのないスライドも点1つを出し、位置表示の幅は総ページ数の桁で固定して、ボタン位置を動かさない。
- **アイコン**: 依存を増やさないため、`viewer.ts`の`ICONS`に単純なSVGパスを自作して保持しています。
- **印刷**: 操作UI一式を`display: none`にし、全要素の`transition`を無効化（Revealのフェード途中を印刷しない）。

確認時はlight/dark・fade/scroll/none・Presenter・全画面・ウィンドウサイズ変更に加え、
マウス/キーボード/タッチ、Reveal・同期・印刷への影響を見てください。

## 現行資料と歴史資料

現行の契約は`presenit-scenario.md`、`docs/v2-spec.md`、`docs/markdown-compatibility.md`。
利用方法は`README.md`、技術判断は`docs/v2-plan.md`、検証は`docs/v2-validation.md`、
公開構成は`docs/publishing.md`です。文書一覧は`docs/README.md`。

PoC実行コードと独立した依存/lockfileは整理済みで、`docs/archive/poc-report.md`に設計上の根拠を残しました。
旧CLI向けサンプルは`examples/legacy-v1/`へ移し、現行`src/`と区別しました。
`docs/1.0-scope.md`は歴史仕様ですが、旧サイトからの参照もあるため元のパスで保持しています。
`site/`は旧v1の紹介ページで、`.github/workflows/pages.yml`が参照しています。
不要と断定できないためサイト/Pages workflowは保持し、Viewerや現行仕様の情報源としては扱いません。
