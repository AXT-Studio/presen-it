import { describe, expect, it } from "vitest";
import {
    findChrome,
    ogImageSize,
    ogMeta,
    publicURL,
    validateSiteUrl,
    withoutOgImage,
} from "../src/vite/og-image";

describe("publicURL", () => {
    const file = "slides/a/ogp.png";

    it("needs an origin from siteUrl or base", () => {
        expect(publicURL("/", undefined, file)).toBeUndefined();
        expect(publicURL("./", undefined, file)).toBeUndefined();
    });

    it("uses siteUrl as the origin of an absolute-path base", () => {
        expect(publicURL("/", "https://example.com", file)).toBe(
            "https://example.com/slides/a/ogp.png",
        );
        expect(publicURL("/talks/", "https://example.com/", file)).toBe(
            "https://example.com/talks/slides/a/ogp.png",
        );
    });

    it("uses siteUrl as the output root of a relative base", () => {
        expect(publicURL("./", "https://example.com/talks", file)).toBe(
            "https://example.com/talks/slides/a/ogp.png",
        );
        expect(publicURL("", "https://example.com/talks/", file)).toBe(
            "https://example.com/talks/slides/a/ogp.png",
        );
    });

    it("prefers a full-URL base", () => {
        expect(publicURL("https://cdn.example.com/x/", "https://example.com", file)).toBe(
            "https://cdn.example.com/x/slides/a/ogp.png",
        );
    });
});

describe("validateSiteUrl", () => {
    it("accepts http(s) URLs only", () => {
        expect(() => validateSiteUrl("https://example.com")).not.toThrow();
        expect(() => validateSiteUrl("example.com")).toThrow(/absolute URL/);
        expect(() => validateSiteUrl("ftp://example.com")).toThrow(/http\(s\)/);
    });
});

describe("ogMeta", () => {
    it("writes a summary card without an image", () => {
        expect(ogMeta({ title: "A", description: "" })).toBe(
            '<meta property="og:type" content="website">' +
                '<meta property="og:title" content="A">' +
                '<meta name="twitter:card" content="summary">',
        );
    });

    it("writes the page URL, the image and escaped text", () => {
        const html = ogMeta({
            title: `"T" & <it's>`,
            description: "D",
            url: "https://example.com/a/",
            image: { url: "https://example.com/a/ogp.png", ...ogImageSize(1920, 1080) },
        });
        expect(html).toContain(
            '<meta property="og:title" content="&quot;T&quot; &amp; &lt;it&#39;s&gt;">',
        );
        expect(html).toContain('<meta name="description" content="D">');
        expect(html).toContain('<meta property="og:description" content="D">');
        expect(html).toContain('<meta property="og:url" content="https://example.com/a/">');
        expect(html).toContain(
            '<meta property="og:image" content="https://example.com/a/ogp.png">',
        );
        expect(html).toContain('<meta property="og:image:width" content="1200">');
        expect(html).toContain('<meta property="og:image:height" content="675">');
        expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    });

    it("can drop the image tags after a failed capture", () => {
        const html = ogMeta({
            title: "A",
            description: "",
            image: { url: "/a/ogp.png", width: 1200, height: 900 },
        });
        expect(withoutOgImage(html)).toBe(ogMeta({ title: "A", description: "" }));
    });
});

describe("findChrome", () => {
    it("honors CHROME_PATH only when it exists", () => {
        expect(findChrome({ CHROME_PATH: process.execPath })).toBe(process.execPath);
        expect(findChrome({ CHROME_PATH: "/nonexistent/chrome" })).toBeUndefined();
    });
});
