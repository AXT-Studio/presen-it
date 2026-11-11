# AXT Presen'it! v2

通常のMarkdownに少しのディレクティブを加えて、読みやすいプレゼンテーションを作るViteプラグインです。
ライブプレビュー、複数デッキの静的ビルド、発表者ビュー、ブラウザ印刷によるPDF保存に対応します。
独自CLIや、Viewer用のHTML・TSエントリーは必要ありません。

## セットアップ

Node.js 22.18以上、Vite 8を使用します。パッケージは[JSR](https://jsr.io/@ayaexptech/presen-it)で配布しており、
パッケージ名・import名はどちらも`@ayaexptech/presen-it`です。

```sh
pnpm add -D jsr:@ayaexptech/presen-it
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import presenit from "@ayaexptech/presen-it";

export default defineConfig({
    plugins: [presenit({ includes: ["src/**/index.md"] })],
});
```

`src/slides/example/index.md`へMarkdownを書き、通常の`vite`を起動します。
`/slides/example/`へアクセスするとViewerが表示されます。既存アプリの`index.html`があっても共存します。

```sh
vite
vite build
vite preview
```

`dist/slides/example/index.html`と、Viteが処理した画像・JS・CSSが出力されます。
`dist/`全体をディレクトリのindex.html配信に対応した静的ホストへ配置してください。
サブパス配信はViteの`base: "/project/"`、移動可能な相対パス配信は`base: "./"`を設定します。

### Vite+

通常のVite+プロジェクトを作成してパッケージを追加します。

```sh
vp create vite:application
vp add jsr:@ayaexptech/presen-it
vp dev
vp build
vp preview
```

Vite+では`defineConfig`を`vite-plus`からimportし、同じ`presenit(...)`をpluginsへ追加します。
Vite+の標準テンプレートにあるVite core alias/override設定をそのまま使います。
通常のViteを手動で追加する必要はありません。

### 対象ファイルとURL

```ts
presenit({
    includes: ["src/**/*.md"],
    root: "src", // URLの基準。Viteのroot自体は変更しない
    excludes: ["src/**/draft/**"],
})
```

| Markdown | URL | 出力 |
| --- | --- | --- |
| `src/slides/example/index.md` | `/slides/example/` | `dist/slides/example/index.html` |
| `src/slides/meeting.md` | `/slides/meeting/` | `dist/slides/meeting/index.html` |
| `talks/keynote.md` (`root: "talks"`) | `/keynote/` | `dist/keynote/index.html` |

`includes`と`excludes`はVite root基準のglob、`root`はMarkdownの配置の基準です。
ファイルの編集・追加・削除、参照画像の変更をdevへ反映します。
相対画像はMarkdownファイル基準で解決し、選択済みMarkdown同士の相対リンクはViewerのURLへ変換します。
`public`内のアセットはViteの通常の規約で利用できます。URLや既存HTMLとの衝突はエラーです。

### デッキ一覧を取得する

`virtual:presenit/decks`から、選択されたデッキのメタデータを通常のアプリのコードでimportできます。
一覧ページそのものは生成しないため、表示はアプリ側で自由に作れます。

```ts
// src/main.ts
import { decks } from "virtual:presenit/decks";

for (const deck of decks) {
    console.log(deck.title, deck.url, deck.slideCount);
}
```

型は`@ayaexptech/presen-it/decks`が持っています。JSRはアンビエントモジュール宣言を配布できないため、
仮想モジュールの型はプロジェクト側の`.d.ts`で次のようにつなぎます。

```ts
// src/env.d.ts
declare module "virtual:presenit/decks" {
    export * from "@ayaexptech/presen-it/decks";
}
```

`import { decks } from "@ayaexptech/presen-it/decks"`と書いても同じモジュールになり、この宣言は不要です。
どちらもプラグインが生成するため、`presenit()`を設定したViteの外ではimportできません（例外を投げます）。

| プロパティ | 型 | 内容 |
| --- | --- | --- |
| `url` | `string` | ViewerのURL（Viteの`base`込み、`/`終わり）。例: `/demo/slides/example/` |
| `route` | `string` | `base`を除いたURL。例: `/slides/example/`。一意なのでkeyに使えます |
| `source` | `string` | Vite root基準のMarkdownパス。例: `src/slides/example/index.md` |
| `title` | `string` | Viewerの`<title>`と同じ値（未設定時は`AXT Presen'it! — <route>`） |
| `description` | `string` | frontmatterの`description`（未設定時は`""`） |
| `slideCount` | `number` | スライド（ページ）数 |
| `theme` / `hue` | `"light" \| "dark"` / `number` | 正規化済みのテーマと色相 |
| `width` / `height` | `number` | スライドの寸法（px）。サムネイルの縦横比などに |
| `frontmatter` | `Record<string, unknown>` | 書かれたままのfrontmatter（JSON互換値）。`date`や`tags`など独自キーも含む |

- 並び順はMarkdownのパス順です。必要ならアプリ側で並べ替えてください。
- 値はViewerと同じパーサーで読み取ります。frontmatterや記法の意味は変わりません。
  未知のキーは従来どおりViewerでは無視され、`frontmatter`からだけ参照できます。
- `url`は`base: "/project/"`やURLのbaseを含みます。`base: "./"`のビルドでは、
  Viteのアセットと同様にバンドルされたJSの位置から解決した完全なURLになります。
- devではMarkdownの追加・削除で再読込し、編集ではメタデータが変わったときだけ、
  このモジュールを使うページを更新します（`import.meta.hot.accept`で受け取ることもできます）。
- importしたアプリのJSには、全デッキの`frontmatter`がそのまま含まれます。公開したくない値は書かないでください。

[examples/slides](./examples/slides/)の`index.html`と`src/main.ts`が一覧ページの例です。

## Markdownの記法

### Frontmatter

```yaml
---
title: My Talk # viewer HTML <title> / og:title（未設定時は AXT Presen'it! — <slug>）
description: Short blurb # meta description / og:description（未設定時は省略）
theme: light # light | dark（既定: light）
hue: 210 # アクセント色相 0–359（既定: 210）
width: 1920 # px（既定: 1920）
height: 1080 # px（既定: 1080）
fontSize: 32 # 基準フォントサイズ px（既定: 32）
fontFamily:
    sans: '"M PLUS 1", system-ui, sans-serif' # CSS font-family（既定この値）
    mono: '"M PLUS 1 Code", ui-monospace, monospace'
pageTransition:
    type: fade # none | fade | scroll（既定: fade）
    duration: 0.2 # 秒（既定: 0.2）。PDF印刷 では無視
animation:
    duration: 0.3 # 秒（既定: 0.3）。同一スライド内 reveal のフェード
rawHTML: false # true で生 HTML を描画（既定: false）
break: soft # soft | hard（既定: soft）。soft で段落内の単改行を <br> に
footer: "" # 全スライド左下に表示するテキスト（既定: 空 = 非表示）
---
```

| Key                         | Default                                              | Notes                                          |
| --------------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| `title`                     | `""`                                                 | viewer HTML の `<title>` / `og:title`          |
| `description`               | `""`                                                 | 設定時のみ description / `og:description`      |
| `theme`                     | `light`                                              | `light` \| `dark`                              |
| `hue`                       | `210`                                                | アクセント色相（mod 360）                      |
| `width` / `height`          | `1920` / `1080`                                      | スライドサイズ（px）                           |
| `fontSize`                  | `32`                                                 | 基準フォントサイズ                             |
| `fontFamily.sans` / `.mono` | M PLUS 1 / M PLUS 1 Code（上記 YAML の既定スタック） | CSS 文字列、またはフォント名の配列             |
| `pageTransition.type`       | `fade`                                               | `none` \| `fade` \| `scroll`（PDF では無視）   |
| `pageTransition.duration`   | `0.2`                                                | 秒。`0` で実質オフ                             |
| `animation.duration`        | `0.3`                                                | 同一スライド内 reveal のフェード秒数           |
| `rawHTML`                   | `false`                                              | `true` のとき生 HTML を描画する                |
| `break`                     | `soft`                                               | `soft` \| `hard`（段落内の改行の扱い）         |
| `footer`                    | `""`                                                 | 全スライド左下に表示するテキスト（空で非表示） |

`fontFamily` は通常の CSS 文字列のほか、**配列**でも書けます（空白入りの名前に便利）。

```yaml
fontFamily:
    sans: Ubuntu, "M PLUS 1", system-ui, sans-serif
    mono: "JetBrains Mono", "M PLUS 1 Code", ui-monospace, monospace
```

```yaml
fontFamily:
    sans: [Edu VIC WA NT Hand, Zen Kurenaido, cursive]
```

名前付きファミリー（`serif` / `system-ui` などの総称以外）は Google Fonts から自動取得を試みます（端末に入っているフォントが優先）。

### Directives

`slide-break` / `column-break` はブロックのあいだに単独で置きます。`reveal` はインライン（リスト行末・段落途中・強調の内側など）にも置けます。

```html
<!-- presen-it! slide-break -->
<!-- presen-it! column-break -->
<!-- presen-it! slide-break (center-x=true) -->
<!-- presen-it! column-break (center-x=true&center-y=false) -->
<!-- presen-it! reveal -->
<!-- presen-it! reveal (at=2) -->
```

- コマンド: `slide-break`, `column-break`, `reveal`
- 整列オプション（break 系）: `center-x=true|false`, `center-y=true|false`（`=` / `&` の前後に空白なし）
- reveal: `at=N`（非負整数）。省略時は `at=0`
- 既定: `center-x=false`, `center-y=true`
- カラムの指定がスライド指定より優先
- frontmatter 直後の `slide-break` は 1 枚目のレイアウト指定に使えます（空ページは作りません）

#### Reveal詳細

同一スライド内でクリックのたびに順次(ステップ)表示することができます。

- (ほとんど)すべての要素は、同じページ内で直前に書かれた`reveal`宣言の`at`の回数クリックしたときに表示されます。
    - 飛び番号は空クリックとして処理されます。
    - 次のスライドから戻ってきた場合は最終ステップの状態に戻ります。
    - PDFやOverviewではステップ表示は無視されてすべて表示されます。
    - プレゼンタービューのNextは次ステップをプレビューします。
    - スライドのタイトルとなったh2は指定にかかわらず常に表示されます。
    - 行頭の`<!-- ... -->` の**同じ行に**本文を続けないでください。
        - Markdown が行全体を HTML ブロックとして扱ってしまうため。
        - ブロックの `reveal` は単独行にし、インラインは段落やリストの途中／末尾に置きます。

```md
<!-- presen-it! slide-break -->

この文章は最初から表示されている

<!-- presen-it! reveal (at=1) -->

この文章は一回クリックすると表示される

<!-- presen-it! column-break -->

この文章も一回クリック時点で表示される (reveal宣言はcolumnをまたぐ)

<!-- presen-it! reveal (at=2) -->

- 2回目のクリックで表示される<!-- presen-it! reveal (at=3) -->
- 3回目のクリックで表示される<!-- presen-it! reveal (at=4) -->
- 4回目のクリックで表示される<!-- presen-it! reveal (at=3) -->
- 3回目のクリックで表示される

<!-- presen-it! reveal -->

この文章は最初から表示されている (atの指定がない場合は0とみなす)

<!-- presen-it! reveal (at=5) -->

この部分は5回目のクリックで表示され、<!-- presen-it! reveal (at=6) --> この部分は6回目のクリックで表示される。

<!-- presen-it! reveal (at=7) -->

7<!-- presen-it! reveal (at=8) -->, 8<!-- presen-it! reveal (at=9) -->, 9<!-- presen-it! reveal (at=10) -->, 10!
```

スピーカーノートは HTML コメント（投影には出ず、Presenter に表示）。

### Rich content

- コードフェンス → **Shiki**
- `$...$` / `$$...$$` → **KaTeX**
- ` ```mermaid ` → **beautiful-mermaid**
- GitHub alerts → スライド向けの `aside`（`NOTE` / `TIP` / `IMPORTANT` / `WARNING` / `CAUTION`）

```md
> [!NOTE]
> Useful context.

> [!WARNING]
> Confirm this before continuing.
```

## 発表する

スライドはウィンドウいっぱいに表示され、操作バーは普段は隠れています。
画面下部へマウスを近づける、Tabキーでフォーカスを移す、タッチ端末ではスライドをタップすると、
アイコンの操作バー（前へ・ページ番号・次へ・一覧・レーザー・フルスクリーン・メニュー）が現れます。
各ボタンはマウスを重ねるとラベルとショートカットキーを表示します。
ページ番号の下の点はスライドの表示段階（最初の表示とRevealの各ステップ）で、表示済みの段階が塗られます。
Revealのないスライドは点1つです。周囲の背景と操作バーの配色はデッキの`theme`/`hue`に合わせます。

Overviewではスライドを選択して移動できます。メニュー（︙）から発表者ビューを別タブで開くと、
同じデッキのページ・Reveal・ブラックアウト・レーザーが双方向で同期します。
Presenterには次の表示、経過時間、スピーカーノートが表示され、操作バーは常に表示されます。

| キー | 操作 |
| --- | --- |
| ← / → / Space / Enter / PageUp / PageDown | 前後（Revealのステップを優先）。PageUp/PageDownはプレゼンリモコン向け |
| Home / End | 最初 / 最後 |
| O | Overview |
| P | 発表者ビューを別タブで開く |
| F | フルスクリーン |
| L | レーザーの切替 |
| B / . / Esc | ブラックアウト切替 / 切替（プレゼンリモコン向け） / 解除 |
| T / R | Presenterのタイマー停止再開 / リセット |
| Esc | 開いたメニュー・キーボードで表示した操作バーを閉じる |

タッチ操作では左右のスワイプで前後に移動します。ブラックアウト中は画面のクリックでも解除できます。

URLの`#N`は1始まりのページ番号です。devの更新時はページとReveal状態を保持します。
`?presenter`を付けて発表者ビューを直接開くこともできます。
タブ同期にはBroadcastChannelを使用するため、同じブラウザ・同じオリジンで開いてください。
フルスクリーン等が制限されている場合は、ブラウザのメニューを利用できます。

## PDFとして保存する

操作バーの「メニュー」（︙）→「PDFとして保存」を押し、ブラウザの印刷画面で「PDFに保存」を選びます。
全Revealを表示し、1スライドを1ページとして印刷します。Viewerの操作UI・ノートは入りません。
印刷設定は余白なし・倍率100%・ヘッダーとフッターなしを推奨します。
スライドの寸法と縦横比はfrontmatterのwidth/heightに従います。
ビルド時のPDF生成やブラウザ自動操作ライブラリは利用者の依存に含まれません。

## v1からの移行

- npmの`@ayaexptech/presenit`からJSRの`@ayaexptech/presen-it`へ変更。
- `presenit init/dev/build/export`は廃止。Viteの通常の設定とコマンドへ置換。
- `src/<slug>/slide.md`は必須ではありません。旧ファイルも`includes`で指定できます。
- 既存のfrontmatter・ディレクティブ・Markdown拡張の意味と既定値は維持します。
- title未指定時の製品名は`AXT Presen'it! — <deck path>`へ変更。
- 出力URLとViewerの操作部・内部APIは新しくなりました。

## このリポジトリで開発する

```sh
pnpm install
pnpm build
pnpm dev
pnpm check
pnpm test:integration
pnpm check:jsr
```

サンプルURLは`/slides/example/`と`/slides/team/`、デッキ一覧の利用例は`/`です。
`build`はViewerをJS/CSS文字列のTSモジュールへ生成し、プラグインのJSと型定義を`dist/`へ出力します。
生成した`src/generated/viewer.ts`をコミットするため、JSR利用者に追加のビルド工程を要求しません。
ブラウザ試験はChrome/Chromiumが必要です。自動検出できない場合は`CHROME_PATH`を指定します。
結合テストはtarballを空のプロジェクトへ導入し、ソースsymlinkに依存せず検証します。

構成・Viewerの設計・確認事項は[docs/development.md](./docs/development.md)、
入力の互換性は[docs/markdown-compatibility.md](./docs/markdown-compatibility.md)、公開手順は[docs/publishing.md](./docs/publishing.md)を参照してください。

## License

MIT
