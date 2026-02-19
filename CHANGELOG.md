# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3](https://github.com/dungle-scrubs/synapse/compare/synapse-v0.1.2...synapse-v0.1.3) (2026-02-19)


### Added

* **resolver:** add preferredProviders to resolveModelFuzzy ([ec614b1](https://github.com/dungle-scrubs/synapse/commit/ec614b119e4deccf68974f2a465ad51c5518088a))

## [0.1.2](https://github.com/dungle-scrubs/synapse/compare/synapse-v0.1.1...synapse-v0.1.2) (2026-02-19)


### Added

* add preferredProviders option to selectModels ([aacae3e](https://github.com/dungle-scrubs/synapse/commit/aacae3e958cc166fc357522b63db2fee492c74f9))

## [0.1.1](https://github.com/dungle-scrubs/synapse/compare/synapse-v0.1.0...synapse-v0.1.1) (2026-02-17)


### Added

* initial synapse package — model matrix, fuzzy resolver, task classifier, selector ([bca16f6](https://github.com/dungle-scrubs/synapse/commit/bca16f6eda40a12631734ce06db90afbc25bd05b))


### Fixed

* add test preload to mock pi-ai peer dependency in CI ([2773bb0](https://github.com/dungle-scrubs/synapse/commit/2773bb0e605dffea0d6906137337693f9230d5b3))
* lazy-load completeSimple to avoid static ESM validation failure ([c4f9e2c](https://github.com/dungle-scrubs/synapse/commit/c4f9e2c5908fbb4bd981d9572cd61ba49eeacf77))
* scope package name to @dungle-scrubs/synapse ([e55cb46](https://github.com/dungle-scrubs/synapse/commit/e55cb4635b18e57dbebf87a9def75d7504372368))
* track bun.lock for reproducible CI installs ([671b1a1](https://github.com/dungle-scrubs/synapse/commit/671b1a137fdd7ba9cce2b33eba78269f546db384))
* use 'bun run test' in CI to pick up preload flag ([71a90ac](https://github.com/dungle-scrubs/synapse/commit/71a90ac19aeb786c9ea9fb55cf47796724717751))


### Changed

* use dependency injection in classifier instead of pi-ai imports ([a905c90](https://github.com/dungle-scrubs/synapse/commit/a905c90bd9f35d633b443f89254c410f36a09118))


### Maintenance

* prepare for public release ([2b1c208](https://github.com/dungle-scrubs/synapse/commit/2b1c2086ac1699da66c3f219ed0eda9c9b61d727))

## [0.1.0](https://github.com/dungle-scrubs/synapse/releases/tag/v0.1.0) (2026-02-17)

### Added

- **matrix:** `MODEL_MATRIX` capability ratings for 30+ models across code, vision, text
- **matrix:** `getModelRatings` with longest-prefix matching and provider stripping
- **matrix:** `modelSupportsTask` for capability/complexity filtering
- **resolver:** `resolveModelFuzzy` with 6-tier resolution cascade (exact → case-insensitive →
  normalized → provider/id → token overlap → substring)
- **resolver:** `resolveModelCandidates` for scoped routing (returns all tied matches)
- **resolver:** `listAvailableModels` for error messages
- **classifier:** `classifyTask` using in-process `completeSimple` instead of CLI subprocess
- **classifier:** `findCheapestModel` by effective cost
- **selector:** `selectModels` with eco/balanced/premium cost preference sorting
