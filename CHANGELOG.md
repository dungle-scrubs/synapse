# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.9](https://github.com/dungle-scrubs/synapse/compare/synapse-v0.1.8...synapse-v0.1.9) (2026-03-21)


### Added

* add matrix overrides CLI and mode-aware routing ([6d15391](https://github.com/dungle-scrubs/synapse/commit/6d15391680754264a4724781910ff5891e74e257))
* add preferredProviders option to selectModels ([cc04c5b](https://github.com/dungle-scrubs/synapse/commit/cc04c5ba3ba6d31ca9a729553f5fe7e1ca600136))
* harden routing signals and add arena priors ([a3b24ba](https://github.com/dungle-scrubs/synapse/commit/a3b24ba9a82b558599f47385c2705251ff2b8c3d))
* initial synapse package — model matrix, fuzzy resolver, task classifier, selector ([bca16f6](https://github.com/dungle-scrubs/synapse/commit/bca16f6eda40a12631734ce06db90afbc25bd05b))
* **matrix:** add override APIs and init-overrides CLI ([aafd65b](https://github.com/dungle-scrubs/synapse/commit/aafd65ba00dbaab9b18809deb98469a0d714bfe6))
* **matrix:** update arena priors and tiers to 2026-03-06 ([694cfd8](https://github.com/dungle-scrubs/synapse/commit/694cfd829950ab83c868b408e3951e47dd3f3bb2))
* model exclusion patterns for selection ([#11](https://github.com/dungle-scrubs/synapse/issues/11)) ([917665a](https://github.com/dungle-scrubs/synapse/commit/917665a914ce0b13b53fda2ce780d96112f2be70))
* **resolver:** add preferredProviders to resolveModelFuzzy ([412197e](https://github.com/dungle-scrubs/synapse/commit/412197e80cfe74fc9f3a862923e0595c68ca11f5))
* **routing:** harden signals and add arena priors ([22ce93d](https://github.com/dungle-scrubs/synapse/commit/22ce93d8310df983bdde85b4fd6116f290509dec))
* selection observability and classifier model override ([#19](https://github.com/dungle-scrubs/synapse/issues/19)) ([00d9dab](https://github.com/dungle-scrubs/synapse/commit/00d9dab5be88c32b80645d27c768f8cd77d85b04))
* **selector:** add routing modes with telemetry scoring ([5ab5877](https://github.com/dungle-scrubs/synapse/commit/5ab58775650ecb2eecaed8b8add9000424cb02bf))


### Fixed

* add test preload to mock pi-ai peer dependency in CI ([2773bb0](https://github.com/dungle-scrubs/synapse/commit/2773bb0e605dffea0d6906137337693f9230d5b3))
* ambiguous route keys, signal staleness, classifier tie-breaking ([7f1f9e2](https://github.com/dungle-scrubs/synapse/commit/7f1f9e25ea3e47d9e7a36f16e8af247e217fd9c3))
* apply review follow-ups ([a5f313d](https://github.com/dungle-scrubs/synapse/commit/a5f313dc58531655aa74ae351956ce42446495df))
* immutable matrix, defensive copies, routing API, and full test coverage ([#24](https://github.com/dungle-scrubs/synapse/issues/24)) ([b6bc3d5](https://github.com/dungle-scrubs/synapse/commit/b6bc3d55316a8874ca9107cec553499728003e77))
* lazy-load completeSimple to avoid static ESM validation failure ([c4f9e2c](https://github.com/dungle-scrubs/synapse/commit/c4f9e2c5908fbb4bd981d9572cd61ba49eeacf77))
* **resolver:** compare model versions numerically ([416009e](https://github.com/dungle-scrubs/synapse/commit/416009ea337c28618a0c73483f1fde3e724b7e2f))
* scope package name to @dungle-scrubs/synapse ([e55cb46](https://github.com/dungle-scrubs/synapse/commit/e55cb4635b18e57dbebf87a9def75d7504372368))
* **selector:** ignore pooled models without cost ([dcefd17](https://github.com/dungle-scrubs/synapse/commit/dcefd1725cf4970ff0561c930fca7508fc5f201b))
* track bun.lock for reproducible CI installs ([671b1a1](https://github.com/dungle-scrubs/synapse/commit/671b1a137fdd7ba9cce2b33eba78269f546db384))
* use 'bun run test' in CI to pick up preload flag ([71a90ac](https://github.com/dungle-scrubs/synapse/commit/71a90ac19aeb786c9ea9fb55cf47796724717751))


### Changed

* extract shared utilities (isRecord, providerPriority) ([cbd9ca6](https://github.com/dungle-scrubs/synapse/commit/cbd9ca6f4a6ee41ef959d38cc47df008ab36e3e3))
* use dependency injection in classifier instead of pi-ai imports ([a905c90](https://github.com/dungle-scrubs/synapse/commit/a905c90bd9f35d633b443f89254c410f36a09118))


### Documentation

* **readme:** fix usage imports and signatures ([2176395](https://github.com/dungle-scrubs/synapse/commit/21763954ef717ab4a7c5d7d9b99a16b2821b0cd6))


### Maintenance

* cover audit gaps (CLI, priors prefix, staleness, agentRole) ([9c1873d](https://github.com/dungle-scrubs/synapse/commit/9c1873d5720bc046f7275501404fbbe3a5300ddb))
* **git:** ignore AGENTS.md ([9a40927](https://github.com/dungle-scrubs/synapse/commit/9a409275a39d5b699db883ca753439b57218a44b))
* **git:** ignore local .tallow metadata ([7854ca2](https://github.com/dungle-scrubs/synapse/commit/7854ca213939e149c6a1277ba784e56b1eefbe57))
* harden release + add routing brand assets ([#10](https://github.com/dungle-scrubs/synapse/issues/10)) ([f89d26f](https://github.com/dungle-scrubs/synapse/commit/f89d26f04c7d4b615465ef4060d7556a4a2fca7f))
* **main:** release synapse 0.1.1 ([#1](https://github.com/dungle-scrubs/synapse/issues/1)) ([2e4c399](https://github.com/dungle-scrubs/synapse/commit/2e4c39966744094c238a85666d11b00ab27f89d3))
* **main:** release synapse 0.1.2 ([#2](https://github.com/dungle-scrubs/synapse/issues/2)) ([eba8726](https://github.com/dungle-scrubs/synapse/commit/eba87269b6797f5e79e0ec064159218ca6cfcdef))
* **main:** release synapse 0.1.3 ([#3](https://github.com/dungle-scrubs/synapse/issues/3)) ([cc01ff5](https://github.com/dungle-scrubs/synapse/commit/cc01ff51f70122e5ba410d2489907d4796cee986))
* **main:** release synapse 0.1.4 ([cc92df1](https://github.com/dungle-scrubs/synapse/commit/cc92df1110396f2ed700cbb513a5c85f06ebc09a))
* **main:** release synapse 0.1.4 ([07b8263](https://github.com/dungle-scrubs/synapse/commit/07b82635d284e68425128452a9beb00b3da16db6))
* **main:** release synapse 0.1.5 ([67b933a](https://github.com/dungle-scrubs/synapse/commit/67b933a0670714f68bec12b183391fd57176a05a))
* **main:** release synapse 0.1.5 ([acc741e](https://github.com/dungle-scrubs/synapse/commit/acc741e2442ba8561379be1ea403b76fc45bc9d9))
* **main:** release synapse 0.1.6 ([#16](https://github.com/dungle-scrubs/synapse/issues/16)) ([d2757e0](https://github.com/dungle-scrubs/synapse/commit/d2757e07f925a9ea8cffc9191ef8536259e6eb0c))
* **main:** release synapse 0.1.7 ([#18](https://github.com/dungle-scrubs/synapse/issues/18)) ([613a582](https://github.com/dungle-scrubs/synapse/commit/613a5829c7ee698a6601b3fd2339dd24a5e650dd))
* **main:** release synapse 0.1.8 ([#25](https://github.com/dungle-scrubs/synapse/issues/25)) ([fa9b9c3](https://github.com/dungle-scrubs/synapse/commit/fa9b9c34362d49bd2247d2da75a73c8ed48eaab6))
* prepare for public release ([2b1c208](https://github.com/dungle-scrubs/synapse/commit/2b1c2086ac1699da66c3f219ed0eda9c9b61d727))
* **release:** dedupe 0.1.5 changelog entries ([e460e02](https://github.com/dungle-scrubs/synapse/commit/e460e0206f78adce59df74fc187b2be5396f9e4e))
* retrigger release-please ([ac54a1c](https://github.com/dungle-scrubs/synapse/commit/ac54a1c3121718914d09695eba262acb72eb20de))

## [0.1.8](https://github.com/dungle-scrubs/synapse/compare/synapse-v0.1.7...synapse-v0.1.8) (2026-03-21)


### Fixed

* immutable matrix, defensive copies, routing API, and full test coverage ([#24](https://github.com/dungle-scrubs/synapse/issues/24)) ([b6bc3d5](https://github.com/dungle-scrubs/synapse/commit/b6bc3d55316a8874ca9107cec553499728003e77))

## [0.1.7](https://github.com/dungle-scrubs/synapse/compare/synapse-v0.1.6...synapse-v0.1.7) (2026-03-06)


### Added

* **matrix:** update arena priors and tiers to 2026-03-06 ([694cfd8](https://github.com/dungle-scrubs/synapse/commit/694cfd829950ab83c868b408e3951e47dd3f3bb2))
* selection observability and classifier model override ([#19](https://github.com/dungle-scrubs/synapse/issues/19)) ([00d9dab](https://github.com/dungle-scrubs/synapse/commit/00d9dab5be88c32b80645d27c768f8cd77d85b04))


### Fixed

* ambiguous route keys, signal staleness, classifier tie-breaking ([7f1f9e2](https://github.com/dungle-scrubs/synapse/commit/7f1f9e25ea3e47d9e7a36f16e8af247e217fd9c3))


### Changed

* extract shared utilities (isRecord, providerPriority) ([cbd9ca6](https://github.com/dungle-scrubs/synapse/commit/cbd9ca6f4a6ee41ef959d38cc47df008ab36e3e3))


### Maintenance

* cover audit gaps (CLI, priors prefix, staleness, agentRole) ([9c1873d](https://github.com/dungle-scrubs/synapse/commit/9c1873d5720bc046f7275501404fbbe3a5300ddb))

## [0.1.6](https://github.com/dungle-scrubs/synapse/compare/synapse-v0.1.5...synapse-v0.1.6) (2026-02-25)


### Added

* model exclusion patterns for selection ([#11](https://github.com/dungle-scrubs/synapse/issues/11)) ([917665a](https://github.com/dungle-scrubs/synapse/commit/917665a914ce0b13b53fda2ce780d96112f2be70))


### Maintenance

* harden release + add routing brand assets ([#10](https://github.com/dungle-scrubs/synapse/issues/10)) ([f89d26f](https://github.com/dungle-scrubs/synapse/commit/f89d26f04c7d4b615465ef4060d7556a4a2fca7f))
* retrigger release-please ([ac54a1c](https://github.com/dungle-scrubs/synapse/commit/ac54a1c3121718914d09695eba262acb72eb20de))

## [0.1.5](https://github.com/dungle-scrubs/synapse/compare/synapse-v0.1.4...synapse-v0.1.5) (2026-02-22)


### Added

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
