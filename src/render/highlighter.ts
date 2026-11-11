import { getSingletonHighlighter, type BundledLanguage } from "shiki";
import type { ThemeName } from "../types.ts";

const LIGHT_THEME = "github-light";
const DARK_THEME = "github-dark";

const COMMON_LANGS: BundledLanguage[] = [
    "bash",
    "css",
    "html",
    "javascript",
    "json",
    "markdown",
    "python",
    "shell",
    "ts",
    "tsx",
    "typescript",
    "yaml",
];

let highlighterPromise: ReturnType<typeof getSingletonHighlighter> | null = null;

function getHighlighter() {
    if (!highlighterPromise) {
        highlighterPromise = getSingletonHighlighter({
            themes: [LIGHT_THEME, DARK_THEME],
            langs: COMMON_LANGS,
        });
    }
    return highlighterPromise;
}

export async function highlightCode(
    code: string,
    lang: string | null | undefined,
    theme: ThemeName,
): Promise<string> {
    const highlighter = await getHighlighter();
    const loadedLangs = highlighter.getLoadedLanguages();
    const requested = (lang ?? "text").toLowerCase();
    const language = loadedLangs.includes(requested as BundledLanguage)
        ? (requested as BundledLanguage)
        : ("plaintext" as BundledLanguage);

    return highlighter.codeToHtml(code, {
        lang: language,
        theme: theme === "dark" ? DARK_THEME : LIGHT_THEME,
    });
}
