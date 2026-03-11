import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      environment: "jsdom",
      setupFiles: ["./src/test-setup.ts"],
    },
  })
);
