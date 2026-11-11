# Markdownの意味的互換性

v1からv2へ移行する際に維持した入力の意味です。下記の構文・既定値は必須互換とし、
Viewerの主要機能は操作方法を変更できるが、機能自体は提供し続ける。

調査対象: v1時点の`README.md`、`llms.txt`、1.0 scope文書、当時のテスト全10ファイル。
現在のv2の挙動は旧1.0方針より優先します。旧テストのHTMLクラス名・ライブラリ名・色などを新実装の契約にはしません。
以下は**v2でも維持する入力と意味**です。表中のテスト名はv1調査時の名称も含みます。
現在の検証は`tests/parse.test.ts`、`tests/render.test.ts`、`tests/rich.test.ts`、
`tests/fonts.test.ts`、`tests/compatibility.test.ts`と結合テストを参照してください。

## 維持する入力・文書の意味

| 対象 | 維持する内容 | 根拠 |
| --- | --- | --- |
| YAML frontmatter | `title`、`description`、`theme` (`light`/`dark`)、`hue`、`width`/`height`、`fontSize`、`fontFamily.sans`/`.mono`、`pageTransition.type`/`.duration`、`animation.duration`、`rawHTML`、`break`、`footer` | README / llms / parse・render・viewer-htmlテスト |
| 値の解釈 | フォントはCSS文字列または名前の配列。hueはmod 360。未知キーは無視、不正な型は警告と既定値へのフォールバック | llms / parse・fontsテスト |
| 既定値 | `theme: light`、`hue: 210`、1920×1080、`fontSize: 32`、sansはM PLUS 1、monoはM PLUS 1 Code、transitionはfade/0.2秒、animationは0.3秒、`rawHTML: false`、`break: soft`、footerは空文字 | README / llms / parseテスト |
| 改ページ | `<!-- presen-it! slide-break -->`と`(center-x=true&center-y=false)`形式 | README / llms / parseテスト |
| カラム | `<!-- presen-it! column-break -->`と同じ整列オプション。既定はcenter-x=false、center-y=true、カラム側を優先 | README / llms / parseテスト |
| ディレクティブの制約 | break系はブロック間で単独。`=`/`&`前後に空白なし。不明コマンド・不正オプションは警告して無視 | llms / parseテスト |
| 構造の境界 | 最初のbreak前も1ページ目。先頭breakは空ページを増やさず配置指定。先頭h2はページ見出し。直前のcolumn-breakで本文h2にできる。空カラムは除去、連続slide-breakは空スライドを保持 | llms / parseテスト |
| Reveal | `<!-- presen-it! reveal -->` / `(at=N)`、Nは非負整数、省略0。インライン・強調内部でも使える | README / llms / parse・renderテスト |
| Revealの意味 | 文書順で後続へsticky、カラムをまたぎ、slide-breakで0へ。表示条件at≤step、飛び番号もステップを消費。ページh2は常時表示。戻る際は前ページの最終step | README / llms / parse・storeテスト |
| 通常コメント | ディレクティブでない末尾HTMLコメントはスピーカーノート。投影には表示しない | llms / parseテスト |
| Markdown拡張 | GFMの表・取消線・タスクリスト等（チェックボックスは読み取り専用）、コードフェンス、`mermaid`フェンス、`$…$`/`$$…$$`数式 | README / llms / render・richテスト |
| Alerts | 引用形式の`[!NOTE]`、`TIP`、`IMPORTANT`、`WARNING`、`CAUTION`。既存テストでは小文字も認識 | README / llms / renderテスト |
| 改行とHTML | `break: soft`で段落内単改行をbr、`hard`では通常Markdown。生HTMLは既定でエスケープし、`rawHTML: true`で描画 | README / llms / parse・renderテスト |

旧READMEのtitle既定値は空でslugへフォールバックし、llmsの例では最終的な表示文字列が既定値として載っています。
v2のtitle未指定時のフォールバックは`AXT Presen'it! — <deck path>`です。古い製品名やslug規約は引き継いでいません。
v1の1.0 scope文書にあった「fragmentsは対象外」は現行README・revealテストと矛盾しており、現行の構文を優先します。

## v2で置き換えたもの・変更できるもの

以下はv1からv2へ移行した際の区分です。今後のViewer改善で、v2の
ディレクトリURL・セットアップ方法・必須機能を自由に変えてよいという意味ではありません。

- CLIとフラグ、`init`/`export`、内部API、パッケージexports、旧npm公開・tsup・リリースCI。
- `src/<slug>/slide.md`規約、`view.html`・`resume.pdf`という出力名、ポート、Viewer用の専用Vite root。
- Preact/Signals、unified等の採否、Shiki/KaTeX/beautiful-mermaidを含む描画エンジン。入力の意味を維持すれば変更可能です。
- CSSクラス、HTML構造、色・余白・フォント取得方法、見た目の完全一致。
- キーボード・ツールバー・URLの形式、Presenterの画面構成、同期方式、レーザー、タイマー等のUI。
- PDFのビルド時自動生成。今回は印刷によるPDF保存が要件です。

フォント自動取得、アセットの埋め込み方式、警告文の完全一致は入力構文ではありません。
ただし相対画像が表示できること、ノートが投影に漏れないこと等の文書の意図は本実装でも維持すべきです。
Viewerのデザイン・操作方法は改善できますが、入力の意味と必須の機能（Reveal・Overview・Presenter同期・
レーザー・ブラックアウト・タイマー・ノート・全Revealを含むPDF保存）は保ってください。
現行テストにはCSSクラスや色・文字列に依存するアサーションも残っています。見た目を変える場合は
その期待値を適切に見直せますが、構文の意味に関する検証を削除して通すことは避けてください。
