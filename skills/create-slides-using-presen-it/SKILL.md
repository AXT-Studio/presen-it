---
name: create-slides-using-presen-it
description: Create or edit Markdown presentation decks using AyaExpTech Presen'it!, including its Vite setup, layouts, reveal steps, and presenter notes.
---

# Create slides using Presen'it!

Presen'it! is a Vite plugin that turns each selected Markdown file into a presentation deck. Follow the project's existing Vite config, scripts, and deck layout.

## Setup and delivery

- Requires Node.js >=22.18.0 and Vite 8. Install: `pnpm add -D jsr:@ayaexptech/presen-it` (Vite+: `vp add -D jsr:@ayaexptech/presen-it`); add `vite` if absent.
- In `vite.config.ts`: `import presenit from "@ayaexptech/presen-it";` then add `presenit()` to `plugins`.
- Options: `includes` defaults to `["src/**/index.md"]`, `excludes` to `[]`, `root` to `"src"`; paths/globs are relative to Vite root. Selected files must be inside the plugin's `root`.
- Default layout: `src/slides/<name>/index.md`, optional adjacent `assets/`. A deck needs no author-written HTML or viewer entry.
- Route: remove plugin `root`, `.md`, and a final `index` path segment; append `/`. Thus `src/slides/talk/index.md` → `/slides/talk/`, built as `dist/slides/talk/index.html`. Vite `base` prefixes URLs. Duplicate deck routes or existing HTML at the same route are errors.
- Dev: `pnpm exec vite`; build: `pnpm exec vite build`; preview: `pnpm exec vite preview`. Publish the entire output directory. No `presenit init/dev/build/export` CLI exists in this version.
- PDF: Viewer menu → “PDFとして保存” → browser “Save as PDF”; one slide per page, all reveals visible, no UI/notes. Build does not generate PDFs.

## Authoring

```md
---
title: My talk
---

<!-- presen-it! slide-break (center-x=true) -->

# My talk

Subtitle

<!-- Opening speaker note. -->

<!-- presen-it! slide-break -->

## Main point

Always visible.

<!-- presen-it! column-break (center-y=false) -->

<!-- presen-it! reveal (at=1) -->

Visible after one advance.
```

- Separate pages with `<!-- presen-it! slide-break -->`; headings and horizontal rules do not paginate. A leading slide-break configures page 1 without an empty page.
- A page's first block, if `h2` (`##`), becomes its shared header. To keep it in the body, place a column-break before it. `h1` stays in the body.
- `<!-- presen-it! column-break -->` starts the next equal-width column; empty columns are removed.
- Break directives must stand alone between blocks. Alignment: `(center-x=true&center-y=false)`; no spaces around `=` or `&`. Defaults: horizontal left, vertical center. Slide options apply to all columns; column options override for the new column.
- The final standalone non-directive HTML comment in the last column becomes speaker notes. It is absent from projection/PDF but included in generated HTML.
- Images resolve relative to the Markdown file: `![diagram](./assets/diagram.png)`. Relative links to other selected `.md` files become deck URLs; `#N` selects page N. Vite public assets also work.
- GFM tables, strikethrough, read-only task lists; fenced code → Shiki; `$inline$` / `$$` blocks → KaTeX; fenced `mermaid` → beautiful-mermaid SVG; alerts: `> [!NOTE]` / `TIP` / `IMPORTANT` / `WARNING` / `CAUTION`.
- Keep content within the fixed page; overflow does not create pages. Split dense slides. Use centered title/quote slides and columns for text + figures where useful.

## Reveal

`<!-- presen-it! reveal (at=N) -->` sets the entrance step for **subsequent** content. N is a non-negative integer; `<!-- presen-it! reveal -->` means step 0 (initially visible).

- Sticky in document order across columns and nested/inline content; resets to 0 on each page. Content is visible when `at <= currentStep`. Gaps cause empty advances; decreasing N is allowed.
- Forward/back navigation advances/reverses steps before pages; returning to a previous page shows its final step. Shared h2 headers are always visible. Overview/PDF show all steps.
- Use standalone block directives with blank lines, or inline directives mid-paragraph/end-of-item. A line-leading HTML comment followed by text on that same line becomes a Markdown HTML block; avoid it.

```md
- Visible initially<!-- presen-it! reveal (at=1) -->
- Visible at step 1<!-- presen-it! reveal (at=2) -->
- Visible at step 2
```

## Frontmatter

Optional file-leading YAML between `---` lines; these are the defaults:

```yaml
title: "" # browser/OG title; fallback: AXT Presen'it! — <route>; write cover heading in body
description: "" # meta/OG description
theme: light # light | dark
hue: 210 # modulo 360
width: 1920 # px; positive
height: 1080 # px; positive
fontSize: 32 # px; positive
fontFamily:
    sans: '"M PLUS 1", system-ui, sans-serif'
    mono: '"M PLUS 1 Code", ui-monospace, monospace'
pageTransition: { type: fade, duration: 0.2 } # none | fade | scroll; seconds >=0
animation: { duration: 0.3 } # reveal fade; seconds >=0
rawHTML: false # literal HTML displayed as text; enable only for intentional HTML
break: soft # soft: single newline → line break; hard: standard Markdown behavior
footer: "" # bottom-left on all pages
```

Font stacks accept CSS strings or arrays, e.g. `[M PLUS 1, system-ui, sans-serif]`. Named fonts request Google Fonts; generics alone avoid font downloads. Invalid settings warn and fall back. Custom keys do not affect slides but remain available in deck metadata.

## Preview and controls

Open the deck route and check layout, assets, and reveal order. Dev reload preserves page/step. Viewer keys: →/Space/Enter/PageDown forward; ←/PageUp back; Home/End first/last page at step 0; O overview; P presenter tab; F fullscreen; L laser; B or `.` blackout; Esc dismiss/clear blackout. Presenter: T pause/resume timer, R reset. Touch: tap toolbar, swipe navigate.

Presenter shows notes, timer, and next step/page; page/reveal/blackout/laser sync via BroadcastChannel between tabs in the same browser and origin for the same deck. URL `#N` is 1-based page only; `?presenter` opens presenter directly.

For an index page, import `{ decks }` from `@ayaexptech/presen-it/decks` inside the configured Vite app. Entries sorted by source path expose `url`, `route`, `source`, `title`, `description`, `slideCount`, `theme`, `hue`, `width`, `height`, `frontmatter`. All raw frontmatter is bundled publicly.

Full reference: [README](https://github.com/AXT-Studio/presen-it/blob/main/README.md).
