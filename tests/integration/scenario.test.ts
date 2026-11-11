import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import os from "node:os";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = fileURLToPath(new URL("../../", import.meta.url));

const chrome =
    process.env.CHROME_PATH ??
    [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome",
    ].find(existsSync);

function cli(cwd: string, args: string[], plus = false): ChildProcess {
    return spawn(
        plus ? path.join(cwd, "node_modules/.bin/vp") : process.execPath,
        plus ? args : [path.join(cwd, "node_modules/vite/bin/vite.js"), ...args],
        {
            cwd,
            detached: process.platform !== "win32",
            env: { ...process.env, NO_COLOR: "1" },
            stdio: ["ignore", "pipe", "pipe"],
        },
    );
}
function stop(child: ChildProcess, signal: NodeJS.Signals): void {
    try {
        if (process.platform === "win32") child.kill(signal);
        else if (child.pid) process.kill(-child.pid, signal);
    } catch {
        /* Process already exited. */
    }
}

async function build(cwd: string): Promise<string> {
    const child = cli(cwd, ["build"]);
    let output = "";
    child.stdout!.on("data", (chunk) => {
        output += chunk;
    });
    child.stderr!.on("data", (chunk) => {
        output += chunk;
    });
    const [code] = await once(child, "exit");
    assert.equal(code, 0, output);
    return output;
}

async function serve(cwd: string, preview = false, plus = false) {
    const child = cli(
        cwd,
        [
            ...(preview ? ["preview"] : plus ? ["dev"] : []),
            "--host",
            "127.0.0.1",
            "--port",
            "0",
            "--strictPort",
        ],
        plus,
    );
    let output = "";
    const url = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
            stop(child, "SIGKILL");
            reject(new Error(`Vite startup timed out: ${output}`));
        }, 15_000);
        const collect = (chunk: Buffer) => {
            output += chunk.toString();
            const match = output.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+\/[^\s]*)/);
            if (match) {
                clearTimeout(timer);
                resolve(match[1]!);
            }
        };
        child.stdout!.on("data", collect);
        child.stderr!.on("data", collect);
        child.once("exit", (code) => {
            clearTimeout(timer);
            reject(new Error(`Vite exited (${code}): ${output}`));
        });
    });
    return {
        url,
        async close() {
            if (child.exitCode !== null || child.signalCode !== null) return;
            const exited = once(child, "exit");
            stop(child, "SIGTERM");
            const force = setTimeout(() => stop(child, "SIGKILL"), 2000);
            try {
                await exited;
            } finally {
                clearTimeout(force);
            }
        },
    };
}

const markdown = `---
title: Acceptance deck
width: 1280
height: 720
fontFamily:
  sans: [system-ui, sans-serif]
  mono: [ui-monospace, monospace]
animation:
  duration: 0
---
# First slide

![local image](./assets/mark.svg)

<!-- secret speaker note -->

<!-- presen-it! slide-break -->

## Second slide

Always visible.

<!-- presen-it! reveal (at=1) -->

First reveal.

<!-- presen-it! column-break -->

Sticky across columns.

<!-- presen-it! reveal (at=3) -->

Final reveal.

<!-- second secret note -->

<!-- presen-it! slide-break -->

## Rich content

> [!NOTE]
> An alert.

- [x] Task done

| a | b |
| - | - |
| 1 | 2 |

<!-- presen-it! column-break -->

\`\`\`ts
const answer = 42;
\`\`\`

$E=mc^2$

\`\`\`mermaid
graph LR
  A --> B
\`\`\`
`;
async function open(page: import("puppeteer-core").Page, url: string) {
    await page.goto(url);
    await page.waitForSelector("html.presenit-ready");
}
async function click(page: import("puppeteer-core").Page, label: string) {
    await page.bringToFront();
    await page.locator(`button[aria-label="${label}"]`).click();
}
/** Waits for "slide / total · step / maxStep", read from the toolbar position. */
async function count(page: import("puppeteer-core").Page, value: string) {
    await page.waitForFunction(
        (expected) => {
            const steps = document.querySelector<HTMLElement>(".presenit-steps");
            const slide = document.querySelector(".presenit-counter")?.textContent;
            return `${slide} · ${steps?.dataset.step} / ${steps?.dataset.max}` === expected;
        },
        {},
        value,
    );
}
async function toolbarShown(page: import("puppeteer-core").Page, shown: boolean) {
    await page.waitForFunction(
        (expected) => {
            const toolbar = document.querySelector(".presenit-toolbar")!;
            const style = getComputedStyle(toolbar);
            return (style.pointerEvents !== "none" && style.opacity === "1") === expected;
        },
        { timeout: 6000 },
        shown,
    );
}
/** Opens the floating menu the way a mouse user does: approach the bottom edge, then click. */
async function openMenu(page: import("puppeteer-core").Page) {
    await page.bringToFront();
    const { width, height } = page.viewport()!;
    await page.mouse.move(width / 2, height - 24);
    await toolbarShown(page, true);
    await click(page, "メニュー");
    await page.waitForSelector(".presenit-menu:popover-open");
}
const VIEWER_UI = [
    ".presenit-toolbar",
    ".presenit-menu",
    ".presenit-tooltip",
    ".presenit-status",
    ".presenit-presenter",
    ".presenit-overview",
    ".presenit-blackout",
    ".presenit-laser",
];

test(
    "Installed package: complete authoring, presenting and PDF scenario",
    { timeout: 180_000 },
    async (t) => {
        assert.ok(chrome, "Set CHROME_PATH to Chrome/Chromium.");
        const fixture = await mkdtemp(path.join(os.tmpdir(), "presenit-v2-"));
        t.after(() => rm(fixture, { recursive: true, force: true }));
        execFileSync(process.execPath, ["scripts/build.mjs", "--package"], {
            cwd: root,
            stdio: "pipe",
        });
        const packed = JSON.parse(
            execFileSync(
                "npm",
                [
                    "pack",
                    path.join(root, "tmp/package"),
                    "--pack-destination",
                    fixture,
                    "--cache",
                    "/tmp/presen-it-npm-cache",
                    "--json",
                ],
                { cwd: root, encoding: "utf8" },
            ),
        );
        await writeFile(
            path.join(fixture, "package.json"),
            JSON.stringify({ name: "acceptance-consumer", type: "module", private: true }),
        );
        execFileSync(
            "npm",
            [
                "install",
                path.join(fixture, packed[0].filename),
                "vite@8.1.5",
                "vite-plus@1.6.0",
                "typescript@5.9.3",
                "@types/node@24.13.3",
                "--cache",
                "/tmp/presen-it-npm-cache",
                "--no-audit",
                "--no-fund",
            ],
            { cwd: fixture, stdio: "pipe", timeout: 120_000 },
        );
        assert.equal(
            (
                await (
                    await import("node:fs/promises")
                ).lstat(path.join(fixture, "node_modules/@ayaexptech/presen-it"))
            ).isSymbolicLink(),
            false,
        );
        await mkdir(path.join(fixture, "src/slides/example/assets"), { recursive: true });
        await mkdir(path.join(fixture, "src/slides/second"), { recursive: true });
        await writeFile(path.join(fixture, "src/slides/example/index.md"), markdown);
        await writeFile(
            path.join(fixture, "src/slides/second/index.md"),
            "# Other deck\n\n[First](../example/index.md)",
        );
        await writeFile(
            path.join(fixture, "src/slides/example/assets/mark.svg"),
            '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>',
        );
        await writeFile(
            path.join(fixture, "index.html"),
            '<!doctype html><html><head><title>Host app</title></head><body><h1>Host app</h1><script type="module" src="/main.js"></script></body></html>',
        );
        await writeFile(path.join(fixture, "main.js"), 'document.body.dataset.hostReady="yes"');
        await cp(
            path.join(root, "tests/fixtures/real-talk"),
            path.join(fixture, "src/slides/real"),
            { recursive: true },
        );
        await (
            await import("node:fs/promises")
        ).rename(
            path.join(fixture, "src/slides/real/slide.md"),
            path.join(fixture, "src/slides/real/index.md"),
        );
        const configFile = path.join(fixture, "vite.config.ts");
        const configSource = (
            base: string,
            plus = false,
        ) => `import { defineConfig } from "${plus ? "vite-plus" : "vite"}";
import presenit from "@ayaexptech/presen-it";
export default defineConfig({ base: ${JSON.stringify(base)}, plugins: [presenit({ includes: ["src/**/*.md"] })] });`;
        await writeFile(configFile, configSource("/demo/"));
        await writeFile(
            path.join(fixture, "tsconfig.json"),
            JSON.stringify({
                compilerOptions: {
                    module: "ESNext",
                    moduleResolution: "Bundler",
                    strict: true,
                    skipLibCheck: true,
                    noEmit: true,
                    types: ["node"],
                },
                include: ["vite.config.ts"],
            }),
        );
        execFileSync(
            process.execPath,
            [path.join(fixture, "node_modules/typescript/bin/tsc"), "--noEmit"],
            { cwd: fixture, stdio: "pipe" },
        );
        const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
        t.after(() => browser.close());
        const page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on("request", (request) => {
            if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== "127.0.0.1")
                void request.abort();
            else void request.continue();
        });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        const dev = await serve(fixture);
        let presenter: import("puppeteer-core").Page | undefined;
        try {
            await page.goto(dev.url);
            await page.waitForFunction(() => document.body.dataset.hostReady === "yes");
            await open(page, dev.url + "slides/example/");
            await page.waitForFunction(
                () =>
                    document.querySelector<HTMLImageElement>(".presenit-slide img")
                        ?.naturalWidth === 20,
            );
            await count(page, "1 / 3 · 0 / 0");
            // The slide uses the whole window: no space is reserved for controls.
            const frame = await page.evaluate(() => ({
                theme: document.documentElement.dataset.presenitTheme,
                stage: document.querySelector("#presenit-stage")!.getBoundingClientRect().height,
                scroll: document.documentElement.scrollHeight,
                viewport: innerHeight,
            }));
            assert.deepEqual(frame, {
                theme: "light",
                stage: frame.viewport,
                scroll: frame.viewport,
                viewport: frame.viewport,
            });
            // The floating toolbar appears near the bottom edge or with keyboard focus only.
            const viewport = page.viewport()!;
            await page.mouse.move(viewport.width / 2, viewport.height / 3);
            await toolbarShown(page, false);
            await page.mouse.move(viewport.width / 2, viewport.height - 24);
            await toolbarShown(page, true);
            await page.mouse.move(viewport.width / 2, viewport.height / 3);
            await toolbarShown(page, false);
            await page.keyboard.press("Tab");
            await toolbarShown(page, true);
            await page.keyboard.press("Escape");
            await toolbarShown(page, false);
            // Page transitions cross-fade over the outgoing slide instead of the page background.
            const crossfade = await page.evaluate(() => {
                document.body.dispatchEvent(
                    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
                );
                const leaving = document.querySelector<HTMLElement>(".presenit-slide.is-leaving");
                return (
                    leaving && {
                        index: leaving.dataset.slideIndex,
                        display: getComputedStyle(leaving).display,
                    }
                );
            });
            assert.deepEqual(crossfade, { index: "0", display: "flex" });
            await count(page, "2 / 3 · 0 / 3");
            await page.waitForFunction(() => !document.querySelector(".is-leaving"));
            assert.equal(
                await page.$eval(
                    '.is-current [data-presenit-at="1"]',
                    (el) => getComputedStyle(el).visibility,
                ),
                "hidden",
            );
            await page.keyboard.press("ArrowRight");
            await count(page, "2 / 3 · 1 / 3");
            assert.equal(
                await page.$eval(
                    '.is-current [data-presenit-at="1"]',
                    (el) => getComputedStyle(el).visibility,
                ),
                "visible",
            );
            await page.keyboard.press("ArrowRight");
            await count(page, "2 / 3 · 2 / 3");
            await page.keyboard.press("ArrowRight");
            await page.keyboard.press("ArrowRight");
            await count(page, "3 / 3 · 0 / 0");
            await page.keyboard.press("ArrowLeft");
            await count(page, "2 / 3 · 3 / 3");
            await page.keyboard.press("o");
            await page.waitForSelector("dialog[open]");
            await click(page, "スライド 1: First slide");
            await count(page, "1 / 3 · 0 / 0");
            await page.keyboard.press("p");
            const target = await browser.waitForTarget((target) =>
                target.url().includes("presenter"),
            );
            presenter = (await target.page())!;
            await presenter.waitForSelector("html.presenit-ready");
            assert.match(
                await presenter.$eval(".presenit-notes", (el) => el.textContent ?? ""),
                /secret speaker note/,
            );
            await click(presenter, "次へ");
            await count(page, "2 / 3 · 0 / 3");
            await click(presenter, "次へ");
            await count(page, "2 / 3 · 1 / 3");
            await page.bringToFront();
            await page.keyboard.press("ArrowRight");
            await count(presenter, "2 / 3 · 2 / 3");
            await presenter.bringToFront();
            await presenter.keyboard.press("b");
            await page.waitForFunction(
                () => !document.querySelector<HTMLElement>(".presenit-blackout")?.hidden,
            );
            await presenter.keyboard.press("Escape");
            await page.waitForFunction(
                () => document.querySelector<HTMLElement>(".presenit-blackout")?.hidden,
            );
            await presenter.keyboard.press("l");
            const rect = await presenter.$eval(".is-current", (el) => {
                const r = el.getBoundingClientRect();
                return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
            });
            await presenter.mouse.move(rect.x, rect.y);
            await page.waitForFunction(
                () => !document.querySelector<HTMLElement>(".presenit-laser")?.hidden,
            );
            await click(presenter, "一時停止");
            const paused = await presenter.$eval(".presenit-timer", (el) => el.textContent);
            await new Promise((resolve) => setTimeout(resolve, 1100));
            assert.equal(await presenter.$eval(".presenit-timer", (el) => el.textContent), paused);
            await click(presenter, "タイマーをリセット");
            assert.equal(await presenter.$eval(".presenit-timer", (el) => el.textContent), "00:00");
            // Content and frontmatter edits both reach the open page; the theme
            // CSS is a separate (<link>) module that must not stay cached.
            await writeFile(
                path.join(fixture, "src/slides/example/index.md"),
                markdown
                    .replace("Always visible.", "Edited live.")
                    .replace(
                        "title: Acceptance deck",
                        "title: Acceptance deck\ntheme: dark\nhue: 30",
                    ),
            );
            await page.waitForFunction(() =>
                document.querySelector("#presenit-stage")?.textContent?.includes("Edited live."),
            );
            await page.waitForFunction(() => {
                const slide = document.querySelector(".presenit-slide")!;
                return (
                    document.documentElement.dataset.presenitTheme === "dark" &&
                    getComputedStyle(slide).getPropertyValue("--presenit-hue").trim() === "30" &&
                    getComputedStyle(slide).backgroundColor.startsWith("oklch(0.2 ")
                );
            });
            await count(page, "2 / 3 · 2 / 3");
            await mkdir(path.join(fixture, "src/new"), { recursive: true });
            await writeFile(path.join(fixture, "src/new/index.md"), "# New glob deck");
            const extra = await browser.newPage();
            await open(extra, dev.url + "new/");
            await rm(path.join(fixture, "src/new/index.md"));
            await extra.waitForFunction(() => !document.querySelector("html.presenit-ready"));
            await extra.close();
            t.diagnostic(
                "Dev, glob addition/removal, image, reveal, overview, presenter, laser, blackout, timer and live reload (content and frontmatter) passed.",
            );
        } finally {
            await Promise.race([
                presenter?.close(),
                new Promise((resolve) => setTimeout(resolve, 2000)),
            ]);
            await dev.close();
        }
        for (const base of ["/demo/", "./"]) {
            await writeFile(configFile, configSource(base));
            await build(fixture);
            const output = await readFile(
                path.join(fixture, "dist/slides/example/index.html"),
                "utf8",
            );
            assert.doesNotMatch(output, /@presenit|@vite\/client|\/@fs/);
            assert.match(
                await readFile(path.join(fixture, "dist/slides/second/index.html"), "utf8"),
                /Other deck/,
            );
            const preview = await serve(fixture, true);
            try {
                await open(page, preview.url + "slides/example/");
                await page.waitForFunction(
                    () =>
                        document.querySelector<HTMLImageElement>(".presenit-slide img")
                            ?.naturalWidth === 20,
                );
                assert.ok(await page.$("svg"));
                assert.ok(await page.$(".katex"));
                assert.ok(await page.$(".shiki"));
                await page.evaluate(() => {
                    window.print = () => {
                        document.body.dataset.printCalled = "yes";
                    };
                });
                // Print from a slide whose Reveal steps are still hidden on screen.
                await page.keyboard.press("ArrowRight");
                await count(page, "2 / 3 · 0 / 3");
                await openMenu(page);
                await click(page, "PDFとして保存");
                await page.waitForFunction(() => document.body.dataset.printCalled === "yes");
                await page.emulateMediaType("print");
                assert.deepEqual(
                    await page.evaluate(
                        (selectors) =>
                            selectors.filter((selector) =>
                                Array.from(document.querySelectorAll(selector)).some(
                                    (node) => getComputedStyle(node).display !== "none",
                                ),
                            ),
                        VIEWER_UI,
                    ),
                    [],
                );
                const concealed = await page.$$eval(
                    "#presenit-stage .presenit-slide .is-concealed",
                    (nodes) =>
                        nodes.map(
                            (node) =>
                                `${getComputedStyle(node).visibility}/${getComputedStyle(node).opacity}`,
                        ),
                );
                assert.ok(concealed.length > 0);
                assert.deepEqual(new Set(concealed), new Set(["visible/1"]));
                assert.equal(
                    await page.$$eval(
                        "#presenit-stage .presenit-slide",
                        (slides) =>
                            slides.filter((slide) => getComputedStyle(slide).display !== "none")
                                .length,
                    ),
                    3,
                );
                await mkdir(path.join(root, "tmp/pdfs"), { recursive: true });
                await page.pdf({
                    path: path.join(root, "tmp/pdfs/acceptance.pdf"),
                    preferCSSPageSize: true,
                    printBackground: true,
                    waitForFonts: true,
                });
                await page.emulateMediaType("screen");
                await page.evaluate(() => {
                    document.querySelector(".presenit-status")!.textContent = "";
                });
                await page.screenshot({ path: path.join(root, "tmp/viewer.png") });
                await open(page, preview.url + "slides/second/");
                await Promise.all([page.waitForNavigation(), page.click("#presenit-stage a")]);
                await page.waitForSelector("html.presenit-ready");
                assert.match(new URL(page.url()).pathname, /slides\/example\/$/);
            } finally {
                await preview.close();
            }
            t.diagnostic(
                `Static build/preview, assets, rich content, PDF operation and Markdown links passed with base ${base}.`,
            );
        }
        const realPreview = await serve(fixture, true);
        const realPage = await browser.newPage();
        await realPage.setRequestInterception(true);
        realPage.on("request", (request) => {
            if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== "127.0.0.1")
                void request.abort();
            else void request.continue();
        });
        try {
            await open(realPage, realPreview.url + "slides/real/");
            await count(realPage, "1 / 30 · 0 / 0");
            // Dark decks get a dark surround instead of a light page background.
            const surround = await realPage.evaluate(() => ({
                theme: document.documentElement.dataset.presenitTheme,
                lightness: Number(
                    /oklch\(([\d.]+)/.exec(getComputedStyle(document.body).backgroundColor)?.[1],
                ),
            }));
            assert.equal(surround.theme, "dark");
            assert.ok(surround.lightness < 0.3, JSON.stringify(surround));
            await realPage.waitForFunction(() =>
                Array.from(document.querySelectorAll<HTMLImageElement>("#presenit-stage img"))
                    .filter((img) => new URL(img.src).origin === location.origin)
                    .every((img) => img.complete && img.naturalWidth > 0),
            );
            await realPage.screenshot({ path: path.join(root, "tmp/real-viewer.png") });
        } finally {
            await realPage.close();
            await realPreview.close();
        }
        t.diagnostic(
            "Real authored 30-slide talk and seven relative WebP assets built and previewed with network requests disabled.",
        );
        // Vite+ uses its own CLI and defineConfig, loading the same installed plugin.
        await writeFile(configFile, configSource("/vp/", true));
        const manifestPath = path.join(fixture, "package.json");
        const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
        manifest.dependencies.vite = "npm:@voidzero-dev/vite-plus-core@1.6.0";
        manifest.overrides = { vite: manifest.dependencies.vite };
        await writeFile(manifestPath, JSON.stringify(manifest));
        execFileSync(
            "npm",
            ["install", "--cache", "/tmp/presen-it-npm-cache", "--no-audit", "--no-fund"],
            { cwd: fixture, stdio: "pipe", timeout: 120_000 },
        );
        execFileSync(
            process.execPath,
            [path.join(fixture, "node_modules/typescript/bin/tsc"), "--noEmit"],
            { cwd: fixture, stdio: "pipe" },
        );
        await rm(path.join(fixture, "index.html"));
        const vpDev = await serve(fixture, false, true);
        try {
            await open(page, vpDev.url + "slides/example/");
            await count(page, "1 / 3 · 0 / 0");
        } finally {
            await vpDev.close();
        }
        execFileSync(path.join(fixture, "node_modules/.bin/vp"), ["build"], {
            cwd: fixture,
            stdio: "pipe",
            timeout: 30_000,
        });
        const vpPreview = await serve(fixture, true, true);
        try {
            await open(page, vpPreview.url + "slides/example/");
            await count(page, "1 / 3 · 0 / 0");
        } finally {
            await vpPreview.close();
        }
        assert.match(
            await readFile(path.join(fixture, "dist/slides/example/index.html"), "utf8"),
            /First slide/,
        );
        await page.bringToFront();
        await page.keyboard.press("f");
        await page.waitForFunction(() => document.fullscreenElement !== null);
        await page.keyboard.press("f");
        await page.waitForFunction(() => document.fullscreenElement === null);
        assert.deepEqual(errors, []);
        t.diagnostic(
            "Vite+ dev/build/preview passed using the locally installed tarball, without author-written HTML.",
        );
    },
);
