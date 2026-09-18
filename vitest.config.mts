import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Samakan alias "@/..." dengan paths di tsconfig.json.
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) }],
  },
  test: {
    // Belum ada tes; yang pertama datang dari rules engine (docs-20 §2.4).
    passWithNoTests: true,
  },
});
