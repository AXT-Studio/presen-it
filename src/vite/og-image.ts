import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** File name of the generated OGP image, placed next to each deck's `index.html`. */
export const OG_IMAGE_FILE = "ogp.png";
/** Pixel width of the generated OGP image. The height follows the slide aspect ratio. */
export const OG_IMAGE_WIDTH = 1200;

/** Pixel size of the OGP image for a slide of the given size. */
export function ogImageSize(width: number, height: number): { width: number; height: number } {
    return { width: OG_IMAGE_WIDTH, height: Math.round((OG_IMAGE_WIDTH * height) / width) };
}

const ABSOLUTE_URL = /^[a-z][a-z\d+.-]*:/i;

/** Throws unless `siteUrl` is an absolute http(s) URL. */
export function validateSiteUrl(siteUrl: string): void {
    let url: URL;
    try {
        url = new URL(siteUrl);
    } catch {
        throw new Error(
            `[presenit] siteUrl must be an absolute URL, got ${JSON.stringify(siteUrl)}`,
        );
    }
    if (url.protocol !== "http:" && url.protocol !== "https:")
        throw new Error(
            `[presenit] siteUrl must be an http(s) URL, got ${JSON.stringify(siteUrl)}`,
        );
}

/**
 * Absolute public URL of `file` (relative to the build output root, such as
 * `slides/example/ogp.png`), or `undefined` when neither `base` nor `siteUrl` gives an origin.
 * `siteUrl` is the origin for an absolute-path `base`, and the URL of the output root for
 * a relative `base` (`./` or empty).
 */
export function publicURL(
    base: string,
    siteUrl: string | undefined,
    file: string,
): string | undefined {
    if (ABSOLUTE_URL.test(base)) return new URL(file, base).href;
    if (!siteUrl) return undefined;
    if (base.startsWith("/")) return new URL(base + file, siteUrl).href;
    return new URL(file, siteUrl.endsWith("/") ? siteUrl : siteUrl + "/").href;
}

const escapeAttribute = (value: string): string =>
    value.replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
    );

export interface OgMetaInput {
    title: string;
    description: string;
    /** Absolute URL of the page, when known. */
    url?: string;
    /** The first-slide image, when one is generated. */
    image?: { url: string; width: number; height: number };
}

/** The `<meta>` tags for search engines and link previews. */
export function ogMeta(input: OgMetaInput): string {
    const meta = (attribute: "name" | "property", key: string, content: string | number) =>
        `<meta ${attribute}="${key}" content="${escapeAttribute(String(content))}">`;
    const tags = [
        meta("property", "og:type", "website"),
        meta("property", "og:title", input.title),
    ];
    if (input.description)
        tags.push(
            meta("name", "description", input.description),
            meta("property", "og:description", input.description),
        );
    if (input.url) tags.push(meta("property", "og:url", input.url));
    if (input.image)
        tags.push(
            meta("property", "og:image", input.image.url),
            meta("property", "og:image:width", input.image.width),
            meta("property", "og:image:height", input.image.height),
            meta("property", "og:image:alt", input.title),
        );
    tags.push(meta("name", "twitter:card", input.image ? "summary_large_image" : "summary"));
    return tags.join("");
}

/** Removes the image tags written by {@link ogMeta}, for a deck whose capture failed. */
export function withoutOgImage(html: string): string {
    return html
        .replace(/<meta property="og:image(?::[a-z]+)?" content="[^"]*">/g, "")
        .replace(
            '<meta name="twitter:card" content="summary_large_image">',
            '<meta name="twitter:card" content="summary">',
        );
}

/** `CHROME_PATH`, or the first Chrome / Chromium found at a well-known location. */
export function findChrome(env: NodeJS.ProcessEnv = process.env): string | undefined {
    if (env.CHROME_PATH) return existsSync(env.CHROME_PATH) ? env.CHROME_PATH : undefined;
    const windows = [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA]
        .filter((directory): directory is string => !!directory)
        .map((directory) => path.join(directory, "Google/Chrome/Application/chrome.exe"));
    return [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        ...windows,
    ].find(existsSync);
}

const MIME: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
};

/** A deck to capture, by route without `base` (such as `/slides/example/`). */
export interface CaptureTarget {
    route: string;
    width: number;
    height: number;
}

export interface CaptureOptions {
    chrome: string;
    /** The build output directory. */
    outDir: string;
    /** Vite's resolved `base`. */
    base: string;
    decks: CaptureTarget[];
    /** Per-deck time limit in milliseconds. */
    timeout?: number;
}

/** The origin the built site is served from inside the headless browser. Never hits the network. */
const ORIGIN = "http://presenit.localhost";

/**
 * Screenshots the first slide of every deck from the built output with a headless Chrome.
 * Files are answered from `outDir` through request interception; other requests (such as
 * web fonts) go to the network. Returns the error of each deck that could not be captured;
 * the image is written to `<outDir><route>ogp.png` for the others.
 */
export async function captureFirstSlides(options: CaptureOptions): Promise<Map<string, unknown>> {
    const failures = new Map<string, unknown>();
    const { default: puppeteer } = await import("puppeteer-core");
    // An absolute `base` URL is answered locally too, so the built HTML needs no rewriting.
    const prefix = ABSOLUTE_URL.test(options.base)
        ? options.base
        : ORIGIN + (options.base.startsWith("/") ? options.base : "/");
    const browser = await puppeteer.launch({
        executablePath: options.chrome,
        headless: true,
        args: ["--hide-scrollbars"],
    });
    try {
        for (const deck of options.decks) {
            const page = await browser.newPage();
            try {
                await page.setRequestInterception(true);
                page.on("request", (request) => {
                    void (async () => {
                        const url = request.url().split(/[?#]/)[0]!;
                        if (!url.startsWith(prefix)) {
                            if (url.startsWith(ORIGIN)) return request.respond({ status: 404 });
                            return request.continue();
                        }
                        let relative = decodeURIComponent(url.slice(prefix.length));
                        if (relative === "" || relative.endsWith("/")) relative += "index.html";
                        const file = path.resolve(options.outDir, relative);
                        if (path.relative(options.outDir, file).startsWith(".."))
                            return request.respond({ status: 404 });
                        try {
                            const body = await readFile(file);
                            return request.respond({
                                status: 200,
                                contentType:
                                    MIME[path.extname(file).toLowerCase()] ??
                                    "application/octet-stream",
                                body,
                            });
                        } catch {
                            return request.respond({ status: 404 });
                        }
                    })().catch(() => undefined);
                });
                const timeout = options.timeout ?? 30_000;
                page.setDefaultTimeout(timeout);
                await page.setViewport({
                    width: Math.ceil(deck.width),
                    height: Math.ceil(deck.height),
                    deviceScaleFactor: OG_IMAGE_WIDTH / deck.width,
                });
                // Print styles hide the Viewer chrome and lay the slides out at their own size.
                await page.emulateMediaType("print");
                await page.goto(prefix + deck.route.slice(1), { waitUntil: "load" });
                await page.waitForSelector("html.presenit-ready");
                await page.evaluate(async () => {
                    await document.fonts.ready;
                    await Promise.all(
                        Array.from(document.images).map((image) =>
                            image.decode().catch(() => undefined),
                        ),
                    );
                });
                const slide = await page.$("#presenit-stage .presenit-slide");
                if (!slide) throw new Error("No slide found");
                const image = await slide.screenshot({ type: "png" });
                const output = path.join(options.outDir, "." + deck.route, OG_IMAGE_FILE);
                await mkdir(path.dirname(output), { recursive: true });
                await writeFile(output, image);
            } catch (error) {
                failures.set(deck.route, error);
            } finally {
                await page.close().catch(() => undefined);
            }
        }
    } finally {
        await browser.close();
    }
    return failures;
}
