# v2 受け入れ検証

検証日: 2026-11-12。受け入れ条件は`presenit-scenario.md`と`docs/v2-spec.md`。
レジストリへの実公開、GitHub Release、リモートpushは実施していない。

## 結果

| 対象 | 検証と結果 |
| --- | --- |
| Markdown互換性 | 旧parse/render/rich/fontsのテストと追加互換性テスト、計53件成功。全frontmatter、break・column・sticky reveal・インライン強調・ノート・GFM・Alerts・コード・数式・Mermaidを確認 |
| ローカル配布 | JSと型定義を含むtarballを作り、リポジトリ外の空プロジェクトへnpm install。symlinkでないことを検査 |
| 利用者側の型 | インストールしたパッケージをimportするvite.config.tsを通常ViteとVite+の両構成でtsc検査 |
| Vite | 実CLIのdev/build/previewとChromeを使用。既存index.htmlとアプリJSが動作し、デッキを追加できる |
| Vite+ | 公式core alias/override構成でvp dev/build/previewが成功。HTMLを置かない構成も検証 |
| ディレクトリURL | src/slides/example/index.md → /slides/example/ → dist/slides/example/index.html |
| Markdown編集 | 手動更新なしで反映し、ページとReveal stepを保持 |
| glob | Markdown追加で新URLが開き、削除するとViewerが消える |
| 相対画像・リンク | SVG画像、選択済みMarkdown間のリンク、7個のWebP画像が正しくビルド・配信される |
| base | /demo/と./の両方でbuild/preview、画像、Viewer、PDF操作が成功 |
| 発表操作 | キーボード、前後、空Reveal step、前ページの最終step復帰、Overviewジャンプ、フルスクリーンを検証 |
| Presenter | 別タブ、ノート、ページ・Revealの双方向同期、レーザー位置、ブラックアウト、タイマー停止・リセットを検証 |
| PDF操作 | メニューからwindow.printへの到達を検査。実際のChrome印刷出力も生成 |
| PDFレイアウト | 1280×720pxの3スライドを各960×540ptの3ページへ出力。PDFKitで寸法・テキストを検査し、各ページをPNG化して目視。全Revealを含み、ノートと操作UIを含まない |
| 実スライド | 指定されたGinza.jsの30枚のMarkdownと画像を使用。生HTML・複雑なReveal・カラム・数式を含むデッキをビルド/preview。外部ネットワークを止めてもローカル画像が読み込まれる |
| JSR | deno publish --dry-run --allow-dirtyで型・slow types・公開対象の検査に成功 |
| 静的検査 | TypeScript、Oxfmt、Oxlint成功 |

結合テストは`tests/integration/scenario.test.ts`にある。
この試験は公開処理を含まず、利用者のパッケージ導入・各CLI起動・実ブラウザ操作を行う。
macOSではPDFKitを使って印刷結果を追加確認した。CIでもChromeから検証用PDFを生成する。

実行環境: macOS、Node.js 26.13.1、TypeScript 5.9.3、Vite 8.1.5、Vite+ 1.6.0、
Google Chrome 157.0.8103.40、puppeteer-core 25.4.0、Deno 2.9.8。

## 実装中に修正した問題

- Vite devのCSS直接リクエストに付くqueryを仮想CSSの解決・loadで扱う。
- 生HTML無効時も、生成したReveal spanだけは保持する。通常のネストした生HTMLはエスケープする。
- Google Fonts URL内のセミコロンをCSS importの終端と誤認しない。
- ローカル配布の型定義内の相対importを、配布されたJSのパスに合わせる。
- 投影のブラックアウト中は操作バーとレーザーも隠す。
- ブラウザ試験ではタブの前面化とプロセス終了を明示し、残留サーバーが結果に影響しないようにする。

## 移行上の差分と制限

- パッケージ名/import名は`@ayaexptech/presen-it`。旧CLIと内部APIは廃止。
- 入力の意味・既定値は維持。未指定titleの製品名はAXT Presen'it!へ変更。
- 出力パス、ViewerのUI、HTML構造は変更。PDFは自動生成ではなくブラウザ印刷。
- 本実装は通常のclient Viteアプリが対象。SSR専用frameworkやlibrary buildは対象外。
- 全文書を書き換えるfull reloadで更新する。差分HMRは行わない。
- タブ同期は同じブラウザ・同じオリジンのBroadcastChannel。端末間同期ではない。
- rawHTML: trueは著者が信頼するHTMLを有効にする設定。既定では無効。
- Google Fonts自動取得はネットワークに依存し、利用できなければローカル/総称フォントへフォールバック。
- 紙のサイズ・余白・ヘッダー等の印刷設定はブラウザ側の設定にも依存する。ブラウザは現行Chromeで検証。
- 実際のJSR npm互換変換物の取得試験は未実施。公開許可後に別途確認する。

## 再実行

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm check
pnpm test:integration
pnpm check:jsr
```

手動でサンプルを開くには`pnpm dev`で`/slides/example/`へアクセスする。
`pnpm build:example`、`pnpm preview`で静的出力を確認できる。
