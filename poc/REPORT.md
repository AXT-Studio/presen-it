# PoC結果

この文書はPoC完了時点の記録。本実装の追加要件・glob・ディレクトリURL・必須Viewer機能は
[v2仕様](../docs/v2-spec.md)と[実装計画](../docs/v2-plan.md)を参照。

通常のViteプラグインだけで、手書きHTML・Viewerエントリーなしのdev/build/previewと複数デッキ出力を実現できました。
既存CLIの実装・依存設定は変更していません。本実装・JSR実公開は未着手です。

## 採用した方式

`config`で`build.rolldownOptions.input`へ仮想HTMLの絶対パスを追加し、`resolveId`/`load`で内容を供給します。
ViteはHTMLのresolved IDを基準に出力パスを決めるため、HTMLには`\0virtual:...`でなくVite root内のファイル形状のIDを使います。
実ファイルは生成しません。Vite 8.1.5でこの組み合わせが動くことを検証しました。
根拠: [Vite Plugin API](https://vite.dev/guide/api-plugin)、[Vite Multi-Page App](https://vite.dev/guide/build#multi-page-app)。

devの対象ルートだけmiddlewareで処理し、同じHTML生成処理を`server.transformIndexHtml`へ渡します。
Markdown変更はVite watcherで検出し、対象HTMLへ`full-reload`を通知します。
buildではViteのHTML変換・アセット処理、previewでは通常の静的配信を使います。
Vite root、既存アプリのHTML、通常のdev/previewサーバーはそのまま利用します。

| 方式 | 判断 |
| --- | --- |
| 仮想HTML + Vite標準HTML処理 | 採用。ユーザー用の生成ソースファイルが不要で、他のHTML変換も通る |
| HTMLを一時ディレクトリへ書き出す | 今回は不要。watch・掃除・rootとの関係を追加管理する必要がある |
| `generateBundle`から完成HTMLを直接emit | 今回は不採用。ViteのHTML変換やアセット処理を自前で補う範囲が増える |
| 専用Viteアプリを別rootで起動 | 通常プロジェクトとの共存に不向きで、独自CLIも必要ないため不採用 |

Markdown処理はunified / remark-parse / remark-rehype / rehype-stringifyを選び、rehype-sanitizeを加えました。
本実装でコメントディレクティブやインラインrevealをAST上で扱えるためです。旧パーサー・Viewerコードは使用していません。
PoCの表示は1ファイル1文書のCommonMarkで、独自構文は実装していません。

## 実行した検証

実行環境: macOS、Node.js 26.8.2、TypeScript 5.9.3、Vite 8.1.5、ローカルGoogle Chrome、puppeteer-core 25.17.0、Deno 2.9.8。
Nodeの最低バージョンや他OSを横断した試験はしていません。

| 検証 | 結果 |
| --- | --- |
| 旧実装のVitest | 10ファイル・71件成功。旧仕様の調査基準として実行 |
| PoC TypeScript型検査 | 成功 |
| PoC Oxfmt / Oxlint | 成功 |
| 実Vite CLI `dev` + Chrome | HTML・Viewer TSのないサンプルで2つのデッキを表示 |
| Markdown変更 | 手動reloadなしで反映。ハッシュ保持。別デッキのページは再読込されない |
| 実Vite CLI `build` | `dist/slides/intro.html`と`dist/slides/team/update.html`を独立出力。dev clientは含まれない |
| 実Vite CLI `preview` + Chrome | JavaScript無効でも両HTMLを表示でき、相対リンクで相互移動できる |
| 通常アプリの既定入力 | 既存`index.html`とアプリJSの動作を保ってデッキ追加 |
| 明示入力 | 文字列・配列・オブジェクト、および旧`rollupOptions.input`形式でbuild/preview成功 |
| `base: "/demo/"` | アプリとデッキのdev/build/preview、Markdown更新が成功 |
| 他プラグインのHTML変換 | devとbuildの両方でデッキにも適用される |
| `public`画像 | base付きdev/previewで実際の画像ロード成功 |
| 危険なMarkdownリンク・生script | javascript URLとscriptの出力を抑止 |
| `deno publish --dry-run --allow-dirty` | 型検査・slow types検査・公開対象の列挙が成功。実公開は行わない |

ブラウザ検証は`tests/integration.test.ts`の2つの結合テストとして再実行できます。
最小サンプルは独立した`package.json`とローカル`file:`依存を持ち、パッケージ名でimportします。

## JSR公開に関する調査

- JSRはESMのTypeScriptソース、npm依存、`node:`組み込みを受け付けます。Node向けViteプラグインであること自体は公開の妨げになりません。Denoやブラウザ上で動作するプラグインという意味ではありません。[Publishing packages](https://jsr.io/docs/publishing-packages)
- パッケージを`poc/`に分離し、`jsr.json`の公開対象を明示しました。旧CLI、旧Viewer、examples、ブラウザテストとそのdev依存は公開ソースに混ぜません。
- 公開APIを`presenit(options): Plugin`と`PresenitOptions`に絞り、戻り値を明示しています。slow typesの無効化は不要でした。[About slow types](https://jsr.io/docs/about-slow-types)
- 相対importには`.ts`拡張子、外部依存には`package.json`の宣言を使います。型専用のVite importもdry-runを通りました。
- Node/Vite利用者はJSRのnpm互換経由でインストールします。通常のVite config内で`jsr:`を直接importする設計にはしません。JSR側がTSをJSと型定義へ変換します。[npm compatibility](https://jsr.io/docs/npm-compatibility)
- 本実装のViewerを追加する際は、配布後のJSから未配布のTSX・CSS・HTMLをファイル探索する構成に注意が必要です。TS文字列からの仮想モジュール、または配布対象に明示した事前生成JS/CSSをViteへ渡す方法が候補です。後者を使う場合は生成工程と公開ファイルを一緒に検証します。
- dry-runはscope所有権、実レジストリからのインストール、npm互換パッケージの最終的なpeer依存・型解決までは実証しません。実公開前に、空のNode/ViteプロジェクトへJSRから導入する試験が残ります。公開scope・正式バージョンも確定していません。

## 残る技術的リスク

1. **仮想HTMLとViteのバージョン差**: 使用フックは公開APIですが、ファイルのないHTMLエントリーの組み合わせをVite 8.1.5でのみ検証しています。対応範囲を決めて結合テストをCIに残す必要があります。他プラグインが後からinputやrootを置き換える場合の合成も要検討です。
2. **アセットとリンク**: Markdownファイル基準の相対画像・相対Markdownリンクの変換、CSS/フォント、`base: "./"`、CDN baseは未検証です。HTMLの出力先基準で画像を解決すると元Markdownとずれるため、本実装で明示的な変換が必要です。
3. **互換パーサー**: frontmatterの既定値・警告、コメントとコードフェンスの区別、inline reveal、ノート、空ページなどを意味単位でテスト化する必要があります。PoCは既存構文対応を主張しません。
4. **対象構成**: SSR、library、framework固有ルーター、複数Environment、Windows・大文字小文字・シンボリックリンクは未検証です。少なくとも通常のclient Viteアプリとの共存は確認できました。
5. **Watcherと本番Viewer**: 明示列挙したMarkdownのfull reloadのみです。glob追加削除、依存アセット更新、差分HMR、Viewerの状態復元は今後の設計対象です。

## 本実装に推奨する構成

```text
mod.ts                     公開するプラグインとOptions型
src/markdown/              frontmatter / Markdown AST / directives / diagnostics
src/deck/                  表示UIに依存しないDeckモデル
src/render/                Deck → HTML、共通の描画処理
src/vite/                  config・仮想HTML/モジュール・watch・アセット接続
src/client/                必要になった最小Viewerと印刷CSS
tests/compatibility/       既存Markdown入力の意味に関する互換性テスト
tests/integration/         実Vite CLI・ブラウザ・JSRパッケージ導入試験
```

まず明示的な複数decks設定を採用し、専用CLIや強制的なVite root変更は導入しない構成を推奨します。
Markdown ASTからUIと独立したDeckモデルを作り、dev/buildで同じパイプラインを使います。
相対画像はMarkdown AST上で元ファイル基準に解決し、Viteのアセット処理へ渡します。
Viewerは必要な操作が固まってから小さなブラウザモジュールとして追加し、フレームワークは必要性に応じて選びます。
PDFは印刷CSSとブラウザ印刷で扱います。この構成への移行や機能実装は今回行っていません。
