# v2パッケージの検証と公開

JSR名・import名: `@ayaexptech/presen-it`。旧npm名`@ayaexptech/presenit`とは異なる。
通常の開発作業やCIではレジストリへ公開しない。公開は所有者の明示的な依頼後に別途行う。
GitHub Release公開をトリガーにした旧npm自動publishは廃止した。

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm check
pnpm test:integration
pnpm check:jsr
```

`pnpm build`でViewerのTS/CSSから`src/generated/viewer.ts`を生成する。
このファイルをコミットし、`jsr.json`で明示したESM/TypeScriptソースを公開する。
JSR利用者にViewerのビルドやHTML/TSエントリー作成を求めない。
`package.json`と`jsr.json`のversionを揃える。公開APIはmod.tsのプラグインとOptionsのみ。

`node scripts/build.mjs --package`は同じソースと生成Viewerからローカル配布用のJS/型を作り、
`tmp/package/`へ配置する。結合テストはここからtarballを作り、空のプロジェクトへインストールする。
ソースsymlinkや開発用node_modulesがない状態でVite・Vite+の操作を試験する。
これはレジストリのnpm互換変換そのものを検証するものではないため、公開後のJSR取得試験も推奨する。

Vite+プロジェクトでは公式テンプレートのVite core alias/overrideを使用する。
手動npm導入の場合は[Vite+ Project-local CLI](https://viteplus.dev/guide/local-cli)に従う。
JSRの導入方法・ESM・npm依存・型制約は[公式公開ガイド](https://jsr.io/docs/publishing-packages)を参照。
