import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: { alias: { "@": resolve(__dirname, "src/renderer/src") } },
    plugins: [react(), tailwindcss()],
    // Sans cela, Vite remonte jusqu'au postcss.config.js du site (Tailwind v3)
    // à la racine du dépôt, qui ne vaut pas pour ce dossier.
    css: { postcss: { plugins: [] } },
    // L'encodeur MP3 tourne dans un worker, comme sur le site.
    worker: { format: "es" },
  },
});
