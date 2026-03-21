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
	parseSynapseConfig,
} from "./matrix.js";
export type {
	CreateModelMatrixOverrideTemplateOptions,
	ModelMatrixOverrideTemplate,
	ModelRatingsLookupOptions,
	SynapseConfig,
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
export type {
	ClassifierModel,
	ClassifyTaskOptions,
	CompleteFn,
	ModelLister,
} from "./classifier.js";

// Selector
export {
	getDefaultModePolicy,
	ROUTING_MODES,
	selectModels,
	selectModelsExplained,
} from "./selector.js";
export type {
	CandidateScore,
	FilterSummary,
	SelectionExplanation,
	SelectionOptions,
	SelectionResult,
} from "./selector.js";

// Utilities
export { buildProviderPreferenceMap, isRecord, providerPriority } from "./utils.js";
