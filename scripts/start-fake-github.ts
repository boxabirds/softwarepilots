/**
 * Starts the fake GitHub OAuth server for local development.
 * Reuses the mock from claude-backlog project.
 *
 * Usage: bun run scripts/start-fake-github.ts
 */

import { startFakeGitHub, configureFakeGitHub } from "../../claude-backlog/apps/web/e2e/fixtures/fake-github-server";

const PORT = 9999;

configureFakeGitHub({
  accessibleRepos: [],
  user: {
    id: 99999,
    login: "local-dev-pilot",
    email: "pilot@localhost.dev",
  },
});

await startFakeGitHub({ port: PORT });
console.log(`Fake GitHub server running on http://localhost:${PORT}`);
console.log("User: local-dev-pilot (pilot@localhost.dev)");
console.log("\nTo use: uncomment GITHUB_BASE_URL and GITHUB_API_BASE_URL in packages/api/.dev.vars");
