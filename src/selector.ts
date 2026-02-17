/**
 * Model selection algorithm.
 *
 * Given a classified task and cost preference, ranks available models
 * by suitability. Consumers use the first result and fall back to the rest.
 */

import { getModels, getProviders } from "@mariozechner/pi-ai";
import { getModelRatings } from "./matrix.js";
import type {
	CandidateModel,
	ClassificationResult,
	CostPreference,
	ModelRatings,
	ModelSource,
	ResolvedModel,
} from "./types.js";

/** Model candidate with resolved identity and cost. */
interface ScoredCandidate {
	resolved: ResolvedModel;
	ratings: ModelRatings;
	effectiveCost: number;
}

/**
 * Collects all models from every registered provider.
 *
 * @returns Flat array of candidate models
 */
function getAllModels(): CandidateModel[] {
	const result: CandidateModel[] = [];
	for (const provider of getProviders()) {
		for (const m of getModels(provider)) {
			result.push({ provider: m.provider, id: m.id, name: m.name });
		}
	}
	return result;
}

/**
 * Enumerates all models from the registry with their ratings and costs.
 *
 * @param modelSource - Optional model-fetching function (defaults to pi-ai registry)
 * @returns Array of candidates that exist in the capability matrix
 */
function enumerateCandidates(modelSource?: ModelSource): ScoredCandidate[] {
	const candidates: ScoredCandidate[] = [];
	const models = modelSource ? modelSource() : getAllModels();

	for (const provider of getProviders()) {
		for (const regModel of getModels(provider)) {
			// Only include models that are in our source list (or all if no source)
			if (
				modelSource &&
				!models.some((m) => m.id === regModel.id && m.provider === regModel.provider)
			) {
				continue;
			}
			const ratings = getModelRatings(regModel.id);
			if (!ratings) continue;
			candidates.push({
				resolved: {
					provider: regModel.provider,
					id: regModel.id,
					displayName: `${regModel.provider}/${regModel.id}`,
				},
				ratings,
				effectiveCost: (regModel.cost.input + regModel.cost.output) / 2,
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
 * @returns Scored candidates (only those with matrix ratings)
 */
function candidatesFromPool(pool: ResolvedModel[]): ScoredCandidate[] {
	const candidates: ScoredCandidate[] = [];
	for (const resolved of pool) {
		const ratings = getModelRatings(resolved.id);
		if (!ratings) continue;
		// Look up cost from registry
		let effectiveCost = 0;
		for (const provider of getProviders()) {
			for (const model of getModels(provider)) {
				if (model.id === resolved.id && model.provider === resolved.provider) {
					effectiveCost = (model.cost.input + model.cost.output) / 2;
				}
			}
		}
		candidates.push({ resolved, ratings, effectiveCost });
	}
	return candidates;
}

/**
 * Selects models for a classified task, ranked by preference.
 *
 * Algorithm:
 * 1. Enumerate all models from registry that have matrix ratings
 * 2. Filter: model has rating for classification.type
 * 3. Filter: rating[type] >= classification.complexity
 * 4. Sort by cost preference:
 *    - "eco": ascending by effective cost
 *    - "premium": descending by effective cost
 *    - "balanced": exact rating match first, then ascending cost
 * 5. Return ranked list (caller uses first, falls back to rest)
 *
 * @param classification - Task classification result
 * @param costPreference - Cost preference for sorting
 * @param pool - Optional pre-resolved model pool (for scoped routing)
 * @returns Ranked list of suitable models (may be empty)
 */
export function selectModels(
	classification: ClassificationResult,
	costPreference: CostPreference,
	pool?: ResolvedModel[]
): ResolvedModel[] {
	const { type, complexity } = classification;
	const allCandidates = pool ? candidatesFromPool(pool) : enumerateCandidates();
	const candidates = allCandidates.filter((c) => {
		const rating = c.ratings[type];
		return rating !== undefined && rating >= complexity;
	});

	if (candidates.length === 0) return [];

	candidates.sort((a, b) => {
		if (costPreference === "eco") {
			return a.effectiveCost - b.effectiveCost;
		}
		if (costPreference === "premium") {
			return b.effectiveCost - a.effectiveCost;
		}
		// "balanced": exact-match rating sorts first, then ascending cost
		const aExact = a.ratings[type] === complexity ? 0 : 1;
		const bExact = b.ratings[type] === complexity ? 0 : 1;
		if (aExact !== bExact) return aExact - bExact;
		return a.effectiveCost - b.effectiveCost;
	});

	return candidates.map((c) => c.resolved);
}
