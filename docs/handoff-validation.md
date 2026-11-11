# 引き継ぎ準備の整理・再検証

対象: 2026-11-12時点のv2。整理開始時のHEADは`31494eb`（所有者による実スライド追加）。
Viewer/パーサー/レンダラー/プラグインの機能・デザイン、テストコード、依存・公開設定は変更しない。

## 整理内容と理由

| 対象 | 整理と理由 |
| --- | --- |
| `poc/COMPATIBILITY.md` | `docs/markdown-compatibility.md`へ移し、現在も有効な契約であることを明示。構文・既定値の内容を保持 |
| `poc/REPORT.md` | `docs/archive/poc-report.md`へ移動。技術判断の根拠を保存し、当時のAPI/制限と現行を区別 |
| 残りの`poc/` | 現行ビルド/試験から未参照の実行コード、独立したpackage/lock/config、重複README/LICENSE、PoC用依存・出力を削除 |
| `src/demo/`・`src/kitchen-sink/`・`src/templates/` | Markdownを内容不変で`examples/legacy-v1/`へ移動。旧CLI向けの手順と現行ソースを分離し、記法例は保持 |
| `tmp/`・`examples/slides/dist/` | 古いtarballステージング、PDF/PNG、サンプル静的出力を削除。検証後は`tmp/`を片付け、`dist/`と再生成したサンプル出力は保持する |
| 文書参照・公開ルール | 移動先へリンクを更新。削除済み`src/pkg.ts`を指していた旧release policyを現行package/jsr構成へ更新 |
| `HANDOFF.md`・`docs/README.md` | 再開手順と資料の優先順位を追加。次のUX課題は記録のみで未修正 |

## 意図して保持したもの

- `src/generated/viewer.ts`、`dist/`、`scripts/build.mjs`、JSR/TS/Vite/CI設定。
- 現行の仕様・シナリオ・技術判断・v2検証記録。
- 全互換性テストと`tests/fixtures/real-talk/`。
- 所有者が追加した`examples/slides/src/slides/test/`。固定fixtureと内容が重なるが、目視用と回帰テスト用の役割が異なる。
- `docs/1.0-scope.md`、`site/`、Pages workflow。旧サイトからの参照や配信設定があり、不要と断定しない。
- 現行TSの旧実装由来の内部関数や既存アサーション。今回は実装リファクタリングを行わない。

## 再検証

実行環境: macOS、Node 26.13.1、pnpm 11.11.0、Deno 2.9.8、ローカルChrome。

| コマンド/確認 | 結果 |
| --- | --- |
| `pnpm build` | 成功。生成Viewer・JS/型定義を再生成 |
| `pnpm check` | 成功。format・lint・型検査・5ファイル53件の単体テスト |
| `pnpm build:example` | 成功。example/team/testの3デッキと画像・フォントを出力 |
| `pnpm test:integration` | 初回タイムアウト、実装/テストを変更しない単独再実行で成功。Vite/Vite+のdev/build/preview、tarball導入・利用者側型検査、glob、base、同期・発表操作・PDF、実30枚/7画像を確認 |
| `pnpm check:jsr` | 成功。型・slow types・公開対象をdry-runで確認 |
| 文書のローカルリンク | 破損なし |
| 整理前後のSHA-256比較 | 実装TS/CSS・生成Viewer・テストTS・build/依存/JSR/TS設定・利用シナリオは不変 |
| 旧サンプル3点 | Gitの整理前内容とのバイト比較で一致 |
| `git diff --check` | 成功 |

### 結合試験の初回タイムアウト

`tests/integration/scenario.test.ts`の新しい`src/new/index.md`を作った直後、
`/new/`の`html.presenit-ready`を待つ箇所（整理時点で399行目）が30秒でタイムアウトした。
実装・テストを変更せず、他の検証と分けて再実行すると全シナリオが約19秒で成功した。
原因は未特定。watch反映と新しいURLへのアクセスのタイミングは調査候補だが、断定しない。
今回は実装追加・修正を行う依頼ではないため、試験コードへの待機追加等も行っていない。
この間欠的な失敗は次の担当へ引き継ぐ。

### 作業範囲

Viewerの4つの既知UX課題は記録のみで、未修正。
実公開・Release作成・リモートpushは実施しない。
検証が生成した`tmp/package/`、PDF/PNGは検証後に削除し、配布用`dist/`とサンプルの静的出力は保持する。
