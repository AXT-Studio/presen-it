# 公開手順

パッケージ名・import名は`@ayaexptech/presen-it`（[JSR](https://jsr.io/@ayaexptech/presen-it)）。
旧npmパッケージ`@ayaexptech/presenit`（v1）とは別物です。公開は所有者が明示的に行い、CIは公開しません。

## 公開物の構成

- `jsr.json`はTSソースの`mod.ts`を公開エントリーとし、`src/client/**`は公開から除外します。
- ViewerはTS/CSSから生成した`src/generated/viewer.ts`（文字列モジュール）で配布します。
  JSR利用者にViewerのビルドやHTML/TSエントリー作成を求めません。生成物は必ずコミットします。
- 相対TS importの拡張子を維持し、公開APIの型を明示します（slow types対策）。
- `package.json`と`jsr.json`の名前・versionを揃えます。

## 公開前の確認

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm check
pnpm test:integration
pnpm check:jsr
```

`pnpm test:integration`は`node scripts/build.mjs --package`で`tmp/package/`へJS/型の配布形態を作り、
tarballを空のプロジェクトへnpm installしてVite・Vite+の操作を試験します。
これはJSRのnpm互換変換そのものの検証ではないため、公開後に実際のJSRから導入する確認も推奨します。

## 公開

1. `package.json`と`jsr.json`のversionを更新し、`CHANGELOG.md`へ記載する
   （プレリリースは`2.0.0-rc.1`のようなSemVer形式）。
2. 上記の確認を通してコミットする。
3. `deno publish`（または`npx jsr publish`）で公開する。手動の検証用に`.github/workflows/release.yml`もある（公開はしない）。
4. 別の空プロジェクトで`pnpm add -D jsr:@ayaexptech/presen-it`（Vite+は`vp add`）を行い、dev/build/previewを確認する。

Vite+プロジェクトでは公式テンプレートのVite core alias/overrideを使います。
JSRの導入方法・ESM・npm依存・型制約は[公式公開ガイド](https://jsr.io/docs/publishing-packages)を参照してください。
