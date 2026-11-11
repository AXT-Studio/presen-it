# 維持するMarkdownと変更可能な仕様

v2本実装の受け入れ条件は[最新版の仕様](../docs/v2-spec.md)と
[利用シナリオ](../presenit-scenario.md)へ統合した。下記の構文・既定値は必須互換とし、
Viewerの主要機能は操作方法を変更できるが、機能自体はv2でも提供する。

調査対象: 既存`README.md`、`llms.txt`、`docs/1.0-scope.md`、`tests/`全10ファイル。
今回の依頼が旧1.0方針に優先します。旧テストのHTMLクラス名・ライブラリ名・色などを新実装の契約にはしません。
以下は**本実装で維持すべき入力と意味**の整理であり、このPoCで実装済みという意味ではありません。

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
本実装ではtitle未指定のフォールバックを新しい名称・デッキIDで定義すればよく、古い製品名やslug規約は維持不要です。
`docs/1.0-scope.md`の「fragmentsは対象外」は現行README・revealテストと矛盾しており、現行の構文を優先します。

## 変更できるもの

- CLIとフラグ、`init`/`export`、内部API、パッケージexports、旧npm公開・tsup・リリースCI。
- `src/<slug>/slide.md`規約、`view.html`・`resume.pdf`という出力名、ポート、Viewer用の専用Vite root。
- Preact/Signals、unified等の採否、Shiki/KaTeX/beautiful-mermaidを含む描画エンジン。入力の意味を維持すれば変更可能です。
- CSSクラス、HTML構造、色・余白・フォント取得方法、見た目の完全一致。
- キーボード・ツールバー・URLの形式、Presenterの画面構成、同期方式、レーザー、タイマー等のUI。
- PDFのビルド時自動生成。今回は印刷によるPDF保存が要件です。

フォント自動取得、アセットの埋め込み方式、警告文の完全一致は入力構文ではありません。
ただし相対画像が表示できること、ノートが投影に漏れないこと等の文書の意図は本実装でも維持すべきです。
本実装では旧テストから入力例と期待する意味だけを抽出し、旧HTML・CSSに依存しない互換性テストへ移すことを推奨します。
