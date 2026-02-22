/**
 * Model selection algorithm.
 *
 * Given a classified task and cost preference, ranks available models
 * by suitability. Consumers use the first result and fall back to the rest.
 */

import { getModels, getProviders } from "@mariozechner/pi-ai";
import { createModelArenaPriorsLookup, createModelRatingsLookup } from "./matrix.js";
import {
	buildModelSignalKey,
	buildProviderModelSignalKey,
	buildRouteSignalKey,
	sanitizeRoutingModePolicyOverride,
	sanitizeRoutingSignalsSnapshot,
} from "./routing-signals.js";
import type {
	ClassificationResult,
	CostPreference,
	ModelArenaScores,
	ModelMatrixOverrides,
	ModelRatings,
	ResolvedModel,
	RoutingMode,
	RoutingModePolicy,
	RoutingModePolicyOverride,
	RoutingModelSignal,
	RoutingRouteSignal,
	RoutingSignalsSnapshot,
	TaskType,
} from "./types.js";

/** Model candidate with resolved identity and cost. */
interface ScoredCandidate {
	arenaScores?: ModelArenaScores;
	effectiveCost: number;
	ratings: ModelRatings;
	resolved: ResolvedModel;
}

/** Candidate decorated with a mode-aware aggregate score. */
interface ModeScoredCandidate extends ScoredCandidate {
	score: number;
}

/** Ratings lookup function type. */
type RatingsLookup = (modelId: string) => ModelRatings | undefined;

/** Built-in routing-mode policies. */
const DEFAULT_MODE_POLICIES: Readonly<Record<RoutingMode, RoutingModePolicy>> = {
	balanced: {
		complexityBias: 0,
		constraints: { maxErrorRate: 0.08, minUptime: 0.92 },
		taskFloors: { code: 2, text: 2, vision: 2 },
		weights: { capability: 0.5, cost: 0.05, latency: 0.15, reliability: 0.2, throughput: 0.1 },
	},
	cheap: {
		complexityBias: -1,
		constraints: { maxErrorRate: 0.1, minUptime: 0.88 },
		taskFloors: { code: 1, text: 1, vision: 1 },
		weights: {
			capability: 0.25,
			cost: 0.45,
			latency: 0.1,
			reliability: 0.15,
			throughput: 0.05,
		},
	},
	fast: {
		complexityBias: 0,
		constraints: { maxLatencyP90Ms: 4_000, maxErrorRate: 0.1, minUptime: 0.9 },
		taskFloors: { code: 2, text: 2, vision: 2 },
		weights: {
			capability: 0.25,
			cost: 0.05,
			latency: 0.45,
			reliability: 0.15,
			throughput: 0.1,
		},
	},
	quality: {
		complexityBias: 1,
		constraints: { maxErrorRate: 0.06, minUptime: 0.94 },
		taskFloors: { code: 3, text: 3, vision: 3 },
		weights: {
			capability: 0.65,
			cost: 0.02,
			latency: 0.08,
			reliability: 0.2,
			throughput: 0.05,
		},
	},
	reliable: {
		complexityBias: 0,
		constraints: { maxErrorRate: 0.03, minUptime: 0.97 },
		taskFloors: { code: 2, text: 2, vision: 2 },
		weights: {
			capability: 0.3,
			cost: 0.05,
			latency: 0.1,
			reliability: 0.5,
			throughput: 0.05,
		},
	},
} as const;

/** Options for model selection. */
export interface SelectionOptions {
	/** Optional per-model matrix overrides from host configuration. */
	matrixOverrides?: ModelMatrixOverrides;
	/** Pre-resolved model pool for scoped routing. */
	pool?: ResolvedModel[];
	/**
	 * Providers to prefer when models tie on cost/rating.
	 *
	 * When two candidates have equal sort priority (same cost in eco/premium,
	 * same rating+cost in balanced), candidates whose provider appears in this
	 * list sort first. Earlier entries have higher priority.
	 *
	 * Typical use: pass subscription-backed providers (e.g. "openai-codex",
	 * "github-copilot") so they're preferred over pay-per-token API providers
	 * at equal capability.
	 */
	preferredProviders?: string[];
	/** Optional mode policy override merged into the active mode. */
	routingModePolicyOverride?: RoutingModePolicyOverride;
	/** Optional score-based routing mode. Falls back to legacy sort when absent. */
	routingMode?: RoutingMode;
	/** Optional telemetry snapshot used by score-based modes. */
	routingSignals?: RoutingSignalsSnapshot;
}

/**
 * Clamp a number into an inclusive range.
 *
 * @param value - Input value
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Clamped value
 */
function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * Build provider preference lookup map.
 *
 * @param preferredProviders - Ordered preferred provider names
 * @returns Provider name to priority index lookup
 */
function buildProviderPreferenceMap(preferredProviders?: string[]): Map<string, number> {
	const prefMap = new Map<string, number>();
	if (!preferredProviders) return prefMap;
	for (let i = 0; i < preferredProviders.length; i++) {
		prefMap.set(preferredProviders[i], i);
	}
	return prefMap;
}

/**
 * Resolve provider priority from the preference map.
 *
 * @param prefMap - Provider priority map
 * @param provider - Provider to score
 * @returns Priority index (lower is better)
 */
function providerPriority(prefMap: ReadonlyMap<string, number>, provider: string): number {
	return prefMap.get(provider) ?? Number.POSITIVE_INFINITY;
}

/**
 * Merge a built-in mode policy with a partial override.
 *
 * @param mode - Active routing mode
 * @param override - Optional partial override
 * @returns Effective mode policy
 */
function getEffectiveModePolicy(
	mode: RoutingMode,
	override?: RoutingModePolicyOverride
): RoutingModePolicy {
	const base = DEFAULT_MODE_POLICIES[mode];
	return {
		complexityBias: override?.complexityBias ?? base.complexityBias,
		constraints: { ...base.constraints, ...override?.constraints },
		taskFloors: { ...base.taskFloors, ...override?.taskFloors },
		weights: { ...base.weights, ...override?.weights },
	};
}

/**
 * Build a lookup of effective costs keyed by "provider/id".
 *
 * @returns Map of model key to effective cost
 */
function buildCostIndex(): Map<string, number> {
	const index = new Map<string, number>();
	for (const provider of getProviders()) {
		for (const model of getModels(provider)) {
			index.set(`${model.provider}/${model.id}`, (model.cost.input + model.cost.output) / 2);
		}
	}
	return index;
}

/**
 * Enumerate all models from the registry with ratings, priors, and costs.
 *
 * @param getRatings - Ratings lookup function
 * @param getArenaPriors - Raw LM Arena priors lookup function
 * @returns Array of candidates that exist in the capability matrix
 */
function enumerateCandidates(
	getRatings: RatingsLookup,
	getArenaPriors: (modelId: string) => ModelArenaScores | undefined
): ScoredCandidate[] {
	const candidates: ScoredCandidate[] = [];
	for (const provider of getProviders()) {
		for (const model of getModels(provider)) {
			const ratings = getRatings(model.id);
			if (!ratings) continue;
			candidates.push({
				arenaScores: getArenaPriors(model.id),
				effectiveCost: (model.cost.input + model.cost.output) / 2,
				ratings,
				resolved: {
					displayName: `${model.provider}/${model.id}`,
					id: model.id,
					provider: model.provider,
				},
			});
		}
	}
	return candidates;
}

/**
 * Convert a pre-resolved pool into scored candidates.
 *
 * Used for scoped routing: takes fuzzy-matched models and enriches them
 * with ratings, priors, and cost data so they can be filtered/sorted by
 * `selectModels`.
 *
 * @param pool - Pre-resolved models to convert
 * @param getRatings - Ratings lookup function
 * @param getArenaPriors - Raw LM Arena priors lookup function
 * @returns Scored candidates (only those with matrix ratings and registry costs)
 */
function candidatesFromPool(
	pool: ResolvedModel[],
	getRatings: RatingsLookup,
	getArenaPriors: (modelId: string) => ModelArenaScores | undefined
): ScoredCandidate[] {
	const candidates: ScoredCandidate[] = [];
	const costIndex = buildCostIndex();
	for (const resolved of pool) {
		const ratings = getRatings(resolved.id);
		if (!ratings) continue;
		const effectiveCost = costIndex.get(`${resolved.provider}/${resolved.id}`);
		if (effectiveCost === undefined) continue;
		candidates.push({
			arenaScores: getArenaPriors(resolved.id),
			effectiveCost,
			ratings,
			resolved,
		});
	}
	return candidates;
}

/**
 * Resolve a route signal for a candidate from a telemetry snapshot.
 *
 * Keys are canonicalized at sanitization time, so lookup here is strict and
 * deterministic (`provider/modelId` lowercase).
 *
 * @param candidate - Candidate model
 * @param signals - Optional telemetry snapshot
 * @returns Route signal when present
 */
function getRouteSignal(
	candidate: ScoredCandidate,
	signals?: RoutingSignalsSnapshot
): RoutingRouteSignal | undefined {
	const routes = signals?.routes;
	if (!routes) return undefined;
	const routeKey = buildRouteSignalKey(candidate.resolved.provider, candidate.resolved.id);
	return routes[routeKey];
}

/**
 * Resolve a model-level signal for a candidate from a telemetry snapshot.
 *
 * Matching order:
 * 1. canonical model key (`modelId`)
 * 2. canonical provider-scoped model key (`provider/modelId`)
 * 3. longest model-prefix key (`modelId` prefix)
 *
 * @param candidate - Candidate model
 * @param signals - Optional telemetry snapshot
 * @returns Model signal when present
 */
function getModelSignal(
	candidate: ScoredCandidate,
	signals?: RoutingSignalsSnapshot
): RoutingModelSignal | undefined {
	const models = signals?.models;
	if (!models) return undefined;

	const modelKey = buildModelSignalKey(candidate.resolved.id);
	if (models[modelKey]) return models[modelKey];

	const providerModelKey = buildProviderModelSignalKey(
		candidate.resolved.provider,
		candidate.resolved.id
	);
	if (models[providerModelKey]) return models[providerModelKey];

	const matchingPrefix = Object.keys(models)
		.filter((key) => modelKey.startsWith(key))
		.sort((a, b) => b.length - a.length)[0];

	return matchingPrefix ? models[matchingPrefix] : undefined;
}

/**
 * Convert optional reliability fields into a normalized [0,1] score.
 *
 * @param routeSignal - Optional route-level signal
 * @returns Reliability score where 1 is best
 */
function reliabilityScore(routeSignal?: RoutingRouteSignal): number {
	const uptimeScore = routeSignal?.uptime === undefined ? 0.5 : clamp(routeSignal.uptime, 0, 1);
	const errorScore =
		routeSignal?.errorRate === undefined ? 0.5 : clamp(1 - routeSignal.errorRate, 0, 1);
	const fallbackScore =
		routeSignal?.fallbackRate === undefined ? 0.5 : clamp(1 - routeSignal.fallbackRate, 0, 1);
	return (uptimeScore + errorScore + fallbackScore) / 3;
}

/**
 * Convert optional latency fields into a normalized [0,1] score.
 *
 * @param routeSignal - Optional route-level signal
 * @param modelSignal - Optional model-level signal
 * @returns Latency score where 1 is best
 */
function latencyScore(routeSignal?: RoutingRouteSignal, modelSignal?: RoutingModelSignal): number {
	const latencyMs =
		routeSignal?.latencyP90Ms ?? routeSignal?.latencyP50Ms ?? modelSignal?.ttftMedianMs;
	if (latencyMs === undefined) return 0.5;
	return clamp(1 / (1 + latencyMs / 1000), 0, 1);
}

/**
 * Convert optional throughput fields into a normalized [0,1] score.
 *
 * @param routeSignal - Optional route-level signal
 * @param modelSignal - Optional model-level signal
 * @returns Throughput score where 1 is best
 */
function throughputScore(
	routeSignal?: RoutingRouteSignal,
	modelSignal?: RoutingModelSignal
): number {
	const tokensPerSecond =
		routeSignal?.throughputP50Tps ?? routeSignal?.throughputP90Tps ?? modelSignal?.outputTpsMedian;
	if (tokensPerSecond === undefined) return 0.5;
	return clamp(tokensPerSecond / (tokensPerSecond + 50), 0, 1);
}

/**
 * Convert candidate cost into normalized [0,1] score, where cheaper is better.
 *
 * Uses reciprocal scaling so very cheap models remain clearly preferred even
 * when expensive frontier models are also present in the candidate set.
 *
 * @param effectiveCost - Candidate effective cost
 * @returns Cost score where 1 is cheapest
 */
function costScore(effectiveCost: number): number {
	return clamp(1 / (1 + Math.max(0, effectiveCost)), 0, 1);
}

/** Tier boundaries per task type used for raw-LM-Arena normalization. */
const ARENA_TIER_BOUNDARIES: Readonly<Record<TaskType, readonly [number, number, number, number]>> =
	{
		code: [1180, 1280, 1370, 1440],
		text: [1320, 1370, 1410, 1460],
		vision: [1100, 1150, 1200, 1250],
	} as const;

/**
 * Normalize a raw LM Arena prior into [0,1] using tier boundaries.
 *
 * This preserves the existing 5-tier structure while adding within-tier
 * resolution so close models don't collapse to identical capability scores.
 *
 * @param taskType - Task type
 * @param rawScore - Raw LM Arena score for this task
 * @returns Normalized capability in [0,1]
 */
function normalizeArenaPrior(taskType: TaskType, rawScore: number): number {
	const [tier2, tier3, tier4, tier5] = ARENA_TIER_BOUNDARIES[taskType];

	if (rawScore < tier2) {
		return clamp((rawScore / tier2) * 0.2, 0, 0.2);
	}
	if (rawScore < tier3) {
		return clamp(0.2 + ((rawScore - tier2) / (tier3 - tier2)) * 0.2, 0.2, 0.4);
	}
	if (rawScore < tier4) {
		return clamp(0.4 + ((rawScore - tier3) / (tier4 - tier3)) * 0.2, 0.4, 0.6);
	}
	if (rawScore < tier5) {
		return clamp(0.6 + ((rawScore - tier4) / (tier5 - tier4)) * 0.2, 0.6, 0.8);
	}

	const topBandWidth = tier5 - tier4;
	return clamp(0.8 + ((rawScore - tier5) / topBandWidth) * 0.2, 0.8, 1);
}

/**
 * Resolve capability component score using raw priors when available.
 *
 * Fallback is the coarse matrix tier score (`rating / 5`).
 *
 * @param taskType - Task type
 * @param taskRating - Matrix tier rating (1..5)
 * @param arenaScore - Optional raw LM Arena score for this task
 * @returns Capability component in [0,1]
 */
function capabilityComponentScore(
	taskType: TaskType,
	taskRating: number,
	arenaScore?: number
): number {
	if (arenaScore !== undefined) {
		return normalizeArenaPrior(taskType, arenaScore);
	}
	return clamp(taskRating / 5, 0, 1);
}

/**
 * Check hard mode constraints against route telemetry.
 *
 * Missing telemetry never fails a candidate; constraints are only enforced
 * when the relevant signal exists.
 *
 * @param candidate - Candidate model
 * @param policy - Effective mode policy
 * @param signals - Optional telemetry snapshot
 * @returns true when candidate passes hard constraints
 */
function passesModeConstraints(
	candidate: ScoredCandidate,
	policy: RoutingModePolicy,
	signals?: RoutingSignalsSnapshot
): boolean {
	const routeSignal = getRouteSignal(candidate, signals);
	if (!routeSignal) return true;

	if (
		policy.constraints?.maxLatencyP90Ms !== undefined &&
		routeSignal.latencyP90Ms !== undefined &&
		routeSignal.latencyP90Ms > policy.constraints.maxLatencyP90Ms
	) {
		return false;
	}

	if (
		policy.constraints?.maxErrorRate !== undefined &&
		routeSignal.errorRate !== undefined &&
		routeSignal.errorRate > policy.constraints.maxErrorRate
	) {
		return false;
	}

	if (
		policy.constraints?.minUptime !== undefined &&
		routeSignal.uptime !== undefined &&
		routeSignal.uptime < policy.constraints.minUptime
	) {
		return false;
	}

	return true;
}

/**
 * Compute a weighted routing score for a candidate under a mode policy.
 *
 * @param candidate - Candidate to score
 * @param taskType - Classified task type
 * @param policy - Effective routing mode policy
 * @param signals - Optional telemetry snapshot
 * @returns Aggregate weighted score (higher is better)
 */
function computeModeScore(
	candidate: ScoredCandidate,
	taskType: TaskType,
	policy: RoutingModePolicy,
	signals: RoutingSignalsSnapshot | undefined
): number {
	const routeSignal = getRouteSignal(candidate, signals);
	const modelSignal = getModelSignal(candidate, signals);
	const taskRating = candidate.ratings[taskType] ?? 0;
	const arenaScore = candidate.arenaScores?.[taskType];

	const capability = capabilityComponentScore(taskType, taskRating, arenaScore);
	const reliability = reliabilityScore(routeSignal);
	const latency = latencyScore(routeSignal, modelSignal);
	const throughput = throughputScore(routeSignal, modelSignal);
	const cost = costScore(candidate.effectiveCost);

	return (
		policy.weights.capability * capability +
		policy.weights.reliability * reliability +
		policy.weights.latency * latency +
		policy.weights.throughput * throughput +
		policy.weights.cost * cost
	);
}

/**
 * Sort candidates using legacy cost-preference behavior.
 *
 * @param candidates - Candidate list
 * @param costPreference - Cost preference for ordering
 * @param taskType - Classified task type
 * @param complexity - Classified complexity
 * @param prefMap - Provider preference map
 * @returns Sorted candidates
 */
function sortLegacy(
	candidates: ScoredCandidate[],
	costPreference: CostPreference,
	taskType: TaskType,
	complexity: number,
	prefMap: ReadonlyMap<string, number>
): ScoredCandidate[] {
	return [...candidates].sort((a, b) => {
		if (costPreference === "eco") {
			const costDiff = a.effectiveCost - b.effectiveCost;
			if (costDiff !== 0) return costDiff;
			return (
				providerPriority(prefMap, a.resolved.provider) -
				providerPriority(prefMap, b.resolved.provider)
			);
		}
		if (costPreference === "premium") {
			const costDiff = b.effectiveCost - a.effectiveCost;
			if (costDiff !== 0) return costDiff;
			return (
				providerPriority(prefMap, a.resolved.provider) -
				providerPriority(prefMap, b.resolved.provider)
			);
		}
		// "balanced": exact-match rating sorts first, then ascending cost, then provider pref.
		const aExact = a.ratings[taskType] === complexity ? 0 : 1;
		const bExact = b.ratings[taskType] === complexity ? 0 : 1;
		if (aExact !== bExact) return aExact - bExact;
		const costDiff = a.effectiveCost - b.effectiveCost;
		if (costDiff !== 0) return costDiff;
		return (
			providerPriority(prefMap, a.resolved.provider) -
			providerPriority(prefMap, b.resolved.provider)
		);
	});
}

/**
 * Map routing mode to fallback tie-break cost preference.
 *
 * @param mode - Routing mode
 * @param fallback - Fallback preference when mode has no explicit mapping
 * @returns Tie-break cost preference
 */
function modeTieBreakPreference(mode: RoutingMode, fallback: CostPreference): CostPreference {
	if (mode === "cheap") return "eco";
	if (mode === "quality") return "premium";
	return fallback;
}

/**
 * Select models for a classified task, ranked by preference.
 *
 * Legacy path (default):
 * 1. Enumerate all models from registry that have matrix ratings
 * 2. Filter: model has rating for classification.type
 * 3. Filter: rating[type] >= classification.complexity
 * 4. Sort by cost preference:
 *    - "eco": ascending by effective cost, then preferred providers
 *    - "premium": descending by effective cost, then preferred providers
 *    - "balanced": exact rating match first, then ascending cost, then preferred providers
 * 5. Return ranked list (caller uses first, falls back to rest)
 *
 * Mode path (`options.routingMode` set):
 * 1. Merge built-in mode policy + optional override
 * 2. Apply complexity bias and task-floor filtering
 * 3. Apply hard constraints when matching telemetry exists
 * 4. Weighted-score candidates (capability/reliability/latency/throughput/cost)
 * 5. Sort by score desc, then tie-break by provider preference and cost preference
 *
 * @param classification - Task classification result
 * @param costPreference - Cost preference for sorting
 * @param poolOrOptions - Pre-resolved model pool OR selection options object
 * @returns Ranked list of suitable models (may be empty)
 */
export function selectModels(
	classification: ClassificationResult,
	costPreference: CostPreference,
	poolOrOptions?: ResolvedModel[] | SelectionOptions
): ResolvedModel[] {
	// Normalize legacy pool array to options object.
	const options: SelectionOptions = Array.isArray(poolOrOptions)
		? { pool: poolOrOptions }
		: (poolOrOptions ?? {});

	const prefMap = buildProviderPreferenceMap(options.preferredProviders);
	const getRatings = createModelRatingsLookup({ matrixOverrides: options.matrixOverrides });
	const getArenaPriors = createModelArenaPriorsLookup();
	const allCandidates = options.pool
		? candidatesFromPool(options.pool, getRatings, getArenaPriors)
		: enumerateCandidates(getRatings, getArenaPriors);

	if (!options.routingMode) {
		const legacyCandidates = allCandidates.filter((candidate) => {
			const rating = candidate.ratings[classification.type];
			return rating !== undefined && rating >= classification.complexity;
		});
		if (legacyCandidates.length === 0) return [];
		return sortLegacy(
			legacyCandidates,
			costPreference,
			classification.type,
			classification.complexity,
			prefMap
		).map((candidate) => candidate.resolved);
	}

	const routingSignals = sanitizeRoutingSignalsSnapshot(options.routingSignals);
	const routingModePolicyOverride = sanitizeRoutingModePolicyOverride(
		options.routingModePolicyOverride
	);
	const policy = getEffectiveModePolicy(options.routingMode, routingModePolicyOverride);
	const effectiveComplexity = clamp(classification.complexity + policy.complexityBias, 1, 5);
	const taskFloor = Math.max(policy.taskFloors?.[classification.type] ?? 1, effectiveComplexity);

	const capableCandidates = allCandidates.filter((candidate) => {
		const rating = candidate.ratings[classification.type];
		return rating !== undefined && rating >= taskFloor;
	});
	if (capableCandidates.length === 0) return [];

	const constrainedCandidates = capableCandidates.filter((candidate) =>
		passesModeConstraints(candidate, policy, routingSignals)
	);
	const scoringPool = constrainedCandidates.length > 0 ? constrainedCandidates : capableCandidates;

	const modeScoredCandidates: ModeScoredCandidate[] = scoringPool.map((candidate) => ({
		...candidate,
		score: computeModeScore(candidate, classification.type, policy, routingSignals),
	}));

	const tieBreakPreference = modeTieBreakPreference(options.routingMode, costPreference);

	modeScoredCandidates.sort((a, b) => {
		const scoreDiff = b.score - a.score;
		if (scoreDiff !== 0) return scoreDiff;

		const providerDiff =
			providerPriority(prefMap, a.resolved.provider) -
			providerPriority(prefMap, b.resolved.provider);
		if (providerDiff !== 0) return providerDiff;

		if (tieBreakPreference === "premium") {
			const costDiff = b.effectiveCost - a.effectiveCost;
			if (costDiff !== 0) return costDiff;
		} else {
			const costDiff = a.effectiveCost - b.effectiveCost;
			if (costDiff !== 0) return costDiff;
		}

		const providerNameDiff = a.resolved.provider.localeCompare(b.resolved.provider);
		if (providerNameDiff !== 0) return providerNameDiff;
		return a.resolved.id.localeCompare(b.resolved.id);
	});

	return modeScoredCandidates.map((candidate) => candidate.resolved);
}
