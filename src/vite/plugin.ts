import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { glob } from "tinyglobby";
import { parseFragment, serialize, type DefaultTreeAdapterMap } from "parse5";
import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";
import { parseSlideMarkdown } from "../parse/index.ts";
import { renderDeckAsync } from "../render/index.ts";
import { viewerJs, viewerCss } from "../generated/viewer.ts";
import {
    DECKS_ID,
    DECKS_PACKAGE_ID,
    deckMetadata,
    decksModuleCode,
    deckTitle,
    replaceRelativeBase,
    type DeckMetadata,
} from "./decks.ts";

/** Markdown selection and the directory from which output routes are derived. */
export interface PresenitOptions {
    /** Globs relative to Vite root. Default: ["src/**\/index.md"]. */
    includes?: string[];
    /** Markdown path root, relative to Vite root. Default: "src". */
    root?: string;
    /** Exclude patterns, relative to Vite root. */
    excludes?: string[];
}
interface Entry {
    source: string;
    route: string;
    id: string;
}
interface Document {
    html: string;
    css: string;
    dependencies: Set<string>;
}
const JS_URL = "/@presenit/viewer.js";
const CSS_URL = "/@presenit/viewer.css";
const THEME = "/@presenit/theme/";
const slash = (value: string): string => value.replaceAll("\\", "/");
const RESOLVED_DECKS_ID = "\0" + DECKS_ID;
/** The published `decks` stub (TS from JSR source, JS from the npm build). */
const DECKS_STUBS = ["ts", "js"].map((extension) => {
    const url = new URL("../../decks." + extension, import.meta.url);
    return url.protocol === "file:" ? slash(fileURLToPath(url)) : url.href;
});
const escape = (value: string): string =>
    value.replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
    );
const json = (value: unknown): string => JSON.stringify(value).replaceAll("<", "\\u003c");

/** A standard Vite plugin. No author-written HTML or viewer entry is required. */
export function presenit(options: PresenitOptions = {}): Plugin {
    let config: ResolvedConfig;
    let root = "";
    let sourceRoot = "";
    let entries: Entry[] = [];
    const documents = new Map<string, Promise<Document>>();
    const assetDependencies = new Map<string, Set<string>>();
    const metadata = new Map<string, { markdown: string; value: DeckMetadata }>();
    /** Settles after the watcher has processed queued Markdown additions and removals. */
    let discovered: Promise<void> = Promise.resolve();
    const includes = options.includes ?? ["src/**/index.md"];
    const excludes = [
        "**/node_modules/**",
        "**/dist/**",
        "**/.git/**",
        ...(options.excludes ?? []),
    ];

    async function discover(): Promise<Entry[]> {
        const files = await glob(includes, {
            cwd: root,
            absolute: true,
            onlyFiles: true,
            ignore: excludes,
        });
        const routes = new Set<string>();
        return files.sort().map((file) => {
            const source = slash(file);
            const relative = slash(path.relative(sourceRoot, source));
            if (relative.startsWith("../") || path.isAbsolute(relative))
                throw new Error(
                    `[presenit] ${file} is outside the Markdown root. Set the root option.`,
                );
            const stem = relative.replace(/\.md$/i, "").replace(/(^|\/)index$/i, "");
            const route = "/" + stem.replace(/^\/+|\/+$/g, "") + (stem ? "/" : "");
            const canonical = route.replace(/\/+$/, "") + "/";
            if (routes.has(canonical.toLowerCase()))
                throw new Error(`[presenit] Duplicate deck route: ${canonical}`);
            routes.add(canonical.toLowerCase());
            const id = slash(path.resolve(root, "." + canonical, "index.html"));
            if (existsSync(id)) throw new Error(`[presenit] HTML route already exists: ${id}`);
            return { source, route: canonical, id };
        });
    }

    function themeURL(entry: Entry): string {
        return THEME + Buffer.from(entry.source).toString("base64url") + ".css";
    }
    function rootURL(file: string): string {
        const relative = slash(path.relative(root, file));
        return relative.startsWith("../") ? "/@fs/" + slash(file) : "/" + relative;
    }
    function rewrite(html: string, entry: Entry, dependencies: Set<string>): string {
        function url(value: string, asset: boolean): string {
            if (!value || /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(value)) return value;
            const match = /^([^?#]*)([?#].*)?$/.exec(value)!;
            const file = path.resolve(path.dirname(entry.source), decodeURIComponent(match[1]!));
            if (!asset && /\.md$/i.test(file)) {
                const target = entries.find((other) => other.source === slash(file));
                if (target)
                    return (
                        (path.posix.relative(entry.route, target.route) || ".") +
                        "/" +
                        (match[2] ?? "")
                    );
            }
            if (!asset) return value;
            dependencies.add(slash(file));
            if (!existsSync(file))
                throw new Error(
                    `[presenit] Missing asset: ${file} (referenced by ${entry.source})`,
                );
            return rootURL(file) + (match[2] ?? "");
        }
        const fragment = parseFragment(html);
        function visit(node: DefaultTreeAdapterMap["node"]): void {
            if ("attrs" in node)
                for (const attr of node.attrs) {
                    if (["src", "poster"].includes(attr.name)) attr.value = url(attr.value, true);
                    if (attr.name === "href") attr.value = url(attr.value, node.tagName !== "a");
                    if (attr.name === "srcset")
                        attr.value = attr.value
                            .split(",")
                            .map((part) => {
                                const [src, ...descriptor] = part.trim().split(/\s+/);
                                return [url(src ?? "", true), ...descriptor].join(" ");
                            })
                            .join(", ");
                }
            if ("childNodes" in node) node.childNodes.forEach(visit);
        }
        visit(fragment);
        return serialize(fragment);
    }
    async function compile(entry: Entry): Promise<Document> {
        const deck = parseSlideMarkdown(await readFile(entry.source, "utf8"));
        for (const diagnostic of deck.diagnostics)
            config.logger.warn(
                `[presenit] ${path.relative(root, entry.source)}${diagnostic.line ? ":" + diagnostic.line : ""}: ${diagnostic.message}`,
            );
        const rendered = await renderDeckAsync(deck);
        const dependencies = new Set([entry.source]);
        let css = rendered.css.replace(/@import\s+url\(["']?[^"']*katex[^"']*["']?\);\s*/gi, "");
        if (rendered.hasMath) {
            const require = createRequire(import.meta.url);
            const cssPath = path.join(
                path.dirname(require.resolve("katex/package.json")),
                "dist/katex.min.css",
            );
            const katexCss = (await readFile(cssPath, "utf8")).replace(
                /url\(fonts\/([^)]*)\)/g,
                (_, file: string) =>
                    `url("${rootURL(path.join(path.dirname(cssPath), "fonts", file))}")`,
            );
            // Imports must precede declarations in the final CSS.
            const imports = css.match(/^@import[^\n]*;[ \t]*$/gm)?.join("\n") ?? "";
            css = imports + "\n" + katexCss + "\n" + css.replace(/^@import[^\n]*;[ \t]*$/gm, "");
        }
        const title = deckTitle(deck.config, entry.route);
        const slides = rendered.slides
            .map((slide) => rewrite(slide.html, entry, dependencies))
            .join("\n");
        const data = {
            config: deck.config,
            notes: rendered.slides.map((slide) => slide.notes),
            route: entry.route,
        };
        // The theme attributes let the Viewer chrome match the deck from the first paint.
        const html = `<!doctype html><html lang="ja" data-presenit-theme="${escape(deck.config.theme)}" style="--presenit-viewer-hue: ${Number(deck.config.hue) || 0}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title><meta property="og:title" content="${escape(title)}">${deck.config.description ? `<meta name="description" content="${escape(deck.config.description)}"><meta property="og:description" content="${escape(deck.config.description)}">` : ""}<link rel="stylesheet" href="${CSS_URL}"><link rel="stylesheet" href="${themeURL(entry)}"><style>@page { size: ${deck.config.width}px ${deck.config.height}px; margin: 0; }</style></head><body><main id="presenit-stage" aria-label="スライド"><div class="presenit-deck">${slides}</div></main><script id="presenit-data" type="application/json">${json(data)}</script><script type="module" src="${JS_URL}"></script><noscript>発表用の操作にはJavaScriptを有効にしてください。印刷ではすべてのスライドを表示できます。</noscript></body></html>`;
        assetDependencies.set(entry.source, dependencies);
        return { html, css, dependencies };
    }
    function document(entry: Entry): Promise<Document> {
        if (!documents.has(entry.source))
            documents.set(
                entry.source,
                compile(entry).catch((error) => {
                    documents.delete(entry.source);
                    throw error;
                }),
            );
        return documents.get(entry.source)!;
    }
    /**
     * Theme CSS is requested by a <link>, which Vite serves as a separate
     * `?direct` module. Invalidate every variant so frontmatter changes
     * (theme, hue, fonts, size) reach the slides after the reload.
     */
    function invalidateThemes(server: ViteDevServer, entry?: Entry): void {
        const prefix = "\0" + (entry ? themeURL(entry) : THEME);
        for (const environment of Object.values(server.environments))
            for (const [id, module] of environment.moduleGraph.idToModuleMap)
                if (id.startsWith(prefix)) environment.moduleGraph.invalidateModule(module);
    }
    function readMetadata(entry: Entry, markdown: string): DeckMetadata {
        return deckMetadata(markdown, {
            route: entry.route,
            source: slash(path.relative(root, entry.source)),
        });
    }
    async function decksModule(watch: (file: string) => void): Promise<string> {
        await discovered;
        const items: DeckMetadata[] = [];
        for (const entry of entries) {
            watch(entry.source);
            let markdown: string;
            try {
                markdown = await readFile(entry.source, "utf8");
            } catch (error) {
                // Removed before the watcher rediscovered the decks.
                if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
                throw error;
            }
            let cached = metadata.get(entry.source);
            if (cached?.markdown !== markdown) {
                cached = { markdown, value: readMetadata(entry, markdown) };
                metadata.set(entry.source, cached);
            }
            items.push(cached.value);
        }
        return decksModuleCode(items, config.base);
    }
    function invalidateDecks(server: ViteDevServer): void {
        for (const environment of Object.values(server.environments)) {
            const module = environment.moduleGraph.getModuleById(RESOLVED_DECKS_ID);
            if (module) environment.moduleGraph.invalidateModule(module);
        }
    }
    function virtualURL(id: string): string {
        if (id.startsWith("\0")) return id.slice(1);
        return id;
    }
    return {
        name: "presenit",
        enforce: "pre",
        async config(user) {
            if (user.build?.lib || user.build?.ssr)
                throw new Error("[presenit] Client HTML builds are required.");
            root = path.resolve(user.root ?? process.cwd());
            sourceRoot = path.resolve(root, options.root ?? "src");
            entries = await discover();
            user.build ??= {};
            const bundler = user.build.rolldownOptions ?? user.build.rollupOptions ?? {};
            const host = bundler.input;
            const ids = entries.map((entry) => entry.id);
            const index = path.join(root, "index.html");
            if (host && typeof host === "object" && !Array.isArray(host)) {
                const merged = { ...host };
                for (const entry of entries) {
                    const key = "presenit:" + entry.route;
                    if (key in merged) throw new Error("[presenit] Duplicate input: " + key);
                    merged[key] = entry.id;
                }
                user.build.rolldownOptions = { ...bundler, input: merged };
            } else
                user.build.rolldownOptions = {
                    ...bundler,
                    input: [
                        ...(typeof host === "string"
                            ? [host]
                            : (host ?? (existsSync(index) ? [index] : []))),
                        ...ids,
                    ],
                };
        },
        configResolved(resolved) {
            config = resolved;
            for (const entry of entries) {
                if (
                    resolved.publicDir &&
                    existsSync(path.join(resolved.publicDir, "." + entry.route, "index.html"))
                )
                    throw new Error("[presenit] Public HTML route already exists: " + entry.route);
            }
        },
        async resolveId(id, importer) {
            if (id === DECKS_ID || id === DECKS_PACKAGE_ID || DECKS_STUBS.includes(slash(id)))
                return RESOLVED_DECKS_ID;
            // The package may be installed under another name (an alias or a jsr: specifier).
            if (id.endsWith("/decks") && !id.startsWith(".") && !path.isAbsolute(id)) {
                const resolved = await this.resolve(id, importer, { skipSelf: true });
                if (resolved && DECKS_STUBS.includes(slash(resolved.id.split("?")[0]!)))
                    return RESOLVED_DECKS_ID;
            }
            if (id.split("?")[0] === JS_URL || id.split("?")[0] === CSS_URL || id.startsWith(THEME))
                return "\0" + id;
            return entries.find((entry) => entry.id === slash(id))?.id;
        },
        async load(id) {
            const url = virtualURL(id).split("?")[0]!;
            if (id === RESOLVED_DECKS_ID) return decksModule((file) => this.addWatchFile(file));
            if (url === JS_URL) return viewerJs;
            if (url === CSS_URL) return viewerCss;
            const entry = entries.find((item) => item.id === slash(id) || themeURL(item) === url);
            if (!entry) return;
            const output = await document(entry);
            for (const file of output.dependencies) this.addWatchFile(file);
            return url.startsWith(THEME) ? output.css : output.html;
        },
        /**
         * `addWatchFile` links each Markdown file to the decks module, but Vite would
         * only soft-invalidate the importer and then reload every page. Replace that
         * link with a real update of the decks module, and only when the deck's
         * metadata changed, so ordinary slide edits do not reload list pages.
         * Additions and removals are handled by the watcher in configureServer.
         */
        async hotUpdate({ type, file, modules, read }) {
            if (type !== "update") return;
            const entry = entries.find((item) => item.source === slash(file));
            const decks = this.environment.moduleGraph.getModuleById(RESOLVED_DECKS_ID);
            if (!entry || !decks) return;
            const others = modules.filter(
                (module) =>
                    module.id !== entry.source ||
                    [...module.importers].some((importer) => importer !== decks),
            );
            const previous = metadata.get(entry.source)?.value;
            const next = readMetadata(entry, await read());
            if (previous && JSON.stringify(previous) === JSON.stringify(next)) return others;
            return [...others, decks];
        },
        renderChunk(code, chunk) {
            const replaced = replaceRelativeBase(code, chunk.fileName);
            return replaced === null ? null : { code: replaced, map: null };
        },
        configureServer(server) {
            server.watcher.add(sourceRoot);
            let pending = Promise.resolve();
            const changed = (event: string, file: string) => {
                pending = pending
                    .then(async () => {
                        const normalized = slash(file);
                        if (file.endsWith(".md") && ["add", "unlink"].includes(event)) {
                            entries = await discover();
                            documents.clear();
                            invalidateThemes(server);
                            invalidateDecks(server);
                            server.ws.send({ type: "full-reload" });
                            return;
                        }
                        for (const entry of entries)
                            if (
                                entry.source === normalized ||
                                assetDependencies.get(entry.source)?.has(normalized)
                            ) {
                                documents.delete(entry.source);
                                invalidateThemes(server, entry);
                                server.ws.send({
                                    type: "full-reload",
                                    path: entry.route + "index.html",
                                });
                            }
                    })
                    .catch((error) => {
                        config.logger.error(String(error));
                        server.ws.send({
                            type: "error",
                            err: { message: String(error), stack: "" },
                        });
                    });
                discovered = pending;
            };
            server.watcher.on("all", changed);
            server.httpServer?.once("close", () => server.watcher.off("all", changed));
            server.middlewares.use(async (req, res, next) => {
                if (!req.url || !["GET", "HEAD"].includes(req.method ?? "")) return next();
                let pathname: string;
                try {
                    pathname = decodeURIComponent(new URL(req.url, "http://vite.local").pathname);
                } catch {
                    return next();
                }
                const base = config.base;
                const route = pathname.startsWith(base)
                    ? "/" + pathname.slice(base.length)
                    : pathname;
                const entry = entries.find(
                    (item) =>
                        item.route === route ||
                        item.route + "index.html" === route ||
                        item.route.slice(0, -1) === route,
                );
                if (!entry) return next();
                if (!pathname.endsWith("/") && !pathname.endsWith(".html")) {
                    res.statusCode = 302;
                    res.setHeader("Location", pathname + "/");
                    res.end();
                    return;
                }
                try {
                    const output = await document(entry);
                    for (const file of output.dependencies) server.watcher.add(file);
                    const html = await server.transformIndexHtml(
                        pathname,
                        output.html,
                        req.originalUrl,
                    );
                    res.setHeader("Content-Type", "text/html; charset=utf-8");
                    res.setHeader("Cache-Control", "no-cache");
                    res.end(req.method === "HEAD" ? undefined : html);
                } catch (error) {
                    next(error);
                }
            });
        },
    };
}
