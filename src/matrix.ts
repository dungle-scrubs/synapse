/**
 * Multi-dimensional model capability matrix.
 *
 * Maps model ID prefixes to per-task-type capability ratings.
 * Source: Arena leaderboards (arena.ai/leaderboard/*).
 */

import type { ModelArenaScores, ModelMatrixOverrides, ModelRatings, TaskType } from "./types.js";

/**
 * Multi-dimensional model capability matrix.
 *
 * Source: Arena leaderboards (arena.ai/leaderboard/*), updated 2026-02-21.
 *
 * ELO → tier mapping per leaderboard (each has different ELO scale):
 *   Code:   5=≥1440  4=1370-1439  3=1280-1369  2=1180-1279  1=<1180
 *   Vision: 5=≥1250  4=1200-1249  3=1150-1199  2=1100-1149  1=<1100
 *   Text:   5=≥1460  4=1410-1459  3=1370-1409  2=1320-1369  1=<1320
 *
 * Ratings use base model scores when available — no thinking, default effort.
 */
export const MODEL_MATRIX: Record<string, ModelRatings> = {
	// Anthropic
	"claude-opus-4-6": { code: 5, vision: 3, text: 5 },
	"claude-opus-4-5": { code: 5, vision: 3, text: 5 },
	"claude-opus-4-1": { code: 4, vision: 3, text: 4 },
	"claude-sonnet-4-6": { code: 5, vision: 3, text: 4 },
	"claude-sonnet-4-5": { code: 4, vision: 3, text: 4 },
	"claude-haiku-4-5": { code: 3, vision: 2, text: 3 },
	// OpenAI
	"gpt-5.2": { code: 4, vision: 4, text: 4 },
	"gpt-5": { code: 4, vision: 4, text: 4 },
	"gpt-5.1": { code: 3, vision: 4, text: 4 },
	"gpt-5.3-codex": { code: 4, text: 4 },
	"gpt-5.3-codex-spark": { code: 2, text: 2 },
	"gpt-5.2-codex": { code: 3, text: 3 },
	"gpt-5.1-codex-max": { code: 4, text: 4 },
	"gpt-5.1-codex": { code: 3, text: 3 },
	"gpt-5.1-codex-mini": { code: 2, text: 2 },
	// Google
	"gemini-3-pro": { code: 5, vision: 5, text: 5 },
	"gemini-3-flash": { code: 5, vision: 5, text: 5 },
	"gemini-2.5-pro": { code: 2, vision: 4, text: 4 },
	"gemini-2.5-flash": { vision: 4, text: 4 },
	// Z.ai (Zhipu)
	"glm-5": { code: 5, text: 4 },
	"glm-4.7": { code: 5, text: 4 },
	"glm-4.6": { code: 3, vision: 3, text: 4 },
	// DeepSeek
	"deepseek-reasoner": { code: 4, text: 4 },
	"deepseek-chat": { code: 3, text: 4 },
	// MiniMax
	"minimax-m2.1": { code: 4, text: 3 },
	"minimax-m2": { code: 3, text: 2 },
	// Moonshot (Kimi)
	"kimi-k2.5": { code: 4, text: 4 },
	"kimi-k2": { code: 3, text: 4 },
	// Qwen (Alibaba)
	"qwen3-coder": { code: 3, text: 3 },
	"qwen3-max": { text: 4 },
	// xAI
	"grok-4.1": { code: 2, text: 5 },
	"grok-4": { code: 1, text: 4 },
	// Mistral
	"mistral-large-3": { code: 2, text: 4 },
	"devstral-2": { code: 2 },
	"devstral-medium": { code: 1 },
};

/**
 * Raw LM Arena priors (ELO-like board scores) used to break within-tier ties.
 *
 * These do not replace matrix tiers. They only add granularity when selecting
 * among models that already pass tier filters.
 */
export const MODEL_ARENA_PRIORS: Record<string, ModelArenaScores> = {
	"claude-opus-4-6": { code: 1561, text: 1505 },
	"claude-opus-4-5": { code: 1469, text: 1467 },
	"claude-opus-4-1": { code: 1389, text: 1446 },
	"claude-sonnet-4-6": { code: 1524, text: 1457 },
	"claude-sonnet-4-5": { code: 1386, text: 1450 },
	"claude-haiku-4-5": { code: 1307, text: 1405 },
	"gpt-5.2": { code: 1395, vision: 1227, text: 1438 },
	"gpt-5.1": { code: 1343, vision: 1241, text: 1437 },
	"gpt-5.2-codex": { code: 1336 },
	"gpt-5.1-codex": { code: 1329 },
	"gpt-5.1-codex-mini": { code: 1243 },
	"gemini-3-pro": { code: 1444, vision: 1288, text: 1486 },
	"gemini-3-flash": { code: 1440, vision: 1274, text: 1474 },
	"gemini-2.5-pro": { code: 1205, vision: 1248, text: 1449 },
	"gemini-2.5-flash": { vision: 1212, text: 1411 },
	"glm-5": { code: 1456, text: 1452 },
	"glm-4.7": { code: 1440, text: 1441 },
	"glm-4.6": { code: 1356, vision: 1163, text: 1425 },
	"deepseek-reasoner": { code: 1371, text: 1420 },
	"deepseek-chat": { code: 1319, text: 1419 },
	"minimax-m2.1": { code: 1402, text: 1385 },
	"minimax-m2": { code: 1312, text: 1347 },
	"kimi-k2.5": { code: 1439, vision: 1250, text: 1450 },
	"kimi-k2": { code: 1331, text: 1429 },
	"qwen3-coder": { code: 1282, text: 1386 },
	"qwen3-max": { text: 1425 },
	"grok-4.1": { code: 1204, text: 1463 },
	"grok-4": { code: 1153, vision: 1182, text: 1410 },
	"mistral-large-3": { code: 1223, text: 1414 },
	"devstral-2": { code: 1199 },
	"devstral-medium": { code: 1099 },
};

/** Valid task types used when validating override payloads. */
const VALID_TASK_TYPES: readonly TaskType[] = ["code", "vision", "text"];

/**
 * Options for model-ratings lookup.
 */
export interface ModelRatingsLookupOptions {
	/** Optional per-model override map from host configuration. */
	matrixOverrides?: ModelMatrixOverrides;
}

/**
 * Options for override template generation.
 */
export interface CreateModelMatrixOverrideTemplateOptions {
	/** Include a full copy of the current matrix in the generated template. */
	includeCurrentMatrix?: boolean;
}

/**
 * JSON-friendly override template shape.
 */
export interface ModelMatrixOverrideTemplate {
	/** Exclusion patterns to block models from selection results. */
	exclude: string[];
	/** Map of model-prefix overrides passed via `matrixOverrides`. */
	matrixOverrides: ModelMatrixOverrides;
}

/**
 * Parsed synapse configuration from a config file or settings object.
 *
 * Consumers load this from a JSON file and spread it into `SelectionOptions`.
 */
export interface SynapseConfig {
	/** Exclusion patterns to block models from selection results. */
	exclude?: string[];
	/** Per-model capability matrix overrides. */
	matrixOverrides?: ModelMatrixOverrides;
}

/**
 * Checks whether a value is a plain object (non-null, non-array).
 *
 * @param value - Value to test
 * @returns true if the value is a plain object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Clone a ratings object to avoid leaking mutable references.
 *
 * @param ratings - Ratings object to clone
 * @returns Cloned ratings object
 */
function cloneRatings(ratings: ModelRatings): ModelRatings {
	const clone: ModelRatings = {};
	for (const taskType of VALID_TASK_TYPES) {
		const rating = ratings[taskType];
		if (rating !== undefined) clone[taskType] = rating;
	}
	return clone;
}

/**
 * Deep-clone a matrix map (`modelPrefix -> ratings`).
 *
 * @param matrix - Matrix to clone
 * @returns Deep clone of the matrix
 */
function copyMatrix(matrix: Readonly<Record<string, ModelRatings>>): Record<string, ModelRatings> {
	const clone: Record<string, ModelRatings> = {};
	for (const [modelPrefix, ratings] of Object.entries(matrix)) {
		clone[modelPrefix] = cloneRatings(ratings);
	}
	return clone;
}

/**
 * Normalize a model ID for prefix lookup by removing provider prefixes.
 *
 * Uses the final path segment so nested provider IDs normalize correctly:
 * - `openrouter/z-ai/glm-5` -> `glm-5`
 * - `openrouter/minimax/minimax-m2.1` -> `minimax-m2.1`
 *
 * @param modelId - Full model ID (may include one or more provider prefixes)
 * @returns Bare model ID without provider prefixes
 */
function resolveBareModelId(modelId: string): string {
	return modelId.includes("/") ? modelId.slice(modelId.lastIndexOf("/") + 1) : modelId;
}

/**
 * Sort matrix keys longest-first to ensure most-specific prefix matching.
 *
 * @param keys - Matrix keys
 * @returns Keys sorted longest-first
 */
function sortKeysLongestFirst(keys: string[]): string[] {
	return keys.sort((a, b) => b.length - a.length);
}

/**
 * Apply user overrides to the base model matrix.
 *
 * Override behavior:
 * - `overrides[key] = { ...ratings }` → add/replace that model prefix
 * - `overrides[key] = null` → remove that model prefix from the base matrix
 *
 * @param baseMatrix - Base hard-coded matrix
 * @param overrides - Optional user overrides
 * @returns Effective matrix after overrides
 */
export function applyModelMatrixOverrides(
	baseMatrix: Readonly<Record<string, ModelRatings>>,
	overrides?: ModelMatrixOverrides
): Record<string, ModelRatings> {
	const merged = copyMatrix(baseMatrix);
	if (!overrides) return merged;

	for (const [modelPrefix, override] of Object.entries(overrides)) {
		if (override === null) {
			delete merged[modelPrefix];
			continue;
		}
		merged[modelPrefix] = cloneRatings(override);
	}

	return merged;
}

/**
 * Clone a raw-priors object to avoid leaking mutable references.
 *
 * @param scores - Raw LM Arena priors to clone
 * @returns Cloned priors object
 */
function cloneArenaScores(scores: ModelArenaScores): ModelArenaScores {
	const clone: ModelArenaScores = {};
	for (const taskType of VALID_TASK_TYPES) {
		const score = scores[taskType];
		if (score !== undefined) clone[taskType] = score;
	}
	return clone;
}

/**
 * Create a fast raw-LM-Arena lookup function.
 *
 * Uses the same longest-prefix semantics as `createModelRatingsLookup`.
 *
 * @returns Function that resolves raw LM Arena priors for a model ID
 */
export function createModelArenaPriorsLookup(): (modelId: string) => ModelArenaScores | undefined {
	const sortedKeys = sortKeysLongestFirst(Object.keys(MODEL_ARENA_PRIORS));
	return (modelId: string): ModelArenaScores | undefined => {
		const bare = resolveBareModelId(modelId);
		const key = sortedKeys.find((candidate) => bare.startsWith(candidate));
		return key ? cloneArenaScores(MODEL_ARENA_PRIORS[key]) : undefined;
	};
}

/**
 * Create a fast model-ratings lookup function with optional overrides applied.
 *
 * @param options - Lookup options including optional matrix overrides
 * @returns Function that resolves ratings for a model ID
 */
export function createModelRatingsLookup(
	options?: ModelRatingsLookupOptions
): (modelId: string) => ModelRatings | undefined {
	const matrix = options?.matrixOverrides
		? applyModelMatrixOverrides(MODEL_MATRIX, options.matrixOverrides)
		: MODEL_MATRIX;
	const sortedKeys = sortKeysLongestFirst(Object.keys(matrix));

	return (modelId: string): ModelRatings | undefined => {
		const bare = resolveBareModelId(modelId);
		const key = sortedKeys.find((candidate) => bare.startsWith(candidate));
		return key ? matrix[key] : undefined;
	};
}

/** Default lookup for base matrix (no overrides). */
const BASE_LOOKUP = createModelRatingsLookup();

/** Default lookup for raw LM Arena priors. */
const BASE_PRIORS_LOOKUP = createModelArenaPriorsLookup();

/**
 * Get capability ratings for a model by its ID.
 *
 * Uses longest-prefix matching: strips provider prefixes (e.g. "openrouter/z-ai/"),
 * then finds the longest key in the effective matrix that the model ID starts with.
 * E.g., "claude-sonnet-4-5-20250929" matches "claude-sonnet-4-5".
 *
 * @param modelId - Full model ID (may include date suffixes)
 * @param options - Optional lookup options including matrix overrides
 * @returns Capability ratings, or undefined if model not in matrix
 */
export function getModelRatings(
	modelId: string,
	options?: ModelRatingsLookupOptions
): ModelRatings | undefined {
	if (!options?.matrixOverrides) return BASE_LOOKUP(modelId);
	return createModelRatingsLookup(options)(modelId);
}

/**
 * Get raw LM Arena priors for a model by its ID.
 *
 * Uses the same longest-prefix semantics as `getModelRatings`.
 *
 * @param modelId - Full model ID
 * @returns Raw LM Arena priors, or undefined when not available
 */
export function getModelArenaPriors(modelId: string): ModelArenaScores | undefined {
	return BASE_PRIORS_LOOKUP(modelId);
}

/**
 * Check if a model supports a given task type at the required complexity level.
 *
 * @param modelId - Full model ID
 * @param type - Required task type
 * @param minRating - Minimum required rating (1-5)
 * @param options - Optional lookup options including matrix overrides
 * @returns true if the model has a rating for the type >= minRating
 */
export function modelSupportsTask(
	modelId: string,
	type: TaskType,
	minRating: number,
	options?: ModelRatingsLookupOptions
): boolean {
	const ratings = getModelRatings(modelId, options);
	if (!ratings) return false;
	const rating = ratings[type];
	return rating !== undefined && rating >= minRating;
}

/**
 * Parse an unknown override payload into a validated override map.
 *
 * Accepts either:
 * - direct map: `{ "model-prefix": { code: 4, text: 5 } }`
 * - wrapped file shape: `{ "matrixOverrides": { ... } }`
 *
 * Invalid entries are dropped. Returns undefined when the payload
 * shape is invalid at the root.
 *
 * @param input - Unknown payload from JSON/settings
 * @returns Validated override map, empty object, or undefined on invalid root
 */
export function parseModelMatrixOverrides(input: unknown): ModelMatrixOverrides | undefined {
	const hasWrappedOverrides = isRecord(input) && Object.hasOwn(input, "matrixOverrides");
	const root = hasWrappedOverrides ? (input as Record<string, unknown>).matrixOverrides : input;

	if (!isRecord(root)) return undefined;

	const parsed: Record<string, ModelRatings | null> = {};
	for (const [modelPrefix, rawOverride] of Object.entries(root)) {
		if (rawOverride === null) {
			parsed[modelPrefix] = null;
			continue;
		}
		if (!isRecord(rawOverride)) continue;

		const ratings: ModelRatings = {};
		for (const taskType of VALID_TASK_TYPES) {
			const rawRating = rawOverride[taskType];
			if (
				typeof rawRating === "number" &&
				Number.isInteger(rawRating) &&
				rawRating >= 1 &&
				rawRating <= 5
			) {
				ratings[taskType] = rawRating;
			}
		}

		if (Object.keys(ratings).length > 0) {
			parsed[modelPrefix] = ratings;
		}
	}

	return parsed;
}

/**
 * Parse an unknown payload into a validated synapse config.
 *
 * Extracts `exclude` and `matrixOverrides` from a config object.
 * Invalid fields are silently dropped. Returns undefined when the
 * root is not a plain object.
 *
 * @param input - Unknown payload from JSON/settings
 * @returns Validated config, or undefined on invalid root
 */
export function parseSynapseConfig(input: unknown): SynapseConfig | undefined {
	if (!isRecord(input)) return undefined;

	const config: SynapseConfig = {};

	// Parse exclude patterns
	const rawExclude = input.exclude;
	if (Array.isArray(rawExclude)) {
		const patterns = rawExclude.filter(
			(entry): entry is string => typeof entry === "string" && entry.length > 0
		);
		if (patterns.length > 0) {
			config.exclude = patterns;
		}
	}

	// Parse matrix overrides (reuse existing parser on the nested field)
	if (Object.hasOwn(input, "matrixOverrides")) {
		const overrides = parseModelMatrixOverrides(input.matrixOverrides);
		if (overrides && Object.keys(overrides).length > 0) {
			config.matrixOverrides = overrides;
		}
	}

	return config;
}

/**
 * Create a JSON template users can edit for matrix overrides.
 *
 * @param options - Template generation options
 * @returns Override template object
 */
export function createModelMatrixOverrideTemplate(
	options?: CreateModelMatrixOverrideTemplateOptions
): ModelMatrixOverrideTemplate {
	const includeCurrentMatrix = options?.includeCurrentMatrix ?? true;
	return {
		exclude: [],
		matrixOverrides: includeCurrentMatrix ? copyMatrix(MODEL_MATRIX) : {},
	};
}
