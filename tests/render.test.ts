import { describe, expect, it } from "vitest";
import { parseSlideMarkdown } from "../src/parse/index";
import { renderDeckAsync } from "../src/render/index";

describe("renderDeck", () => {
    it("renders slides with theme css and slide numbers", async () => {
        const deck = parseSlideMarkdown(`---
theme: dark
hue: 200
---

# Title

<!-- presen-it! slide-break -->

## Section

- one
- two

<!-- presen-it! column-break -->

![alt](./pic.png)
`);

        const result = await renderDeckAsync(deck);
        expect(result.css).toContain("--presenit-accent");
        expect(result.css).toContain("M+PLUS+1");
        expect(result.html).toContain('data-theme="dark"');
        expect(result.html).toContain("1 / 2");
        expect(result.html).toContain("2 / 2");
        expect(result.html).toContain("presenit-slide-header");
        expect(result.html).toContain("presenit-column");
        expect(result.html).toContain('src="./pic.png"');
        expect(result.slides).toHaveLength(2);
    });

    it("applies center alignment classes", async () => {
        const deck =
            parseSlideMarkdown(`<!-- presen-it! slide-break (center-x=true&center-y=false) -->

## Centered

hello
`);
        const result = await renderDeckAsync(deck);
        const slide = result.slides[0]!.html;
        expect(slide).toContain("presenit-column--center-x");
        expect(slide).not.toContain("presenit-column--center-y");
    });

    it("uses positive letter-spacing on h1 and a low-chroma dark palette", async () => {
        const dark = await renderDeckAsync(
            parseSlideMarkdown(`---
theme: dark
---

# Title
`),
        );
        expect(dark.css).toContain("letter-spacing: 0.01em");
        expect(dark.css).toMatch(/--presenit-slide-bg:\s*oklch\(0\.2 0\.012 /);
        expect(dark.css).toContain("--presenit-slide-bg-top:");
        expect(dark.css).toContain("linear-gradient(165deg");
        expect(dark.css).toContain(".presenit-column em");
        expect(dark.css).not.toMatch(/\.presenit-column em \{[^}]*text-muted/);
        expect(dark.css).toContain("fonts.googleapis.com/css2?family=M+PLUS+1");
    });

    it("requests Google Fonts for custom fontFamily names", async () => {
        const result = await renderDeckAsync(
            parseSlideMarkdown(`---
fontFamily:
  sans: '"Libertinus Serif", serif'
  mono: Ubuntu Mono, monospace
---

# Title
`),
        );
        expect(result.css).toContain("family=Libertinus+Serif");
        expect(result.css).toContain("family=Ubuntu+Mono");
    });

    it("renders read-only GFM task lists with task-list styles", async () => {
        const result = await renderDeckAsync(
            parseSlideMarkdown(`- [ ] open
- [x] done`),
        );

        expect(result.html).toContain('class="contains-task-list"');
        expect(result.html).toContain('class="task-list-item"');
        expect(result.html).toContain('type="checkbox"');
        expect(result.html).toContain("disabled");
        expect(result.html).toContain("checked");
        expect(result.css).toContain("ul.contains-task-list");
        expect(result.css).toContain("li.task-list-item::before");
        expect(result.css).toContain('li.task-list-item > input[type="checkbox"]');
        expect(result.css).toContain("appearance: none");
        expect(result.css).toContain("clip: rect(0 0 0 0)");
    });

    it("escapes HTML by default and allows rawHTML when enabled", async () => {
        const escaped = await renderDeckAsync(parseSlideMarkdown(`<div class="x">hi</div>`));
        expect(escaped.html).toMatch(/&lt;div|&#x3C;div/);
        expect(escaped.html).not.toContain('<div class="x">');

        const raw = await renderDeckAsync(
            parseSlideMarkdown(`---
rawHTML: true
---

<div class="x">hi</div>
`),
        );
        expect(raw.html).toContain('<div class="x">hi</div>');
    });

    it("renders GitHub alert blockquotes as labelled asides", async () => {
        const result = await renderDeckAsync(
            parseSlideMarkdown(`> [!NOTE]
> Useful context.

> [!tip]
> A helpful suggestion.

> [!IMPORTANT]
> Critical detail.

> [!WARNING]
> Take care.

> [!CAUTION]
> Irreversible action.`),
        );

        for (const [kind, label] of [
            ["note", "Note"],
            ["tip", "Tip"],
            ["important", "Important"],
            ["warning", "Warning"],
            ["caution", "Caution"],
        ]) {
            expect(result.html).toContain(`class="presenit-alert presenit-alert--${kind}"`);
            expect(result.html).toContain(`data-alert="${kind.toUpperCase()}"`);
            expect(result.html).toContain(`<p class="presenit-alert__label">${label}</p>`);
        }

        expect(result.html).toContain("Useful context.");
        expect(result.html).not.toContain("[!NOTE]");
        expect(result.css).toContain(".presenit-column .presenit-alert");
        expect(result.css).toContain("--presenit-alert-icon");
        expect(result.css).toContain(".presenit-alert__label::before");
    });

    it("does not insert a blank line after alert labels when break is soft", async () => {
        const soft = await renderDeckAsync(
            parseSlideMarkdown(`> [!NOTE]
> Useful information that users should know, even when skimming content.`),
        );
        const hard = await renderDeckAsync(
            parseSlideMarkdown(`---
break: hard
---

> [!NOTE]
> Useful information that users should know, even when skimming content.`),
        );

        const pattern =
            /<p class="presenit-alert__label">Note<\/p>\s*<p>Useful information that users should know, even when skimming content\.<\/p>/;
        expect(soft.html).toMatch(pattern);
        expect(soft.html).not.toMatch(/presenit-alert__label[\s\S]*?<p>\s*<br\s*\/?>\s*Useful/);
        expect(hard.html).toMatch(pattern);
    });

    it("keeps non-alert blockquotes unchanged", async () => {
        const result = await renderDeckAsync(parseSlideMarkdown(`> A normal quote.`));
        const slide = result.slides[0]!.html;

        expect(slide).toContain("<blockquote>");
        expect(slide).toContain("A normal quote.");
        expect(slide).not.toContain("presenit-alert");
    });

    it("renders soft breaks as <br> when break: soft", async () => {
        const result = await renderDeckAsync(
            parseSlideMarkdown(`---
break: soft
---

line one
line two
`),
        );
        expect(result.slides[0]!.html).toContain("line one<br>");
        expect(result.slides[0]!.html).toContain("line two");
    });

    it("does not render soft breaks when break: hard", async () => {
        const result = await renderDeckAsync(
            parseSlideMarkdown(`---
break: hard
---

line one
line two
`),
        );
        const slide = result.slides[0]!.html;
        expect(slide).toContain("line one\nline two");
        expect(slide).not.toContain("<br>");
    });
    it("renders footer on every slide when set and omits when empty", async () => {
        const without = await renderDeckAsync(
            parseSlideMarkdown(`# Title

<!-- presen-it! slide-break -->

## Section
`),
        );
        expect(without.html).not.toContain('class="presenit-slide-footer"');

        const withFooter = await renderDeckAsync(
            parseSlideMarkdown(`---
footer: "© 2026 Example Co. <internal>"
---

# Title

<!-- presen-it! slide-break -->

## Section
`),
        );
        expect(withFooter.css).toContain(".presenit-slide-footer");
        expect(withFooter.html).toContain('class="presenit-slide-footer"');
        expect(withFooter.html).toContain("© 2026 Example Co. &lt;internal&gt;");
        expect(withFooter.html).not.toContain("<internal>");
        expect(withFooter.slides).toHaveLength(2);
        expect(withFooter.slides.every((s) => s.html.includes("presenit-slide-footer"))).toBe(true);
    });

    it("emits data-presenit-at for reveal fragments and strips reveal comments", async () => {
        const deck = parseSlideMarkdown(`<!-- presen-it! reveal (at=1) -->
- item one <!-- presen-it! reveal (at=2) -->
- item two

Hello <!-- presen-it! reveal (at=3) -->world
`);
        const result = await renderDeckAsync(deck);
        const html = result.slides[0]!.html;
        expect(result.slides[0]!.maxStep).toBe(3);
        expect(html).toContain('data-presenit-max-step="3"');
        expect(html).toContain('data-presenit-at="1"');
        expect(html).toContain('data-presenit-at="2"');
        expect(html).toContain('data-presenit-at="3"');
        expect(html).toContain("presenit-fragment");
        expect(html).not.toContain("presen-it! reveal");
        expect(result.css).toContain("is-concealed");
    });

    describe("reveal with raw inline HTML spanning links (#121)", () => {
        const render = async (body: string): Promise<string> => {
            const deck = parseSlideMarkdown(`---
rawHTML: true
---

<!-- presen-it! reveal (at=1) -->

${body}
`);
            const result = await renderDeckAsync(deck);
            return result.slides[0]!.html;
        };

        it("stamps a uniform paragraph instead of splitting the user's element", async () => {
            const html = await render(
                '<span style="opacity:.6">実は[`dst`](https://example.com/)が使えます</span>',
            );
            expect(html).toContain(
                '<p data-presenit-at="1"><span style="opacity:.6">実は<a href="https://example.com/"><code>dst</code></a>が使えます</span></p>',
            );
            expect(html).not.toContain("presenit-fragment");
        });

        it("keeps the user's element in one fragment when the paragraph reveals mid-way", async () => {
            const html = await render(
                '<span style="opacity:.6">前[L](https://example.com/)<br>後</span> <!-- presen-it! reveal (at=2) -->続き',
            );
            expect(html).toContain(
                '<p><span class="presenit-fragment" data-presenit-at="1"><span style="opacity:.6">前<a href="https://example.com/">L</a><br>後</span> </span><span class="presenit-fragment" data-presenit-at="2">続き</span></p>',
            );
        });

        it("relies on the list item's attribute in a tight list", async () => {
            const html = await render(
                '- <span style="opacity:.6">前[L](https://example.com/)後</span>\n- next',
            );
            expect(html).toContain(
                '<li data-presenit-at="1"><span style="opacity:.6">前<a href="https://example.com/">L</a>後</span></li>',
            );
            expect(html).not.toContain("presenit-fragment");
        });
    });

    it("still detects GitHub alerts under reveal", async () => {
        const deck = parseSlideMarkdown(`<!-- presen-it! reveal (at=1) -->

> [!NOTE]
> hello
`);
        const html = (await renderDeckAsync(deck)).slides[0]!.html;
        expect(html).toContain('class="presenit-alert presenit-alert--note"');
        expect(html).toContain('data-presenit-at="1"');
        expect(html).not.toContain("[!NOTE]");
    });
});
