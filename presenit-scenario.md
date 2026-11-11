## AyaExpTech Presen'it! (Vite Plugin version) 想定利用シナリオ

### 1. (登壇者)リポジトリのセットアップ

Vite+を使う場合、コマンドは以下の通り

```sh
cd my-project
vp create vite:application
vp add jsr:@ayaexptech/presen-it
```

Vite+を使わない場合、たとえばpnpmならコマンドは以下の通り

```sh
pnpm create vite
pnpm add jsr:@ayaexptech/presen-it
```

いずれの場合でも、Viteの設定ファイル(`vite.config.ts`)に以下のような記述を追加する

```ts
import { defineConfig } from "vite";
import presenit from "@ayaexptech/presen-it"; // import { presenit } from ... かも？

export default defineConfig({
  plugins: [
    presenit({
      // ※あくまでこれは仮のAPIなので変更の可能性あり
      /** スライドとなるmarkdownファイルのパス */
      includes: ["src/**/index.md"],
    }),
  ],
});
```

### 2. (登壇者)スライドをつくる

たとえば`src/slides/2026-11-12_example/index.md`を作って、そこにPresen'it! Directivesを含むMarkdownファイルを書いていく
`vp dev` / `pnpm run dev`で開発サーバーを開いて`/slides/2026-11-12_example/`にアクセスしたらビューワー表示がされて、それを参考にスライドを書ける

### 3. (登壇者)ビルドして公開する

`vp build` / `pnpm run build`でビルドする

- ビルド成果物フォルダをCloudflare Workersとかにデプロイすればそのまま公開できる
- `vp preview` / `pnpm run preview`でローカルでプレビューできる

### 4. (主に登壇者)ビューワーを使って発表する

デプロイ先で`/slides/2026-11-12_example/`にアクセスしたら普通にビューワー表示がされて、使える
あるいはdev, previewからビューワー表示出して発表時に使うとかでもいい。

- このビューワーは一般的なスライドツールにある機能は大体ある
  - オーバービューを持ち、スライド全体を並べて見てジャンプしたりできる
  - 発表者ビューを持ち、同じブラウザのタブ同士で表示状況(ページ、アニメーション)などが同期される
  - レーザーポインター機能がある
  - 発表者ビューにはタイマーがついてて、プレゼンターノートも表示される

### 5. PDFをダウンロードする

ビューワーのメニューかどこかに「PDFとしてダウンロード」ボタンがあって、それを押すとスライドをPDFとしてダウンロードできる

(これは事前生成でもブラウザ印刷でもその場で生成でもよくて、PDFを得ることができればOK)
