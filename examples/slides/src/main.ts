// A deck list page built from the presenit() plugin's metadata.
import { decks } from "virtual:presenit/decks";

const list = document.querySelector<HTMLUListElement>("#decks")!;
list.replaceChildren(
    ...decks.map((deck) => {
        const item = document.createElement("li");
        item.className = "deck";
        item.dataset.theme = deck.theme;
        item.style.setProperty("--hue", String(deck.hue));
        item.style.setProperty("--ratio", `${deck.width} / ${deck.height}`);

        const link = document.createElement("a");
        link.href = deck.url;
        link.textContent = deck.title;
        const heading = document.createElement("h2");
        heading.append(link);

        const details = document.createElement("p");
        details.className = "meta";
        details.textContent = `${deck.slideCount} slide${deck.slideCount === 1 ? "" : "s"} · ${deck.source}`;

        item.append(heading, details);
        if (deck.description) {
            const description = document.createElement("p");
            description.textContent = deck.description;
            item.append(description);
        }
        return item;
    }),
);
