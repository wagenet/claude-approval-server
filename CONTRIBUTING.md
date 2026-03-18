# Contributing

## Dev setup

```sh
bun install
bun run index.ts   # server at http://localhost:4759
bun test
bun run lint
bun run format
```

## Conventional commits

This project uses [release-please](https://github.com/googleapis/release-please) for automated releases. Commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

- `feat: ...` — new feature (minor version bump)
- `fix: ...` — bug fix (patch version bump)
- `chore: ...` — maintenance, no version bump
- `feat!:` or `fix!:` — breaking change (major version bump)

## Release flow

1. Merge conventional commits to `main`
2. release-please opens a "Release vX.Y.Z" PR with an updated `CHANGELOG.md` and `package.json` version
3. Review and merge the release PR
4. A tag is created → CI builds macOS binaries (arm64 + x86_64), uploads them to the GitHub release, and updates the Homebrew formula automatically
