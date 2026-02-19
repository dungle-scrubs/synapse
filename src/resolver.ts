/**
 * Fuzzy model name resolution against the pi-ai model registry.
 *
 * Resolves human-friendly names like "opus", "sonnet 4.5" to exact
 * provider/model-id pairs using a 6-tier resolution cascade.
 */

import { getModels, getProviders } from "@mariozechner/pi-ai";
import { getModelRatings } from "./matrix.js";
import type { CandidateModel, ModelSource, ResolvedModel } from "./types.js";

/**
 * Collects all models from every registered provider.
 *
 * @returns Flat array of candidate models with provider, id, and name
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
 * Builds a ResolvedModel from a candidate.
 *
 * @param m - Candidate model
 * @returns ResolvedModel with display name
 */
function toResolved(m: CandidateModel): ResolvedModel {
	return { provider: m.provider, id: m.id, displayName: `${m.provider}/${m.id}` };
}

/**
 * Sum of all capability ratings for a model from the matrix.
 * Higher = more capable. Returns 0 if not in matrix.
 *
 * @param id - Model ID
 * @returns Total capability score
 */
function capabilityScore(id: string): number {
	const ratings = getModelRatings(id);
	if (!ratings) return 0;
	return Object.values(ratings).reduce((sum, v) => sum + (v ?? 0), 0);
}

/**
 * Returns the priority index for a provider in the preferred list.
 * Lower = higher priority. Providers not in the list get Infinity.
 *
 * @param provider - Provider name
 * @param preferred - Ordered list of preferred providers
 * @returns Priority index (lower is better)
 */
function providerPriority(provider: string, preferred: string[]): number {
	const idx = preferred.indexOf(provider);
	return idx === -1 ? Number.POSITIVE_INFINITY : idx;
}

/**
 * Compares model IDs using numeric-aware ordering.
 *
 * This treats numeric segments as numbers so "5.10" sorts after "5.2".
 *
 * @param a - First model ID
 * @param b - Second model ID
 * @returns Positive when a is higher/newer than b, negative when lower, 0 if equivalent
 */
function compareModelIds(a: string, b: string): number {
	return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Picks the best model ID from a list, ignoring provider.
 *
 * Tiebreak order:
 * 1. Highest capability score (from model matrix)
 * 2. Higher numeric-aware model ID — prefers newer versions ("5.10" > "5.2")
 * 3. Shortest model ID when numeric ordering ties
 * 4. Lexicographically last as final deterministic fallback
 *
 * @param models - Array of candidates to pick from
 * @returns The best candidate by capability-then-version-then-length
 */
function pickBestModel(models: CandidateModel[]): CandidateModel {
	return models.reduce((a, b) => {
		const aCap = capabilityScore(a.id);
		const bCap = capabilityScore(b.id);
		if (aCap !== bCap) return aCap > bCap ? a : b;
		const versionDiff = compareModelIds(a.id, b.id);
		if (versionDiff !== 0) return versionDiff > 0 ? a : b;
		if (a.id.length !== b.id.length) return a.id.length < b.id.length ? a : b;
		return a.id >= b.id ? a : b;
	});
}

/**
 * Two-phase best-candidate selection:
 * 1. Identify the best MODEL (by capability → numeric-aware ID → shortest ID)
 * 2. Among providers offering that model, pick by provider preference
 *
 * This ensures fuzzy resolution picks the right model first, then chooses
 * the cheapest delivery path (subscription > API key > aggregator).
 *
 * @param models - Array of candidates to pick from
 * @param preferredProviders - Optional ordered provider preference list
 * @returns The best candidate: best model first, then best provider
 */
function pickBest(models: CandidateModel[], preferredProviders?: string[]): CandidateModel {
	const bestModel = pickBestModel(models);

	if (!preferredProviders || preferredProviders.length === 0) return bestModel;

	// Filter to all providers offering the winning model ID
	const sameModel = models.filter((m) => m.id === bestModel.id);
	if (sameModel.length <= 1) return bestModel;

	// Pick by provider preference
	return sameModel.reduce((a, b) => {
		const aPrio = providerPriority(a.provider, preferredProviders);
		const bPrio = providerPriority(b.provider, preferredProviders);
		return aPrio <= bPrio ? a : b;
	});
}

/**
 * Splits a string into lowercase tokens on spaces, hyphens, underscores, dots,
 * and word↔digit boundaries (e.g. "codex5" → ["codex", "5"]).
 *
 * @param s - Input string
 * @returns Array of non-empty lowercase tokens
 */
function tokenize(s: string): string[] {
	return s
		.toLowerCase()
		.replace(/([a-z])(\d)/g, "$1 $2")
		.replace(/(\d)([a-z])/g, "$1 $2")
		.split(/[\s\-_.]+/)
		.filter((t) => t.length > 0);
}

/**
 * Strips all common separators and lowercases for normalized comparison.
 * "glm-5" → "glm5", "claude-sonnet-4-5" → "claudesonnet45"
 *
 * @param s - Input string
 * @returns Normalized string with separators removed
 */
function normalize(s: string): string {
	return s.toLowerCase().replace(/[\s\-_.]+/g, "");
}

/**
 * Finds all fuzzy-matched candidates for a query (before tiebreaking).
 *
 * Returns all models that tie at the best score for whichever resolution
 * tier first produces a match. Used by `resolveModelFuzzy` (picks one)
 * and `resolveModelCandidates` (returns all for scoped routing).
 *
 * Resolution cascade:
 * 1. Exact ID match across all providers
 * 2. Case-insensitive ID match
 * 2.5. Normalized match — strips separators ("glm5" → "glm-5")
 * 3. Provider/ID format (e.g. "anthropic/claude-sonnet-4-5")
 * 4. Token overlap — split query into tokens, score models by weighted
 *    token matches. ID/name matches score 2, provider-only matches score 1.
 *    Best score wins.
 * 5. Substring match — query appears as substring in model ID or name
 * 6. Normalized substring — strips separators before substring comparison
 *
 * @param query - Human-friendly model name (e.g. "opus", "sonnet 4.5", "codex")
 * @param modelSource - Optional model-fetching function (defaults to pi-ai registry)
 * @returns Array of tied candidates from the first matching tier, or empty
 */
function findCandidates(query: string, modelSource?: ModelSource): CandidateModel[] {
	const models = modelSource ? modelSource() : getAllModels();
	if (models.length === 0) return [];

	const q = query.trim();
	if (q.length === 0) return [];
	const qLower = q.toLowerCase();

	// 1. Exact ID match
	const exact = models.filter((m) => m.id === q);
	if (exact.length > 0) return exact;

	// 2. Case-insensitive ID match
	const ciMatch = models.filter((m) => m.id.toLowerCase() === qLower);
	if (ciMatch.length > 0) return ciMatch;

	// 2.5. Normalized match — strips separators ("glm5" matches "glm-5")
	const qNorm = normalize(q);
	const normMatch = models.filter((m) => normalize(m.id) === qNorm);
	if (normMatch.length > 0) return normMatch;

	// 3. Provider/ID format
	if (q.includes("/")) {
		const slashIdx = q.indexOf("/");
		const provider = q.slice(0, slashIdx).toLowerCase();
		const id = q.slice(slashIdx + 1).toLowerCase();
		const providerMatch = models.filter(
			(m) => m.provider.toLowerCase() === provider && m.id.toLowerCase() === id
		);
		if (providerMatch.length > 0) return providerMatch;
	}

	// 4. Token overlap scoring (ID/name matches weighted 2×, provider-only 1×)
	const queryTokens = tokenize(q);
	if (queryTokens.length > 0) {
		let bestScore = 0;
		let bestMatches: CandidateModel[] = [];

		for (const m of models) {
			const idName = `${m.id} ${m.name}`.toLowerCase();
			const providerStr = m.provider.toLowerCase();
			let score = 0;
			for (const t of queryTokens) {
				if (idName.includes(t)) score += 2;
				else if (providerStr.includes(t)) score += 1;
			}
			if (score > bestScore) {
				bestScore = score;
				bestMatches = [m];
			} else if (score === bestScore && score > 0) {
				bestMatches.push(m);
			}
		}

		if (bestScore > 0 && bestMatches.length > 0) return bestMatches;
	}

	// 5. Substring match (raw)
	const subMatches = models.filter(
		(m) => m.id.toLowerCase().includes(qLower) || m.name.toLowerCase().includes(qLower)
	);
	if (subMatches.length > 0) return subMatches;

	// 6. Substring match (normalized — strips separators before comparing)
	const normSubMatches = models.filter(
		(m) => normalize(m.id).includes(qNorm) || normalize(m.name).includes(qNorm)
	);
	if (normSubMatches.length > 0) return normSubMatches;

	return [];
}

/**
 * Resolves a human-friendly model name to a single exact provider/model-id.
 *
 * Finds all tied candidates via the resolution cascade, then picks the
 * best model (capability → numeric-aware ID → shortest ID), and finally
 * selects the preferred provider among those offering that model.
 *
 * @param query - Human-friendly model name (e.g. "opus", "sonnet 4.5", "claude-opus-4-5")
 * @param modelSource - Optional model-fetching function (defaults to pi-ai registry)
 * @param preferredProviders - Optional ordered provider preference (e.g. subscription first, then API key, then aggregator). Earlier entries have higher priority.
 * @returns Resolved model, or undefined if no match found
 */
export function resolveModelFuzzy(
	query: string,
	modelSource?: ModelSource,
	preferredProviders?: string[]
): ResolvedModel | undefined {
	const candidates = findCandidates(query, modelSource);
	if (candidates.length === 0) return undefined;
	return toResolved(pickBest(candidates, preferredProviders));
}

/**
 * Resolves a human-friendly model name to ALL tied candidates.
 *
 * Same resolution cascade as `resolveModelFuzzy`, but returns every model
 * that ties at the best score instead of picking one. Used by the model
 * router for scoped auto-routing: "codex" → all codex models → classify
 * task → pick the right one for the job.
 *
 * @param query - Human-friendly model name (e.g. "codex", "opus", "gemini flash")
 * @param modelSource - Optional model-fetching function (defaults to pi-ai registry)
 * @returns Array of resolved models (may be empty if no match)
 */
export function resolveModelCandidates(query: string, modelSource?: ModelSource): ResolvedModel[] {
	return findCandidates(query, modelSource).map(toResolved);
}

/**
 * Lists all available models from the registry for error messages.
 *
 * @param modelSource - Optional model-fetching function (defaults to pi-ai registry)
 * @returns Array of model display strings ("provider/id")
 */
export function listAvailableModels(modelSource?: ModelSource): string[] {
	const models = modelSource ? modelSource() : getAllModels();
	return models.map((m) => `${m.provider}/${m.id}`);
}
