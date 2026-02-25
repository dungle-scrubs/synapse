# Contributing to synapse

## Development

```bash
bun install
bun run typecheck
bun run lint
bun test
```

## Git hooks

`bun install` runs `prepare`, which installs Husky hooks.

- `pre-commit`: `bun run typecheck`, `bun run lint`, `bun test`
- `pre-push`: `trufflehog git file://. --only-verified`

## Commit conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/)
for automated changelog generation and semantic versioning.

| Prefix | Purpose | Version bump |
|--------|---------|--------------|
| `feat:` | New feature | patch (pre-1.0) |
| `fix:` | Bug fix | patch |
| `feat!:` | Breaking change | minor (pre-1.0) |
| `docs:` | Documentation | changelog only |
| `test:` | Tests | changelog only |
| `chore:` | Maintenance | changelog only |
| `refactor:` | Code cleanup | changelog only |

## Pull requests

1. Fork the repo and create a branch from `main`
2. Add tests for new functionality
3. Ensure `bun run typecheck`, `bun run lint`, and `bun test` all pass
4. Use conventional commit messages
5. Open a PR against `main`
