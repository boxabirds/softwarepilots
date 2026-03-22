# Software Pilots

## Package manager

**Use `bun` exclusively.** Never use `npm`, `yarn`, or `pnpm` in this project. All commands must use `bun run`, `bun install`, `bun add`, etc.

## Setup

After cloning, run: `git config core.hooksPath scripts/hooks`

This enables the shared git hooks (e.g., story-tagging reminders on commit).

## Commit conventions

Every commit must be tagged with its Ceetrix story ID(s) using git notes:

```
git notes --ref=stories add -m "stories: 57" HEAD
git push origin refs/notes/stories
```

The post-commit hook will remind you if a tag is missing.
