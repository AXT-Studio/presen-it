import type {
    BlockContent,
    DefinitionContent,
    Html,
    ListItem,
    PhrasingContent,
    RootContent,
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

function transformPhrasing(children: PhrasingContent[], state: RevealState): PhrasingContent[] {
    const out: PhrasingContent[] = [];
    let group: PhrasingContent[] = [];
    let groupAt: number | null = null;

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
        }

        if (PHRASING_CONTAINERS.has(child.type) && "children" in child) {
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

function transformListItem(item: ListItem, state: RevealState): ListItem {
    const itemAt = state.at;
    noteMax(state, itemAt);
    const children = transformBlockNodes(
        item.children as Array<BlockContent | DefinitionContent>,
        state,
    );
    const next: ListItem = { ...item, children };
    setPresenitAt(next, itemAt);
    return next;
}

function transformBlockNodes(
    nodes: Array<BlockContent | DefinitionContent | RootContent>,
    state: RevealState,
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
            out.push({
                ...node,
                children: node.children.map((item) => transformListItem(item, state)),
            });
            continue;
        }

        if (
            node.type === "paragraph" ||
            node.type === "heading" ||
            node.type === "tableCell" ||
            node.type === "tableRow"
        ) {
            if ("children" in node) {
                const transformed = {
                    ...node,
                    children: transformPhrasing(node.children as PhrasingContent[], state),
                };
                // Prefer element-level attr when the block is a single uniform fragment.
                // Phrasing already wrapped in spans; still stamp block for blocks without splits
                // when there is exactly one open span covering all — spans are enough for visibility.
                out.push(transformed as BlockContent);
            } else {
                out.push(node as BlockContent);
            }
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
                const cells = row.children.map((cell) => ({
                    ...cell,
                    children: transformPhrasing(cell.children as PhrasingContent[], state),
                }));
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
