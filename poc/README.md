# AXT Presen'it! Vite plugin PoC

既存CLIとは分離した技術検証です。本実装は開始していません。
TypeScript製の通常のViteプラグインで、利用者が用意するファイルはMarkdown、`vite.config.ts`、`package.json`だけです。

## 実行

Node.js 22.18以上を使用します。リポジトリ直下から:

```sh
cd poc
npm ci
cd examples/minimal
npm ci
npm run dev
```

`http://127.0.0.1:5173/slides/intro.html` と `/slides/team/update.html` を開きます。
`/` のランディングページは生成しません。

```sh
npm run build
npm run preview
```

出力は `examples/minimal/dist/slides/intro.html` と `dist/slides/team/update.html`。
Previewの既定ポートは4173です。任意の静的ホスティングでも配信できます。
ポートが使用中ならViteが表示するURLを使ってください。

```ts
import { defineConfig } from "vite";
import { presenit } from "@ayaexptech/presenit";

export default defineConfig({
    plugins: [presenit({ decks: { intro: "intro.md", "team/update": "update.md" } })],
});
```

`decks`のキーが`/slides/<key>.html`、値がVite root基準のMarkdownパスです。
PoCではファイルを明示列挙し、構成変更はVite configの更新で反映します。
通常のViteアプリへ追加する場合は、既存`index.html`または明示したHTML入力に追加します。
既存ファイルと衝突する出力名はエラーにします。

## 範囲と方式

- CommonMark → mdast → hast → sanitize → HTML。フレームワークと独自CLIはありません。
- `config`でHTML入力を追加し、`resolveId`/`load`でディスクにないHTMLを供給します。
- devの対象URLをmiddlewareで処理し、`server.transformIndexHtml`でVite clientと他プラグインのHTML変換を適用します。
- Markdownの監視変更で対象ページにViteの`full-reload`を通知します。差分HMRは未実装です。
- buildではViteの標準HTML処理を通します。previewには独自middlewareが不要です。
- HTML/CSSはパッケージ内のTSから生成し、`import.meta.url`から未変換TSやテンプレートファイルを探す設計を避けています。
- 標準Markdownのみを検証対象とし、frontmatter、独自ディレクティブ、GFM、数式、Mermaid、PDF、Presenterは未実装です。1ファイルを連続した文書として表示します。
- PoCの生HTMLは無効です。本実装での`rawHTML`互換性と信頼境界の検討は別途必要です。
- Vite 8のclient HTMLビルドが対象。SSR・library・複数Environmentビルドは対象外です。
- 画像のMarkdownファイル相対パス解決は未実装です。PoCでは`public`配下の画像を`/mark.svg`形式で指定できます。

詳細は[既存構文の互換性整理](./COMPATIBILITY.md)と[検証結果・推奨構成](./REPORT.md)を参照してください。

## 検証の再実行

`poc/`から:

```sh
npm run typecheck
npm test
npm run check:jsr
```

ブラウザテストにはローカルChrome/Chromiumが必要です。macOS/Linuxの一般的なパスを検出します。
それ以外は`CHROME_PATH=/path/to/chrome npm test`を使ってください。
テストは実際のVite CLIを起動し、Chromeで表示、再読込、リンク、静的出力、通常アプリとの共存を確認します。
JSRはdry-runのみで、公開やscope作成は行いません。

サンプルはローカル`file:`依存を使います。本公開後はJSRのnpm互換経由で導入し、同じパッケージ名からimportする想定です。
PoCの`private: true`は誤ったnpm公開を防ぐための設定です。
