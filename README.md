# synapse

Model capability matrix, fuzzy resolver, task classifier, and selection
algorithm for [pi-ai](https://github.com/nicobrinkkemper/pi-ai) models.

## Install

```bash
npm install synapse
```

Requires `@mariozechner/pi-ai` as a peer dependency.

## Usage

```typescript
import {
  classifyTask,
  resolveModelFuzzy,
  selectModels,
  MODEL_MATRIX,
} from "synapse";

// Fuzzy resolve a human-friendly model name
const model = resolveModelFuzzy("opus");
// → { provider: "anthropic", id: "claude-opus-4-6", displayName: "anthropic/claude-opus-4-6" }

// Classify a task's type and complexity
const classification = await classifyTask("Refactor the auth module", "code");
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

- `classifyTask(task, primaryType, agentRole?)` — Classify task type and complexity
- `findCheapestModel()` — Find the cheapest available model

### Selector

- `selectModels(classification, costPreference, pool?)` — Rank models for a classified task

## License

MIT
