import type { AlignOptions, Diagnostic } from "../types.ts";
import { DEFAULT_SLIDE_ALIGN } from "../types.ts";

export type DirectiveCommand = "slide-break" | "column-break" | "reveal";

export type DirectiveOptions = {
    centerX?: boolean;
    centerY?: boolean;
    /** Reveal step index (non-negative). Only set for `reveal`. */
    at?: number;
};

export type ParsedDirective = {
    command: DirectiveCommand;
    options: DirectiveOptions;
};

const COMMENT_BODY_RE = /^<!--([\s\S]*?)-->$/;
const DIRECTIVE_RE = /^presen-it!\s+(\S+)(?:\s+\((.*)\))?$/;
const KNOWN_COMMANDS = new Set<DirectiveCommand>(["slide-break", "column-break", "reveal"]);
const BOOL_OPTIONS = new Set(["center-x", "center-y"]);
const INT_OPTIONS = new Set(["at"]);

/**
 * Try to parse an HTML comment as an AXT Presen'it! directive.
 * Returns null when the comment is not a (valid) directive.
 */
export function parseDirectiveComment(
    html: string,
    diagnostics: Diagnostic[],
    line?: number,
): ParsedDirective | null {
    const commentMatch = COMMENT_BODY_RE.exec(html.trim());
    if (!commentMatch) {
        return null;
    }

    const body = (commentMatch[1] ?? "").trim();
    if (!body.startsWith("presen-it!")) {
        return null;
    }

    const directiveMatch = DIRECTIVE_RE.exec(body);
    if (!directiveMatch) {
        diagnostics.push({
            severity: "warning",
            message: `Malformed AXT Presen'it! directive: ${html.trim()}`,
            line,
        });
        return null;
    }

    const command = directiveMatch[1] ?? "";
    const optionsRaw = directiveMatch[2];

    if (!KNOWN_COMMANDS.has(command as DirectiveCommand)) {
        diagnostics.push({
            severity: "warning",
            message: `Unknown AXT Presen'it! command "${command}"; directive ignored`,
            line,
        });
        return null;
    }

    const options: DirectiveOptions = {};

    if (command === "reveal" && (optionsRaw === undefined || optionsRaw.length === 0)) {
        options.at = 0;
        return { command, options };
    }

    if (optionsRaw !== undefined && optionsRaw.length > 0) {
        const parts = optionsRaw.split("&");
        for (const part of parts) {
            const eq = part.indexOf("=");
            if (eq <= 0) {
                diagnostics.push({
                    severity: "warning",
                    message: `Invalid directive option "${part}"; directive ignored`,
                    line,
                });
                return null;
            }

            const key = part.slice(0, eq);
            const value = part.slice(eq + 1);

            if (BOOL_OPTIONS.has(key)) {
                if (command === "reveal") {
                    diagnostics.push({
                        severity: "warning",
                        message: `Directive option "${key}" is not valid on reveal; directive ignored`,
                        line,
                    });
                    return null;
                }
                if (value !== "true" && value !== "false") {
                    diagnostics.push({
                        severity: "warning",
                        message: `Directive option "${key}" must be true|false, got "${value}"; directive ignored`,
                        line,
                    });
                    return null;
                }
                if (key === "center-x") {
                    options.centerX = value === "true";
                } else if (key === "center-y") {
                    options.centerY = value === "true";
                }
                continue;
            }

            if (INT_OPTIONS.has(key)) {
                if (command !== "reveal") {
                    diagnostics.push({
                        severity: "warning",
                        message: `Directive option "${key}" is only valid on reveal; directive ignored`,
                        line,
                    });
                    return null;
                }
                if (!/^\d+$/.test(value)) {
                    diagnostics.push({
                        severity: "warning",
                        message: `Directive option "at" must be a non-negative integer, got "${value}"; directive ignored`,
                        line,
                    });
                    return null;
                }
                options.at = Number.parseInt(value, 10);
                continue;
            }

            diagnostics.push({
                severity: "warning",
                message: `Unknown directive option "${key}"; directive ignored`,
                line,
            });
            return null;
        }
    }

    if (command === "reveal" && options.at === undefined) {
        options.at = 0;
    }

    return {
        command: command as DirectiveCommand,
        options,
    };
}

export function isHtmlComment(value: string): boolean {
    return COMMENT_BODY_RE.test(value.trim());
}

export function extractCommentText(html: string): string {
    const match = COMMENT_BODY_RE.exec(html.trim());
    return (match?.[1] ?? "").trim();
}

export function mergeAlign(base: AlignOptions, override: DirectiveOptions): AlignOptions {
    return {
        centerX: override.centerX ?? base.centerX,
        centerY: override.centerY ?? base.centerY,
    };
}

export function alignFromDirective(options: DirectiveOptions): AlignOptions {
    return mergeAlign(DEFAULT_SLIDE_ALIGN, options);
}
