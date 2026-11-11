import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseSlideMarkdown } from "../src/parse/index.ts";
import { renderDeckAsync } from "../src/render/index.ts";

describe("v2 semantic compatibility", () => {
    it("escapes nested raw HTML without escaping generated reveal spans", async () => {
        const rendered = await renderDeckAsync(
            parseSlideMarkdown(
                '<!-- presen-it! reveal (at=1) -->\n\nHello <img src=x onerror="alert(1)"> **bold**.\n\n<!-- private note -->',
            ),
        );
        expect(rendered.slides[0]!.html).not.toContain("<img");
        expect(rendered.slides[0]!.html).toMatch(/(?:&lt;|&#x3C;)img/);
        expect(rendered.slides[0]!.html).toContain('data-presenit-at="1"');
        expect(rendered.slides[0]!.html).not.toContain("private note");
        expect(rendered.slides[0]!.notes).toBe("private note");
    });
    it("preserves code fences containing directives and consumes invalid directives", () => {
        const deck = parseSlideMarkdown(
            "```html\n<!-- presen-it! slide-break -->\n```\n\n<!-- presen-it! unknown -->\n\nText",
        );
        expect(deck.slides).toHaveLength(1);
        expect(deck.slides[0]!.columns[0]!.children[0]!.type).toBe("code");
        expect(deck.diagnostics.some((item) => item.message.includes("Unknown"))).toBe(true);
    });
    it("supports a real authored talk with raw HTML, nested reveals, tables and assets", async () => {
        const source = await readFile(
            new URL("./fixtures/real-talk/slide.md", import.meta.url),
            "utf8",
        );
        const deck = parseSlideMarkdown(source);
        expect(deck.config.hue).toBeCloseTo(281.44);
        expect(deck.config.fontFamily.sans).toBe('Ubuntu, "M PLUS 1", sans-serif');
        expect(deck.config.pageTransition).toEqual({ type: "scroll", duration: 0.25 });
        expect(deck.config.animation.duration).toBe(0.125);
        expect(deck.diagnostics).toEqual([]);
        expect(deck.slides).toHaveLength(30);
        expect(deck.slides.some((slide) => slide.maxStep === 6)).toBe(true);
        const rendered = await renderDeckAsync(deck);
        expect(rendered.html).toContain("<ruby>");
        expect(rendered.html).toContain("<table>");
        expect(rendered.hasMath).toBe(true);
        expect(rendered.html).toContain("./assets/atcoder-codetest-screenshot.webp");
    });
});
