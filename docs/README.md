# ドキュメントの読み方

新しい担当はまずルートの[HANDOFF.md](../HANDOFF.md)を読んでください。

## 現行の契約と開発

| 資料 | 用途 |
| --- | --- |
| [利用シナリオ](../presenit-scenario.md) | 所有者が想定する一連の操作・受け入れ条件 |
| [v2仕様](./v2-spec.md) | パッケージ/API、URL、必須機能、検証範囲 |
| [Markdown互換性](./markdown-compatibility.md) | 維持する入力・既定値・意味と、変更できる実装 |
| [README](../README.md) / [llms.txt](../llms.txt) | 利用者向けの起動手順・記法 |
| [実装計画・技術判断](./v2-plan.md) | 完了したv2実装とその理由。UI配色等の当初案は今後の改善を禁止しない |
| [v2受け入れ検証](./v2-validation.md) | v2実装完了時の検証記録 |
| [引き継ぎ時の再検証](./handoff-validation.md) | 整理したファイルと、整理後の検証結果 |
| [公開構成](./publishing.md) | 生成Viewer、JSR dry-run、ローカル配布、公開許可の制約 |

`v2-plan.md`は完了済みの実装記録です。次のViewer UX課題は`HANDOFF.md`を参照してください。

## 歴史資料

- [1.0 scope](./1.0-scope.md): v1の仕様記録。旧サイトの参照先でもあるためパスを保持。
- [PoC検証記録](./archive/poc-report.md): 仮想HTML方式・JSR構成の技術検証。当時のAPI/未実装項目は現行仕様ではない。
- [旧CLI向けサンプル](../examples/legacy-v1/README.md): 記法の参考用Markdown。現行Viewerの起動手順は含めない。
- `site/`: Pages workflowが参照するv1紹介ページ。現行の利用方法はルートREADMEを優先。

現行仕様は履歴資料より優先します。Markdownの意味的互換性は、歴史資料へ分類したことを理由に変更しません。
