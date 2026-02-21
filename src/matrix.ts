/**
 * Multi-dimensional model capability matrix.
 *
 * Maps model ID prefixes to per-task-type capability ratings.
 * Source: Arena leaderboards (arena.ai/leaderboard/*).
 */

import type { ModelMatrixOverrides, ModelRatings, TaskType } from "./types.js";

/**
 * Multi-dimensional model capability matrix.
 *
 * Source: Arena leaderboards (arena.ai/leaderboard/*), Feb 2026.
 *
 * ELO → tier mapping per leaderboard (each has different ELO scale):
 *   Code:   5=≥1440  4=1370-1439  3=1280-1369  2=1180-1279  1=<1180
 *   Vision: 5=≥1250  4=1200-1249  3=1150-1199  2=1100-1149  1=<1100
 *   Text:   5=≥1460  4=1410-1459  3=1370-1409  2=1320-1369  1=<1320
 *
 * Ratings use base model scores — no thinking, default effort.
 */
export const MODEL_MATRIX: Record<string, ModelRatings> = {
	// Anthropic
	"claude-opus-4-6": { code: 5, vision: 3, text: 5 },
	"claude-opus-4-5": { code: 5, vision: 3, text: 5 },
	"claude-opus-4-1": { code: 4, vision: 3, text: 4 },
	"claude-sonnet-4-6": { code: 5, vision: 3, text: 5 },
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
	"glm-5": { code: 5, text: 5 },
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
	/** Map of model-prefix overrides passed via `matrixOverrides`. */
	matrixOverrides: ModelMatrixOverrides;
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
 * Normalize a model ID for prefix lookup by removing provider prefix.
 *
 * @param modelId - Full model ID (may include provider prefix)
 * @returns Bare model ID without provider prefix
 */
function resolveBareModelId(modelId: string): string {
	return modelId.includes("/") ? modelId.slice(modelId.indexOf("/") + 1) : modelId;
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

/**
 * Get capability ratings for a model by its ID.
 *
 * Uses longest-prefix matching: strips provider prefix (e.g. "anthropic/"),
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
		matrixOverrides: includeCurrentMatrix ? copyMatrix(MODEL_MATRIX) : {},
	};
}
