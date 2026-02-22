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
	ModelArenaScores,
	ModelMatrixOverrides,
	ModelRatings,
	ModelSource,
	ResolvedModel,
	RoutingMode,
	RoutingModeConstraints,
	RoutingModePolicy,
	RoutingModePolicyOverride,
	RoutingModelSignal,
	RoutingRouteSignal,
	RoutingScoreWeights,
	RoutingSignalsSnapshot,
	TaskComplexity,
	TaskType,
} from "./types.js";

// Matrix
export {
	applyModelMatrixOverrides,
	createModelArenaPriorsLookup,
	createModelMatrixOverrideTemplate,
	createModelRatingsLookup,
	getModelArenaPriors,
	getModelRatings,
	MODEL_ARENA_PRIORS,
	MODEL_MATRIX,
	modelSupportsTask,
	parseModelMatrixOverrides,
} from "./matrix.js";
export type {
	CreateModelMatrixOverrideTemplateOptions,
	ModelMatrixOverrideTemplate,
	ModelRatingsLookupOptions,
} from "./matrix.js";

// Routing signal helpers
export {
	buildModelSignalKey,
	buildProviderModelSignalKey,
	buildRouteSignalKey,
	parseRouteSignalKey,
	sanitizeRoutingModePolicyOverride,
	sanitizeRoutingSignalsSnapshot,
} from "./routing-signals.js";
export type { RouteSignalKeyParts } from "./routing-signals.js";

// Resolver
export { listAvailableModels, resolveModelCandidates, resolveModelFuzzy } from "./resolver.js";

// Classifier
export { classifyTask, findCheapestModel } from "./classifier.js";
export type { ClassifierModel, CompleteFn, ModelLister } from "./classifier.js";

// Selector
export { selectModels } from "./selector.js";
export type { SelectionOptions } from "./selector.js";
