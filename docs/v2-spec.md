# Presen'it! v2 仕様

この仕様は旧1.0 scopeおよびPoCの制限より優先する。受け入れ条件の基準は
[`presenit-scenario.md`](../presenit-scenario.md)と[Markdownの意味的互換性](./markdown-compatibility.md)。

## パッケージと利用

- TypeScript / ESM、JSR名とimport名を`@ayaexptech/presen-it`へ統一する。
- 通常のViteプラグインをdefault・named `presenit`として提供。独自CLIは提供しない。
- Vite 8 / Vite+でdev・build・previewを利用し、HTMLとViewerエントリーの手書きは不要。
- `presenit({ includes: ["src/**/index.md"], root: "src" })`。
  includesはVite root基準のglob、rootは出力パスを導くMarkdown側の基準（既定`src`）。
  `src/slides/example/index.md` → `/slides/example/` → `dist/slides/example/index.html`。
  `src/talk.md` → `/talk/`。root/includesを変えて任意の配置を扱える。
- 通常アプリの既定index.htmlと明示的なbuild入力を保持する。URL衝突は明確なエラー。
- globの追加・削除、Markdown編集、相対アセット変更をdevへ反映する。
- 相対画像はMarkdownファイルから解決し、Viteの標準アセット処理で配布する。
- 絶対base・サブパス・相対baseで静的出力とpreviewが動作する。

## Markdownの必須互換性

全frontmatterキー・値・既定値、slide-break/column-break/revealと全オプション、sticky状態、
先頭break、空ページ、h2見出し、カラム優先、ノート、GFM、Alerts、コード、数式、Mermaidを維持。
新ディレクティブは追加しない。未知キー無視・不正値の警告とフォールバックも維持する。
title未指定時の製品名のみ`AXT Presen'it! — <deck path>`へ変更する。
旧パーサーとASTモデルは利用し、公開APIや旧ViewerのHTML/CSSとの互換性は要求しない。

## ViewerとPDF

- 前後・先頭末尾・キーボード・フルスクリーン、Reveal、Overviewから任意ページへ移動。
- 別タブのPresenter、現在/次ステップのプレビュー、ページとRevealの双方向同期。
- レーザーと投影側への位置同期、ブラックアウト、タイマーの停止再開とリセット、ノート。
- メニューの「PDFとして保存」でブラウザ印刷へ進める。
- 印刷は全Reveal表示、1スライド1ページ、ノートと操作UIを除外。frontmatterの縦横比を維持。
- 無難で読みやすいスライドと小さな操作バー。通常表示は内容を最優先にする。

## 検証と公開制約

互換性単体テスト、実Vite CLIとChromeによる結合試験、glob追加削除、base/画像、
Presenter同期・タイマー・レーザー、印刷PDFのページ寸法と内容・目視、Vite+、
ソースへのsymlinkに依存しないローカルtarballインストールを検証する。
JSRはdry-runまで。実公開・リリース・リモートpushは実施しない。
