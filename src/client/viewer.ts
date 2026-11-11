interface Settings {
    width: number;
    height: number;
    pageTransition: { type: "none" | "fade" | "scroll"; duration: number };
    animation: { duration: number };
}
interface State {
    index: number;
    step: number;
    blackout: boolean;
    laser: boolean;
}
const data = JSON.parse(document.querySelector("#presenit-data")!.textContent!) as {
    config: Settings;
    notes: (string | null)[];
    route: string;
};
const config = data.config;
const root = document.documentElement;
const stage = document.querySelector<HTMLElement>("#presenit-stage")!;
const deck = stage.querySelector<HTMLElement>(".presenit-deck")!;
const slides = Array.from(deck.querySelectorAll<HTMLElement>(".presenit-slide"));
const presenter = new URLSearchParams(location.search).has("presenter");
const storageKey = "presenit:" + location.pathname;
const initial = Math.max(0, Number.parseInt(location.hash.slice(1), 10) - 1 || 0);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let state: State = {
    index: Math.min(initial, slides.length - 1),
    step: 0,
    blackout: false,
    laser: false,
};
try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    if (saved && saved.index === state.index)
        state.step = Math.max(0, Math.min(Number(saved.step) || 0, maxStep(state.index)));
} catch {
    /* Storage is optional in restricted/private contexts. */
}
const channel =
    typeof BroadcastChannel === "function"
        ? new BroadcastChannel(
              "presenit:" + location.origin + location.pathname.replace(/index\.html$/, ""),
          )
        : null;
function maxStep(index: number): number {
    return Number(slides[index]?.dataset.presenitMaxStep ?? 0);
}

// ---------------------------------------------------------------------------
// DOM helpers and icons. Icons are simple geometric strokes drawn for this
// Viewer, so no icon package is bundled.
// ---------------------------------------------------------------------------
const ICONS = {
    previous: '<path d="M15 18l-6-6 6-6"/>',
    next: '<path d="M9 18l6-6-6-6"/>',
    overview:
        '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    laser: '<path d="M3.5 20.5l5-5" stroke-width="3.4"/><path d="M11 13l4-4" stroke-dasharray="1.6 2.4"/><circle cx="18" cy="6" r="2.6" fill="currentColor" stroke="none"/>',
    expand: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    shrink: '<path d="M9 4v5H4M15 4v5h5M20 15h-5v5M4 15h5v5"/>',
    more: '<circle cx="12" cy="5.5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="18.5" r="1.6" fill="currentColor" stroke="none"/>',
    presenter:
        '<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4M7 8.5h6M7 12h3.5"/>',
    blackout:
        '<rect x="3" y="4" width="18" height="12.5" rx="2" fill="currentColor"/><path d="M8.5 20.5h7M12 16.5v4"/>',
    print: '<path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z"/><path d="M14 3v5h5M12 11.5v6M9.2 14.8L12 17.6l2.8-2.8"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    pause: '<rect x="6.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/>',
    play: '<path d="M7.5 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8a.8.8 0 0 0-1.2.7z" fill="currentColor" stroke="none"/>',
    reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 3.5v4h4"/>',
};
type Icon = keyof typeof ICONS;
function element<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className = "",
    text?: string,
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
}
function icon(name: Icon): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "presenit-icon");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    // Static markup from ICONS only; never user content.
    svg.innerHTML = ICONS[name];
    return svg;
}
function setIcon(target: HTMLElement, name: Icon): void {
    target.querySelector("svg.presenit-icon")?.replaceWith(icon(name));
}
interface Shortcut {
    /** Value for aria-keyshortcuts. */
    aria: string;
    /** Key shown in tooltips and menus. */
    label: string;
}
function button(
    label: string,
    action: () => void,
    parent: HTMLElement,
    shortcut?: Shortcut,
): HTMLButtonElement {
    const node = element("button", "", label);
    node.type = "button";
    node.setAttribute("aria-label", label);
    if (shortcut) node.setAttribute("aria-keyshortcuts", shortcut.aria);
    node.addEventListener("click", () => {
        if (node.getAttribute("aria-disabled") !== "true") action();
    });
    parent.append(node);
    return node;
}
/** Icon-only button with a visual tooltip; the accessible name stays in aria-label. */
function iconButton(
    label: string,
    glyph: Icon,
    action: () => void,
    parent: HTMLElement,
    shortcut?: Shortcut,
): HTMLButtonElement {
    const node = button(label, action, parent, shortcut);
    node.className = "presenit-icon-button";
    node.replaceChildren(icon(glyph));
    node.dataset.tip = label;
    if (shortcut) node.dataset.key = shortcut.label;
    return node;
}
function menuItem(
    label: string,
    glyph: Icon,
    action: () => void,
    shortcut?: Shortcut,
): HTMLButtonElement {
    const node = button(label, action, menuPanel, shortcut);
    node.className = "presenit-menu-item";
    node.replaceChildren(icon(glyph), element("span", "", label));
    if (shortcut) node.append(element("kbd", "", shortcut.label));
    return node;
}

// ---------------------------------------------------------------------------
// Layout: the stage fills the window. The toolbar floats above it and never
// reserves space, except in the Presenter where it is docked under the slide.
// ---------------------------------------------------------------------------
const layout = element("div", "presenit-layout");
const main = element("div", "presenit-main");
stage.before(layout);
layout.append(main);
main.append(stage);

const sidebar = element("aside", "presenit-presenter");
sidebar.hidden = !presenter;
sidebar.setAttribute("aria-label", "発表者ビュー");
layout.append(sidebar);
sidebar.append(element("h1", "presenit-ui-title", "発表者ビュー"));
const timerCard = element("section", "presenit-timer-card");
sidebar.append(timerCard);
const timerText = element("div", "presenit-timer-text");
timerCard.append(timerText);
timerText.append(element("span", "presenit-label", "経過時間"));
const timer = element("output", "presenit-timer", "00:00");
timer.setAttribute("aria-label", "経過時間");
timerText.append(timer);
let elapsed = 0;
let started = Date.now();
let running = true;
function renderTimer(): void {
    const seconds = Math.floor((elapsed + (running ? Date.now() - started : 0)) / 1000);
    const hours = Math.floor(seconds / 3600);
    const clock = `${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    timer.textContent = hours ? `${hours}:${clock}` : clock;
    timer.classList.toggle("is-paused", !running);
}
const timerActions = element("div", "presenit-actions");
timerCard.append(timerActions);
const pause = iconButton(
    "一時停止",
    "pause",
    () => {
        if (running) elapsed += Date.now() - started;
        else started = Date.now();
        running = !running;
        const label = running ? "一時停止" : "再開";
        pause.setAttribute("aria-label", label);
        pause.dataset.tip = label;
        setIcon(pause, running ? "pause" : "play");
        renderTimer();
    },
    timerActions,
    { aria: "T", label: "T" },
);
const reset = iconButton(
    "タイマーをリセット",
    "reset",
    () => {
        elapsed = 0;
        started = Date.now();
        renderTimer();
    },
    timerActions,
    { aria: "R", label: "R" },
);
const nextSection = element("section", "presenit-next");
nextSection.append(element("h2", "presenit-label", "次の表示"));
const nextPreview = element("div", "presenit-preview");
nextPreview.setAttribute("aria-label", "次のスライドまたはReveal");
nextSection.append(nextPreview);
sidebar.append(nextSection);
const notesSection = element("section", "presenit-notes-section");
notesSection.append(element("h2", "presenit-label", "スピーカーノート"));
const notes = element("p", "presenit-notes");
notesSection.append(notes);
sidebar.append(notesSection);

const toolbar = element("nav", "presenit-toolbar");
toolbar.setAttribute("aria-label", "発表の操作");
main.append(toolbar);
const previous = iconButton("前へ", "previous", () => move(-1), toolbar, {
    aria: "ArrowLeft PageUp",
    label: "←",
});
const position = element("div", "presenit-position");
position.setAttribute("aria-live", "polite");
position.setAttribute("aria-atomic", "true");
position.append(element("span", "presenit-sr", "スライド"));
const counter = element("span", "presenit-counter");
position.append(counter);
const steps = element("span", "presenit-steps");
position.append(steps);
toolbar.append(position);
const forward = iconButton("次へ", "next", () => move(1), toolbar, {
    aria: "ArrowRight Space PageDown",
    label: "→",
});
const separator = element("span", "presenit-separator");
separator.setAttribute("role", "separator");
separator.setAttribute("aria-orientation", "vertical");
toolbar.append(separator);
iconButton("スライド一覧", "overview", () => openOverview(), toolbar, {
    aria: "O",
    label: "O",
});
const laserButton = iconButton(
    "レーザーポインター",
    "laser",
    () => {
        state.laser = !state.laser;
        hideLaser();
        update();
    },
    toolbar,
    { aria: "L", label: "L" },
);
const fullscreenButton = iconButton("フルスクリーン", "expand", () => toggleFullscreen(), toolbar, {
    aria: "F",
    label: "F",
});
fullscreenButton.setAttribute("aria-pressed", "false");
const menuButton = iconButton("メニュー", "more", () => undefined, toolbar);
const menuPanel = element("div", "presenit-menu");
menuPanel.id = "presenit-menu";
menuPanel.setAttribute("popover", "auto");
menuPanel.setAttribute("role", "group");
menuPanel.setAttribute("aria-label", "メニュー");
// The panel follows its trigger so Tab moves straight into the opened menu.
toolbar.append(menuPanel);
menuButton.setAttribute("popovertarget", menuPanel.id);
const presenterItem = menuItem("発表者ビューを開く", "presenter", () => openPresenter(), {
    aria: "P",
    label: "P",
});
presenterItem.hidden = presenter;
const blackoutButton = menuItem(
    "ブラックアウト",
    "blackout",
    () => {
        closeMenu();
        state.blackout = !state.blackout;
        update();
    },
    { aria: "B .", label: "B" },
);
const printButton = menuItem("PDFとして保存", "print", async () => {
    closeMenu();
    announce("印刷画面の送信先で「PDFに保存」を選択してください。");
    await document.fonts.ready;
    await Promise.all(
        Array.from(deck.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)),
    );
    window.print();
});
printButton.setAttribute("aria-description", "ブラウザの印刷画面でPDFとして保存します。");

const overview = element("dialog", "presenit-overview");
overview.setAttribute("aria-label", "スライド一覧");
overview.setAttribute("closedby", "any");
document.body.append(overview);
const overviewHeader = element("header");
overviewHeader.append(element("h2", "", "スライド一覧"));
overview.append(overviewHeader);
const closeOverview = iconButton("閉じる", "close", () => overview.close(), overviewHeader);
delete closeOverview.dataset.tip;
const grid = element("div", "presenit-grid");
overview.append(grid);

const status = element("p", "presenit-status");
status.setAttribute("role", "status");
document.body.append(status);
const blackout = element("div", "presenit-blackout");
blackout.setAttribute("aria-label", "ブラックアウト中");
blackout.hidden = true;
document.body.append(blackout);
const dot = element("div", "presenit-laser");
dot.hidden = true;
dot.setAttribute("aria-hidden", "true");
document.body.append(dot);
const tooltip = element("div", "presenit-tooltip");
tooltip.setAttribute("popover", "manual");
tooltip.setAttribute("aria-hidden", "true");
document.body.append(tooltip);

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
let statusTimer = 0;
function announce(message: string): void {
    status.textContent = message;
    clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
        status.textContent = "";
    }, 8000);
}
function openPresenter(): void {
    if (presenter) return;
    closeMenu();
    const url = new URL(location.href);
    url.searchParams.set("presenter", "");
    window.open(url, "presenit-presenter-" + data.route);
}
async function toggleFullscreen(): Promise<void> {
    try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await root.requestFullscreen();
    } catch {
        announce("フルスクリーンを開始できませんでした。ブラウザのメニューから操作してください。");
    }
}
document.addEventListener("fullscreenchange", () => {
    const active = document.fullscreenElement !== null;
    fullscreenButton.setAttribute("aria-pressed", String(active));
    setIcon(fullscreenButton, active ? "shrink" : "expand");
});
function menuOpen(): boolean {
    return menuPanel.matches(":popover-open");
}
function closeMenu(): void {
    if (menuOpen()) menuPanel.hidePopover();
}
function openOverview(): void {
    if (overview.open) return;
    closeMenu();
    hideTip();
    overview.showModal();
    resize();
    const current = grid.children[state.index] as HTMLElement | undefined;
    current?.focus();
    current?.scrollIntoView({ block: "nearest" });
}
function hideLaser(): void {
    dot.hidden = true;
}

// ---------------------------------------------------------------------------
// Slides, Reveal and scaling
// ---------------------------------------------------------------------------
function fragments(slide: HTMLElement, step: number): void {
    slide.querySelectorAll<HTMLElement>("[data-presenit-at]").forEach((node) => {
        const hidden = Number(node.dataset.presenitAt) > step;
        node.classList.toggle("is-concealed", hidden);
        node.inert = hidden;
        if (hidden) node.setAttribute("aria-hidden", "true");
        else node.removeAttribute("aria-hidden");
    });
}
function clone(index: number, step: number): HTMLElement {
    const node = slides[index]!.cloneNode(true) as HTMLElement;
    node.removeAttribute("hidden");
    node.classList.remove("is-current", "is-leaving");
    node.inert = true;
    node.querySelectorAll("[id]").forEach((child) => child.removeAttribute("id"));
    fragments(node, step);
    return node;
}
function fit(container: HTMLElement, child: HTMLElement): void {
    const scale = Math.max(
        0.01,
        Math.min(container.clientWidth / config.width, container.clientHeight / config.height),
    );
    child.style.setProperty("--presenit-scale", String(scale));
    child.style.setProperty("--presenit-scaled-width", `${config.width * scale}px`);
    child.style.setProperty("--presenit-scaled-height", `${config.height * scale}px`);
}
function resize(): void {
    fit(stage, deck);
    const previewSlide = nextPreview.firstElementChild as HTMLElement | null;
    if (previewSlide?.classList.contains("presenit-slide")) fit(nextPreview, previewSlide);
    grid.querySelectorAll<HTMLElement>(".presenit-thumb").forEach((frame) => {
        const child = frame.firstElementChild as HTMLElement;
        if (child) fit(frame, child);
    });
}

// Page transitions cross-fade over the outgoing slide, which stays visible
// underneath until the incoming one is opaque. Nothing behind the deck can
// show through mid-transition.
let transition: { animation: Animation; leaving: HTMLElement } | null = null;
function settleTransition(): void {
    if (!transition) return;
    const { animation, leaving } = transition;
    transition = null;
    leaving.classList.remove("is-leaving");
    animation.cancel();
}
function playTransition(leaving: HTMLElement, entering: HTMLElement, direction: number): void {
    const { type, duration } = config.pageTransition;
    if (
        type === "none" ||
        !(duration > 0) ||
        reducedMotion.matches ||
        typeof entering.animate !== "function"
    )
        return;
    leaving.classList.add("is-leaving");
    const offset = deck.clientWidth * 0.04 * direction;
    const animation = entering.animate(
        type === "scroll"
            ? [
                  { opacity: 0, translate: `${offset}px 0` },
                  { opacity: 1, translate: "0 0" },
              ]
            : [{ opacity: 0 }, { opacity: 1 }],
        {
            duration: duration * 1000,
            easing: type === "scroll" ? "cubic-bezier(0.2, 0.7, 0.2, 1)" : "ease-in-out",
        },
    );
    const current = { animation, leaving };
    transition = current;
    animation.addEventListener("finish", () => {
        if (transition === current) settleTransition();
    });
}

let shown = state.index;
/**
 * Reveal progress under the page number. One dot per view of the slide (the
 * initial view plus each Reveal step), filled up to the current one, so a
 * slide without Reveal shows a single filled dot and the number never moves.
 */
function renderSteps(): void {
    const max = maxStep(state.index);
    steps.dataset.step = String(state.step);
    steps.dataset.max = String(max);
    steps.replaceChildren(
        element("span", "presenit-sr", max ? `、Reveal ${state.step} / ${max}` : ""),
    );
    if (max >= 9) {
        const text = element("span", "presenit-steps-text", `${state.step}/${max}`);
        text.setAttribute("aria-hidden", "true");
        steps.append(text);
        return;
    }
    for (let view = 0; view <= max; view++) {
        const dot = element("i", view <= state.step ? "is-on" : "");
        dot.setAttribute("aria-hidden", "true");
        steps.append(dot);
    }
}
function update(broadcast = true, animate = true): void {
    const from = shown;
    shown = state.index;
    if (from !== state.index) settleTransition();
    slides.forEach((slide, index) => {
        const current = index === state.index;
        slide.classList.toggle("is-current", current);
        slide.inert = !current;
        if (!current) slide.setAttribute("aria-hidden", "true");
        else slide.removeAttribute("aria-hidden");
        // The outgoing slide keeps its Reveal state while it fades out.
        if (current) fragments(slide, state.step);
    });
    if (from !== state.index && animate)
        playTransition(slides[from]!, slides[state.index]!, Math.sign(state.index - from));
    counter.textContent = `${state.index + 1} / ${slides.length}`;
    renderSteps();
    const atStart = state.index === 0 && state.step === 0;
    const atEnd = state.index === slides.length - 1 && state.step === maxStep(state.index);
    previous.setAttribute("aria-disabled", String(atStart));
    forward.setAttribute("aria-disabled", String(atEnd));
    notes.textContent = data.notes[state.index] || "このスライドにノートはありません。";
    notes.classList.toggle("is-empty", !data.notes[state.index]);
    if (presenter) {
        if (atEnd)
            nextPreview.replaceChildren(element("p", "presenit-preview-end", "最後のスライドです"));
        else {
            const nextIndex = state.step < maxStep(state.index) ? state.index : state.index + 1;
            nextPreview.replaceChildren(
                clone(nextIndex, nextIndex === state.index ? state.step + 1 : 0),
            );
        }
    }
    Array.from(grid.children).forEach((item, index) => {
        if (index === state.index) item.setAttribute("aria-current", "true");
        else item.removeAttribute("aria-current");
    });
    laserButton.setAttribute("aria-pressed", String(state.laser));
    blackoutButton.setAttribute("aria-pressed", String(state.blackout));
    const blackedOut = !presenter && state.blackout;
    blackout.hidden = !blackedOut;
    root.classList.toggle("is-blackout", blackedOut);
    root.classList.toggle("is-laser", state.laser);
    toolbar.inert = blackedOut;
    if (blackedOut) {
        hideTip();
        showToolbar(false);
    }
    if (!state.laser) hideLaser();
    history.replaceState(null, "", "#" + (state.index + 1));
    try {
        sessionStorage.setItem(
            storageKey,
            JSON.stringify({ index: state.index, step: state.step }),
        );
    } catch {
        /* Optional storage. */
    }
    resize();
    if (broadcast) channel?.postMessage({ type: "state", state });
}
function navigate(index: number, step = 0): void {
    state.index = Math.max(0, Math.min(index, slides.length - 1));
    state.step = Math.max(0, Math.min(step, maxStep(state.index)));
    update();
}
function move(direction: number): void {
    if (direction > 0) {
        if (state.step < maxStep(state.index)) {
            state.step++;
            update();
        } else if (state.index < slides.length - 1) navigate(state.index + 1);
    } else {
        if (state.step > 0) {
            state.step--;
            update();
        } else if (state.index > 0) navigate(state.index - 1, maxStep(state.index - 1));
    }
}
slides.forEach((slide, index) => {
    const title = slide.querySelector("h1,h2")?.textContent?.trim() ?? "";
    const item = button(
        `スライド ${index + 1}: ${title}`,
        () => {
            navigate(index);
            overview.close();
        },
        grid,
    );
    const thumb = element("div", "presenit-thumb");
    thumb.append(clone(index, maxStep(index)));
    const caption = element("span", "presenit-thumb-label");
    caption.append(element("b", "", String(index + 1)), element("span", "", title || "スライド"));
    item.replaceChildren(thumb, caption);
});
// Clicks on ::backdrop target the dialog itself; this covers browsers without closedby.
overview.addEventListener("click", (event) => {
    if (event.target === overview) overview.close();
});
overview.addEventListener("toggle", resize);
const observer = new ResizeObserver(resize);
observer.observe(stage);
observer.observe(nextPreview);
observer.observe(grid);

// ---------------------------------------------------------------------------
// Toolbar visibility. Hidden while presenting; shown when the mouse nears the
// bottom edge, while it holds keyboard focus or its menu is open, and on tap.
// ---------------------------------------------------------------------------
let nearToolbar = false;
let toolbarTimer = 0;
let idleTimer = 0;
function showToolbar(visible: boolean): void {
    root.classList.toggle("presenit-toolbar-shown", visible);
}
function hideToolbarSoon(delay = 1500): void {
    clearTimeout(toolbarTimer);
    toolbarTimer = window.setTimeout(() => {
        if (!nearToolbar && !menuOpen()) showToolbar(false);
    }, delay);
}
function peekToolbar(duration: number): void {
    if (presenter || state.blackout) return;
    showToolbar(true);
    hideToolbarSoon(duration);
}
function hotZone(): number {
    return Math.max(96, innerHeight * 0.14);
}
function wake(): void {
    root.classList.remove("presenit-idle");
    clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
        if (!nearToolbar && !menuOpen() && !overview.open) root.classList.add("presenit-idle");
    }, 2500);
}
window.addEventListener(
    "pointermove",
    (event) => {
        if (event.pointerType === "touch") return;
        wake();
        if (presenter || state.blackout || overview.open) return;
        const near =
            toolbar.contains(event.target as Node) || event.clientY >= innerHeight - hotZone();
        if (near === nearToolbar) return;
        nearToolbar = near;
        if (near) {
            clearTimeout(toolbarTimer);
            showToolbar(true);
        } else hideToolbarSoon();
    },
    { passive: true },
);
window.addEventListener("mouseout", (event) => {
    if (event.relatedTarget) return;
    nearToolbar = false;
    hideToolbarSoon(600);
});
menuPanel.addEventListener("beforetoggle", (event) => {
    if ((event as ToggleEvent).newState !== "open") return;
    hideTip();
    // Open above the trigger, aligned to its right edge. Only the trigger is
    // measured, so the panel never paints at the UA's default position.
    const rect = menuButton.getBoundingClientRect();
    menuPanel.style.right = `${Math.max(8, innerWidth - rect.right)}px`;
    menuPanel.style.bottom = `${Math.max(8, innerHeight - rect.top + 8)}px`;
});
menuPanel.addEventListener("toggle", (event) => {
    if ((event as ToggleEvent).newState === "open") {
        clearTimeout(toolbarTimer);
        showToolbar(true);
    } else hideToolbarSoon();
});
// Touch: a tap toggles the toolbar and a horizontal swipe moves between slides.
let touchStart: { id: number; x: number; y: number } | null = null;
stage.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" || !event.isPrimary) return;
    touchStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
});
stage.addEventListener("pointercancel", () => {
    touchStart = null;
});
stage.addEventListener("pointerup", (event) => {
    if (!touchStart || touchStart.id !== event.pointerId) return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    touchStart = null;
    if (!state.laser && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        move(dx < 0 ? 1 : -1);
        return;
    }
    if (Math.hypot(dx, dy) > 10 || (event.target as Element).closest("a,button")) return;
    if (root.classList.contains("presenit-toolbar-shown")) showToolbar(false);
    else peekToolbar(4000);
});
blackout.addEventListener("click", () => {
    state.blackout = false;
    update();
});

// ---------------------------------------------------------------------------
// Tooltips for icon buttons (mouse hover and keyboard focus, not touch).
// ---------------------------------------------------------------------------
let tipTimer = 0;
let tipTarget: HTMLElement | null = null;
function hideTip(): void {
    clearTimeout(tipTimer);
    tipTarget = null;
    if (tooltip.matches(":popover-open")) tooltip.hidePopover();
}
function showTip(target: HTMLElement, delay: number): void {
    clearTimeout(tipTimer);
    tipTimer = window.setTimeout(() => {
        // Toolbar tips would cover the open menu.
        if (!target.isConnected || (menuOpen() && toolbar.contains(target))) return;
        tipTarget = target;
        tooltip.replaceChildren(target.dataset.tip ?? "");
        if (target.dataset.key) tooltip.append(element("kbd", "", target.dataset.key));
        if (!tooltip.matches(":popover-open")) tooltip.showPopover();
        const anchor = target.getBoundingClientRect();
        const box = tooltip.getBoundingClientRect();
        const left = Math.max(
            8,
            Math.min(anchor.left + anchor.width / 2 - box.width / 2, innerWidth - box.width - 8),
        );
        const above = anchor.top - box.height - 8;
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${above >= 8 ? above : anchor.bottom + 8}px`;
    }, delay);
}
const hoverCapable = matchMedia("(hover: hover)");
document.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch" || !hoverCapable.matches) return;
    const target = (event.target as Element).closest<HTMLElement>("[data-tip]");
    if (!target || target === tipTarget) return;
    // Moving between buttons keeps the tooltip responsive once one is open.
    showTip(target, tipTarget ? 0 : 450);
});
document.addEventListener("pointerout", (event) => {
    const target = (event.target as Element).closest<HTMLElement>("[data-tip]");
    if (target && !target.contains(event.relatedTarget as Node)) hideTip();
});
document.addEventListener("focusin", (event) => {
    const target = (event.target as Element).closest<HTMLElement>("[data-tip]");
    if (target?.matches(":focus-visible")) showTip(target, 250);
});
document.addEventListener("focusout", hideTip);
document.addEventListener("pointerdown", hideTip);

// ---------------------------------------------------------------------------
// Laser, sync and keyboard
// ---------------------------------------------------------------------------
let lastLaser = 0;
stage.addEventListener("pointermove", (event) => {
    if (!state.laser || performance.now() - lastLaser < 20) return;
    lastLaser = performance.now();
    const rect = slides[state.index]!.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const position = x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
    showLaser(position);
    channel?.postMessage({ type: "laser", position });
});
stage.addEventListener("pointerleave", () => {
    hideLaser();
    channel?.postMessage({ type: "laser", position: null });
});
function showLaser(position: { x: number; y: number } | null): void {
    if (!position || !state.laser) {
        hideLaser();
        return;
    }
    const rect = slides[state.index]!.getBoundingClientRect();
    dot.hidden = false;
    dot.style.left = `${rect.left + position.x * rect.width}px`;
    dot.style.top = `${rect.top + position.y * rect.height}px`;
}
let synced = false;
channel?.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || typeof message !== "object") return;
    if (message.type === "hello") {
        if (!presenter) channel.postMessage({ type: "state", state });
        return;
    }
    if (message.type === "state") {
        const incoming = message.state as State;
        if (
            !incoming ||
            !Number.isInteger(incoming.index) ||
            incoming.index < 0 ||
            incoming.index >= slides.length ||
            !Number.isInteger(incoming.step) ||
            incoming.step < 0 ||
            incoming.step > maxStep(incoming.index)
        )
            return;
        state = {
            index: incoming.index,
            step: incoming.step,
            blackout: incoming.blackout === true,
            laser: incoming.laser === true,
        };
        // A Presenter opening mid-talk jumps to the projected slide; later
        // changes animate so the projector follows the Presenter smoothly.
        update(false, !presenter || synced);
        synced = true;
    }
    if (message.type === "laser") {
        const p = message.position;
        if (
            p === null ||
            (Number.isFinite(p?.x) &&
                Number.isFinite(p?.y) &&
                p.x >= 0 &&
                p.x <= 1 &&
                p.y >= 0 &&
                p.y <= 1)
        )
            showLaser(p);
    }
});
window.addEventListener("hashchange", () =>
    navigate(Number.parseInt(location.hash.slice(1), 10) - 1 || 0),
);
window.addEventListener("keydown", (event) => {
    if (
        (event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"]') ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
    )
        return;
    if (event.key === "Escape") {
        hideTip();
        if (state.blackout) {
            state.blackout = false;
            update();
            return;
        }
        // Esc also dismisses a toolbar that was opened with the keyboard.
        const active = document.activeElement as HTMLElement | null;
        if (!presenter && !menuOpen() && active && toolbar.contains(active)) {
            active.blur();
            nearToolbar = false;
            showToolbar(false);
        }
        return;
    }
    if (
        overview.open ||
        ((event.target as HTMLElement)?.closest("button,a,summary") &&
            [" ", "Enter"].includes(event.key))
    )
        return;
    const key = event.key.toLowerCase();
    const action = (
        {
            arrowright: () => move(1),
            " ": () => move(1),
            enter: () => move(1),
            arrowleft: () => move(-1),
            // Presentation remotes (clickers) send PageDown / PageUp.
            pagedown: () => move(1),
            pageup: () => move(-1),
            home: () => navigate(0),
            end: () => navigate(slides.length - 1),
            o: () => openOverview(),
            p: () => openPresenter(),
            f: () => void toggleFullscreen(),
            l: () => laserButton.click(),
            b: () => blackoutButton.click(),
            // Many presentation remotes send "." for their blackout button.
            ".": () => blackoutButton.click(),
            t: () => {
                if (presenter) pause.click();
            },
            r: () => {
                if (presenter) reset.click();
            },
        } as Record<string, () => void>
    )[key];
    if (action) {
        event.preventDefault();
        action();
    }
});
const timerInterval = setInterval(renderTimer, 250);
window.addEventListener("pagehide", () => {
    channel?.close();
    observer.disconnect();
    clearInterval(timerInterval);
});
root.classList.toggle("is-presenter", presenter);
root.style.setProperty("--presenit-aspect", `${config.width} / ${config.height}`);
// Size the page number for the deck's longest value so the toolbar never shifts.
root.style.setProperty("--presenit-total-digits", String(String(slides.length).length));
root.style.setProperty("--presenit-fragment-duration", config.animation.duration + "s");
root.style.setProperty("--presenit-anim-duration", config.animation.duration + "s");
root.classList.add("presenit-ready");
update(false);
channel?.postMessage({ type: "hello" });
// Show the toolbar briefly once per tab so people can discover it.
if (!presenter) {
    let seen = false;
    try {
        seen = sessionStorage.getItem("presenit:toolbar-hint") === "1";
        sessionStorage.setItem("presenit:toolbar-hint", "1");
    } catch {
        /* Optional storage. */
    }
    if (!seen) peekToolbar(2500);
}
// Remove inert for printing so hidden reveal content remains accessible to print engines.
window.addEventListener("beforeprint", () => {
    closeMenu();
    hideTip();
    slides.forEach((slide) => {
        slide.inert = false;
        slide.querySelectorAll<HTMLElement>("[inert]").forEach((node) => {
            node.inert = false;
        });
    });
});
window.addEventListener("afterprint", () => update(false));
export {};
