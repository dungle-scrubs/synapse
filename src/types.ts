/** LLM task types for routing. */
export type TaskType = "code" | "vision" | "text";

/**
 * Per-type capability ratings. Scale: 1 (basic) to 5 (frontier).
 * Missing key = model doesn't support that type.
 */
export type ModelRatings = Partial<Record<TaskType, number>>;

/** User's cost preference for model routing. */
export type CostPreference = "eco" | "balanced" | "premium";

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
