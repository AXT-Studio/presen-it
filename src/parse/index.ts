import type { Heading, Root, RootContent } from "mdast";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { AlignOptions, BreakMode, Column, Deck, Diagnostic, Slide } from "../types.ts";
import { DEFAULT_SLIDE_ALIGN } from "../types.ts";
import {
    alignFromDirective,
    extractCommentText,
    isHtmlComment,
    mergeAlign,
    parseDirectiveComment,
    type DirectiveOptions,
} from "./directive.ts";
import { parseFrontmatter } from "./frontmatter.ts";
import { applyRevealToSlide } from "./reveal.ts";

type MutableColumn = {
    optionOverride: DirectiveOptions;
    children: RootContent[];
};

type MutableSlide = {
    align: AlignOptions;
    header: Heading | null;
    columns: MutableColumn[];
    notes: string | null;
    awaitingHeader: boolean;
};

function positionLine(node: RootContent): number | undefined {
    return node.position?.start.line;
}

function createSlide(optionOverride: DirectiveOptions = {}): MutableSlide {
    return {
        align: alignFromDirective(optionOverride),
        header: null,
        columns: [{ optionOverride: {}, children: [] }],
        notes: null,
        awaitingHeader: true,
    };
}

function finalizeSlide(slide: MutableSlide, diagnostics: Diagnostic[]): Slide {
    const lastColumn = slide.columns[slide.columns.length - 1];
    if (lastColumn && lastColumn.children.length > 0) {
        const last = lastColumn.children[lastColumn.children.length - 1];
        if (last && last.type === "html" && isHtmlComment(last.value)) {
            const body = extractCommentText(last.value);
            // Trailing non-directive HTML comment → speaker notes.
            if (!body.startsWith("presen-it!")) {
                slide.notes = body;
                lastColumn.children.pop();
            }
        }
    }

    const columns: Column[] = slide.columns
        .filter((column) => column.children.length > 0)
        .map((column) => ({
            align: mergeAlign(slide.align, column.optionOverride),
            children: column.children,
        }));

    // Empty pages are allowed; always keep one column for layout.
    if (columns.length === 0) {
        columns.push({
            align: { ...slide.align },
            children: [],
        });
    }

    if (columns.length >= 4) {
        diagnostics.push({
            severity: "warning",
            message: `Slide has ${columns.length} columns (4+ is unusual)`,
        });
    }

    const finalized: Slide = {
        align: slide.align,
        header: slide.header,
        columns,
        notes: slide.notes,
        maxStep: 0,
    };
    applyRevealToSlide(finalized, diagnostics);
    return finalized;
}

function parseMarkdownRoot(body: string, breakMode: BreakMode): Root {
    const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
    if (breakMode === "soft") {
        processor.use(remarkBreaks);
    }
    return processor.runSync(processor.parse(body)) as Root;
}

/**
 * Parse an AXT Presen'it! Markdown source into a deck AST.
 */
export function parseSlideMarkdown(source: string): Deck {
    const { config, body, diagnostics: fmDiagnostics } = parseFrontmatter(source);
    const diagnostics: Diagnostic[] = [...fmDiagnostics];
    const root = parseMarkdownRoot(body, config.break);

    const slides: MutableSlide[] = [createSlide()];
    let current = slides[0]!;

    for (const node of root.children) {
        if (node.type === "html" && isHtmlComment(node.value)) {
            const directive = parseDirectiveComment(node.value, diagnostics, positionLine(node));

            if (directive?.command === "slide-break") {
                const isLeadingEmpty =
                    slides.length === 1 &&
                    current.header === null &&
                    current.columns.length === 1 &&
                    current.columns[0]!.children.length === 0 &&
                    current.awaitingHeader;

                if (isLeadingEmpty) {
                    // File-leading slide-break applies options to page 1
                    // instead of creating an empty page.
                    current.align = alignFromDirective(directive.options);
                    continue;
                }

                slides.push(createSlide(directive.options));
                current = slides[slides.length - 1]!;
                continue;
            }

            if (directive?.command === "column-break") {
                current.awaitingHeader = false;
                current.columns.push({
                    optionOverride: directive.options,
                    children: [],
                });
                continue;
            }
        }

        if (
            current.awaitingHeader &&
            node.type === "heading" &&
            node.depth === 2 &&
            current.columns.length === 1 &&
            current.columns[0]!.children.length === 0
        ) {
            current.header = node;
            current.awaitingHeader = false;
            continue;
        }

        current.awaitingHeader = false;
        const column = current.columns[current.columns.length - 1]!;
        column.children.push(node);
    }

    return {
        config,
        slides: slides.map((slide) => finalizeSlide(slide, diagnostics)),
        diagnostics,
    };
}

// Re-export DEFAULT_SLIDE_ALIGN for tests / consumers that need defaults.
export { DEFAULT_SLIDE_ALIGN };
