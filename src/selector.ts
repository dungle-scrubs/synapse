/**
 * Model selection algorithm.
 *
 * Given a classified task and cost preference, ranks available models
 * by suitability. Consumers use the first result and fall back to the rest.
 */

import { getModels, getProviders } from "@mariozechner/pi-ai";
import { getModelRatings } from "./matrix.js";
import type { ClassificationResult, CostPreference, ModelRatings, ResolvedModel } from "./types.js";

/** Model candidate with resolved identity and cost. */
interface ScoredCandidate {
	resolved: ResolvedModel;
	ratings: ModelRatings;
	effectiveCost: number;
}

/**
 * Builds a lookup of effective costs keyed by "provider/id".
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
 * Enumerates all models from the registry with their ratings and costs.
 *
 * @returns Array of candidates that exist in the capability matrix
 */
function enumerateCandidates(): ScoredCandidate[] {
	const candidates: ScoredCandidate[] = [];
	for (const provider of getProviders()) {
		for (const model of getModels(provider)) {
			const ratings = getModelRatings(model.id);
			if (!ratings) continue;
			candidates.push({
				resolved: {
					provider: model.provider,
					id: model.id,
					displayName: `${model.provider}/${model.id}`,
				},
				ratings,
				effectiveCost: (model.cost.input + model.cost.output) / 2,
			});
		}
	}
	return candidates;
}

/**
 * Converts a set of pre-resolved models into scored candidates.
 *
 * Used for scoped routing: takes fuzzy-matched models and enriches them
 * with ratings and cost data so they can be filtered/sorted by selectModels.
 *
 * @param pool - Pre-resolved models to convert
 * @returns Scored candidates (only those with matrix ratings and registry costs)
 */
function candidatesFromPool(pool: ResolvedModel[]): ScoredCandidate[] {
	const candidates: ScoredCandidate[] = [];
	const costIndex = buildCostIndex();
	for (const resolved of pool) {
		const ratings = getModelRatings(resolved.id);
		if (!ratings) continue;
		const effectiveCost = costIndex.get(`${resolved.provider}/${resolved.id}`);
		if (effectiveCost === undefined) continue;
		candidates.push({ resolved, ratings, effectiveCost });
	}
	return candidates;
}

/** Options for model selection. */
export interface SelectionOptions {
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
}

/**
 * Selects models for a classified task, ranked by preference.
 *
 * Algorithm:
 * 1. Enumerate all models from registry that have matrix ratings
 * 2. Filter: model has rating for classification.type
 * 3. Filter: rating[type] >= classification.complexity
 * 4. Sort by cost preference:
 *    - "eco": ascending by effective cost, then preferred providers
 *    - "premium": descending by effective cost, then preferred providers
 *    - "balanced": exact rating match first, then ascending cost, then preferred providers
 * 5. Return ranked list (caller uses first, falls back to rest)
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
	// Normalize legacy pool array to options object
	const options: SelectionOptions = Array.isArray(poolOrOptions)
		? { pool: poolOrOptions }
		: (poolOrOptions ?? {});

	const { type, complexity } = classification;
	const allCandidates = options.pool ? candidatesFromPool(options.pool) : enumerateCandidates();
	const candidates = allCandidates.filter((c) => {
		const rating = c.ratings[type];
		return rating !== undefined && rating >= complexity;
	});

	if (candidates.length === 0) return [];

	// Build provider preference lookup: provider → priority (lower = better).
	// Providers not in the list get Infinity (sorted last in tiebreaks).
	const prefMap = new Map<string, number>();
	if (options.preferredProviders) {
		for (let i = 0; i < options.preferredProviders.length; i++) {
			prefMap.set(options.preferredProviders[i], i);
		}
	}
	const providerPriority = (provider: string): number =>
		prefMap.get(provider) ?? Number.POSITIVE_INFINITY;

	candidates.sort((a, b) => {
		if (costPreference === "eco") {
			const costDiff = a.effectiveCost - b.effectiveCost;
			if (costDiff !== 0) return costDiff;
			return providerPriority(a.resolved.provider) - providerPriority(b.resolved.provider);
		}
		if (costPreference === "premium") {
			const costDiff = b.effectiveCost - a.effectiveCost;
			if (costDiff !== 0) return costDiff;
			return providerPriority(a.resolved.provider) - providerPriority(b.resolved.provider);
		}
		// "balanced": exact-match rating sorts first, then ascending cost, then provider pref
		const aExact = a.ratings[type] === complexity ? 0 : 1;
		const bExact = b.ratings[type] === complexity ? 0 : 1;
		if (aExact !== bExact) return aExact - bExact;
		const costDiff = a.effectiveCost - b.effectiveCost;
		if (costDiff !== 0) return costDiff;
		return providerPriority(a.resolved.provider) - providerPriority(b.resolved.provider);
	});

	return candidates.map((c) => c.resolved);
}
