# synapse

Model capability matrix, fuzzy resolver, task classifier, and selection
algorithm for [pi-ai](https://github.com/nicobrinkkemper/pi-ai) models.

## Install

```bash
npm install @dungle-scrubs/synapse
```

Requires `@mariozechner/pi-ai` as a peer dependency.

## Usage

```typescript
import {
  buildRouteSignalKey,
  classifyTask,
  resolveModelFuzzy,
  selectModels,
} from "@dungle-scrubs/synapse";

const matrixOverrides = {
  "claude-sonnet-4-5": { code: 2, text: 3, vision: 2 },
};

// Fuzzy resolve a human-friendly model name
const model = resolveModelFuzzy("opus", undefined, undefined, { matrixOverrides });
// → { provider: "anthropic", id: "claude-opus-4-6", displayName: "anthropic/claude-opus-4-6" }

// classifyTask requires injected deps:
// - listModels(): { provider, id, cost: { input, output } }[]
// - complete(provider, modelId, prompt): Promise<string>
const classification = await classifyTask("Refactor the auth module", "code", {
  listModels,
  complete,
});
// → { type: "code", complexity: 3, reasoning: "..." }

// Select ranked models for the task (with optional overrides)
const ranked = selectModels(classification, "balanced", { matrixOverrides });
// → [{ provider: "anthropic", id: "claude-sonnet-4-5-...", ... }, ...]

// Optional score-based routing modes (cheap|fast|balanced|quality|reliable)
const rankedFast = selectModels(classification, "balanced", {
  routingMode: "fast",
  routingSignals: {
    generatedAtMs: Date.now(),
    routes: {
      [buildRouteSignalKey("anthropic", "claude-sonnet-4-5-20250514")]: {
        latencyP90Ms: 420,
        observedAtMs: Date.now(),
        uptime: 0.995
      }
    }
  }
});
```

## Routing signal contract

Canonical keys used by selector lookups:

- Route keys: `provider/modelId` (lowercase)
- Model keys: `modelId` (lowercase)
- Provider-scoped model keys: `provider/modelId` (lowercase)

Use helpers to build keys instead of hand-assembling strings:

- `buildRouteSignalKey(provider, modelId)`
- `buildModelSignalKey(modelId)`
- `buildProviderModelSignalKey(provider, modelId)`

Runtime sanitization behavior:

- `sanitizeRoutingSignalsSnapshot(input)` drops invalid entries/fields.
- `sanitizeRoutingModePolicyOverride(input)` drops invalid override fields.
- Invalid numeric ranges are ignored (for example uptime outside `[0,1]`).
- Legacy route keys in `provider|modelId` format are normalized.

## CLI

Generate a model-matrix override template users can edit:

```bash
synapse init-overrides ~/.tallow/model-matrix-overrides.json
```

Useful flags:

- `--empty` — generate `{ "matrixOverrides": {} }`
- `--force` — overwrite existing file
- `--stdout` — print JSON to stdout

Generated shape:

```json
{
  "matrixOverrides": {
    "claude-sonnet-4-5": { "code": 4, "vision": 3, "text": 4 }
  }
}
```

Pass `matrixOverrides` into synapse APIs via options.

## API

### Matrix

- `MODEL_MATRIX` — Capability tiers for known models
- `MODEL_ARENA_PRIORS` — Raw LM Arena priors used for within-tier scoring
- `getModelRatings(modelId, options?)` — Look up ratings by model ID (prefix matching)
- `getModelArenaPriors(modelId)` — Look up raw LM Arena priors by model ID
- `modelSupportsTask(modelId, type, minRating, options?)` — Check if a model supports a task type
- `createModelRatingsLookup(options?)` — Build a reusable ratings lookup with optional overrides
- `createModelArenaPriorsLookup()` — Build a reusable raw-priors lookup
- `applyModelMatrixOverrides(baseMatrix, overrides?)` — Merge base matrix and override map
- `parseModelMatrixOverrides(input)` — Parse unknown JSON/settings payload into validated overrides
- `createModelMatrixOverrideTemplate(options?)` — Build override-template object for file generation

### Routing signals

- `buildRouteSignalKey(provider, modelId)` — Build canonical route signal keys
- `parseRouteSignalKey(key)` — Parse canonical/legacy route signal keys
- `buildModelSignalKey(modelId)` — Build canonical model signal keys
- `buildProviderModelSignalKey(provider, modelId)` — Build canonical provider-scoped model keys
- `sanitizeRoutingSignalsSnapshot(input)` — Validate and sanitize telemetry payloads
- `sanitizeRoutingModePolicyOverride(input)` — Validate and sanitize mode-policy overrides

### Resolver

- `resolveModelFuzzy(query, modelSource?, preferredProviders?, options?)` — Fuzzy resolve a name to a single model
- `resolveModelCandidates(query)` — Resolve to all tied candidates
- `listAvailableModels()` — List all registered models

### Classifier

- `classifyTask(task, primaryType, deps, agentRole?)` — Classify task type and complexity
- `findCheapestModel(listModels)` — Find the cheapest available model

### Selector

- `selectModels(classification, costPreference, options?)` — Rank models for a classified task
  - Score-based modes combine matrix tiers with raw LM Arena priors (when available)
  - When `options.matrixOverrides` is provided, capability scoring uses matrix tiers only so overrides fully control ranking
  - `options.routingMode`: score-based mode (`cheap`, `fast`, `balanced`, `quality`, `reliable`)
  - `options.routingSignals`: telemetry snapshot for latency/reliability/throughput scoring
  - `options.routingModePolicyOverride`: partial policy override for the active mode
  - `options.matrixOverrides`: per-model capability override map

## License

MIT
