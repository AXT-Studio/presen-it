---
name: create-slides-using-axtech-presenit
description: Create presentation slides based on Markdown files using AyaExpTech Presen'it!.
---

# Create slides using "AyaExpTech Presen'it!"

"AyaExpTech Presen'it!" is a tool for turning a normal Markdown document into tidy presentation slides with minimal directives.
The following is a summary of the information needed to create slides using this tool.

## Project Directory Layout

```txt
package.json
src/{slug}/slide.md
src/{slug}/assets/...   # optional assets
dist/{slug}/view.html   # from `presenit build`
dist/{slug}/resume.pdf  # from `presenit export`
```

## Commands

```sh
pnpm add -D @ayaexptech/presenit
pnpm exec presenit init {slug} # writes src/{slug}/slide.md (starter deck)
pnpm exec presenit init {slug} --force # to overwrite
pnpm exec presenit dev {slug}
pnpm exec presenit build {slug}
pnpm exec presenit export {slug}
```

## slide.md YAML frontmatter (slide's settings)

The following examples show the default values.

```yaml
title: AyaExpTech Presen'it! — <slug>
description: ""
theme: light # light | dark
hue: 210 # number, mod 360
width: 1920 # px
height: 1080 # px
fontSize: 32 # px
fontFamily:
    sans: '"M PLUS 1", system-ui, sans-serif'
    mono: '"M PLUS 1 Code", ui-monospace, monospace'
pageTransition:
    type: fade # none | fade | scroll (ignored in PDF)
    duration: 0.2 # seconds
animation:
    duration: 0.3 # fragment fade seconds (viewer)
rawHTML: false # true only if you intentionally embed HTML
break: soft # soft | hard
footer: "" # bottom-left text on every slide
```

Unknown keys are ignored.
Wrong types fall back to defaults with warnings.

`fontFamily.sans` / `.mono` accept a CSS stack string **or** an array of family names (e.g. `sans: ["Edu VIC WA NT Hand", "Zen Kurenaido", cursive]`).
Spaced names are quoted in CSS automatically.
Named families (not generics like `serif` / `system-ui`) are requested from Google Fonts automatically; locally installed fonts still take priority in the browser.

## Directives

`slide-break` / `column-break` must be alone between blocks. `reveal` may also appear inline (e.g. end of a list item or mid-paragraph).

```html
<!-- presen-it! slide-break -->
<!-- presen-it! column-break -->
<!-- presen-it! slide-break (center-x=true) -->
<!-- presen-it! column-break (center-x=true&center-y=false) -->
<!-- presen-it! reveal -->
<!-- presen-it! reveal (at=2) -->
```

Rules:

- Commands: `slide-break`, `column-break`, `reveal`
- Align options (breaks only): `center-x=true|false`, `center-y=true|false`
- Reveal option: `at=N` (non-negative integer). Omitted → `at=0`
- No spaces around `=` or `&`
- Defaults: `center-x=false`, `center-y=true`
- Column options override slide options
- Unknown command/option → warning and ignore directive

### Reveal (click fragments)

- Sticky `at` walks document order within a slide (left→right columns, nested lists, phrasing including inside `strong` / `emphasis`)
- Content before a `reveal` uses the current sticky `at`; the directive updates sticky for what follows
- Visible when `at <= step` (entrance step is `0`)
- Counter advances `0..max(at)` one by one (unused numbers are empty clicks)
- `slide-break` resets sticky to `0`; columns do not
- Leading page `h2` header is always visible
- PDF / overview show all fragments; projection↔presenter sync step via BroadcastChannel
- Hash stays slide-only (`#N`)

Example:

```md
<!-- presen-it! reveal (at=1) -->

- one <!-- presen-it! reveal (at=2) -->
- two

**abc<!-- presen-it! reveal (at=3) -->def**
```

## Page structure

- Content before the first `slide-break` is page 1
- A `slide-break` immediately after frontmatter applies options to page 1 (no empty page)
- Leading `h2` after a slide-break becomes the page header
    - To keep an `h2` in the body, put `column-break` immediately after `slide-break`
- Empty columns are removed
- Trailing non-directive HTML comment = speaker notes (presenter only)

## Supported Markdown extras

- GFM (tables, strikethrough, task lists, etc.); task lists (`- [ ]` / `- [x]`) render as read-only checkboxes
- Code fences → Shiki highlight
- ` ```mermaid ` → SVG via beautiful-mermaid
- `$inline$` and `$$ block $$` math → KaTeX
- GitHub alerts use blockquotes: `> [!NOTE]`, `TIP`, `IMPORTANT`, `WARNING`, or `CAUTION`; they render as labelled, slide-friendly alert asides

## Viewer keys

- `←` `→` / Space: navigate (within-slide reveal steps first, then slides)
- `Home` `End`: first/last slide (step resets to entrance)
- Projection short-press zones: left/right slide-edge bands (padding width) = previous/next (ignores drag / text selection; hover shows a chevron affordance)
- Bottom-left hover toolbar: Overview / Presenter / Fullscreen / Laser (`L`)
- `O`: overview grid (all fragments visible)
- `F`: fullscreen
- `P`: open presenter in a separate tab/window (projection tab unchanged)
- `B`: blackout projection (opaque black overlay; syncs across tabs; `Esc` clears blackout first)
- `T`: timer pause/resume (presenter)
- `R`: timer reset (presenter)
- `L`: laser pointer (red dot on current slide; presenter mouse syncs to projection)
- URL hash `#N` (1-based) syncs the current page (kept across markdown reload in `dev`); step is not in the hash
- `?presenter` query: open presenter directly in that tab
- Projection and presenter tabs stay in sync via `BroadcastChannel` (hash, index, step, blackout, and laser)
- Presenter “Next” preview: next reveal step on the current slide when available; otherwise the next slide

## Tips for Creating Better Slides

- Use `center-x=true` for title / quote / single figure slides
- Use `column-break` for text + figure
- Keep speaker notes factual and short
- Avoid raw HTML unless `rawHTML: true` is intentional
