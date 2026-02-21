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
import { classifyTask, resolveModelFuzzy, selectModels } from "@dungle-scrubs/synapse";

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
      "anthropic/claude-sonnet-4-5-20250514": {
        latencyP90Ms: 420,
        observedAtMs: Date.now(),
        uptime: 0.995
      }
    }
  }
});
```

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

- `MODEL_MATRIX` — Capability ratings for known models
- `getModelRatings(modelId, options?)` — Look up ratings by model ID (prefix matching)
- `modelSupportsTask(modelId, type, minRating, options?)` — Check if a model supports a task type
- `createModelRatingsLookup(options?)` — Build a reusable ratings lookup with optional overrides
- `applyModelMatrixOverrides(baseMatrix, overrides?)` — Merge base matrix and override map
- `parseModelMatrixOverrides(input)` — Parse unknown JSON/settings payload into validated overrides
- `createModelMatrixOverrideTemplate(options?)` — Build override-template object for file generation

### Resolver

- `resolveModelFuzzy(query, modelSource?, preferredProviders?, options?)` — Fuzzy resolve a name to a single model
- `resolveModelCandidates(query)` — Resolve to all tied candidates
- `listAvailableModels()` — List all registered models

### Classifier

- `classifyTask(task, primaryType, deps, agentRole?)` — Classify task type and complexity
- `findCheapestModel(listModels)` — Find the cheapest available model

### Selector

- `selectModels(classification, costPreference, options?)` — Rank models for a classified task
  - `options.routingMode`: score-based mode (`cheap`, `fast`, `balanced`, `quality`, `reliable`)
  - `options.routingSignals`: telemetry snapshot for latency/reliability/throughput scoring
  - `options.routingModePolicyOverride`: partial policy override for the active mode
  - `options.matrixOverrides`: per-model capability override map

## License

MIT
