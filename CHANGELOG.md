# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.5](https://github.com/dungle-scrubs/synapse/compare/synapse-v0.1.4...synapse-v0.1.5) (2026-02-22)


### Added

* harden routing signals and add arena priors ([a3b24ba](https://github.com/dungle-scrubs/synapse/commit/a3b24ba9a82b558599f47385c2705251ff2b8c3d))
* **routing:** harden signals and add arena priors ([22ce93d](https://github.com/dungle-scrubs/synapse/commit/22ce93d8310df983bdde85b4fd6116f290509dec))


### Maintenance

* **git:** ignore AGENTS.md ([9a40927](https://github.com/dungle-scrubs/synapse/commit/9a409275a39d5b699db883ca753439b57218a44b))
* **git:** ignore local .tallow metadata ([7854ca2](https://github.com/dungle-scrubs/synapse/commit/7854ca213939e149c6a1277ba784e56b1eefbe57))

## [0.1.4](https://github.com/dungle-scrubs/synapse/compare/synapse-v0.1.3...synapse-v0.1.4) (2026-02-21)


### Added

* add matrix overrides CLI and mode-aware routing ([a6e465d](https://github.com/dungle-scrubs/synapse/commit/a6e465ddc4d465fee094eca45e94e41fb2653f0a))
* **matrix:** add override APIs and init-overrides CLI ([dec06d3](https://github.com/dungle-scrubs/synapse/commit/dec06d3259a906386869bf6c792dfd67d33b90d5))
* **selector:** add routing modes with telemetry scoring ([06478c3](https://github.com/dungle-scrubs/synapse/commit/06478c3fa6efe659843053dbd535b4f9163a2345))


### Fixed

* apply review follow-ups ([7bceb61](https://github.com/dungle-scrubs/synapse/commit/7bceb61eb2ee8c6073d5c76d99f38a73aa976877))
* **resolver:** compare model versions numerically ([31b30d4](https://github.com/dungle-scrubs/synapse/commit/31b30d434382d0e04b12f4a55526e6b35c0e6c24))
* **selector:** ignore pooled models without cost ([7431925](https://github.com/dungle-scrubs/synapse/commit/7431925635ead553a9e4698d9bc4f5ec5b0d3bc4))


### Documentation

* **readme:** fix usage imports and signatures ([5f96e97](https://github.com/dungle-scrubs/synapse/commit/5f96e97651a40cec4fddd70286b7a3d1115803ae))

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
