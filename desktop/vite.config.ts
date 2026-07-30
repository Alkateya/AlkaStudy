import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname),
  base: "./",
  publicDir: resolve(__dirname, "../public"),
  plugins: [react()],
  css: { postcss: {} },
  build: { outDir: resolve(__dirname, "../dist-desktop"), emptyOutDir: true },
});
