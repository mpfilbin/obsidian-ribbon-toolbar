# Ribbon Bar: notes for Claude

## Versioning

Assume every change bumps the plugin version unless the user says otherwise. Make the bump on the branch you are working on, as its own `chore: update version to X.Y.Z` commit, so it ships in the same PR.

- **New feature:** bump the **minor** version (e.g. 0.18.12 → 0.19.0).
- **Dependency upgrades** (e.g. Dependabot): bump the **patch** version, typically.
- Anything else: use judgment (a bug fix is normally a patch), and say which level you chose.

`npm run release <patch|minor|major>` does the whole bump: it updates `package.json`, `package-lock.json`, `manifest.json` and (when needed) `versions.json`, then commits with a fixed message. If the session requires commit attribution trailers, run the script's steps by hand instead (`npm version <level> --no-git-tag-version`, `node version-bump.mjs`, `npm install`, then commit with the trailers) or amend the commit it made before pushing.

Merging a `manifest.json` change to `master` publishes a GitHub release automatically (see `.github/workflows/release.yml`), so the bump is what triggers a release.

## Before pushing

```bash
npm run typecheck
npm test
```
