import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import { renderDocument } from "./document.ts";

/** Options for the proof-of-concept plugin. */
export interface PresenitOptions {
    /** Output name → Markdown file relative to Vite's root. Example: { intro: "talk.md" }. */
    decks: Record<string, string>;
}

interface Deck {
    name: string;
    source: string;
    htmlId: string;
    route: string;
}

function normalize(file: string): string {
    return file.split(path.sep).join("/");
}

/**
 * Add `/slides/<name>.html` pages without requiring author-written HTML or viewer JS.
 * Existing Vite HTML inputs are retained. This PoC targets Vite 8 client builds.
 */
export function presenit(options: PresenitOptions): Plugin {
    let decks: Deck[] = [];
    let resolved: ResolvedConfig;

    async function html(deck: Deck): Promise<string> {
        return renderDocument(await readFile(deck.source, "utf8"), deck.name);
    }

    return {
        name: "presenit:poc",
        enforce: "pre",
        config(config) {
            if (!options.decks || Object.keys(options.decks).length === 0) {
                throw new Error("[presenit] Configure at least one Markdown deck.");
            }
            if (config.build?.lib || config.build?.ssr) {
                throw new Error("[presenit] The PoC supports client HTML builds only.");
            }
            const root = path.resolve(config.root ?? process.cwd());
            decks = Object.entries(options.decks).map(([name, file]) => {
                if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(name)) {
                    throw new Error(`[presenit] Invalid output name: ${name}`);
                }
                const source = normalize(path.resolve(root, file));
                const route = `/slides/${name}.html`;
                const htmlId = normalize(path.resolve(root, `.${route}`));
                if (!source.endsWith(".md") || !existsSync(source)) {
                    throw new Error(`[presenit] Markdown file not found: ${source}`);
                }
                const publicDir =
                    config.publicDir === false
                        ? undefined
                        : path.resolve(root, config.publicDir ?? "public");
                if (existsSync(htmlId) || (publicDir && existsSync(path.join(publicDir, route)))) {
                    throw new Error(`[presenit] HTML route already exists: ${route}`);
                }
                return { name, source, route, htmlId };
            });

            // Mutate only the input field: returning an array would let Vite concatenate inputs.
            config.build ??= {};
            const bundler = config.build.rolldownOptions ?? config.build.rollupOptions ?? {};
            const input = bundler.input;
            const htmlIds = decks.map((deck) => deck.htmlId);
            const hostIndex = path.resolve(root, "index.html");
            const merged =
                typeof input === "object" && !Array.isArray(input) ? { ...input } : undefined;
            if (merged) {
                for (const deck of decks) {
                    const key = `presenit/${deck.name}`;
                    if (key in merged)
                        throw new Error(`[presenit] Input name already exists: ${key}`);
                    merged[key] = deck.htmlId;
                }
            }
            config.build.rolldownOptions = {
                ...bundler,
                input: merged ?? [
                    ...(typeof input === "string"
                        ? [input]
                        : Array.isArray(input)
                          ? input
                          : existsSync(hostIndex)
                            ? [hostIndex]
                            : []),
                    ...htmlIds,
                ],
            };
        },
        configResolved(config) {
            resolved = config;
        },
        resolveId(id) {
            // HTML needs a root-relative file-shaped ID for Vite's HTML output naming.
            // A \0 virtual module ID would bypass that convention.
            return decks.find((deck) => deck.htmlId === normalize(id))?.htmlId;
        },
        async load(id) {
            const deck = decks.find((entry) => entry.htmlId === normalize(id));
            if (!deck) return;
            this.addWatchFile(deck.source);
            return html(deck);
        },
        configureServer(server) {
            server.watcher.add(decks.map((deck) => deck.source));
            const reload = (file: string) => {
                for (const deck of decks.filter((entry) => entry.source === normalize(file))) {
                    server.ws.send({ type: "full-reload", path: deck.route });
                }
            };
            server.watcher.on("change", reload);
            server.watcher.on("add", reload);
            server.watcher.on("unlink", reload);
            server.httpServer?.once("close", () => {
                server.watcher.off("change", reload);
                server.watcher.off("add", reload);
                server.watcher.off("unlink", reload);
            });
            server.middlewares.use(async (req, res, next) => {
                if (!req.url || (req.method !== "GET" && req.method !== "HEAD")) return next();
                let pathname: string;
                try {
                    pathname = decodeURIComponent(new URL(req.url, "http://vite.local").pathname);
                } catch {
                    return next();
                }
                const base = resolved.base;
                const route = pathname.startsWith(base)
                    ? `/${pathname.slice(base.length)}`
                    : pathname;
                const deck = decks.find((entry) => entry.route === route);
                if (!deck) return next();
                try {
                    const output = await server.transformIndexHtml(
                        pathname,
                        await html(deck),
                        req.originalUrl,
                    );
                    res.statusCode = 200;
                    res.setHeader("Content-Type", "text/html; charset=utf-8");
                    res.setHeader("Cache-Control", "no-cache");
                    res.end(req.method === "HEAD" ? undefined : output);
                } catch (error) {
                    next(error);
                }
            });
        },
    };
}
