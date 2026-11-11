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
const stage = document.querySelector<HTMLElement>("#presenit-stage")!;
const deck = stage.querySelector<HTMLElement>(".presenit-deck")!;
const slides = Array.from(deck.querySelectorAll<HTMLElement>(".presenit-slide"));
const presenter = new URLSearchParams(location.search).has("presenter");
const storageKey = "presenit:" + location.pathname;
const initial = Math.max(0, Number.parseInt(location.hash.slice(1), 10) - 1 || 0);
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
function button(
    label: string,
    action: () => void,
    parent: HTMLElement,
    key?: string,
): HTMLButtonElement {
    const node = element("button", "", label);
    node.type = "button";
    node.setAttribute("aria-label", label);
    if (key) node.setAttribute("aria-keyshortcuts", key);
    node.addEventListener("click", action);
    parent.append(node);
    return node;
}
const layout = element("div", "presenit-layout");
stage.before(layout);
layout.append(stage);
const sidebar = element("aside", "presenit-presenter");
sidebar.hidden = !presenter;
layout.append(sidebar);
const heading = element("h1", "presenit-ui-title", "発表者ビュー");
sidebar.append(heading);
const timer = element("output", "presenit-timer", "00:00");
timer.setAttribute("aria-label", "経過時間");
sidebar.append(timer);
let elapsed = 0;
let started = Date.now();
let running = true;
function timerText(): void {
    const seconds = Math.floor((elapsed + (running ? Date.now() - started : 0)) / 1000);
    timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
const timerActions = element("div", "presenit-actions");
sidebar.append(timerActions);
const pause = button(
    "一時停止",
    () => {
        if (running) elapsed += Date.now() - started;
        else started = Date.now();
        running = !running;
        pause.textContent = running ? "一時停止" : "再開";
        timerText();
    },
    timerActions,
    "T",
);
const reset = button(
    "タイマーをリセット",
    () => {
        elapsed = 0;
        started = Date.now();
        timerText();
    },
    timerActions,
    "R",
);
sidebar.append(element("h2", "", "次の表示"));
const nextPreview = element("div", "presenit-preview");
nextPreview.setAttribute("aria-label", "次のスライドまたはReveal");
sidebar.append(nextPreview);
sidebar.append(element("h2", "", "スピーカーノート"));
const notes = element("p", "presenit-notes");
sidebar.append(notes);
const toolbar = element("nav", "presenit-toolbar");
toolbar.setAttribute("aria-label", "発表の操作");
document.body.append(toolbar);
const previous = button("前へ", () => move(-1), toolbar, "ArrowLeft");
const counter = element("output", "presenit-counter");
counter.setAttribute("aria-live", "polite");
toolbar.append(counter);
const forward = button("次へ", () => move(1), toolbar, "ArrowRight");
const overview = element("dialog", "presenit-overview");
overview.setAttribute("aria-label", "スライド一覧");
document.body.append(overview);
const overviewHeader = element("header");
overviewHeader.append(element("h2", "", "スライド一覧"));
overview.append(overviewHeader);
button("閉じる", () => overview.close(), overviewHeader);
const grid = element("div", "presenit-grid");
overview.append(grid);
const overviewButton = button("一覧", () => overview.showModal(), toolbar, "O");
overview.addEventListener("close", () => overviewButton.focus());
const menu = element("details", "presenit-menu");
const summary = element("summary", "", "メニュー");
menu.append(summary);
toolbar.append(menu);
const menuActions = element("div", "presenit-menu-actions");
menu.append(menuActions);
button(
    "発表者ビューを開く",
    () => {
        const url = new URL(location.href);
        url.searchParams.set("presenter", "");
        window.open(url, "presenit-presenter-" + data.route);
    },
    menuActions,
    "P",
);
button(
    "フルスクリーン",
    async () => {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.documentElement.requestFullscreen();
        } catch {
            status.textContent =
                "フルスクリーンを開始できませんでした。ブラウザのメニューから操作してください。";
        }
    },
    menuActions,
    "F",
);
const laserButton = button(
    "レーザー",
    () => {
        state.laser = !state.laser;
        hideLaser();
        update();
    },
    menuActions,
    "L",
);
const blackoutButton = button(
    "ブラックアウト",
    () => {
        state.blackout = !state.blackout;
        update();
    },
    menuActions,
    "B",
);
const printButton = button(
    "PDFとして保存",
    async () => {
        menu.open = false;
        status.textContent = "印刷画面の送信先で「PDFに保存」を選択してください。";
        await document.fonts.ready;
        await Promise.all(
            Array.from(deck.querySelectorAll("img")).map((img) =>
                img.decode().catch(() => undefined),
            ),
        );
        window.print();
    },
    menuActions,
);
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
function hideLaser(): void {
    dot.hidden = true;
}
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
    node.classList.remove("is-current");
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
    if (previewSlide) fit(nextPreview, previewSlide);
    grid.querySelectorAll<HTMLElement>(".presenit-thumb").forEach((frame) => {
        const child = frame.firstElementChild as HTMLElement;
        if (child) fit(frame, child);
    });
}
function update(broadcast = true): void {
    slides.forEach((slide, index) => {
        slide.classList.toggle("is-current", index === state.index);
        slide.inert = index !== state.index;
        if (index !== state.index) slide.setAttribute("aria-hidden", "true");
        else slide.removeAttribute("aria-hidden");
        fragments(slide, state.step);
    });
    counter.textContent = `${state.index + 1} / ${slides.length} · ${state.step} / ${maxStep(state.index)}`;
    previous.disabled = state.index === 0 && state.step === 0;
    forward.disabled = state.index === slides.length - 1 && state.step === maxStep(state.index);
    notes.textContent = data.notes[state.index] || "このスライドにノートはありません。";
    const nextIndex =
        state.step < maxStep(state.index)
            ? state.index
            : Math.min(state.index + 1, slides.length - 1);
    nextPreview.replaceChildren(
        clone(
            nextIndex,
            nextIndex === state.index ? Math.min(state.step + 1, maxStep(state.index)) : 0,
        ),
    );
    laserButton.setAttribute("aria-pressed", String(state.laser));
    blackoutButton.setAttribute("aria-pressed", String(state.blackout));
    blackout.hidden = presenter || !state.blackout;
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
    const current = slides[state.index]!;
    if (
        config.pageTransition.type !== "none" &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
        current.animate(
            config.pageTransition.type === "scroll"
                ? [
                      { opacity: 0, translate: "3% 0" },
                      { opacity: 1, translate: "0 0" },
                  ]
                : [{ opacity: 0 }, { opacity: 1 }],
            { duration: config.pageTransition.duration * 1000 },
        );
    }
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
    const item = button(
        `スライド ${index + 1}: ${slide.querySelector("h1,h2")?.textContent ?? ""}`,
        () => {
            navigate(index);
            overview.close();
        },
        grid,
    );
    const thumb = element("div", "presenit-thumb");
    thumb.append(clone(index, maxStep(index)));
    item.replaceChildren(
        thumb,
        element(
            "span",
            "",
            `${index + 1} · ${slide.querySelector("h1,h2")?.textContent ?? "スライド"}`,
        ),
    );
});
overview.addEventListener("toggle", resize);
const observer = new ResizeObserver(resize);
observer.observe(stage);
observer.observe(nextPreview);
observer.observe(grid);
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
        update(false);
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
        if (state.blackout) {
            state.blackout = false;
            update();
        }
        menu.open = false;
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
            home: () => navigate(0),
            end: () => navigate(slides.length - 1),
            o: () => overviewButton.click(),
            p: () => menuActions.querySelector("button")!.click(),
            f: () => (menuActions.children[1] as HTMLButtonElement).click(),
            l: () => laserButton.click(),
            b: () => blackoutButton.click(),
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
const timerInterval = setInterval(timerText, 250);
window.addEventListener("pagehide", () => {
    channel?.close();
    observer.disconnect();
    clearInterval(timerInterval);
});
document.body.classList.toggle("is-presenter", presenter);
document.documentElement.style.setProperty(
    "--presenit-fragment-duration",
    config.animation.duration + "s",
);
document.documentElement.style.setProperty(
    "--presenit-anim-duration",
    config.animation.duration + "s",
);
document.documentElement.classList.add("presenit-ready");
update(false);
channel?.postMessage({ type: "hello" });
// Remove inert for printing so hidden reveal content remains accessible to print engines.
window.addEventListener("beforeprint", () =>
    slides.forEach((slide) => {
        slide.inert = false;
        slide.querySelectorAll<HTMLElement>("[inert]").forEach((node) => {
            node.inert = false;
        });
    }),
);
window.addEventListener("afterprint", () => update(false));
printButton.setAttribute("aria-description", "ブラウザの印刷画面でPDFとして保存します。");
export {};
