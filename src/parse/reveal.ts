import type {
    BlockContent,
    DefinitionContent,
    Heading,
    Html,
    List,
    ListItem,
    Paragraph,
    PhrasingContent,
    RootContent,
    TableCell,
} from "mdast";
import type { Diagnostic, Slide } from "../types.ts";
import { extractCommentText, isHtmlComment, parseDirectiveComment } from "./directive.ts";

export type RevealState = {
    at: number;
    maxStep: number;
    diagnostics: Diagnostic[];
    /** True when fragment `<span>` html nodes were injected (needs allowDangerousHtml). */
    hasFragmentHtml: boolean;
};

const PHRASING_CONTAINERS = new Set(["strong", "emphasis", "delete", "link", "linkReference"]);

function positionLine(node: { position?: { start?: { line?: number } } }): number | undefined {
    return node.position?.start?.line;
}

export function getPresenitAt(node: { data?: unknown }): number | undefined {
    if (!node.data || typeof node.data !== "object") {
        return undefined;
    }
    const at = (node.data as { presenitAt?: unknown }).presenitAt;
    return typeof at === "number" ? at : undefined;
}

export function setPresenitAt(node: { data?: unknown }, at: number): void {
    if (at <= 0) {
        return;
    }
    const prev =
        node.data && typeof node.data === "object" ? (node.data as Record<string, unknown>) : {};
    const prevH =
        prev.hProperties && typeof prev.hProperties === "object" && prev.hProperties !== null
            ? (prev.hProperties as Record<string, unknown>)
            : {};
    node.data = {
        ...prev,
        presenitAt: at,
        hProperties: {
            ...prevH,
            "data-presenit-at": String(at),
        },
    };
}

function noteMax(state: RevealState, at: number): void {
    if (at > state.maxStep) {
        state.maxStep = at;
    }
}

/**
 * If `node` is a reveal directive comment, update sticky `at` and return true (consume).
 * Invalid reveal → warning, sticky unchanged, still consumed when it parsed as reveal command failure?
 * Plan: invalid → warning and ignore directive (sticky unchanged). Still consume the comment so it
 * does not render as text.
 */
function consumeRevealHtml(node: Html, state: RevealState): boolean {
    if (!isHtmlComment(node.value)) {
        return false;
    }
    const body = extractCommentText(node.value);
    if (!body.startsWith("presen-it!")) {
        return false;
    }

    const beforeLen = state.diagnostics.length;
    const directive = parseDirectiveComment(node.value, state.diagnostics, positionLine(node));

    if (directive?.command === "reveal") {
        const at = directive.options.at ?? 0;
        state.at = at;
        noteMax(state, at);
        return true;
    }

    // Valid non-reveal directive in content (shouldn't appear inline often): leave for caller.
    // Malformed / unknown already warned; if it looked like presen-it!, consume to avoid notes/text.
    if (directive) {
        return false;
    }
    // parse returned null after warning → consume so it is not shown as raw HTML/text
    if (state.diagnostics.length > beforeLen) {
        return true;
    }
    return false;
}

function fragmentOpen(at: number): Html {
    return {
        type: "html",
        data: { presenitGenerated: true } as unknown as Html["data"],
        value: `<span class="presenit-fragment" data-presenit-at="${at}">`,
    };
}

function fragmentClose(): Html {
    return {
        type: "html",
        value: "</span>",
        data: { presenitGenerated: true } as unknown as Html["data"],
    };
}

function wrapFragment(nodes: PhrasingContent[], at: number, state: RevealState): PhrasingContent[] {
    if (nodes.length === 0) {
        return [];
    }
    noteMax(state, at);
    if (at <= 0) {
        return nodes;
    }
    state.hasFragmentHtml = true;
    return [fragmentOpen(at), ...nodes, fragmentClose()];
}

const VOID_ELEMENTS = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
]);

/**
 * Nesting change caused by one inline raw HTML node (remark emits one node per tag):
 * +1 for an opening tag, -1 for a closing tag, 0 for void / self-closing tags and comments.
 */
function inlineHtmlDepthDelta(value: string): number {
    const match = /^<(\/?)([A-Za-z][A-Za-z0-9-]*)\b[^]*?(\/?)>$/.exec(value.trim());
    if (!match) {
        return 0;
    }
    if (match[1]) {
        return -1;
    }
    if (match[3] || VOID_ELEMENTS.has(match[2]!.toLowerCase())) {
        return 0;
    }
    return 1;
}

function transformPhrasing(children: PhrasingContent[], state: RevealState): PhrasingContent[] {
    const out: PhrasingContent[] = [];
    let group: PhrasingContent[] = [];
    let groupAt: number | null = null;
    // Depth of user-written inline HTML elements left open in the current group. While > 0,
    // the group must not be split, or fragment `</span>`s would close the user's elements.
    let htmlDepth = 0;

    const flush = (): void => {
        if (group.length === 0 || groupAt === null) {
            group = [];
            groupAt = null;
            return;
        }
        out.push(...wrapFragment(group, groupAt, state));
        group = [];
        groupAt = null;
    };

    for (const child of children) {
        if (child.type === "html") {
            if (consumeRevealHtml(child, state)) {
                flush();
                continue;
            }
            htmlDepth = Math.max(0, htmlDepth + inlineHtmlDepthDelta(child.value));
        }

        if (htmlDepth === 0 && PHRASING_CONTAINERS.has(child.type) && "children" in child) {
            flush();
            const nested = child as PhrasingContent & { children: PhrasingContent[] };
            out.push({
                ...nested,
                children: transformPhrasing(nested.children, state),
            } as PhrasingContent);
            continue;
        }

        if (groupAt === null) {
            groupAt = state.at;
        }
        group.push(child);
    }

    flush();
    return out;
}

type BlockContext = {
    /** `at` already applied by the enclosing element (list item / table). */
    coveredAt?: number;
    /** Paragraphs are unwrapped into their `<li>` (tight list), so they cannot carry attributes. */
    unwrapParagraphs?: boolean;
};

function containsDirectiveComment(nodes: PhrasingContent[]): boolean {
    return nodes.some((node) => {
        if (node.type === "html" && isHtmlComment(node.value)) {
            return extractCommentText(node.value).startsWith("presen-it!");
        }
        return "children" in node && containsDirectiveComment(node.children as PhrasingContent[]);
    });
}

/**
 * When a phrasing block has no inline directive, its content shares one `at`: stamp the block
 * element itself (or rely on an enclosing element with the same `at`) instead of splitting it
 * into fragment spans. Otherwise fall back to per-run fragment spans.
 */
function transformPhrasingBlock<T extends Paragraph | Heading | TableCell>(
    node: T,
    state: RevealState,
    coveredAt: number | undefined,
    canStamp: boolean,
): T {
    if (!containsDirectiveComment(node.children)) {
        const at = state.at;
        noteMax(state, at);
        if (at <= 0 || at === coveredAt) {
            return node;
        }
        if (canStamp) {
            const next = { ...node };
            setPresenitAt(next, at);
            return next;
        }
    }
    return { ...node, children: transformPhrasing(node.children, state) };
}

/** Mirrors mdast-util-to-hast: in a tight list, every `<p>` in its items is unwrapped. */
function isLooseList(list: List): boolean {
    return (
        Boolean(list.spread) ||
        list.children.some((item) =>
            item.spread === null || item.spread === undefined
                ? item.children.length > 1
                : item.spread,
        )
    );
}

function transformListItem(item: ListItem, state: RevealState, loose: boolean): ListItem {
    const itemAt = state.at;
    noteMax(state, itemAt);
    const children = transformBlockNodes(
        item.children as Array<BlockContent | DefinitionContent>,
        state,
        { coveredAt: itemAt, unwrapParagraphs: !loose },
    );
    const next: ListItem = { ...item, children };
    setPresenitAt(next, itemAt);
    return next;
}

function transformBlockNodes(
    nodes: Array<BlockContent | DefinitionContent | RootContent>,
    state: RevealState,
    context: BlockContext = {},
): Array<BlockContent | DefinitionContent> {
    const out: Array<BlockContent | DefinitionContent> = [];

    for (const node of nodes) {
        if (node.type === "html") {
            if (consumeRevealHtml(node, state)) {
                continue;
            }
            // Non-directive HTML block: stamp and keep
            setPresenitAt(node, state.at);
            noteMax(state, state.at);
            out.push(node as BlockContent);
            continue;
        }

        if (node.type === "list") {
            const loose = isLooseList(node);
            out.push({
                ...node,
                children: node.children.map((item) => transformListItem(item, state, loose)),
            });
            continue;
        }

        if (node.type === "paragraph" || node.type === "heading") {
            const canStamp = !(node.type === "paragraph" && context.unwrapParagraphs);
            out.push(transformPhrasingBlock(node, state, context.coveredAt, canStamp));
            continue;
        }

        if (node.type === "blockquote" || node.type === "footnoteDefinition") {
            const children = transformBlockNodes(
                node.children as Array<BlockContent | DefinitionContent>,
                state,
            );
            const next = { ...node, children };
            setPresenitAt(next, state.at);
            noteMax(state, state.at);
            out.push(next as BlockContent);
            continue;
        }

        if (node.type === "table") {
            // Walk rows/cells for inline reveals; stamp table at entry at.
            const entryAt = state.at;
            const children = node.children.map((row) => {
                const cells = row.children.map((cell) =>
                    transformPhrasingBlock(cell, state, entryAt, true),
                );
                return { ...row, children: cells };
            });
            const next = { ...node, children };
            setPresenitAt(next, entryAt);
            noteMax(state, entryAt);
            out.push(next);
            continue;
        }

        // code, thematicBreak, yaml, toml, definition, image (rare as block), etc.
        setPresenitAt(node, state.at);
        noteMax(state, state.at);
        out.push(node as BlockContent);
    }

    return out;
}

/**
 * Apply sticky `reveal` directives within a slide (columns left→right).
 * Mutates column children in place (replaced arrays). Returns maxStep.
 */
export function applyRevealToSlide(
    slide: Slide,
    diagnostics: Diagnostic[],
): {
    maxStep: number;
    hasFragmentHtml: boolean;
} {
    const state: RevealState = {
        at: 0,
        maxStep: 0,
        diagnostics,
        hasFragmentHtml: false,
    };

    for (const column of slide.columns) {
        column.children = transformBlockNodes(column.children, state) as RootContent[];
    }

    slide.maxStep = state.maxStep;
    return { maxStep: state.maxStep, hasFragmentHtml: state.hasFragmentHtml };
}
