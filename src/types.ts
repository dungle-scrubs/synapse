/** LLM task types for routing. */
export type TaskType = "code" | "vision" | "text";

/**
 * Per-type capability ratings. Scale: 1 (basic) to 5 (frontier).
 * Missing key = model doesn't support that type.
 */
export type ModelRatings = Partial<Record<TaskType, number>>;

/** Per-model matrix overrides. `null` removes an entry from the base matrix. */
export type ModelMatrixOverrides = Readonly<Record<string, ModelRatings | null>>;

/** Optional raw LM Arena prior scores keyed per task type. */
export type ModelArenaScores = Partial<Record<TaskType, number>>;

/** User's cost preference for model routing. */
export type CostPreference = "eco" | "balanced" | "premium";

/** Routing behavior profile for model selection. */
export type RoutingMode = "balanced" | "cheap" | "fast" | "quality" | "reliable";

/** Weight vector used by score-based routing modes. */
export interface RoutingScoreWeights {
	readonly capability: number;
	readonly cost: number;
	readonly latency: number;
	readonly reliability: number;
	readonly throughput: number;
}

/** Hard constraints applied before weighted scoring. */
export interface RoutingModeConstraints {
	readonly maxErrorRate?: number;
	readonly maxLatencyP90Ms?: number;
	readonly minUptime?: number;
}

/** Full mode policy used by the selector. */
export interface RoutingModePolicy {
	readonly complexityBias: number;
	readonly constraints?: RoutingModeConstraints;
	readonly taskFloors?: Partial<Record<TaskType, number>>;
	readonly weights: RoutingScoreWeights;
}

/** Partial policy override for the active routing mode. */
export interface RoutingModePolicyOverride {
	readonly complexityBias?: number;
	readonly constraints?: RoutingModeConstraints;
	readonly taskFloors?: Partial<Record<TaskType, number>>;
	readonly weights?: Partial<RoutingScoreWeights>;
}

/** Telemetry for a provider/model route (e.g. OpenRouter endpoint). */
export interface RoutingRouteSignal {
	readonly errorRate?: number;
	readonly fallbackRate?: number;
	readonly latencyP50Ms?: number;
	readonly latencyP90Ms?: number;
	readonly observedAtMs: number;
	readonly source?: string;
	readonly throughputP50Tps?: number;
	readonly throughputP90Tps?: number;
	readonly uptime?: number;
	readonly windowMs?: number;
}

/** Telemetry for a canonical model (e.g. benchmark priors). */
export interface RoutingModelSignal {
	readonly observedAtMs: number;
	readonly outputTpsMedian?: number;
	readonly source?: string;
	readonly ttftMedianMs?: number;
}

/** Snapshot of routing telemetry keyed by route/model identifiers. */
export interface RoutingSignalsSnapshot {
	readonly generatedAtMs: number;
	readonly models?: Readonly<Record<string, RoutingModelSignal>>;
	readonly routes?: Readonly<Record<string, RoutingRouteSignal>>;
}

/** Task complexity level (1-5). */
export type TaskComplexity = 1 | 2 | 3 | 4 | 5;

/** Result of task classification. */
export interface ClassificationResult {
	type: TaskType;
	complexity: TaskComplexity;
	reasoning: string;
}

/** A resolved model with provider and display name. */
export interface ResolvedModel {
	provider: string;
	id: string;
	displayName: string;
}

/** Model-fetching function signature for dependency injection. */
export interface CandidateModel {
	provider: string;
	id: string;
	name: string;
}

/** Model source function for dependency injection in resolver/selector. */
export type ModelSource = () => CandidateModel[];
