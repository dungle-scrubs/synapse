/**
 * Routing signal key helpers and runtime payload sanitizers.
 *
 * These utilities enforce a stable contract for score-based routing inputs.
 */

import type {
	RoutingModePolicyOverride,
	RoutingModelSignal,
	RoutingRouteSignal,
	RoutingSignalsSnapshot,
	TaskType,
} from "./types.js";

/** Parsed provider/model route key. */
export interface RouteSignalKeyParts {
	readonly modelId: string;
	readonly provider: string;
}

/**
 * Check whether an unknown value is a plain object record.
 *
 * @param value - Value to test
 * @returns True when value is a plain object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parse a finite numeric value.
 *
 * @param value - Unknown numeric candidate
 * @returns Finite number, or undefined when invalid
 */
function parseFiniteNumber(value: unknown): number | undefined {
	if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
	return value;
}

/**
 * Parse a non-negative finite number.
 *
 * @param value - Unknown numeric candidate
 * @returns Non-negative number, or undefined when invalid
 */
function parseNonNegativeNumber(value: unknown): number | undefined {
	const parsed = parseFiniteNumber(value);
	if (parsed === undefined || parsed < 0) return undefined;
	return parsed;
}

/**
 * Parse a unit-interval number in [0, 1].
 *
 * @param value - Unknown numeric candidate
 * @returns Number in [0, 1], or undefined when invalid
 */
function parseUnitIntervalNumber(value: unknown): number | undefined {
	const parsed = parseFiniteNumber(value);
	if (parsed === undefined || parsed < 0 || parsed > 1) return undefined;
	return parsed;
}

/**
 * Parse an optional non-empty string.
 *
 * @param value - Unknown string candidate
 * @returns Trimmed string, or undefined when invalid
 */
function parseOptionalString(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	if (trimmed.length === 0) return undefined;
	return trimmed;
}

/**
 * Build the canonical route-signal key format used by selector lookups.
 *
 * Canonical format: `provider/modelId` (lowercase, trimmed).
 *
 * @param provider - Provider name
 * @param modelId - Provider-scoped model ID
 * @returns Canonical key
 */
export function buildRouteSignalKey(provider: string, modelId: string): string {
	return `${provider.trim().toLowerCase()}/${modelId.trim().toLowerCase()}`;
}

/**
 * Build the canonical model-signal key format.
 *
 * Canonical format: `modelId` (lowercase, trimmed).
 *
 * @param modelId - Model ID
 * @returns Canonical model key
 */
export function buildModelSignalKey(modelId: string): string {
	return modelId.trim().toLowerCase();
}

/**
 * Build the canonical provider-scoped model-signal key format.
 *
 * Canonical format: `provider/modelId` (lowercase, trimmed).
 *
 * @param provider - Provider name
 * @param modelId - Model ID
 * @returns Canonical provider-scoped model key
 */
export function buildProviderModelSignalKey(provider: string, modelId: string): string {
	return buildRouteSignalKey(provider, modelId);
}

/**
 * Parse a route-signal key.
 *
 * Accepted input formats:
 * - canonical: `provider/modelId`
 * - legacy: `provider|modelId` (normalized to canonical)
 *
 * @param key - Raw route key
 * @returns Parsed route key parts, or undefined when invalid
 */
export function parseRouteSignalKey(key: string): RouteSignalKeyParts | undefined {
	const trimmed = key.trim();
	if (trimmed.length === 0) return undefined;

	const slashIndex = trimmed.indexOf("/");
	const pipeIndex = trimmed.indexOf("|");
	if (slashIndex === -1 && pipeIndex === -1) return undefined;

	const separatorIndex =
		slashIndex === -1 ? pipeIndex : pipeIndex === -1 ? slashIndex : Math.min(slashIndex, pipeIndex);

	if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) return undefined;

	const provider = trimmed.slice(0, separatorIndex).trim().toLowerCase();
	const modelId = trimmed
		.slice(separatorIndex + 1)
		.trim()
		.toLowerCase();
	if (provider.length === 0 || modelId.length === 0) return undefined;

	return { modelId, provider };
}

/**
 * Sanitize a route-level telemetry payload.
 *
 * Drops invalid fields and enforces numeric ranges.
 * `observedAtMs` is required.
 *
 * @param input - Raw route payload
 * @returns Sanitized route signal, or undefined when invalid
 */
function sanitizeRoutingRouteSignal(input: unknown): RoutingRouteSignal | undefined {
	if (!isRecord(input)) return undefined;

	const observedAtMs = parseNonNegativeNumber(input.observedAtMs);
	if (observedAtMs === undefined) return undefined;

	const errorRate = parseUnitIntervalNumber(input.errorRate);
	const fallbackRate = parseUnitIntervalNumber(input.fallbackRate);
	const latencyP50Ms = parseNonNegativeNumber(input.latencyP50Ms);
	const latencyP90Ms = parseNonNegativeNumber(input.latencyP90Ms);
	const throughputP50Tps = parseNonNegativeNumber(input.throughputP50Tps);
	const throughputP90Tps = parseNonNegativeNumber(input.throughputP90Tps);
	const uptime = parseUnitIntervalNumber(input.uptime);
	const windowMs = parseNonNegativeNumber(input.windowMs);
	const source = parseOptionalString(input.source);

	return {
		observedAtMs,
		...(errorRate !== undefined ? { errorRate } : {}),
		...(fallbackRate !== undefined ? { fallbackRate } : {}),
		...(latencyP50Ms !== undefined ? { latencyP50Ms } : {}),
		...(latencyP90Ms !== undefined ? { latencyP90Ms } : {}),
		...(throughputP50Tps !== undefined ? { throughputP50Tps } : {}),
		...(throughputP90Tps !== undefined ? { throughputP90Tps } : {}),
		...(uptime !== undefined ? { uptime } : {}),
		...(windowMs !== undefined ? { windowMs } : {}),
		...(source !== undefined ? { source } : {}),
	};
}

/**
 * Sanitize a model-level telemetry payload.
 *
 * Drops invalid fields and enforces numeric ranges.
 * `observedAtMs` is required.
 *
 * @param input - Raw model payload
 * @returns Sanitized model signal, or undefined when invalid
 */
function sanitizeRoutingModelSignal(input: unknown): RoutingModelSignal | undefined {
	if (!isRecord(input)) return undefined;

	const observedAtMs = parseNonNegativeNumber(input.observedAtMs);
	if (observedAtMs === undefined) return undefined;

	const outputTpsMedian = parseNonNegativeNumber(input.outputTpsMedian);
	const ttftMedianMs = parseNonNegativeNumber(input.ttftMedianMs);
	const source = parseOptionalString(input.source);

	return {
		observedAtMs,
		...(outputTpsMedian !== undefined ? { outputTpsMedian } : {}),
		...(ttftMedianMs !== undefined ? { ttftMedianMs } : {}),
		...(source !== undefined ? { source } : {}),
	};
}

/**
 * Sanitize routing telemetry snapshot input.
 *
 * Behavior:
 * - Drops invalid routes/models entries
 * - Normalizes route keys to canonical `provider/modelId`
 * - Normalizes model keys to lowercase
 * - Requires finite non-negative `generatedAtMs`
 *
 * @param input - Raw snapshot payload
 * @returns Sanitized snapshot, or undefined when invalid at root
 */
export function sanitizeRoutingSignalsSnapshot(input: unknown): RoutingSignalsSnapshot | undefined {
	if (!isRecord(input)) return undefined;

	const generatedAtMs = parseNonNegativeNumber(input.generatedAtMs);
	if (generatedAtMs === undefined) return undefined;

	const routes = isRecord(input.routes)
		? Object.entries(input.routes).reduce<Record<string, RoutingRouteSignal>>((acc, entry) => {
				const [rawKey, rawSignal] = entry;
				const parsedKey = parseRouteSignalKey(rawKey);
				if (!parsedKey) return acc;
				const sanitizedSignal = sanitizeRoutingRouteSignal(rawSignal);
				if (!sanitizedSignal) return acc;
				acc[buildRouteSignalKey(parsedKey.provider, parsedKey.modelId)] = sanitizedSignal;
				return acc;
			}, {})
		: undefined;

	const models = isRecord(input.models)
		? Object.entries(input.models).reduce<Record<string, RoutingModelSignal>>((acc, entry) => {
				const [rawKey, rawSignal] = entry;
				const key = rawKey.trim().toLowerCase();
				if (key.length === 0) return acc;
				const sanitizedSignal = sanitizeRoutingModelSignal(rawSignal);
				if (!sanitizedSignal) return acc;
				acc[key] = sanitizedSignal;
				return acc;
			}, {})
		: undefined;

	return {
		generatedAtMs,
		...(routes && Object.keys(routes).length > 0 ? { routes } : {}),
		...(models && Object.keys(models).length > 0 ? { models } : {}),
	};
}

/**
 * Sanitize a mode-policy override payload.
 *
 * Behavior:
 * - Drops invalid fields
 * - Validates unit-interval and non-negative constraints
 * - Validates task floors in the 1..5 range
 * - Returns undefined when no valid fields remain
 *
 * @param input - Raw mode-policy override payload
 * @returns Sanitized policy override, or undefined when empty/invalid
 */
export function sanitizeRoutingModePolicyOverride(
	input: unknown
): RoutingModePolicyOverride | undefined {
	if (!isRecord(input)) return undefined;

	const complexityBias = parseFiniteNumber(input.complexityBias);

	const constraints = isRecord(input.constraints)
		? {
				...(parseUnitIntervalNumber(input.constraints.maxErrorRate) !== undefined
					? { maxErrorRate: parseUnitIntervalNumber(input.constraints.maxErrorRate) }
					: {}),
				...(parseNonNegativeNumber(input.constraints.maxLatencyP90Ms) !== undefined
					? { maxLatencyP90Ms: parseNonNegativeNumber(input.constraints.maxLatencyP90Ms) }
					: {}),
				...(parseUnitIntervalNumber(input.constraints.minUptime) !== undefined
					? { minUptime: parseUnitIntervalNumber(input.constraints.minUptime) }
					: {}),
			}
		: undefined;

	const taskFloorsInput = isRecord(input.taskFloors) ? input.taskFloors : undefined;
	const taskFloors = taskFloorsInput
		? (["code", "vision", "text"] as const satisfies readonly TaskType[]).reduce<
				Partial<Record<TaskType, number>>
			>((acc, taskType) => {
				const floor = parseFiniteNumber(taskFloorsInput[taskType]);
				if (floor !== undefined && floor >= 1 && floor <= 5) {
					acc[taskType] = floor;
				}
				return acc;
			}, {})
		: undefined;

	const weightsInput = isRecord(input.weights) ? input.weights : undefined;
	const weights = weightsInput
		? (["capability", "cost", "latency", "reliability", "throughput"] as const).reduce<{
				capability?: number;
				cost?: number;
				latency?: number;
				reliability?: number;
				throughput?: number;
			}>((acc, key) => {
				const weight = parseNonNegativeNumber(weightsInput[key]);
				if (weight !== undefined) {
					acc[key] = weight;
				}
				return acc;
			}, {})
		: undefined;

	const override: RoutingModePolicyOverride = {
		...(complexityBias !== undefined ? { complexityBias } : {}),
		...(constraints && Object.keys(constraints).length > 0 ? { constraints } : {}),
		...(taskFloors && Object.keys(taskFloors).length > 0 ? { taskFloors } : {}),
		...(weights && Object.keys(weights).length > 0 ? { weights } : {}),
	};

	return Object.keys(override).length > 0 ? override : undefined;
}
