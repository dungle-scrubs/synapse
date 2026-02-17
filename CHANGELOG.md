# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
