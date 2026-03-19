import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "isomorphic-dompurify": path.resolve(__dirname, "./__mocks__/isomorphic-dompurify.ts"),
    },
  },
});
