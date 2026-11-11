import { defineConfig } from "vite";
import { presenit } from "@ayaexptech/presenit";

export default defineConfig({
    plugins: [presenit({ decks: { intro: "intro.md", "team/update": "update.md" } })],
});
