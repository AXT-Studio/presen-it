# Changelog

## 2.0.0-rc.1 - Unreleased

- Replace the custom CLI with a TypeScript Vite plugin for JSR `@ayaexptech/presen-it`.
- Discover multiple Markdown decks with globs; emit directory-based HTML routes with Vite assets and base support.
- Add a framework-free Viewer with Reveal, Overview, synchronized Presenter, laser, blackout and timer.
- Viewer: fill the window with the slide, match the surround and controls to the deck theme, and replace the
  fixed text toolbar with an auto-hiding icon toolbar (mouse, keyboard focus, tap; swipe to navigate).
- Viewer: cross-fade page transitions over the outgoing slide so no page background flashes through.
- Print: disable transitions so Reveal content is never captured mid-fade.
- Viewer: PageDown / PageUp move forward / back and "." toggles blackout for presentation remotes (clickers).
- Dev: invalidate every variant of the theme CSS module (including Vite's `?direct` link request) so
  frontmatter changes such as `theme`, `hue` and `fontFamily` reach open slides after the reload.
- Save PDFs through browser printing, with all Reveal steps and one slide per page.
- Expose deck metadata (title, description, URL with Vite `base`, slide count, theme, size and raw
  frontmatter) to app code as `virtual:presenit/decks`, typed via `@ayaexptech/presen-it/decks`;
  dev updates follow Markdown additions, removals and metadata edits (#114).
- Preserve Markdown/frontmatter/directive semantics and defaults; update only the fallback product title.
- Verify Vite, Vite+, local tarball installation, consumer types, real authored slides and JSR dry-run.
- Remove automatic npm publishing; JSR publication is a manual step (see `docs/publishing.md`).

## 1.1.3 — 2026-08-03

### Fixes

- PDF export: inline local images as data URIs so Puppeteer `setContent` can embed them (local WebP/PNG no longer blank in the PDF; #108)

## 1.1.2 — 2026-08-03

### Fixes

- Projection: mid page-transition reveal advances no longer freeze the incoming slide (keyboard repeat / double-press during fade/scroll; #106)

## 1.1.1 — 2026-08-03

### Fixes

- Mermaid diagrams: drop fixed `height` on `.presenit-mermaid svg` so wide flowcharts no longer reserve excess vertical space (`max-height` still caps size)

## 1.1.0 — 2026-08-03

### Features

- Same-slide click reveals via `<!-- presen-it! reveal (at=N) -->` (sticky `at`, inline/list/emphasis support)
- Frontmatter `animation.duration` (default `0.3s`) for fragment fade in/out
- Viewer step navigation (empty clicks for gaps), BroadcastChannel step sync, presenter Next previews the next step

## 1.0.3 — 2026-07-31

### Fixes

- KaTeX display math: increase `.katex-display` vertical padding so integral/sum limits are not clipped by `overflow-y: hidden` (e.g. `\int_0^1`)

## 1.0.2 — 2026-07-31

### Changed

- User-facing product name is now **AyaExpTech Presen'it!** (short form **AXT Presen'it!** in compact UI such as the nav brand, footer, and CLI startup message). CLI command (`presenit`), npm package (`@ayaexptech/presenit`), and `<!-- presen-it! ... -->` directive syntax are unchanged.

## 1.0.1 — 2026-07-31

### Changed

- **Package migration:** npm package renamed from `@axt_ayakoto/presenit` to `@ayaexptech/presenit` (install with `pnpm add -D @ayaexptech/presenit`)
- **Repository migration:** development moved to [`AXT-Studio/presen-it`](https://github.com/AXT-Studio/presen-it) (GitHub redirects from the former `AXT_AyaKoto/presen-it`)
- Official site URL is now https://axt-studio.github.io/presen-it/
- README, `llms.txt`, and publishing docs updated for the new package and repository names

## 1.0.0 — 2026-07-31

### Features

- Stable **1.0.0** release: CLI, documented frontmatter, directives, and Markdown dialect follow SemVer (see `docs/1.0-scope.md` in the v1 tree)
- Official site on GitHub Pages (`site/`, https://axt-ayakoto.github.io/presen-it/)
- README / `llms.txt` updated for 1.0 (prerelease wording removed; site + scope links)

## 0.9.1 — 2026-07-31

### Improvements

- Init template: clearer slide-break and NOTE alert copy
- Bottom-left toolbar: Laser toggle (`L`), matching Overview active state
- Fade page transition uses linear timing to avoid black flash mid-crossfade

## 0.9.0 — 2026-07-31

### Features

- Frontmatter `footer` string (default `""`) renders escaped text at the bottom-left of every slide
- Presenter timer: Pause/Resume and Reset buttons (`T` / `R` shortcuts)
- `presenit init <slug>` scaffolds `src/<slug>/slide.md` with a Japanese intro deck (frontmatter, directives, notes, Markdown extras, viewer keys, dev/build/export hints). Refuses overwrite unless `--force`.
- Blackout (`B` / presenter toggle / `Esc` to clear): opaque overlay on projection, synced via `BroadcastChannel`
- Frontmatter `title` and optional `description` inject `<title>`, Open Graph, and meta description tags into viewer HTML
- Laser pointer (`L`): red dot on projection and presenter current slide; presenter mouse position syncs to projection via `BroadcastChannel`

## 0.8.0 — 2026-07-31

### Features

- Presenter opens in a separate tab/window (`P` or toolbar from projection); projection stays in the original tab
- Slide index syncs across projection and presenter tabs via `BroadcastChannel` (hash + broadcast on open)

## 0.7.7 — 2026-07-31

### Fixes

- PDF export: hide KaTeX MathML layer so inline and display math render once (Puppeteer ignores upstream clip-path hide rules)
- PDF export: inline KaTeX CSS from the installed package with CDN font URLs instead of relying on `@import` in print HTML

## 0.7.6 — 2026-07-31

### Fixes

- Publish `src/shared/` so the Vite viewer can resolve `slide-padding` (fixes `presenit dev` import error on npm installs)

## 0.7.5 — 2026-07-31

### Improvements

- Projection click zones match slide horizontal padding (slightly narrower); chevron affordance on hover unchanged
- Remove `w-resize` / `e-resize` cursors from projection edge zones

## 0.7.4 — 2026-07-31

### Fixes

- Soft breaks no longer leave a blank line between GitHub alert labels and body text

## 0.7.3 — 2026-07-31

### Features

- Frontmatter `break: soft | hard` (default `soft`): `soft` turns single newlines inside paragraphs into `<br>` (GFM-style); `hard` keeps CommonMark line breaks

### Fixes

- Task-list checkbox mark: nudge `::before` to `top: 0.5em` for better vertical alignment
- KaTeX display math: fix stray vertical scrollbar — `overflow-x: auto` with `overflow-y: visible` computed as `auto` on both axes; set `overflow-y: hidden` and hide horizontal scrollbar chrome

## 0.7.2 — 2026-07-31

### Fixes

- Task-list checkboxes: hide the UA widget and draw marks with `li::before` (input `em` sizing was wrong because checkbox font-size did not inherit)

## 0.7.1 — 2026-07-31

### Improvements

- Custom read-only task-list checkboxes (no browser-default control), text aligned with other lists
- Icons on GitHub alert labels (NOTE / TIP / IMPORTANT / WARNING / CAUTION)
- kitchen-sink: alert examples slide

## 0.7.0 — 2026-07-30

### Features

- Render GitHub alert blockquotes (`NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`) as labelled, slide-friendly alerts
- Style GFM task lists as read-only checkboxes with completed items subtly muted

## 0.6.0 — 2026-07-30

### Features

- `pageTransition.type` (`none` \| `fade` \| `scroll`, default `fade`) and `pageTransition.duration` (seconds, default `0.2`) in frontmatter; PDF export ignores transitions

### Fixes

- Soften click-zone chevron shadow (lighter, wider)
- Zone `w-resize` / `e-resize` cursors via hit-target overlays above slide content

## 0.5.0 — 2026-07-30

### Features

- `fontFamily.sans` / `.mono` accept YAML string arrays (auto-quote spaced names into CSS)
- Projection zone affordance uses chevron arrows (white + dark shadow) readable on light and dark

### Fixes

- Zone `w-resize` / `e-resize` cursors now apply over slide content (not only the projection root)

## 0.4.0 — 2026-07-30

### Features

- Projection click zones: hover shows a translucent edge affordance with `w-resize` / `e-resize` cursors
- Load named `fontFamily` stacks from Google Fonts (generics skipped; local fonts still preferred by the browser)

### Changes

- h1 `letter-spacing` 0.03em → 0.01em
- README / llms.txt: clearer frontmatter defaults and `fontFamily` examples

## 0.3.2 — 2026-07-30

### Fixes

- KaTeX script sizing for npm consumers: render with our direct `katex@0.18.1` dependency so HTML emits `katex-sizing` matching the CSS (workspace overrides never applied to downstream installs)
- Soften `katex-display` overflow so limits are less likely to clip

## 0.3.1 — 2026-07-30

### Fixes

- Italic text keeps the normal text color (no muted gray)
- KaTeX script/limit sizing: align renderer + CSS on KaTeX 0.18 (`katex-sizing`)
- Scale Mermaid diagrams up to 2/3 of slide height (was intrinsic SVG size, not the image cap)
- Centered columns: code blocks stay centered, lines are left-aligned
- Projection zones: 10% edges, short-press only so text selection/copy works
- Slightly stronger slide background gradient; image max-height relaxed to 75%

## 0.3.0 — 2026-07-30

### Features

- Keep the current slide across Vite full-reload when editing Markdown (`#N` hash)
- Projection click zones: left 20% previous, right 20% next (center does nothing)
- Bottom-left hover toolbar for Overview / Presenter / Fullscreen
- Subtle lightness gradient + corner wash on slide backgrounds
- Expanded `kitchen-sink` gallery for layouts and features

### Changes

- Removed the projection hover page-number HUD (slide chrome already shows it)

## 0.2.0 — 2026-07-30

### Features

- Lazy Chrome install: download only when needed for `export` / overflow checks (no postinstall Chrome download)
- Sync slide position with the URL hash (`#N`, 1-based)
- Overview mode (`O`) — grid of all slides

### Notes

- Publishing to npm now runs from GitHub Actions when a GitHub Release is published

## 0.1.0 — 2026-07-30

First public prerelease of `@axt_ayakoto/presenit`.

### Features

- Markdown → slides with YAML frontmatter and HTML-comment directives
- Themes: `light` / `dark` + `hue`, default fonts M PLUS 1 / M PLUS 1 Code
- `presenit dev` / `build` / `export` (Vite + Preact viewer, Puppeteer PDF)
- Presenter mode (notes, next slide, timer, BroadcastChannel sync)
- Shiki, KaTeX (`$` / `$$`), beautiful-mermaid
- `llms.txt` for AI-assisted authoring

### Notes

- This is an early **0.1.0** release for dogfooding; APIs and UX may still change before 1.0.0.
