import type { Root, RootContent } from "mdast";
import { toHast } from "mdast-util-to-hast";
import { toHtml } from "hast-util-to-html";
import type { Column, Deck, DeckConfig, Slide } from "../types.ts";
import { transformAlertBlockquotes } from "./alert.ts";
import { enrichRichContent, KATEX_CSS_URL } from "./rich.ts";

export type RenderedSlide = {
    html: string;
    notes: string | null;
    maxStep: number;
};

export type RenderResult = {
    slides: RenderedSlide[];
    css: string;
    config: DeckConfig;
    hasMath: boolean;
};

function escapeHtml(text: string): string {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function sanitizeNodes(nodes: RootContent[], rawHTML: boolean): RootContent[] {
    return nodes.flatMap((node): RootContent[] => {
        if (node.type === "html") {
            if (node.value.trim().startsWith("<!--")) return [];
            if (
                rawHTML ||
                (node.data as { presenitGenerated?: boolean } | undefined)?.presenitGenerated
            )
                return [node];
            return [{ type: "text", value: node.value } as unknown as RootContent];
        }
        if (
            "url" in node &&
            typeof node.url === "string" &&
            /^(?:javascript|vbscript|data):/i.test(
                Array.from(node.url)
                    .filter((char) => char.charCodeAt(0) > 32)
                    .join(""),
            )
        ) {
            node = { ...node, url: "" };
        }
        if ("children" in node && Array.isArray(node.children)) {
            return [
                {
                    ...node,
                    children: sanitizeNodes(node.children as RootContent[], rawHTML),
                } as RootContent,
            ];
        }
        return [node];
    });
}

async function mdastToHtml(
    nodes: RootContent[],
    rawHTML: boolean,
    theme: DeckConfig["theme"],
    mathState: { hasMath: boolean },
): Promise<string> {
    if (nodes.length === 0) {
        return "";
    }

    const sanitized = sanitizeNodes(nodes, rawHTML);
    const enriched = await enrichRichContent(sanitized, theme);
    if (enriched.hasMath) {
        mathState.hasMath = true;
    }

    const root: Root = { type: "root", children: transformAlertBlockquotes(enriched.nodes) };
    const allowDangerousHtml = rawHTML || enriched.hasEnrichedHtml || enriched.hasMath;
    const hast = toHast(root, {
        allowDangerousHtml,
    });
    if (!hast || hast.type !== "root") {
        return "";
    }

    return toHtml(hast, {
        allowDangerousHtml,
    });
}

async function renderColumn(
    column: Column,
    rawHTML: boolean,
    theme: DeckConfig["theme"],
    mathState: { hasMath: boolean },
): Promise<string> {
    const classes = ["presenit-column"];
    if (column.align.centerX) {
        classes.push("presenit-column--center-x");
    }
    if (column.align.centerY) {
        classes.push("presenit-column--center-y");
    }

    const content = await mdastToHtml(column.children, rawHTML, theme, mathState);
    return `<div class="${classes.join(" ")}">${content}</div>`;
}

async function renderHeader(
    slide: Slide,
    rawHTML: boolean,
    theme: DeckConfig["theme"],
    mathState: { hasMath: boolean },
): Promise<string> {
    if (!slide.header) {
        return "";
    }
    const html = await mdastToHtml([slide.header], rawHTML, theme, mathState);
    return `<header class="presenit-slide-header">${html}</header>`;
}

export async function renderSlideHtml(
    slide: Slide,
    index: number,
    total: number,
    rawHTML: boolean,
    theme: DeckConfig["theme"],
    footer: string,
    mathState: { hasMath: boolean },
): Promise<string> {
    const header = await renderHeader(slide, rawHTML, theme, mathState);
    const columns = (
        await Promise.all(
            slide.columns.map((column) => renderColumn(column, rawHTML, theme, mathState)),
        )
    ).join("");
    const number = `<div class="presenit-slide-number">${index + 1} / ${total}</div>`;
    const footerHtml = footer
        ? `<div class="presenit-slide-footer">${escapeHtml(footer)}</div>`
        : "";

    return [
        `<section class="presenit-slide" data-slide-index="${index}" data-presenit-max-step="${slide.maxStep}" aria-label="Slide ${index + 1} of ${total}">`,
        header,
        `<div class="presenit-slide-body">${columns}</div>`,
        footerHtml,
        number,
        `</section>`,
    ].join("");
}

export function renderDeckHtml(
    deck: Deck,
    css: string,
    slidesHtml: string,
    hasMath: boolean,
): string {
    const katexLink = hasMath
        ? `<link rel="stylesheet" href="${KATEX_CSS_URL}" crossorigin="anonymous">`
        : "";

    return [
        `<div class="presenit-deck" data-theme="${escapeHtml(deck.config.theme)}" style="--presenit-slide-width:${deck.config.width}px;--presenit-slide-height:${deck.config.height}px;">`,
        katexLink,
        `<style>${css}</style>`,
        slidesHtml,
        `</div>`,
    ].join("\n");
}

export async function renderDeckSlides(deck: Deck): Promise<{
    slides: RenderedSlide[];
    hasMath: boolean;
}> {
    const mathState = { hasMath: false };
    const slides = await Promise.all(
        deck.slides.map(async (slide, index) => ({
            html: await renderSlideHtml(
                slide,
                index,
                deck.slides.length,
                deck.config.rawHTML,
                deck.config.theme,
                deck.config.footer,
                mathState,
            ),
            notes: slide.notes,
            maxStep: slide.maxStep,
        })),
    );

    return { slides, hasMath: mathState.hasMath };
}
