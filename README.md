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

// Fuzzy resolve a human-friendly model name
const model = resolveModelFuzzy("opus");
// → { provider: "anthropic", id: "claude-opus-4-6", displayName: "anthropic/claude-opus-4-6" }

// classifyTask requires injected deps:
// - listModels(): { provider, id, cost: { input, output } }[]
// - complete(provider, modelId, prompt): Promise<string>
const classification = await classifyTask("Refactor the auth module", "code", {
  listModels,
  complete,
});
// → { type: "code", complexity: 3, reasoning: "..." }

// Select ranked models for the task
const ranked = selectModels(classification, "balanced");
// → [{ provider: "anthropic", id: "claude-sonnet-4-5-...", ... }, ...]
```

## API

### Matrix

- `MODEL_MATRIX` — Capability ratings for known models
- `getModelRatings(modelId)` — Look up ratings by model ID (prefix matching)
- `modelSupportsTask(modelId, type, minRating)` — Check if a model supports a task type

### Resolver

- `resolveModelFuzzy(query)` — Fuzzy resolve a name to a single model
- `resolveModelCandidates(query)` — Resolve to all tied candidates
- `listAvailableModels()` — List all registered models

### Classifier

- `classifyTask(task, primaryType, deps, agentRole?)` — Classify task type and complexity
- `findCheapestModel(listModels)` — Find the cheapest available model

### Selector

- `selectModels(classification, costPreference, pool?)` — Rank models for a classified task

## License

MIT
