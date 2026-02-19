/**
 * synapse — Model capability matrix, fuzzy resolver, task classifier,
 * and selection algorithm for pi-ai models.
 *
 * @module synapse
 */

// Types
export type {
	CandidateModel,
	ClassificationResult,
	CostPreference,
	ModelRatings,
	ModelSource,
	ResolvedModel,
	TaskComplexity,
	TaskType,
} from "./types.js";

// Matrix
export { getModelRatings, MODEL_MATRIX, modelSupportsTask } from "./matrix.js";

// Resolver
export { listAvailableModels, resolveModelCandidates, resolveModelFuzzy } from "./resolver.js";

// Classifier
export { classifyTask, findCheapestModel } from "./classifier.js";
export type { ClassifierModel, CompleteFn, ModelLister } from "./classifier.js";

// Selector
export { selectModels } from "./selector.js";
export type { SelectionOptions } from "./selector.js";
