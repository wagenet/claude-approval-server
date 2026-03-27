# Contributing

## Dev setup

```sh
bun install                      # install root deps (Bun)
pnpm --dir frontend install      # install frontend deps

bun run dev                      # API (:4759) + Vite UI (:4200) together

bun test                         # server-side tests
bun run lint && bun run format   # lint + format check
```

- UI: http://localhost:4200
- API Health: http://localhost:4759/health

### Optional port configuration

Set `UI_PORT` to avoid collisions with other local Ember apps that also default to `:4200`:

```sh
UI_PORT=5100 bun run dev
```

### API dev

To run the API server alone (e.g. when testing a production build):

```sh
bun --hot src/index.ts
```

### Frontend dev

The `frontend/` package uses pnpm. To work on the frontend alone:

```sh
pnpm --dir frontend start   # Vite dev server (proxies API to :4759)
pnpm --dir frontend build   # production build → frontend/dist/
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
