# v2 実装計画

## 優先順位と完了条件

1. [x] シナリオと追加要件を仕様へ統合する。
2. [x] パッケージ名・exports・ビルド構成をv2へ移行。互換パーサー/レンダラーを独立させて試験。
3. [x] glob、ディレクトリURL、相対アセット、base、通常アプリとの共存をViteプラグインへ実装。
4. [x] 新Viewerへナビゲーション、Reveal、Overview、Presenter同期、レーザー、タイマーを実装。
5. [x] 印刷UIと印刷レイアウト、ローカル配布形態、Vite/Vite+の利用フローを検証する。
6. [x] README/llms/CIを移行し、検証結果と制限を記録する。

機能単位でコミットする。PoCの検証記録は[歴史資料](./archive/poc-report.md)、入力契約は[Markdown互換性](./markdown-compatibility.md)として保存する。利用シナリオも保持する。

## 技術判断

- 互換性の細部を失わないため既存のunifiedベースのASTパーサーを継続。旧CLI・専用Vite root・Preact Viewerは廃止。
- 仮想HTMLはPoCと同じくVite root内のファイル形状のID。ビルドはViteの標準HTML処理を通す。
- ViewerはフレームワークなしのTypeScript。配布時にはJS/CSS文字列をTSモジュールへ生成し、
  JSRによるTS→JS変換後も存在しないTS/TSXファイルを探さない。
- 配布試験用にTSをJS/型へ変換したtarballも作る。JSR公開物のソースと同じ生成Viewerを使う。
- 数式用CSSとフォントはローカル依存からViteへ渡す。プレゼン内容の画像もViteでバンドル。
- スライドの既定フォント/寸法/配色設定を維持し、Viewerは白/濃灰/青の小さな操作部で構成。
  見出しと本文を左揃え、中央配置は既存ディレクティブに従う。操作は画面下部、Presenterは
  左に現在のスライド、右に次プレビュー・ノート・タイマー。装飾より可読性・フォーカス表示を優先。

## 検証記録

実装と受け入れ試験を完了。詳細は[v2-validation.md](./v2-validation.md)。
Vite+は公式のcore alias/override構成で検証した。
ローカルJS配布の型定義と、JSRの公開ソースは同じ生成Viewerを使用する。
JSRへの実公開・リモートpushは行っていない。
