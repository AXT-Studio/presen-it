export type ThemeName = "light" | "dark";

export type FontFamilyConfig = {
    sans: string;
    mono: string;
};

export type PageTransitionType = "none" | "fade" | "scroll";

export type PageTransitionConfig = {
    type: PageTransitionType;
    /** Duration in seconds. */
    duration: number;
};

export type AnimationConfig = {
    /** Fragment fade duration in seconds. */
    duration: number;
};

export type BreakMode = "soft" | "hard";

export type DeckConfig = {
    /** Document title for viewer HTML; empty falls back to `AXT Presen'it! — <slug>`. */
    title: string;
    /** Optional blurb for `<meta name="description">` and `og:description`. */
    description: string;
    theme: ThemeName;
    hue: number;
    width: number;
    height: number;
    fontSize: number;
    fontFamily: FontFamilyConfig;
    pageTransition: PageTransitionConfig;
    animation: AnimationConfig;
    rawHTML: boolean;
    /** `soft`: single newlines become `<br>`; `hard`: CommonMark default. */
    break: BreakMode;
    /** Bottom-left footer text on every slide. */
    footer: string;
};

export type AlignOptions = {
    centerX: boolean;
    centerY: boolean;
};

export type Column = {
    /** Effective alignment after merging slide + column overrides. */
    align: AlignOptions;
    /** Raw mdast block nodes belonging to this column. */
    children: import("mdast").RootContent[];
};

export type Slide = {
    align: AlignOptions;
    /** Leading h2 used as the page header, if present. */
    header: import("mdast").Heading | null;
    columns: Column[];
    /** Speaker notes text (trimmed), if any. */
    notes: string | null;
    /** Max `reveal (at=N)` on this slide (0 when none). */
    maxStep: number;
};

export type DiagnosticSeverity = "warning" | "error";

export type Diagnostic = {
    severity: DiagnosticSeverity;
    message: string;
    line?: number;
};

export type Deck = {
    config: DeckConfig;
    slides: Slide[];
    diagnostics: Diagnostic[];
};

export const DEFAULT_CONFIG: DeckConfig = {
    title: "",
    description: "",
    theme: "light",
    hue: 210,
    width: 1920,
    height: 1080,
    fontSize: 32,
    fontFamily: {
        sans: '"M PLUS 1", system-ui, sans-serif',
        mono: '"M PLUS 1 Code", ui-monospace, monospace',
    },
    pageTransition: {
        type: "fade",
        duration: 0.2,
    },
    animation: {
        duration: 0.3,
    },
    rawHTML: false,
    break: "soft",
    footer: "",
};

export const DEFAULT_SLIDE_ALIGN: AlignOptions = {
    centerX: false,
    centerY: true,
};
