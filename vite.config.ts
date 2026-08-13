import { defineConfig } from "vite";

export default defineConfig({
  base: "/Out_Of_Focus/",
  build: {
    target: "es2022",
    outDir: "dist",
  },
  server: {
    port: 5173,
    open: true,
  },
});
