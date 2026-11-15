import { describe, expect, it } from "vitest";
import { parseDirectiveComment } from "../src/parse/directive";
import { parseFrontmatter } from "../src/parse/frontmatter";
import { parseSlideMarkdown } from "../src/parse/index";
import type { Diagnostic } from "../src/types";
import { DEFAULT_CONFIG } from "../src/types";

function messages(diagnostics: Diagnostic[]): string[] {
    return diagnostics.map((d) => d.message);
}

describe("parseFrontmatter", () => {
    it("uses defaults when frontmatter is absent", () => {
        const result = parseFrontmatter("# Hello\n");
        expect(result.config).toEqual(DEFAULT_CONFIG);
        expect(result.body).toBe("# Hello\n");
        expect(result.diagnostics).toEqual([]);
    });

    it("parses valid frontmatter", () => {
        const result = parseFrontmatter(`---
theme: dark
hue: 400
width: 1280
height: 720
fontSize: 24
rawHTML: true
fontFamily:
  sans: '"Inter", sans-serif'
  mono: '"JetBrains Mono", monospace'
---

# Title
`);
        expect(result.config.theme).toBe("dark");
        expect(result.config.hue).toBe(40); // 400 % 360
        expect(result.config.width).toBe(1280);
        expect(result.config.height).toBe(720);
        expect(result.config.fontSize).toBe(24);
        expect(result.config.rawHTML).toBe(true);
        expect(result.config.fontFamily.sans).toBe('"Inter", sans-serif');
        expect(result.body.trimStart().startsWith("# Title")).toBe(true);
        expect(result.diagnostics).toEqual([]);
    });

    it("accepts fontFamily.sans/mono as string arrays", () => {
        const result = parseFrontmatter(`---
fontFamily:
  sans:
    - Edu VIC WA NT Hand
    - Zen Kurenaido
    - cursive
  mono: ["JetBrains Mono", ui-monospace, monospace]
---

# Title
`);
        expect(result.config.fontFamily.sans).toBe(
            '"Edu VIC WA NT Hand", "Zen Kurenaido", cursive',
        );
        expect(result.config.fontFamily.mono).toBe('"JetBrains Mono", ui-monospace, monospace');
        expect(result.diagnostics).toEqual([]);
    });

    it("parses pageTransition with defaults", () => {
        const defaults = parseFrontmatter("# Hi\n");
        expect(defaults.config.pageTransition).toEqual({ type: "fade", duration: 0.2 });

        const custom = parseFrontmatter(`---
pageTransition:
  type: scroll
  duration: 0.35
---

# Hi
`);
        expect(custom.config.pageTransition).toEqual({ type: "scroll", duration: 0.35 });
        expect(custom.diagnostics).toEqual([]);
    });

    it("parses animation.duration with default 0.3", () => {
        const defaults = parseFrontmatter("# Hi\n");
        expect(defaults.config.animation).toEqual({ duration: 0.3 });

        const custom = parseFrontmatter(`---
animation:
  duration: 0.5
---

# Hi
`);
        expect(custom.config.animation).toEqual({ duration: 0.5 });
        expect(custom.diagnostics).toEqual([]);
    });

    it("parses break with default soft", () => {
        const defaults = parseFrontmatter("# Hi\n");
        expect(defaults.config.break).toBe("soft");

        const hard = parseFrontmatter(`---
break: hard
---

# Hi
`);
        expect(hard.config.break).toBe("hard");
        expect(hard.diagnostics).toEqual([]);
    });

    it("parses footer with default empty string", () => {
        const defaults = parseFrontmatter("# Hi\n");
        expect(defaults.config.footer).toBe("");

        const custom = parseFrontmatter(`---
footer: "© 2026 Example Co."
---

# Hi
`);
        expect(custom.config.footer).toBe("© 2026 Example Co.");
        expect(custom.diagnostics).toEqual([]);
    });

    it("falls back and warns on invalid footer", () => {
        const result = parseFrontmatter(`---
footer: 42
---

body
`);
        expect(result.config.footer).toBe("");
        expect(messages(result.diagnostics).some((m) => m.includes("frontmatter.footer"))).toBe(
            true,
        );
    });

    it("parses title and description", () => {
        const result = parseFrontmatter(`---
title: My Talk
description: A short blurb
---

# Hi
`);
        expect(result.config.title).toBe("My Talk");
        expect(result.config.description).toBe("A short blurb");
        expect(result.diagnostics).toEqual([]);
    });

    it("defaults title and description to empty strings", () => {
        const result = parseFrontmatter("# Hi\n");
        expect(result.config.title).toBe("");
        expect(result.config.description).toBe("");
    });

    it("falls back and warns on invalid title", () => {
        const result = parseFrontmatter(`---
title: 42
---

body
`);
        expect(result.config.title).toBe("");
        expect(messages(result.diagnostics).some((m) => m.includes("frontmatter.title"))).toBe(
            true,
        );
    });

    it("falls back and warns on invalid break", () => {
        const result = parseFrontmatter(`---
break: newline
---

body
`);
        expect(result.config.break).toBe("soft");
        expect(messages(result.diagnostics).some((m) => m.includes("frontmatter.break"))).toBe(
            true,
        );
    });

    it("falls back and warns on type errors; ignores unknown keys", () => {
        const result = parseFrontmatter(`---
theme: neon
hue: "blue"
width: -1
extra: ignored
---

body
`);
        expect(result.config.theme).toBe("light");
        expect(result.config.hue).toBe(DEFAULT_CONFIG.hue);
        expect(result.config.width).toBe(DEFAULT_CONFIG.width);
        expect(messages(result.diagnostics).length).toBeGreaterThanOrEqual(3);
    });
});

describe("parseDirectiveComment", () => {
    it("parses slide-break with options", () => {
        const diagnostics: Diagnostic[] = [];
        const result = parseDirectiveComment(
            "<!-- presen-it! slide-break (center-x=true&center-y=false) -->",
            diagnostics,
        );
        expect(result).toEqual({
            command: "slide-break",
            options: { centerX: true, centerY: false },
        });
        expect(diagnostics).toEqual([]);
    });

    it("ignores unknown commands and spaced options", () => {
        const diagnostics: Diagnostic[] = [];
        expect(parseDirectiveComment("<!-- presen-it! zoom -->", diagnostics)).toBeNull();
        expect(
            parseDirectiveComment("<!-- presen-it! slide-break (center-x = true) -->", diagnostics),
        ).toBeNull();
        expect(diagnostics.length).toBe(2);
    });

    it("returns null for ordinary comments", () => {
        const diagnostics: Diagnostic[] = [];
        expect(parseDirectiveComment("<!-- just a note -->", diagnostics)).toBeNull();
        expect(diagnostics).toEqual([]);
    });

    it("parses reveal with at and defaults omitted at to 0", () => {
        const diagnostics: Diagnostic[] = [];
        expect(parseDirectiveComment("<!-- presen-it! reveal (at=3) -->", diagnostics)).toEqual({
            command: "reveal",
            options: { at: 3 },
        });
        expect(parseDirectiveComment("<!-- presen-it! reveal -->", diagnostics)).toEqual({
            command: "reveal",
            options: { at: 0 },
        });
        expect(diagnostics).toEqual([]);
    });

    it("rejects invalid reveal at values", () => {
        const diagnostics: Diagnostic[] = [];
        expect(parseDirectiveComment("<!-- presen-it! reveal (at=-1) -->", diagnostics)).toBeNull();
        expect(
            parseDirectiveComment("<!-- presen-it! reveal (at=1.5) -->", diagnostics),
        ).toBeNull();
        expect(diagnostics.length).toBe(2);
    });
});

describe("parseSlideMarkdown", () => {
    it("parses the concept-doc sample structure", () => {
        const source = `---
theme: dark
width: 1920
height: 1080
---

# 等幅フォントを指定した要素にletter-spacingを使うな

2026-07-29 ― AyaExpTech (@AyaExpTech)

<!-- presen-it! slide-break -->

## 経緯

- 等幅フォントが指定されているのに文字の縦方向の位置が揃ってないサイト、あるよね

<!-- presen-it! slide-break (center-x=true) -->

## 原因

\`\`\`css
.selector {
    letter-spacing: 0.05em
}
\`\`\`

<!-- presen-it! slide-break -->

## 何が起こった？

- \`letter-spacing\`は文字間に空白を入れる

<!-- presen-it! column-break -->

![](hogehoge.png)

<!-- this is a speaker note -->

<!-- presen-it! slide-break -->

## 結論

等幅フォントを指定した要素にletter-spacingを使うな ズレるから
`;

        const deck = parseSlideMarkdown(source);
        expect(deck.config.theme).toBe("dark");
        expect(deck.slides).toHaveLength(5);

        // Title slide: h1 in column, no header
        expect(deck.slides[0]!.header).toBeNull();
        expect(deck.slides[0]!.columns[0]!.children[0]!.type).toBe("heading");

        // Second slide: header "経緯"
        expect(deck.slides[1]!.header?.depth).toBe(2);
        expect(deck.slides[1]!.align.centerX).toBe(false);
        expect(deck.slides[1]!.align.centerY).toBe(true);

        // Third: center-x=true
        expect(deck.slides[2]!.align.centerX).toBe(true);
        expect(deck.slides[2]!.header).not.toBeNull();

        // Fourth: two columns + notes
        expect(deck.slides[3]!.columns).toHaveLength(2);
        expect(deck.slides[3]!.notes).toBe("this is a speaker note");
        expect(deck.slides[3]!.columns[1]!.children[0]!.type).toBe("paragraph");

        // Fifth: conclusion
        expect(deck.slides[4]!.header).not.toBeNull();
        expect(deck.diagnostics).toEqual([]);
    });

    it("supports empty slides and column-break before header", () => {
        const deck = parseSlideMarkdown(`# A

<!-- presen-it! slide-break -->

<!-- presen-it! slide-break -->

<!-- presen-it! column-break -->

## Not a header

text
`);
        expect(deck.slides).toHaveLength(3);
        expect(deck.slides[1]!.header).toBeNull();
        expect(deck.slides[1]!.columns[0]!.children).toEqual([]);
        // column-break first → leading empty column is dropped; h2 stays in body (not header)
        expect(deck.slides[2]!.header).toBeNull();
        expect(deck.slides[2]!.columns).toHaveLength(1);
        expect(deck.slides[2]!.columns[0]!.children[0]!.type).toBe("heading");
    });

    it("warns on 4+ columns", () => {
        const deck = parseSlideMarkdown(`a

<!-- presen-it! column-break -->

b

<!-- presen-it! column-break -->

c

<!-- presen-it! column-break -->

d
`);
        expect(deck.slides[0]!.columns).toHaveLength(4);
        expect(messages(deck.diagnostics).some((m) => m.includes("4 columns"))).toBe(true);
    });

    it("applies a leading slide-break options to the first page", () => {
        const deck = parseSlideMarkdown(`<!-- presen-it! slide-break (center-x=true) -->

# Title

subtitle
`);
        expect(deck.slides).toHaveLength(1);
        expect(deck.slides[0]!.align.centerX).toBe(true);
        expect(deck.slides[0]!.columns[0]!.children[0]!.type).toBe("heading");
    });

    it("parses GitHub alerts as ordinary Markdown blockquotes", () => {
        const deck = parseSlideMarkdown(`> [!NOTE]
> Useful context.`);
        const blockquote = deck.slides[0]!.columns[0]!.children[0]!;

        expect(blockquote.type).toBe("blockquote");
        expect(blockquote).toMatchObject({
            children: [
                {
                    type: "paragraph",
                    children: [
                        { type: "text", value: "[!NOTE]" },
                        { type: "break" },
                        { type: "text", value: "Useful context." },
                    ],
                },
            ],
        });
    });

    it("lets column options override slide options", () => {
        const deck = parseSlideMarkdown(`# keep first

<!-- presen-it! slide-break (center-x=true) -->

centered by slide

<!-- presen-it! column-break (center-x=false) -->

override left
`);
        const slide = deck.slides[1]!;
        expect(slide.align.centerX).toBe(true);
        expect(slide.columns[0]!.align.centerX).toBe(true);
        expect(slide.columns[1]!.align.centerX).toBe(false);
    });

    it("parses soft breaks as mdast break nodes when break: soft", () => {
        const deck = parseSlideMarkdown(`---
break: soft
---

line one
line two
`);
        const node = deck.slides[0]!.columns[0]!.children[0]!;
        expect(node.type).toBe("paragraph");
        if (node.type !== "paragraph") {
            throw new Error("expected paragraph");
        }
        expect(node.children).toEqual([
            { type: "text", value: "line one" },
            { type: "break" },
            { type: "text", value: "line two" },
        ]);
    });

    it("does not parse soft breaks when break: hard", () => {
        const deck = parseSlideMarkdown(`---
break: hard
---

line one
line two
`);
        const node = deck.slides[0]!.columns[0]!.children[0]!;
        expect(node.type).toBe("paragraph");
        if (node.type !== "paragraph") {
            throw new Error("expected paragraph");
        }
        expect(node.children).toMatchObject([{ type: "text", value: "line one\nline two" }]);
    });

    it("applies sticky reveal across list items and columns; resets on slide-break", () => {
        const deck = parseSlideMarkdown(`<!-- presen-it! reveal (at=1) -->
- first <!-- presen-it! reveal (at=2) -->
- second

<!-- presen-it! column-break -->

third column block

<!-- presen-it! slide-break -->

## Next

visible from start
`);
        expect(deck.slides).toHaveLength(2);
        expect(deck.slides[0]!.maxStep).toBe(2);
        expect(deck.slides[1]!.maxStep).toBe(0);

        const list = deck.slides[0]!.columns[0]!.children[0]!;
        expect(list.type).toBe("list");
        if (list.type !== "list") {
            throw new Error("expected list");
        }
        expect(list.children[0]!.data).toMatchObject({
            hProperties: { "data-presenit-at": "1" },
        });
        expect(list.children[1]!.data).toMatchObject({
            hProperties: { "data-presenit-at": "2" },
        });

        // Column-crossing sticky: third block still at=2 (uniform paragraph → stamped itself)
        const col2 = deck.slides[0]!.columns[1]!.children[0]!;
        expect(col2.type).toBe("paragraph");
        expect(col2.data).toMatchObject({
            hProperties: { "data-presenit-at": "2" },
        });
    });

    it("splits phrasing inside strong around inline reveal", () => {
        const deck = parseSlideMarkdown(`**abc<!-- presen-it! reveal (at=2) -->def**
`);
        expect(deck.slides[0]!.maxStep).toBe(2);
        const paragraph = deck.slides[0]!.columns[0]!.children[0]!;
        expect(paragraph.type).toBe("paragraph");
        if (paragraph.type !== "paragraph") {
            throw new Error("expected paragraph");
        }
        const strong = paragraph.children[0]!;
        expect(strong.type).toBe("strong");
        if (strong.type !== "strong") {
            throw new Error("expected strong");
        }
        const values = strong.children
            .filter((c) => c.type === "html" || c.type === "text")
            .map((c) => (c.type === "html" || c.type === "text" ? c.value : ""));
        expect(values.join("")).toContain("abc");
        expect(values.join("")).toContain("def");
        expect(values.some((v) => v.includes('data-presenit-at="2"'))).toBe(true);
        expect(values.join("")).not.toContain("presen-it! reveal");
    });
});
