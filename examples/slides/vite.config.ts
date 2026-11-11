import { defineConfig } from "vite";
import presenit from "../../mod.ts";
export default defineConfig({ plugins: [presenit({ includes: ["src/**/*.md"] })] });
