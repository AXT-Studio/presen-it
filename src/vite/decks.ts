import { splitFrontmatter } from "../parse/frontmatter.ts";
import { parseSlideMarkdown } from "../parse/index.ts";
import type { DeckConfig } from "../types.ts";

/**
 * Metadata of one deck, as exported by `virtual:presenit/decks`
 * (also importable as `@ayaexptech/presen-it/decks`).
 */
export interface PresenitDeck {
    /**
     * Viewer URL including Vite `base`, ending with `/`.
     * Absolute bases give a path or URL such as `/demo/slides/example/`.
     * A relative base (`./`) gives a full URL resolved from the bundled module at runtime.
     */
    readonly url: string;
    /** Deck route without `base`, such as `/slides/example/`. Unique; usable as a key. */
    readonly route: string;
    /** Markdown path relative to Vite root with `/` separators, such as `src/slides/example/index.md`. */
    readonly source: string;
    /** The Viewer `<title>`: frontmatter `title`, or `AXT Presen'it! — <route>` when unset. */
    readonly title: string;
    /** Frontmatter `description`; `""` when unset. */
    readonly description: string;
    /** Number of slides (pages) in the deck. */
    readonly slideCount: number;
    /** Normalized frontmatter `theme`. */
    readonly theme: "light" | "dark";
    /** Normalized frontmatter `hue` (0–359). */
    readonly hue: number;
    /** Slide width in px. */
    readonly width: number;
    /** Slide height in px. */
    readonly height: number;
    /**
     * The YAML frontmatter mapping as written, including keys Presen'it! itself ignores
     * (for example `date` or `tags`). Values are JSON-compatible; `{}` when absent or invalid.
     */
    readonly frontmatter: Readonly<Record<string, unknown>>;
}

/** Deck metadata before `url` is resolved against Vite `base`. */
export type DeckMetadata = Omit<PresenitDeck, "url">;

/** The ID applications import. */
export const DECKS_ID = "virtual:presenit/decks";
/** The typed package subpath, redirected to the same module by the plugin. */
export const DECKS_PACKAGE_ID = "@ayaexptech/presen-it/decks";
/** Replaced in `renderChunk` with the relative path from the chunk to the output root. */
export const RELATIVE_BASE_TOKEN = "__PRESENIT_RELATIVE_BASE_PLACEHOLDER__";

/** The Viewer `<title>` for a deck. */
export function deckTitle(config: DeckConfig, route: string): string {
    return config.title.trim() || `AXT Presen'it! — ${route}`;
}

function rawFrontmatter(markdown: string): Record<string, unknown> {
    const { raw } = splitFrontmatter(markdown);
    if (typeof raw !== "object" || raw === null || Array.isArray(raw) || "__parseError" in raw)
        return {};
    // Keep only what survives JSON, matching what the generated module can carry.
    return JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
}

/** Reads list metadata from Markdown with the same parser the Viewer uses. */
export function deckMetadata(
    markdown: string,
    location: { route: string; source: string },
): DeckMetadata {
    const deck = parseSlideMarkdown(markdown);
    return {
        route: location.route,
        source: location.source,
        title: deckTitle(deck.config, location.route),
        description: deck.config.description,
        slideCount: deck.slides.length,
        theme: deck.config.theme,
        hue: deck.config.hue,
        width: deck.config.width,
        height: deck.config.height,
        frontmatter: rawFrontmatter(markdown),
    };
}

/**
 * Generates the virtual module. `base` is Vite's resolved base; a relative base
 * (`./` or empty) is resolved at runtime from `import.meta.url`, as Vite does for assets.
 */
export function decksModuleCode(decks: DeckMetadata[], base: string): string {
    const relative = base === "" || base === "./";
    const baseCode = relative
        ? `new URL(${JSON.stringify(RELATIVE_BASE_TOKEN)}, import.meta.url).href`
        : JSON.stringify(base);
    return [
        `const base = ${baseCode};`,
        `const data = ${JSON.stringify(decks)};`,
        "export const decks = data.map((deck) => ({ url: base + deck.route.slice(1), ...deck }));",
        "",
    ].join("\n");
}

/**
 * Resolves {@link RELATIVE_BASE_TOKEN} for a chunk emitted at `fileName` (relative to the
 * output directory). The replacement is padded to keep the chunk's columns unchanged.
 */
export function replaceRelativeBase(code: string, fileName: string): string | null {
    const pattern = new RegExp(`(["'\`])${RELATIVE_BASE_TOKEN}\\1`, "g");
    if (!pattern.test(code)) return null;
    const depth = fileName.split("/").length - 1;
    const literal = JSON.stringify(depth ? "../".repeat(depth) : "./");
    return code.replace(pattern, (match) => literal.padEnd(match.length, " "));
}
