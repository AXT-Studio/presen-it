import { buildGoogleFontsImports, namedFontFamilies } from "../font-family.ts";
import { SLIDE_PADDING_RATIO } from "../shared/slide-padding.ts";

type ThemeBuildConfig = {
    theme: "light" | "dark";
    hue: number;
    width: number;
    height: number;
    fontSize: number;
    fontFamily: { sans: string; mono: string };
};

function buildPaletteVars(theme: "light" | "dark", hue: number): string {
    if (theme === "light") {
        return `
        --presenit-bg: oklch(0.97 0.006 ${hue});
        --presenit-slide-bg: oklch(0.99 0.006 ${hue});
        --presenit-slide-bg-top: oklch(1 0.004 ${hue});
        --presenit-slide-bg-bottom: oklch(0.955 0.022 ${hue});
        --presenit-slide-wash: oklch(0.9 0.06 ${hue} / 0.32);
        --presenit-surface: oklch(0.955 0.01 ${hue});
        --presenit-text: oklch(0.24 0.025 ${hue});
        --presenit-text-muted: oklch(0.5 0.03 ${hue});
        --presenit-border: oklch(0.88 0.012 ${hue});
        --presenit-accent: oklch(0.52 0.17 ${hue});
        --presenit-accent-hover: oklch(0.45 0.19 ${hue});
        --presenit-code-bg: oklch(0.945 0.012 ${hue});
        --presenit-blockquote-bg: oklch(0.965 0.015 ${hue});
        `.trim();
    }

    return `
        --presenit-bg: oklch(0.16 0.008 ${hue});
        --presenit-slide-bg: oklch(0.2 0.012 ${hue});
        --presenit-slide-bg-top: oklch(0.255 0.02 ${hue});
        --presenit-slide-bg-bottom: oklch(0.16 0.01 ${hue});
        --presenit-slide-wash: oklch(0.48 0.1 ${hue} / 0.28);
        --presenit-surface: oklch(0.25 0.012 ${hue});
        --presenit-text: oklch(0.94 0.008 ${hue});
        --presenit-text-muted: oklch(0.66 0.012 ${hue});
        --presenit-border: oklch(0.34 0.014 ${hue});
        --presenit-accent: oklch(0.74 0.14 ${hue});
        --presenit-accent-hover: oklch(0.8 0.15 ${hue});
        --presenit-code-bg: oklch(0.23 0.01 ${hue});
        --presenit-blockquote-bg: oklch(0.22 0.011 ${hue});
    `.trim();
}

export function buildThemeCss(config: ThemeBuildConfig): string {
    const { theme, hue, width, height, fontSize, fontFamily } = config;
    const slidePadding = height * SLIDE_PADDING_RATIO;
    const paletteVars = buildPaletteVars(theme, hue);
    const fontFamilies = namedFontFamilies(fontFamily.sans, fontFamily.mono);
    const fontImport = buildGoogleFontsImports(fontFamilies);
    const fontImportBlock = fontImport ? `${fontImport}\n` : "";

    return `${fontImportBlock}
.presenit-deck,
.presenit-slide {
    ${paletteVars}
    --presenit-width: ${width}px;
    --presenit-height: ${height}px;
    --presenit-hue: ${hue};
    --presenit-font-size: ${fontSize}px;
    --presenit-font-sans: ${fontFamily.sans};
    --presenit-font-mono: ${fontFamily.mono};
    --presenit-slide-padding: ${slidePadding}px;
    --presenit-slide-width: ${width}px;
    --presenit-slide-height: ${height}px;
    box-sizing: border-box;
    font-family: var(--presenit-font-sans);
    font-size: var(--presenit-font-size);
    line-height: 1.55;
    color: var(--presenit-text);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
}

.presenit-deck {
    background: var(--presenit-bg);
}

.presenit-deck *,
.presenit-deck *::before,
.presenit-deck *::after,
.presenit-slide *,
.presenit-slide *::before,
.presenit-slide *::after {
    box-sizing: border-box;
}

.presenit-slide {
    width: var(--presenit-slide-width);
    height: var(--presenit-slide-height);
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: var(--presenit-slide-padding);
    background-color: var(--presenit-slide-bg);
    background-image:
        radial-gradient(ellipse 90% 70% at 100% -10%, var(--presenit-slide-wash), transparent 58%),
        linear-gradient(165deg, var(--presenit-slide-bg-top) 0%, var(--presenit-slide-bg-bottom) 100%);
    border: 1px solid var(--presenit-border);

    color: var(--presenit-text);
}

.presenit-slide-header {
    flex-shrink: 0;
    margin-bottom: calc(var(--presenit-slide-height) * 0.022);
    padding-bottom: calc(var(--presenit-slide-height) * 0.014);
    border-bottom: 1px solid var(--presenit-border);
}

.presenit-slide-header h2 {
    margin: 0;
    font-size: 1.55em;
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: -0.025em;
    color: var(--presenit-text);
}

.presenit-slide-body {
    flex: 1;
    display: flex;
    flex-direction: row;
    gap: calc(var(--presenit-slide-width) * 0.032);
    min-height: 0;
}

.presenit-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.presenit-column--center-x {
    text-align: center;
    align-items: center;
}

.presenit-column--center-y {
    justify-content: center;
}

.presenit-column:not(.presenit-column--center-y) {
    justify-content: flex-start;
}

.presenit-slide-number {
    position: absolute;
    bottom: calc(var(--presenit-slide-height) * 0.028);
    right: calc(var(--presenit-slide-width) * 0.028);
    font-size: 0.625em;
    font-weight: 500;
    color: var(--presenit-text-muted);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
    line-height: 1;
}

.presenit-slide-footer {
    position: absolute;
    bottom: calc(var(--presenit-slide-height) * 0.028);
    left: calc(var(--presenit-slide-width) * 0.028);
    font-size: 0.625em;
    font-weight: 500;
    color: var(--presenit-text-muted);
    letter-spacing: 0.04em;
    line-height: 1;
}

.presenit-column h1 {
    margin: 0 0 0.45em;
    font-size: 2.2em;
    font-weight: 700;
    line-height: 1.12;
    letter-spacing: 0.01em;
    color: var(--presenit-text);
}

.presenit-column h2 {
    margin: 0.65em 0 0.35em;
    font-size: 1.55em;
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: -0.025em;
    color: var(--presenit-text);
}

.presenit-column h2:first-child {
    margin-top: 0;
}

.presenit-column h3 {
    margin: 0.55em 0 0.3em;
    font-size: 1.28em;
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: -0.02em;
    color: var(--presenit-text);
}

.presenit-column h3:first-child {
    margin-top: 0;
}

.presenit-column p {
    margin: 0.4em 0;
    color: var(--presenit-text);
}

.presenit-column p:first-child {
    margin-top: 0;
}

.presenit-column p:last-child {
    margin-bottom: 0;
}

.presenit-column ul,
.presenit-column ol {
    margin: 0.45em 0;
    padding-left: 1.45em;
}

.presenit-column ul:first-child,
.presenit-column ol:first-child {
    margin-top: 0;
}

.presenit-column ul:last-child,
.presenit-column ol:last-child {
    margin-bottom: 0;
}

.presenit-column li {
    margin: 0.28em 0;
    padding-left: 0.15em;
}

.presenit-column li::marker {
    color: var(--presenit-accent);
    font-weight: 600;
}

.presenit-column ul.contains-task-list {
    padding-left: 1.45em;
    list-style: none;
}

.presenit-column li.task-list-item {
    position: relative;
    padding-left: 0.15em;
    list-style: none;
}

/* Keep the native checkbox for semantics, but never show the UA widget. */
.presenit-column li.task-list-item > input[type="checkbox"] {
    appearance: none;
    -webkit-appearance: none;
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    border: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    pointer-events: none;
}

/* Custom mark sits in the same gutter as ul/ol markers. */
.presenit-column li.task-list-item::before {
    content: "";
    position: absolute;
    left: -1.02em;
    top: 0.5em;
    box-sizing: border-box;
    width: 0.7em;
    height: 0.7em;
    border: 0.12em solid var(--presenit-accent);
    border-radius: 0.15em;
    background: color-mix(in oklch, var(--presenit-accent) 8%, var(--presenit-surface));
}

.presenit-column li.task-list-item:has(> input[type="checkbox"]:checked)::before {
    background: var(--presenit-accent);
    border-color: var(--presenit-accent);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='white' d='M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: center;
    background-size: 0.72em 0.72em;
}

.presenit-column li.task-list-item:has(> input[type="checkbox"]:checked) {
    color: var(--presenit-text-muted);
}

.presenit-column blockquote {
    margin: 0.55em 0;
    padding: 0.7em 1em;
    border-left: 4px solid var(--presenit-accent);
    border-radius: 0 5px 5px 0;
    background: var(--presenit-blockquote-bg);
    color: var(--presenit-text);
}

.presenit-column blockquote p {
    margin: 0.25em 0;
}

.presenit-column blockquote p:first-child {
    margin-top: 0;
}

.presenit-column blockquote p:last-child {
    margin-bottom: 0;
}

/* GitHub-style Markdown alerts */
.presenit-column .presenit-alert {
    --presenit-alert-tone: var(--presenit-accent);
    --presenit-alert-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='black' d='M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z'/%3E%3C/svg%3E");
    margin: 0.6em 0;
    padding: 0.7em 1em 0.75em;
    border-left: 0.3em solid var(--presenit-alert-tone);
    border-radius: 5px;
    background: color-mix(in oklch, var(--presenit-alert-tone) 10%, var(--presenit-surface));
    color: var(--presenit-text);
}

.presenit-column .presenit-alert--tip {
    --presenit-alert-tone: oklch(0.64 0.15 calc(var(--presenit-hue) + 105));
    --presenit-alert-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='black' d='M8 1.5c-2.363 0-4 1.69-4 3.75 0 .674.197 1.306.52 1.857C5.107 8.029 5.5 8.934 5.5 9.5v.25c0 .516.42.935.935.935h3.13a.935.935 0 0 0 .935-.935V9.5c0-.566.393-1.471.98-2.393.323-.55.52-1.183.52-1.857 0-2.06-1.637-3.75-4-3.75ZM5.75 13.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 0 1.5h-3a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H7.25a.75.75 0 0 1-.75-.75Z'/%3E%3C/svg%3E");
}

.presenit-column .presenit-alert--important {
    --presenit-alert-tone: oklch(0.62 0.16 calc(var(--presenit-hue) + 35));
    --presenit-alert-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='black' d='M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z'/%3E%3C/svg%3E");
}

.presenit-column .presenit-alert--warning {
    --presenit-alert-tone: oklch(0.7 0.15 calc(var(--presenit-hue) + 75));
    --presenit-alert-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='black' d='M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z'/%3E%3C/svg%3E");
}

.presenit-column .presenit-alert--caution {
    --presenit-alert-tone: oklch(0.6 0.18 calc(var(--presenit-hue) - 25));
    --presenit-alert-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='black' d='M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z'/%3E%3C/svg%3E");
}

.presenit-column .presenit-alert__label {
    display: flex;
    align-items: center;
    gap: 0.4em;
    margin: 0 0 0.2em;
    color: var(--presenit-alert-tone);
    font-size: 0.82em;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
}

.presenit-column .presenit-alert__label::before {
    content: "";
    flex: 0 0 auto;
    width: 1em;
    height: 1em;
    background: currentColor;
    -webkit-mask: var(--presenit-alert-icon) center / contain no-repeat;
    mask: var(--presenit-alert-icon) center / contain no-repeat;
}

.presenit-column .presenit-alert p {
    margin: 0.25em 0;
}

.presenit-column .presenit-alert p:last-child {
    margin-bottom: 0;
}

.presenit-column pre {
    margin: 0.55em 0;
    padding: 0.8em 1em;
    overflow: auto;
    font-family: var(--presenit-font-mono);
    font-size: 0.84em;
    line-height: 1.45;
    background: var(--presenit-code-bg);
    border: 1px solid var(--presenit-border);
    border-radius: 5px;
    color: var(--presenit-text);
    text-align: left;
}

.presenit-column--center-x pre,
.presenit-column--center-x pre.shiki {
    align-self: center;
    width: fit-content;
    max-width: 100%;
    text-align: left;
}

.presenit-column pre:first-child {
    margin-top: 0;
}

.presenit-column pre:last-child {
    margin-bottom: 0;
}

.presenit-column pre code {
    padding: 0;
    background: none;
    border-radius: 0;
    font-size: inherit;
}

.presenit-column code {
    font-family: var(--presenit-font-mono);
    font-size: 0.88em;
}

.presenit-column :not(pre) > code {
    padding: 0.12em 0.38em;
    background: var(--presenit-code-bg);
    border: 1px solid var(--presenit-border);
    border-radius: 4px;
}

.presenit-column table {
    width: 100%;
    margin: 0.55em 0;
    border-collapse: collapse;
    font-size: 0.9em;
    line-height: 1.4;
}

.presenit-column table:first-child {
    margin-top: 0;
}

.presenit-column table:last-child {
    margin-bottom: 0;
}

.presenit-column th,
.presenit-column td {
    padding: 0.5em 0.75em;
    border: 1px solid var(--presenit-border);
    text-align: left;
    vertical-align: top;
}

.presenit-column th {
    font-weight: 600;
    background: var(--presenit-surface);
    border-bottom: 2px solid var(--presenit-accent);
    color: var(--presenit-text);
}

.presenit-column td {
    color: var(--presenit-text);
}

.presenit-column a {
    color: var(--presenit-accent);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 0.18em;
    font-weight: 500;
}

.presenit-column a:hover {
    color: var(--presenit-accent-hover);
}

.presenit-column img {
    display: block;
    max-width: 100%;
    max-height: calc(var(--presenit-slide-height) * 0.75);
    width: auto;
    height: auto;
    object-fit: contain;
}

.presenit-column--center-x img {
    margin-left: auto;
    margin-right: auto;
}

.presenit-column hr {
    margin: 0.85em 0;
    border: none;
    border-top: 1px solid var(--presenit-border);
    background: none;
}

.presenit-column strong,
.presenit-column b {
    font-weight: 700;
    color: var(--presenit-text);
}

.presenit-column em {
    font-style: italic;
}

.presenit-mermaid {
    margin: 0.55em 0;
    width: 100%;
    max-width: 100%;
    max-height: calc(var(--presenit-slide-height) * 2 / 3);
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
}

.presenit-mermaid:first-child {
    margin-top: 0;
}

.presenit-mermaid:last-child {
    margin-bottom: 0;
}

.presenit-mermaid svg {
    display: block;
    width: auto;
    max-width: 100%;
    max-height: calc(var(--presenit-slide-height) * 2 / 3);
}

.presenit-column--center-x .presenit-mermaid svg {
    margin-left: auto;
    margin-right: auto;
}

.presenit-column pre.shiki {
    margin: 0.55em 0;
    padding: 0.8em 1em;
    overflow: auto;
    font-family: var(--presenit-font-mono);
    font-size: 0.84em;
    line-height: 1.45;
    border: 1px solid var(--presenit-border);
    border-radius: 5px;
    text-align: left;
}

.presenit-column pre.shiki:first-child {
    margin-top: 0;
}

.presenit-column pre.shiki:last-child {
    margin-bottom: 0;
}

.presenit-column pre.shiki code {
    padding: 0;
    background: none;
    border: none;
    border-radius: 0;
    font-size: inherit;
}

.presenit-column .katex-display {
    margin: 0.55em 0;
    /* overflow-x: auto forces overflow-y off visible (spec); hidden avoids stray vertical scroll */
    overflow-x: auto;
    overflow-y: hidden;
    /* Extra room so integral/sum limits are not clipped by overflow-y: hidden */
    padding-top: 0.4em;
    padding-bottom: 0.5em;
    scrollbar-width: none;
}

.presenit-column .katex-display::-webkit-scrollbar {
    display: none;
}

/* Reveal fragments: layout kept; viewer toggles .is-concealed */
[data-presenit-at] {
    transition:
        opacity var(--presenit-anim-duration, 0.3s) linear;
}

[data-presenit-at].is-concealed {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
}

@media print {
    [data-presenit-at].is-concealed {
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
    }
}
`.trim();
}
