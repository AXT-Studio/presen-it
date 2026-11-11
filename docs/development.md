# 開発ガイド

Presen'it!は、通常のMarkdownに最小限のコメントディレクティブを加えてプレゼンテーションを作る
TypeScript/ESMの**Viteプラグイン**です（JSR: `@ayaexptech/presen-it`）。独自CLIはなく、利用者が書くのは
Markdown・Vite設定・通常のパッケージ設定だけです。ViewerのHTMLやJSエントリーを書かせません。

入力の互換性（frontmatter・ディレクティブ・Markdown拡張の意味と既定値）は
[Markdownの意味的互換性](./markdown-compatibility.md)を契約として維持します。公開手順は[publishing.md](./publishing.md)。

## 環境とコマンド

- Node.js 22.18以上、pnpm 11.11.0（`packageManager`とCIで固定）。Vite 8・Vite+ 1.6で検証。
- `pnpm check:jsr`にはDeno、結合試験にはChrome/Chromium・npm・ネットワークが必要です。
  Chromeを自動検出できない場合は`CHROME_PATH=/path/to/chrome`を指定します。

```sh
pnpm install --frozen-lockfile
pnpm build              # Viewerを生成し、dist/へJSと型を出力
pnpm dev                # examples/slides を起動。/slides/example/ と /slides/team/
pnpm build:example      # examples/slides/dist/ へ静的出力（pnpm previewで確認）
pnpm check              # format:check + lint + typecheck + Vitest
pnpm test:integration   # tarball導入、Vite/Vite+のdev/build/preview、Chromeでの発表操作・同期・印刷
pnpm check:jsr          # deno publish --dry-run
```

Vitestは`tests/integration/**`を除外しているため、`pnpm check`だけでは結合試験を実行しません。

## アーキテクチャ

```text
Markdown
  → parse/ (frontmatter + directive + reveal) → Deck AST (types.ts)
  → render/ (html + rich + theme)             → スライドHTML / テーマCSS
  → vite/plugin.ts                            → 仮想HTMLとViewer JS/CSS → Viteの標準HTML・アセット処理
```

| パス | 役割 |
| --- | --- |
| `mod.ts` | 公開エントリー（`presenit`と`PresenitOptions`） |
| `src/vite/plugin.ts` | glob・URL・入力の合成、仮想HTML/CSS、相対アセット・リンク、watch、dev middleware |
| `src/types.ts` | Deck/Slide/Column/configの型と既定値 |
| `src/parse/` | YAML、Markdown AST、ディレクティブ、ノート、sticky Reveal |
| `src/render/` | スライドHTML、数式・Mermaid・コード・Alerts、**スライド自体**のテーマCSS（`theme.ts`） |
| `src/client/viewer.ts` / `viewer.css` | **Viewer**（操作UI・状態・遷移・Overview・Presenter・同期・レーザー・印刷） |
| `src/generated/viewer.ts` | ViewerのJS/CSSを文字列化した生成物。手編集しない |
| `scripts/build.mjs` | Viewer生成、JS/型出力、`--package`でローカル配布用`tmp/package/` |
| `examples/slides/` | 開発・目視確認用のViteプロジェクト |
| `tests/` | 単体テスト（parse/render/rich/fonts/compatibility）と`integration/scenario.test.ts` |

- HTMLはVite root内の**ファイル形状のID**で`resolveId`/`load`から供給し、Viteの標準HTMLビルドを通します。
  既存アプリのrootを専用rootへ変更しないでください。devのHTMLは`server.transformIndexHtml`を通します。
- テーマCSSは`<link>`で読まれるため、devではViteが`?direct`付きの別モジュールとして扱います。
  Markdown変更時は`invalidateThemes()`でクエリ違いを含めて無効化します（frontmatterの反映に必要）。
- 新しいMarkdownはwatcherの`add`通知後に登録されます。作成直後にURLを開くと、まれに再読込が必要です。

## Viewerを変更するとき

1. `src/client/viewer.ts`・`viewer.css`を編集する。
2. `pnpm build`で`src/generated/viewer.ts`を再生成する（devサーバーは生成物の変更で自動再起動する）。
3. ソースと生成物の両方をコミットする。

状態は`index`/`step`/`blackout`/`laser`で、`update()`がDOMと同期を反映し、`navigate()`/`move()`が移動します。
BroadcastChannelで同じオリジン・デッキのタブを同期し、`#N`とsessionStorageでdev再読込時の位置を復元します。

設計上の前提:

- **テーマ連動**: プラグインが`<html>`へ`data-presenit-theme`と`--presenit-viewer-hue`を出力し、
  `--presenit-ui-*`トークンが周囲・操作UIの色を決めます。スクリプト実行前の初回描画から一致させるためです。
- **表示領域**: ステージはウィンドウ全体。操作バーは重ねて表示し、領域を確保しません。Presenterだけ常時表示。
- **操作バー**: `html.presenit-toolbar-shown`（下端へのマウス接近・メニュー表示中・タップ・初回ヒント）か
  `:has(:focus-visible)`で表示。非表示でもTabで到達できるよう`opacity`/`pointer-events`だけで隠します。
- **ページ遷移**: 新スライドを旧スライド（`.is-leaving`）の上でフェード/スライドさせ、背景を透けさせません。
  reduced motionとPresenterの初回同期では省略します。
- **Reveal表示**: ページ番号の下の点は「最初の表示 + 各ステップ」の数（9段以上は`3/12`）。位置表示の幅は固定。
- **キー**: ←/→/Space/Enter/PageUp/PageDownで移動、B/`.`でブラックアウト（プレゼンリモコン対応）。
- **アイコン**: 依存を増やさないよう`ICONS`に単純なSVGを自作しています。
- **印刷**: 操作UIを`display: none`にし、`transition`を無効化（Revealのフェード途中を印刷しない）。

変更後はlight/dark・fade/scroll/none・Presenter・全画面・ウィンドウサイズ、マウス/キーボード/タッチ、
Reveal・同期・印刷（全Reveal・1スライド1ページ・ノートとUIを含まない）を確認してください。
結合試験はボタンの`aria-label`、`.presenit-counter`と`.presenit-steps`の`data-step`/`data-max`を使います。
見た目に合わせて期待値を更新するのは構いませんが、機能の検証を削って通さないでください。

## 制限事項

- 通常のclient Viteアプリが対象。SSR専用framework・library build・複数Environmentは未対応/未検証。
- Markdown更新はfull reload（差分HMRなし）。タブ同期は同じブラウザ・オリジン内だけです。
- Google Fontsは外部ネットワークに依存し、取得できなければフォールバックします。
- 印刷結果はブラウザの紙サイズ・余白・ヘッダー設定に依存します。主な実ブラウザ検証はChromeです。
