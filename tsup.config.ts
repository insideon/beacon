import { defineConfig } from "tsup";
import { cpSync } from "fs";

export default defineConfig({
  entry: ["src/cli/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  splitting: false,
  sourcemap: true,
  onSuccess: async () => {
    cpSync("src/analyzer/prompts", "dist/prompts", { recursive: true });
  },
});
