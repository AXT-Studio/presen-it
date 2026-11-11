import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = fileURLToPath(new URL("../", import.meta.url));
const example = path.join(root, "examples/minimal");
const vite = fileURLToPath(new URL("./bin/vite.js", import.meta.resolve("vite/package.json")));
const chrome =
    process.env.CHROME_PATH ??
    [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome",
    ].find(existsSync);

function cli(cwd: string, args: string[]): ChildProcess {
    return spawn(process.execPath, [vite, ...args], {
        cwd,
        env: { ...process.env, NO_COLOR: "1" },
        stdio: ["ignore", "pipe", "pipe"],
    });
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

async function serve(cwd: string, preview = false) {
    const child = cli(cwd, [
        ...(preview ? ["preview"] : []),
        "--host",
        "127.0.0.1",
        "--port",
        "0",
        "--strictPort",
    ]);
    let output = "";
    const url = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
            child.kill();
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
            if (child.exitCode === null) {
                child.kill();
                await once(child, "exit");
            }
        },
    };
}

test("Markdown-only example: dev reload, independent decks, build and static preview", async (t) => {
    assert.ok(chrome, "Set CHROME_PATH to a Chrome/Chromium executable.");
    assert.deepEqual(
        (await readdir(example))
            .filter(
                (name) =>
                    !["dist", "node_modules", "package-lock.json", ".DS_Store"].includes(name),
            )
            .sort(),
        ["intro.md", "package.json", "update.md", "vite.config.ts"],
    );
    const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage();
    const sibling = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    const dev = await serve(example);
    const original = await readFile(path.join(example, "intro.md"), "utf8");
    try {
        await page.goto(`${dev.url}slides/intro.html#kept`);
        await sibling.goto(`${dev.url}slides/team/update.html`);
        assert.equal(await page.$eval("h1", (el) => el.textContent), "Hello, AXT Presen'it!");
        assert.equal(await sibling.$eval("h1", (el) => el.textContent), "Team update");
        await page.waitForFunction(() =>
            performance
                .getEntriesByType("resource")
                .some((entry) => entry.name.includes("/@vite/client")),
        );
        let siblingReloads = 0;
        sibling.on("framenavigated", () => {
            siblingReloads++;
        });
        await writeFile(path.join(example, "intro.md"), `${original}\n\n## Live update verified\n`);
        await page.waitForFunction(
            () => document.querySelector("main")?.textContent?.includes("Live update verified"),
            { timeout: 15_000 },
        );
        assert.equal(new URL(page.url()).hash, "#kept");
        assert.equal(siblingReloads, 0, "Other decks should not reload.");
        assert.equal(await sibling.$eval("h1", (el) => el.textContent), "Team update");
        t.diagnostic(
            "Actual Vite CLI + Chrome: reload without manual refresh; hash preserved; sibling unaffected.",
        );
    } finally {
        await writeFile(path.join(example, "intro.md"), original);
        await dev.close();
    }
    await build(example);
    const first = await readFile(path.join(example, "dist/slides/intro.html"), "utf8");
    const second = await readFile(path.join(example, "dist/slides/team/update.html"), "utf8");
    assert.match(first, /Hello, AXT Presen/);
    assert.doesNotMatch(first, /Live update verified|@vite\/client|Team update/);
    assert.match(second, /Team update/);
    const preview = await serve(example, true);
    try {
        await page.setJavaScriptEnabled(false);
        await page.goto(`${preview.url}slides/intro.html`);
        assert.equal(await page.$eval("h1", (el) => el.textContent), "Hello, AXT Presen'it!");
        await page.bringToFront();
        await Promise.all([page.waitForNavigation({ timeout: 10_000 }), page.click("main a")]);
        assert.equal(new URL(page.url()).pathname, "/slides/team/update.html");
        assert.equal(await page.$eval("h1", (el) => el.textContent), "Team update");
        assert.deepEqual(errors, []);
        if (process.env.POC_SCREENSHOT) await page.screenshot({ path: process.env.POC_SCREENSHOT });
        t.diagnostic(
            "Two static HTML files; preview and cross-deck link work with JavaScript disabled.",
        );
    } finally {
        await preview.close();
    }
});

test("Ordinary Vite app: existing inputs, HTML hooks, base paths and public assets", async (t) => {
    assert.ok(chrome);
    const fixture = await mkdtemp(path.join(root, ".verify-"));
    t.after(() => rm(fixture, { recursive: true, force: true }));
    await mkdir(path.join(fixture, "public"));
    await writeFile(path.join(fixture, "package.json"), '{"type":"module"}');
    await writeFile(
        path.join(fixture, "index.html"),
        '<!doctype html><html><head><title>Host</title></head><body><h1>Existing app</h1><script type="module" src="/main.js"></script></body></html>',
    );
    await writeFile(path.join(fixture, "main.js"), 'document.body.dataset.hostReady = "yes";');
    await writeFile(
        path.join(fixture, "public/mark.svg"),
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>',
    );
    await writeFile(
        path.join(fixture, "talk.md"),
        '# Added deck\n\n![Public mark](/mark.svg)\n\n[unsafe](javascript:alert%281%29)\n\n<script>throw new Error("injected")</script>\n',
    );
    const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage();
    const plugin = JSON.stringify(path.join(root, "mod.ts"));
    for (const [label, input] of [
        ["implicit", ""],
        ["string", 'build: { rolldownOptions: { input: "index.html" } },'],
        ["array", 'build: { rolldownOptions: { input: ["index.html"] } },'],
        ["record", 'build: { rolldownOptions: { input: { host: "index.html" } } },'],
        ["legacy", 'build: { rollupOptions: { input: { host: "index.html" } } },'],
    ]) {
        await writeFile(
            path.join(fixture, "vite.config.ts"),
            `
import { defineConfig } from "vite";
import { presenit } from ${plugin};
export default defineConfig({
    base: "/demo/",
    ${input}
    plugins: [presenit({ decks: { talk: "talk.md" } }), {
        name: "host-html-hook",
        transformIndexHtml(html) { return html.replace("<body>", '<body data-transformed="yes">'); }
    }]
});`,
        );
        if (label === "implicit") {
            const dev = await serve(fixture);
            try {
                await page.goto(dev.url);
                await page.waitForFunction(() => document.body.dataset.hostReady === "yes");
                await page.goto(`${dev.url}slides/talk.html`);
                assert.equal(await page.$eval("body", (el) => el.dataset.transformed), "yes");
                assert.equal(await page.$eval("main a", (el) => el.getAttribute("href")), null);
                await page.waitForFunction(
                    () => document.querySelector("img")?.naturalWidth === 20,
                );
                await writeFile(
                    path.join(fixture, "talk.md"),
                    "# Updated under base\n\n![Public mark](/mark.svg)\n",
                );
                await page.waitForFunction(
                    () => document.querySelector("h1")?.textContent === "Updated under base",
                );
                await writeFile(
                    path.join(fixture, "talk.md"),
                    '# Added deck\n\n![Public mark](/mark.svg)\n\n[unsafe](javascript:alert%281%29)\n\n<script>throw new Error("injected")</script>\n',
                );
            } finally {
                await dev.close();
            }
        }
        await build(fixture);
        assert.match(await readFile(path.join(fixture, "dist/index.html"), "utf8"), /Existing app/);
        const deck = await readFile(path.join(fixture, "dist/slides/talk.html"), "utf8");
        assert.match(deck, /data-transformed="yes"/);
        assert.doesNotMatch(deck, /javascript:|<script>throw/);
        const preview = await serve(fixture, true);
        try {
            await page.goto(preview.url);
            await page.waitForFunction(() => document.body.dataset.hostReady === "yes");
            await page.goto(`${preview.url}slides/talk.html`);
            await page.waitForFunction(() => document.querySelector("img")?.naturalWidth === 20);
            assert.equal(await page.$eval("body", (el) => el.dataset.transformed), "yes");
        } finally {
            await preview.close();
        }
        t.diagnostic(`Host input ${label}: app + deck built and previewed under /demo/.`);
    }
});
