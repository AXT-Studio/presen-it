# AyaExpTech Presen'it!

[![JSR: Click to read overview](https://jsr.io/badges/@ayaexptech/presen-it?label=Latest%20version)](https://jsr.io/@ayaexptech/presen-it)

Markdownから簡単に整ったプレゼンスライドを作ることができるViteプラグインです。

- Markdownに(HTMLコメント形式の)Directiveを少し加えるだけで、改ページ・段組み・段階表示をすることができます
- ライブプレビュー、複数デッキの静的ビルド、発表者ビュー、ブラウザ印刷によるPDF保存に対応しています

Landing Page: [`https://axt-studio.github.io/presen-it/`](https://axt-studio.github.io/presen-it/)

> [!CAUTION]
> このツールは、そのほとんどがAIによって実装された、いわゆるVibe-Codingプロダクトです。  
> AIへの指示を行った私(綾坂こと)自身が使用しているためある程度品質については保証しますが、コードベースのほとんどをAIエージェントに委任しているプロダクトであることには留意してください。  
> なお、使用ツール・モデルは以下のとおりです。
>
> - Codex: GPT-6.1 Sol
> - Claude Code: Claude Opus 5.5
> - Cursor: Grok 4.7, Composer 2.5

GPT-6.1 Sol (Codex)・Claude Opus 5.5 (Claude Code)です。

## License

copyright (c) 2026- Ayasaka-Koto(AyaExpTech).  
Released under the [MIT License](LICENSE).

## Quick Start

Vite+をお使いの方は、[`vp create`](https://viteplus.dev/guide/create#template-sources)コマンドを用いてスターターテンプレート([`AXT-AyaKoto/axt-presen-it-template`](https://github.com/AXT-AyaKoto/axt-presen-it-template))を展開できます。

```sh
vp create github:AXT-AyaKoto/axt-presen-it-template
```

---

## 使い方

以降、資料の1枚1枚を「ページ」、ページをまとめた資料のことを「デッキ」と呼びます。

### インストール・セットアップ

Vite 8(以上)導入済みのプロジェクトに、`@ayaexptech/presen-it`を追加します。

```sh
pnpm add -D jsr:@ayaexptech/presen-it  # pnpmを使う場合
vp add -D jsr:@ayaexptech/presen-it    # Vite+を使う場合 (pnpm or yarn使用時限定)
```

そのうえで、`vite.config.ts`に`presenit`をプラグインとして使用するよう記述します。

```ts
// vite.config.ts
import { defineConfig } from "vite";
import presenit from "@ayaexptech/presen-it";

export default defineConfig({
    plugins: [presenit()],
});
```

#### `presenit()`のオプション

`presenit()`には以下のプロパティを持つオブジェクトをオプションとして与えることができます。

- `includes: string[]` (既定値: `["src/**/index.md"]`)
    - 変換対象となるMarkdownファイルにヒットするglobパターンの配列です
- `excludes: string[]` (既定値: `[]`)
    - 変換対象から除外するMarkdownファイルにヒットするglobパターンの配列です
- `root: string` (既定値: `src`)
    - デッキのビューワーのURLの基準ディレクトリを表す文字列です
- `siteUrl?: string` (既定値: なし)
    - 公開先のURLです。`og:image`, `og:url`を設定するためのもので、OGP設定が不要であれば設定しなくて良いです
- `ogImage: boolean` (既定値: `true`)
    - 本番ビルドで`og:image`にデッキの1ページ目を設定する場合`true`を指定します

> [!NOTE]
>
> - いずれも**Viteプロジェクトのルート**からの相対パスとして処理されます
> - プラグイン設定側の`root`は、Vite設定側の`root`とは異なる設定です
> - `includes`・`excludes`の記述にかかわらず、`node_modules`・`dist`・`.git`以下は常に除外されます
> - `siteUrl`は、Vite設定の`base`が`/`始まりならオリジン、`./`なら出力ディレクトリ直下を基準とするパスとして扱われます
>     - `base`がデプロイ先の完全なURLのときは、`siteUrl`の設定は不要です
>     - たとえば`base`が`/my-talks/`、`siteUrl`が`https://example.com`のとき、`/slides/example/`の`og:image`は`https://example.com/my-talks/slides/example/ogp.png`と設定されます
> - 本番ビルド時、`og:image`の撮影のためにChromeかChromiumを用います
>     - 自動検出が失敗する場合は環境変数`CHROME_PATH`で実行ファイルを指定してください
>     - ChromeやChromiumが見つからない場合や撮影に失敗した場合は、警告を出したうえで`og:image`の出力を省いてビルドを続行します
>     - なお、GitHub Actionsの`ubuntu-latest`にはChromeが入っていて、環境変数`CHROME_PATH: /usr/bin/google-chrome`を指定することでビルドに成功します

変換対象のMarkdownファイルのパスから、ビルド成果物におけるビューワーのパスへの変換規則は以下のとおりです。

- 変換対象のMarkdownファイルの、プラグイン設定の`root`からの相対パスを用意します
- そこから末尾の`.md`を取り除きます
- 末尾が`index`ならそれも取り除きます
- 末尾が`/`でないなら`/`を加えます

たとえば、Vite設定の`base`が`"/"`、プラグイン設定の`root`が`"src"`のとき、以下のように変換されます。

| Markdown                      | 閲覧URL            | ビルド先（既定では`dist/`内） |
| ----------------------------- | ------------------ | ----------------------------- |
| `src/slides/example/index.md` | `/slides/example/` | `slides/example/index.html`   |
| `src/slides/team.md`          | `/slides/team/`    | `slides/team/index.html`      |
| `src/index.md`                | `/`                | `index.html`                  |

> [!TIP]
>
> - 対象Markdownファイルがプラグイン設定の`root`の外にある場合はエラーになります
> - 同じURLになる変換対象Markdownファイルが複数ある場合もエラーになります
>     - なお、URLの重複は大文字・小文字を区別せずに判定します
> - 生成先と同じ場所に既存のHTMLファイル(`public/`含む)がある場合もエラーになります
> - 上記を満たさない限り(別のURLになるように配置する限り)、通常のViteのHTMLページとデッキを同じプロジェクトに置くことができます

### デッキ(スライド)を作る

デッキは、先の`presenit()`のオプションで指定した場所にあるMarkdownファイルを編集することで作ります。

#### デッキ全体の設定

Frontmatter (先頭の`---`で囲んだYAML)で、デッキ全体の設定を行うことができます。
以下は既定値です。

```yaml
title: ""
description: ""
theme: light
hue: 210
width: 1920
height: 1080
fontSize: 32
fontFamily:
    sans: [M PLUS 1, system-ui, sans-serif]
    mono: [JetBrains Mono, ui-monospace, monospace]
pageTransition:
    type: fade
    duration: 0.2
animation:
    duration: 0.3
break: soft
footer: ""
rawHTML: false
```

- `title`: Viewer HTMLの`<title>`と`og:title`に用いられます (空なら`AXT Presen'it! — <route>`)
    - デッキ自体に表示するタイトルは`# タイトル`のように本文に書いてください
- `description`: 設定した場合のみ、`meta description`と`og:description`にその文字列が出力されます
- `theme`: `light` or `dark`
- `hue`: アクセントカラーの色相(oklch基準)で、mod 360で循環します
- `width`, `height`: デッキの幅と高さ。単位はpxで、正の数を指定する必要があります
- `fontSize`: フォントサイズ。単位はpxで、正の数を指定する必要があります
- `fontFamily.sans`: 本文用のフォント
- `fontFamily.mono`: コードブロック用のフォント
- `pageTransition.type`: `fade` or `scroll` or `none`
- `pageTransition.duration`: ページ切り替えの秒数。`0`で即時切り替え
- `animation.duration`: Reveal(後述)のフェードの秒数。`0`で即時表示
- `break`: `soft` or `hard`。段落内の単改行を改行として表示したい場合は`soft`を指定
- `footer`: 全ページの左下に指定した文字列を挿入できます
- `rawHTML`: Raw HTMLの記述をHTMLとして読ませたい場合は`true`を指定

> [!NOTE]
> `fontFamily.sans`と同`mono`は、CSS `font-family`文字列か、フォント名の配列を受け取ります。
> 名前付きフォントを指定した場合はGoogle Fontsからの取得を試みます。
> `[system-ui, sans-serif]`や`[ui-monospace, monospace]`などの総称フォントを指定することもできます。

> [!TIP]
> ここに記載のない独自のキーは描画では用いられませんが、後述するデッキ一覧取得機能から参照することができます。

#### 改ページ・改カラム

`<!-- presen-it! slide-break -->`をブロックの間に単独行で置くと改ページします。

> [!TIP]
>
> - 最初の改ページより前が自動的に1ページ目になります
> - frontmatterの直後の`slide-break`による空ページの作成は行われません
> - 各ページの最初のブロックが`## 見出し`なら、カラムの上に共通のページ見出しとして表示します
>     - `# 見出し`や、本文の途中にある`## 見出し`は本文内に表示します
> - 見出しや水平線`---`などによる改ページは行われません
> - 本文の量に応じた自動改ページは行いません
>     - 収まらないときはページを分けるか、文章量や`fontSize`を調整してください

`<!-- presen-it! column-break -->`をブロックの間に単独行で置くと、それ以降の本文を右隣のカラムに分けます。

> [!NOTE]
>
> - 最初の改カラムより前が自動的に最も左のカラムになります
> - カラムは等幅で横に並び、空のカラムは取り除かれます
> - 4カラム以上のページがある場合はビルド時に警告がでます

`slide-break`・`column-break`には、配置のオプションを付けることができます。

- `center-x` (既定値: `false`)
    - 水平方向の整列方法を指定します
    - `false`で左揃え、`true`で中央揃えとなります
- `center-y` (既定値: `true`)
    - 垂直方向の整列方法を指定します
    - `false`で上揃え、`true`で中央揃えとなります

> [!NOTE]
>
> - `slide-break`に書いた指定はページ内全カラムに適用されます
> - `column-break`に書いた指定は`slide-break`側の指定をそのカラムだけ上書きします
> - 複数のオプションは`(center-x=true&center-y=false)`のように`&`で繋いで書きます
>     - `=`や`&`の前後に空白を入れてはいけません

> [!TIP]
> ページ先頭の`##`を共通見出しにせず本文側に入れたいときは、`slide-break`の直後に`column-break`を置いてから書けばよいです。

#### 段階表示 (Reveal)

`reveal`ディレクティブを用いることで、同一ページ内で「次へ」を押すたびに要素を順に表示していくような挙動を設定することができます。

```md
- 最初から見える項目<!-- presen-it! reveal (at=1) -->
- 1回目で現れる項目<!-- presen-it! reveal (at=2) -->
- 2回目で現れる項目

この部分も2回目。<!-- presen-it! reveal (at=3) -->**ここからは3回目**。

<!-- presen-it! reveal -->

ここは最初から見える。
```

- `(at=N)`で「`N`回次へを押したときに表示される」よう指定できます
    - `N`は非負整数を指定する必要があります
    - `(at=N)`自体を省略した場合、`(at=0)`として扱われます
- 指定は**後ろに続く内容**に適用され、次の`reveal`か改ページまで効果が持続します
    - カラムをまたいでも指定の効果は持続します

> [!TIP]
>
> - 番号を飛ばして指定した場合、「次へ」を押しても何も変化しないような挙動をとります
> - 「前へ」を押した場合段階を戻ります
>     - 前のページに戻るときは、戻った先のページの最終段階を表示します
> - スライド一覧・PDFではすべての段階を表示した状態で描画されます

> [!NOTE]
>
> - ブロックに対してRevealを適用したい場合は、指示の前後に空行を入れて単独行にしてください
>     - 行頭のHTMLコメントと同じ行に本文を書くと、Markdownがその行をHTMLブロックとして扱い意図どおりに表示されません
> - 不明なコマンドや不正なオプションがあった場合は、警告を出したうえでその指示全体を無視して続行します

#### 発表者ノート

各ページの末尾に通常のHTMLコメントを(独立したブロックとして)記述すると、それが発表者ノートとして扱われます。  
ノートは発表者ビューにのみ表示され、聴衆向けの投影画面やPDFには表示されません。

> [!NOTE]
>
> - ページ内最後の絡むの末尾以外のコメントはノートとして扱われません
> - ノートの内容自体は生成されるHTMLに含まれるため、公開するデッキの発表者ノートには公開できない内容を書かないよう注意してください

#### コード・数式・図

一般的なMarkdown記法に加えて、以下の記法に対応しています。

- 表・取り消し線・タスクリスト
    - GitHub Flavored Markdownの記法に対応しています
    - チェックボックスは閲覧専用になります
- コードブロック
    - 言語名指定のあるコードブロックは[Shiki](https://shiki.style/languages)によってSyntax Highlightされます
- 数式
    - KaTeXを用いて描画されます
    - `$`で囲むとインライン数式として描画できます(例: `$E = mc^2$`)
    - `$$`で囲んだブロックは数式ブロックとして描画されます
- Mermaid
    - [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid)が対応している範囲に限り、言語名として`mermaid`を指定したコードブロックが図(SVG)に変換されて描画されます
- アラート(脚注)記法
    - `> [!NOTE]`のようなGitHubと同様の記法が使えます
    - 対応しているワードは`NOTE`・`TIP`・`IMPORTANT`・`WARNING`・`CAUTION`です
- Raw HTML
    - Frontmatterで`rawHTML: true`を指定することで、HTMLを埋め込むことができるようになります
    - この指定がない場合、Raw HTMLはHTMLとして解釈されずに文字列としてそのまま表示します
        - 各種Directiveと発表者ノートは`rawHTML: false`のままでも使えます

#### 画像・リンク

画像やリンクの相対パスは、Markdownファイルの場所を基準に解決されます。

> [!TIP]
> 画像を`slides/xxx/index.md`と同じディレクトリの`assets/`以下に置くなどすると、デッキを1つのディレクトリで管理することができます。

> [!NOTE]
>
> - 別のスライド変換対象Markdownファイルへの相対リンクは、そのデッキの閲覧URLに自動変換されます
>     - `#N`をつけることでページ番号を指定することもできます
>     - `#N`だけ書くと同じデッキのページ内リンクになります
> - `public/`内の画像も、Viteの通常の規約どおりに参照できます
>     - 存在しない相対画像を参照するとエラーになります

### サイトで公開する

普通にViteビルドすればよいです。  
Vite+を適切に使っている場合は`vp dev`, `vp build`を使うことができます。

> [!NOTE]
> サブディレクトリで公開する場合は、Viteの`base`を設定します。  
> たとえば次の設定では、デッキのURLは`/my-talks/slides/example/`になります。
>
> ```ts
> export default defineConfig({
>     base: "/my-talks/",
>     plugins: [presenit()],
> });
> ```

> [!TIP]
>
> - `base: "./"`による相対パスでのビルドにも対応しています
> - 通常の`index.html`がある場合はスライドと一緒にビルドされます
>     - たとえば、デッキの一覧ページを作ることができます
> - Presen'it!はクライアント向けのHTMLビルド用で、ViteのライブラリモードとSSRビルドには対応していません

### 発表する

Viewerページを開けば直感的に操作できると思うので詳しい説明は省きます。  
操作メニューはページ中央下部にマウスオーバーすることで表示されます。スマホなどではスライドをタップすれば表示されます。

> [!TIP]
>
> - ページ送りは`→`, `Space`, `Enter`, `PageDown`で、戻しは`←`, `PageUp`で行うことができます
>     - ほとんどのプレゼンリモコンのページ送り・戻しボタンはこれらのいずれかのキーを送信するはずです

> [!NOTE]
>
> - 投影画面と発表者ビューのページ・Reveal・ブラックアウト・レーザーを同期する機能があります
>     - ただし、同期は同じブラウザ・同じオリジンで同じデッキを開いた場合に限ります

### PDFとして保存する

1. 操作バーのメニュー（︙）から「PDFとして保存」を選びます。
2. ブラウザの印刷画面で、送信先に「PDFに保存」を選びます。
3. 余白なし・倍率100%・ヘッダーとフッターなしを指定し、必要に応じて背景の印刷を有効にして保存します。

> [!NOTE]
> PDFはブラウザの印刷機能で保存します。`vite build`でPDFが自動生成されるわけではありません。

### デッキ一覧を取得する

一覧ページの制作などのために、Presen'it!を設定したViteプロジェクト内で、次のモジュールが使用できます。

```ts
import { decks, type PresenitDeck } from "@ayaexptech/presen-it/decks";

for (const deck of decks) {
    console.log(deck.title, deck.url, deck.slideCount);
}
```

`decks`は以下のプロパティを持つオブジェクトの配列です。

| プロパティ         | 型                                  | 内容                                                                |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------- |
| `url`              | `string`                            | Viteの`base`を含む閲覧URL。末尾は`/`                                |
| `route`            | `string`                            | `base`を除いたURL（例：`/slides/example/`）。一意なキーとして使える |
| `source`           | `string`                            | ViteのプロジェクトルートからのMarkdownの相対パス                    |
| `title`            | `string`                            | Viewerの`<title>`と同じ値。未設定時の代替タイトルも反映             |
| `description`      | `string`                            | frontmatterの`description`。未設定なら空文字列                      |
| `slideCount`       | `number`                            | スライドのページ数                                                  |
| `theme`            | `"light" \| "dark"`                 | テーマ                                                              |
| `hue`              | `number`                            | 色相（0以上360未満に正規化済）                                      |
| `width` / `height` | `number`                            | スライドの幅・高さ（px）                                            |
| `frontmatter`      | `Readonly<Record<string, unknown>>` | 独自キーを含む、記述されたfrontmatter（JSON互換値）                 |

> [!NOTE]
>
> - `decks`の並び順はMarkdownのパス順です
>     - 必要なら利用側でソートしてください
> - 全デッキの`frontmatter`が利用側のJavaScriptに含まれる形で公開されることに注意してください
> - このモジュールはプラグインが生成します
>     - プラグインを使わない環境で直接実行するとエラーになります
> - 同じ内容を`virtual:presenit/decks`から取得することもできます
>     - 型定義が必要な場合は、パッケージの`@ayaexptech/presen-it/decks`を使ってください

### AIにスライド作成を頼む

Agent Skillを[skills/create-slides-using-presen-it/SKILL.md](./skills/create-slides-using-presen-it/SKILL.md)に用意しています。  
[skills](https://github.com/vercel-labs/skills) CLIでインストールできます。

```sh
npx skills add AXT-Studio/presen-it --skill create-slides-using-presen-it       # npm
pnpm dlx skills add AXT-Studio/presen-it --skill create-slides-using-presen-it  # pnpm
vp dlx skills add AXT-Studio/presen-it --skill create-slides-using-presen-it    # Vite+
```

### v1からの移行

- レジストリをnpm(`@ayaexptech/presenit`)からJSR(`@ayaexptech/presen-it`)に変更しています
- CLIは廃止され、Vite上で動作するプラグインに変更されています
- PDF出力はViewerのメニューからブラウザの印刷機能を使う形に変更されました
- スライドMarkdownファイルのfrontmatterとDirective、各種拡張記法への対応と既定値に変更はありません
- `src/<slug>/slide.md`という配置が必須ではなくなりました
    - 旧ファイル構造を使い続ける場合は`includes: ["src/**/slide.md"]`などを設定すればよいです

---

## for Developers

```sh
pnpm install
pnpm build
pnpm dev
```

サンプルのデッキは`/slides/example/`と`/slides/team/`、一覧ページは`/`です。  
`pnpm build:example`でサンプルを静的ビルドし、`pnpm preview`で確認できます。

| コマンド                | 内容                                                       |
| ----------------------- | ---------------------------------------------------------- |
| `pnpm check`            | フォーマット・Lint・型検査・ユニットテスト                 |
| `pnpm test:integration` | ビルドしたパッケージを空のプロジェクトに導入して結合テスト |
| `pnpm check:jsr`        | JSR公開のドライラン                                        |

`pnpm build`は、ViewerのJS・CSSを文字列として持つ`src/generated/viewer.ts`を生成し、プラグインのJavaScriptと型定義を`dist/`に出力します。  
`src/generated/viewer.ts`はコミット対象です。JSR利用者がViewerを別途ビルドする必要はありません。  
結合テストとOGP画像のテストにはChromeまたはChromiumが必要です(OGP画像のユニットテストは、見つからなければスキップされます)。自動検出できない場合は`CHROME_PATH`を指定してください。
