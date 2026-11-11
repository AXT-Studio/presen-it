import {
    mkdir,
    mkdtemp,
    readdir,
    readFile,
    realpath,
    rm,
    symlink,
    writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, createServer, type ViteDevServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import {
    deckMetadata,
    decksModuleCode,
    RELATIVE_BASE_TOKEN,
    replaceRelativeBase,
    type PresenitDeck,
} from "../src/vite/decks";
import { presenit } from "../src/vite/plugin";

const stub = fileURLToPath(new URL("../decks.ts", import.meta.url));
const location = { route: "/slides/a/", source: "src/slides/a/index.md" };

describe("deckMetadata", () => {
    it("reads frontmatter and counts slides with the deck parser", () => {
        const markdown = `---
title: "  My talk  "
description: A blurb
theme: dark
hue: 400
width: 1280
height: 720
date: 2026-11-12
tags: [vite, slides]
---
<!-- presen-it! slide-break (center-x=true) -->

# Cover

<!-- presen-it! slide-break -->

## Second

<!-- presen-it! slide-break -->

## Third
`;
        expect(deckMetadata(markdown, location)).toEqual({
            route: "/slides/a/",
            source: "src/slides/a/index.md",
            title: "My talk",
            description: "A blurb",
            slideCount: 3,
            theme: "dark",
            hue: 40,
            width: 1280,
            height: 720,
            frontmatter: {
                title: "  My talk  ",
                description: "A blurb",
                theme: "dark",
                hue: 400,
                width: 1280,
                height: 720,
                date: "2026-11-12",
                tags: ["vite", "slides"],
            },
        });
    });

    it("uses the Viewer defaults without frontmatter", () => {
        expect(deckMetadata("# Only slide\n", location)).toMatchObject({
            title: "AXT Presen'it! — /slides/a/",
            description: "",
            slideCount: 1,
            theme: "light",
            hue: 210,
            width: 1920,
            height: 1080,
            frontmatter: {},
        });
    });

    it("falls back to defaults for invalid frontmatter", () => {
        const metadata = deckMetadata("---\ntitle: [unclosed\n---\n# Slide\n", location);
        expect(metadata.title).toBe("AXT Presen'it! — /slides/a/");
        expect(metadata.frontmatter).toEqual({});
        expect(deckMetadata("---\n- a list\n---\n# Slide\n", location).frontmatter).toEqual({});
    });
});

async function evaluate(code: string, url?: string): Promise<PresenitDeck[]> {
    const source = url ? code.replaceAll("import.meta.url", JSON.stringify(url)) : code;
    const module = await import("data:text/javascript," + encodeURIComponent(source));
    return module.decks;
}

describe("decksModuleCode", () => {
    const metadata = deckMetadata("# A\n", location);

    it("prefixes absolute bases", async () => {
        expect((await evaluate(decksModuleCode([metadata], "/demo/")))[0]!.url).toBe(
            "/demo/slides/a/",
        );
        expect((await evaluate(decksModuleCode([metadata], "/")))[0]!.url).toBe("/slides/a/");
        expect(
            (await evaluate(decksModuleCode([metadata], "https://cdn.example/app/")))[0]!.url,
        ).toBe("https://cdn.example/app/slides/a/");
    });

    it("resolves relative bases from the emitted chunk", async () => {
        for (const base of ["./", ""]) {
            const code = decksModuleCode([metadata], base);
            expect(code).toContain(RELATIVE_BASE_TOKEN);
            const nested = replaceRelativeBase(code, "assets/index-abc.js")!;
            expect(nested.length).toBe(code.length);
            expect(
                (await evaluate(nested, "https://host.example/site/assets/index-abc.js"))[0]!.url,
            ).toBe("https://host.example/site/slides/a/");
            const top = replaceRelativeBase(code, "index.js")!;
            expect((await evaluate(top, "https://host.example/site/index.js"))[0]!.url).toBe(
                "https://host.example/site/slides/a/",
            );
        }
        expect(replaceRelativeBase("const a = 1;", "index.js")).toBeNull();
    });
});

describe("@ayaexptech/presen-it/decks without the plugin", () => {
    it("throws a helpful error", async () => {
        await expect(import("../decks")).rejects.toThrow(/presenit\(\) Vite plugin/);
    });
});

let fixture = "";
let server: ViteDevServer | undefined;
afterEach(async () => {
    await server?.close();
    server = undefined;
    if (fixture) await rm(fixture, { recursive: true, force: true });
    fixture = "";
});

async function project(): Promise<string> {
    // Vite expects a real path root (macOS links /var to /private/var).
    fixture = await realpath(await mkdtemp(path.join(os.tmpdir(), "presenit-decks-")));
    await mkdir(path.join(fixture, "src/slides/a"), { recursive: true });
    await mkdir(path.join(fixture, "src/slides/b"), { recursive: true });
    await writeFile(
        path.join(fixture, "src/slides/a/index.md"),
        "---\ntitle: Deck A\ndescription: First\n---\n# One\n\n<!-- presen-it! slide-break -->\n\n## Two\n",
    );
    await writeFile(path.join(fixture, "src/slides/b/index.md"), "# Untitled deck\n");
    await writeFile(
        path.join(fixture, "index.html"),
        '<!doctype html><html><body><script type="module" src="/main.js"></script></body></html>',
    );
    await writeFile(
        path.join(fixture, "main.js"),
        'import { decks } from "virtual:presenit/decks";\nglobalThis.__decks = decks;\n',
    );
    // Only loaded by the dev test, to check HMR acceptance.
    await writeFile(
        path.join(fixture, "hot.js"),
        'import { decks } from "virtual:presenit/decks";\n' +
            'import.meta.hot.accept("virtual:presenit/decks", () => {});\n' +
            "globalThis.__decks = decks;\n",
    );
    return fixture;
}

describe("Vite build", () => {
    async function built(base: string): Promise<PresenitDeck[]> {
        const root = await project();
        await build({
            root,
            base,
            configFile: false,
            logLevel: "silent",
            plugins: [presenit()],
            build: { modulePreload: { polyfill: false } },
        });
        const assets = path.join(root, "dist/assets");
        const html = await readFile(path.join(root, "dist/index.html"), "utf8");
        const chunk = (await readdir(assets)).find(
            (file) => file.endsWith(".js") && html.includes(file),
        )!;
        delete (globalThis as { __decks?: unknown }).__decks;
        await import(pathToFileURL(path.join(assets, chunk)).href);
        return (globalThis as unknown as { __decks: PresenitDeck[] }).__decks;
    }

    it("emits deck metadata with the configured base", async () => {
        const decks = await built("/demo/");
        expect(
            decks.map(({ url, route, title, slideCount, source }) => ({
                url,
                route,
                title,
                slideCount,
                source,
            })),
        ).toEqual([
            {
                url: "/demo/slides/a/",
                route: "/slides/a/",
                title: "Deck A",
                slideCount: 2,
                source: "src/slides/a/index.md",
            },
            {
                url: "/demo/slides/b/",
                route: "/slides/b/",
                title: "AXT Presen'it! — /slides/b/",
                slideCount: 1,
                source: "src/slides/b/index.md",
            },
        ]);
        const output = await readFile(path.join(fixture, "dist/slides/a/index.html"), "utf8");
        expect(output).toContain("<title>Deck A</title>");
    }, 60_000);

    it("resolves a relative base against the output directory", async () => {
        const decks = await built("./");
        const dist = pathToFileURL(path.join(fixture, "dist")).href;
        expect(decks.map((deck) => deck.url)).toEqual([dist + "/slides/a/", dist + "/slides/b/"]);
    }, 60_000);
});

describe("Vite dev server", () => {
    async function decks(): Promise<PresenitDeck[]> {
        const result = await server!.environments.client.transformRequest("virtual:presenit/decks");
        return evaluate(result!.code);
    }
    async function until(check: (decks: PresenitDeck[]) => boolean): Promise<PresenitDeck[]> {
        const deadline = Date.now() + 10_000;
        for (;;) {
            const current = await decks();
            if (check(current)) return current;
            if (Date.now() > deadline)
                throw new Error("Timed out; last result: " + JSON.stringify(current));
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
    }

    it("serves metadata and follows Markdown additions, edits and removals", async () => {
        const root = await project();
        server = await createServer({
            root,
            base: "/demo/",
            configFile: false,
            logLevel: "silent",
            plugins: [presenit()],
            server: { middlewareMode: true, ws: false },
            optimizeDeps: { noDiscovery: true },
            resolve: { alias: { "aliased-presenit/decks": stub } },
        });
        const reloads: string[] = [];
        for (const channel of new Set([server.ws, server.environments.client.hot])) {
            const send = channel.send.bind(channel) as (...args: unknown[]) => void;
            channel.send = ((...args: unknown[]) => {
                const payload = args[0] as {
                    type?: string;
                    path?: string;
                    updates?: { acceptedPath: string }[];
                };
                if (payload?.type === "full-reload") reloads.push(payload.path ?? "(all)");
                if (payload?.type === "update")
                    for (const update of payload.updates ?? [])
                        reloads.push("hmr " + update.acceptedPath);
                send(...args);
            }) as typeof channel.send;
        }
        async function reloaded(target: string): Promise<void> {
            const deadline = Date.now() + 10_000;
            while (!reloads.includes(target)) {
                if (Date.now() > deadline)
                    throw new Error("No reload of " + target + ": " + reloads);
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
        }
        expect((await decks()).map((deck) => deck.url)).toEqual([
            "/demo/slides/a/",
            "/demo/slides/b/",
        ]);
        // The typed subpath, a Vite alias to it and a renamed install all reach the same module.
        await mkdir(path.join(root, "node_modules/renamed-presenit"), { recursive: true });
        await writeFile(
            path.join(root, "node_modules/renamed-presenit/package.json"),
            JSON.stringify({ name: "renamed-presenit", exports: { "./decks": "./decks.ts" } }),
        );
        await symlink(stub, path.join(root, "node_modules/renamed-presenit/decks.ts"));
        for (const specifier of [
            "@ayaexptech/presen-it/decks",
            "aliased-presenit/decks",
            "renamed-presenit/decks",
        ]) {
            const resolved = await server.environments.client.pluginContainer.resolveId(
                specifier,
                path.join(root, "main.js"),
            );
            expect(resolved?.id, specifier).toBe("\0virtual:presenit/decks");
        }

        await mkdir(path.join(root, "src/slides/c"), { recursive: true });
        await writeFile(path.join(root, "src/slides/c/index.md"), "---\ntitle: Deck C\n---\n");
        await until((list) => list.some((deck) => deck.title === "Deck C"));

        await writeFile(
            path.join(root, "src/slides/a/index.md"),
            "---\ntitle: Renamed\n---\n# Only one slide now\n",
        );
        const edited = await until((list) => list[0]!.title === "Renamed");
        expect(edited[0]!.slideCount).toBe(1);
        // Pages importing the list reload because its metadata changed.
        await reloaded("*");

        // A body-only edit reloads that deck, but not pages that import the list.
        reloads.length = 0;
        await writeFile(
            path.join(root, "src/slides/c/index.md"),
            "---\ntitle: Deck C\n---\nNew body text.\n",
        );
        await reloaded("/slides/c/index.html");
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(reloads).toEqual(["/slides/c/index.html"]);

        await rm(path.join(root, "src/slides/b/index.md"));
        const removed = await until((list) => list.length === 2);
        expect(removed.map((deck) => deck.route)).toEqual(["/slides/a/", "/slides/c/"]);

        // An importer that accepts the module receives HMR updates instead of a reload.
        await server.environments.client.transformRequest("/hot.js");
        reloads.length = 0;
        await writeFile(path.join(root, "src/slides/c/index.md"), "---\ntitle: Deck C2\n---\n");
        await until((list) => list[1]!.title === "Deck C2");
        await reloaded("hmr /@id/virtual:presenit/decks");
        expect(reloads).not.toContain("*");
    }, 30_000);
});
