import { createRequire } from "node:module";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { renderMermaidSVG } from "beautiful-mermaid";
import katex from "katex";
import type { Code, Html, RootContent } from "mdast";
import type { ThemeName } from "../types.ts";
import { getPresenitAt } from "../parse/reveal.ts";
import { highlightCode } from "./highlighter.ts";

export type EnrichResult = {
    nodes: RootContent[];
    hasEnrichedHtml: boolean;
    hasMath: boolean;
};

/** Must match the `katex` package we depend on (not rehype-katex’s nested copy). */
export const KATEX_VERSION = "0.18.1" as const;
export const KATEX_CSS_URL = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css`;
export const KATEX_FONTS_BASE_URL = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/fonts/`;

/** Hide KaTeX MathML in print/PDF; Puppeteer does not apply upstream clip-path hide rules reliably. */
export const KATEX_PRINT_CSS = `.katex .katex-mathml { display: none; }\n`;

let inlineKatexCssCache: string | null = null;

function resolveKatexCssPath(): string {
    const require = createRequire(import.meta.url);
    return path.join(path.dirname(require.resolve("katex/package.json")), "dist/katex.min.css");
}

function rewriteKatexFontUrls(css: string): string {
    return css.replace(/url\(fonts\//g, `url(${KATEX_FONTS_BASE_URL}`);
}

export async function loadInlineKatexCss(): Promise<string> {
    if (inlineKatexCssCache === null) {
        const raw = await readFile(resolveKatexCssPath(), "utf8");
        inlineKatexCssCache = rewriteKatexFontUrls(raw);
    }
    return inlineKatexCssCache;
}

export function stripKatexCssImport(css: string): string {
    return css.replace(/@import\s+url\(["']?[^"']*katex[^"']*["']?\);\s*/i, "");
}

export function cssIncludesKatexImport(css: string): boolean {
    return /@import\s+url\(["']?[^"']*katex/i.test(css);
}

export async function buildExportCss(css: string): Promise<string> {
    if (!cssIncludesKatexImport(css)) {
        return css;
    }
    const katexCss = await loadInlineKatexCss();
    return `${katexCss}\n${KATEX_PRINT_CSS}${stripKatexCssImport(css)}`;
}

function containsMath(nodes: RootContent[]): boolean {
    for (const node of nodes) {
        if (node.type === "math" || node.type === "inlineMath") {
            return true;
        }
        if ("children" in node && Array.isArray(node.children)) {
            if (containsMath(node.children as RootContent[])) {
                return true;
            }
        }
    }
    return false;
}

function renderMathHtml(node: Extract<RootContent, { type: "math" | "inlineMath" }>): Html {
    const displayMode = node.type === "math";
    const value = katex.renderToString(node.value, {
        displayMode,
        throwOnError: false,
        strict: "ignore",
    });
    const at = getPresenitAt(node);
    if (at === undefined) {
        return { type: "html", value };
    }
    return {
        type: "html",
        value: `<span class="presenit-fragment" data-presenit-at="${at}">${value}</span>`,
    };
}

async function enrichCodeBlock(node: Code, theme: ThemeName): Promise<Html> {
    const lang = node.lang?.toLowerCase();
    const at = getPresenitAt(node);

    const wrap = (inner: string): Html => {
        if (at === undefined) {
            return { type: "html", value: inner };
        }
        return {
            type: "html",
            value: `<div class="presenit-fragment" data-presenit-at="${at}">${inner}</div>`,
        };
    };

    if (lang === "mermaid") {
        try {
            const svg = renderMermaidSVG(node.value.trim(), {
                bg: "var(--presenit-slide-bg)",
                fg: "var(--presenit-text)",
                transparent: true,
            });
            // Drop fixed width/height so theme CSS can scale the diagram up.
            const scalable = svg.replace(/\swidth="[^"]*"/i, "").replace(/\sheight="[^"]*"/i, "");
            return wrap(`<div class="presenit-mermaid">${scalable}</div>`);
        } catch {
            const highlighted = await highlightCode(node.value, "text", theme);
            return wrap(highlighted);
        }
    }

    const highlighted = await highlightCode(node.value, lang, theme);
    return wrap(highlighted);
}

async function enrichNodes(nodes: RootContent[], theme: ThemeName): Promise<RootContent[]> {
    const result: RootContent[] = [];

    for (const node of nodes) {
        if (node.type === "math" || node.type === "inlineMath") {
            result.push(renderMathHtml(node));
            continue;
        }

        if (node.type === "code") {
            result.push(await enrichCodeBlock(node, theme));
            continue;
        }

        if ("children" in node && Array.isArray(node.children)) {
            result.push({
                ...node,
                children: await enrichNodes(node.children as RootContent[], theme),
            } as RootContent);
            continue;
        }

        result.push(node);
    }

    return result;
}

function containsHtml(nodes: RootContent[]): boolean {
    for (const node of nodes) {
        if (node.type === "html") {
            return true;
        }
        if ("children" in node && Array.isArray(node.children)) {
            if (containsHtml(node.children as RootContent[])) {
                return true;
            }
        }
    }
    return false;
}

export async function enrichRichContent(
    nodes: RootContent[],
    theme: ThemeName,
): Promise<EnrichResult> {
    const hasMath = containsMath(nodes);
    const enriched = await enrichNodes(nodes, theme);
    return {
        nodes: enriched,
        hasEnrichedHtml: containsHtml(enriched),
        hasMath,
    };
}
