import type { Deck } from "../types.ts";
import { renderDeckHtml, renderDeckSlides, type RenderedSlide } from "./html.ts";
import { KATEX_CSS_URL } from "./rich.ts";
import { buildThemeCss } from "./theme.ts";

export type RenderDeckResult = {
    /** Full deck HTML fragment including embedded theme CSS. */
    html: string;
    /** Theme CSS alone (for injection into a host document). */
    css: string;
    slides: RenderedSlide[];
    /** Whether KaTeX styles were included for math content. */
    hasMath: boolean;
};

/**
 * Render a parsed deck into HTML + CSS.
 */
export async function renderDeckAsync(deck: Deck): Promise<RenderDeckResult> {
    const baseCss = buildThemeCss(deck.config);
    const { slides, hasMath } = await renderDeckSlides(deck);
    const css = hasMath ? `@import url("${KATEX_CSS_URL}");\n${baseCss}` : baseCss;
    const slidesHtml = slides.map((slide) => slide.html).join("\n");
    return {
        html: renderDeckHtml(deck, css, slidesHtml, hasMath),
        css,
        slides,
        hasMath,
    };
}

/** @alias renderDeckAsync */
export const renderDeck = renderDeckAsync;

export { buildThemeCss } from "./theme.ts";
export { renderDeckHtml, renderDeckSlides, renderSlideHtml } from "./html.ts";
export type { RenderedSlide } from "./html.ts";
