/**
 * Task classification via cheap LLM call.
 *
 * Determines a task's type (code/vision/text) and complexity (1-5)
 * using the cheapest available model. All pi-ai dependencies are injected
 * to keep this module testable without platform-specific module resolution.
 */

import type { ClassificationResult, TaskComplexity, TaskType } from "./types.js";

/** Valid task types for validation. */
const VALID_TYPES: ReadonlySet<string> = new Set<TaskType>(["code", "vision", "text"]);

/** Valid complexity values for validation. */
const VALID_COMPLEXITIES: ReadonlySet<number> = new Set<TaskComplexity>([1, 2, 3, 4, 5]);

/** Minimal model info needed for classification. */
export interface ClassifierModel {
	provider: string;
	id: string;
	cost: { input: number; output: number };
}

/** Function that lists all available models. */
export type ModelLister = () => ClassifierModel[];

/** Function that completes a prompt and returns text. */
export type CompleteFn = (provider: string, modelId: string, prompt: string) => Promise<string>;

/**
 * Options for task classification.
 *
 * Accepts either as the 4th argument to `classifyTask`, or pass a plain
 * string for backward-compatible `agentRole` usage.
 */
export interface ClassifyTaskOptions {
	/** Agent role context included in the classification prompt. */
	agentRole?: string;
	/**
	 * Override the classifier model instead of auto-selecting the cheapest.
	 *
	 * By default, `classifyTask` uses the cheapest available model to break
	 * the bootstrapping cycle (need a model to classify, need classification
	 * to pick a model). This works when cheap models handle structured output
	 * well, but callers who need higher classification accuracy — or who
	 * already know which model to trust — can specify one explicitly.
	 */
	classifierModel?: { provider: string; id: string };
}

/**
 * Finds the cheapest available model by effective cost.
 *
 * When multiple models share the same lowest cost, the winner is
 * deterministic: sorted by `provider` then `id` lexicographically.
 *
 * @param listModels - Function that returns all available models
 * @returns Provider and ID of the cheapest model, or undefined if none available
 */
export function findCheapestModel(
	listModels: ModelLister
): { provider: string; id: string } | undefined {
	let cheapest: { provider: string; id: string } | undefined;
	let cheapestCost = Number.POSITIVE_INFINITY;

	for (const m of listModels()) {
		const effective = (m.cost.input + m.cost.output) / 2;
		if (effective < cheapestCost) {
			cheapestCost = effective;
			cheapest = { provider: m.provider, id: m.id };
		} else if (effective === cheapestCost && cheapest) {
			// Deterministic tie-break: provider then id, lexicographic ascending.
			const key = `${m.provider}/${m.id}`;
			const cheapestKey = `${cheapest.provider}/${cheapest.id}`;
			if (key < cheapestKey) {
				cheapest = { provider: m.provider, id: m.id };
			}
		}
	}

	return cheapest;
}

/**
 * Builds the classification prompt for the LLM.
 *
 * @param task - Task description
 * @param primaryType - Agent's default type
 * @param agentRole - Optional agent role context
 * @returns Formatted prompt string
 */
function buildPrompt(task: string, primaryType: TaskType, agentRole?: string): string {
	const roleLine = agentRole ? `\nAgent role: ${agentRole}` : "";
	return `Classify this task on two axes.

TYPE — what LLM capability is needed:
- code: writing, refactoring, debugging, reviewing code
- vision: analyzing images, screenshots, UI mockups
- text: writing docs, planning, general reasoning, research

COMPLEXITY (1-5):
1 = Trivial (rename file, simple lookup, basic edit)
2 = Simple (single-file change, add test, fix typo)
3 = Moderate (multi-file change, implement function, debug)
4 = Complex (design + implement feature, architecture)
5 = Expert (cross-system design, security audit, optimization)

Default type for this agent: ${primaryType}
Use the default unless the task clearly requires a different type.

Task: ${task}${roleLine}

Respond with JSON only: {"type": "<type>", "complexity": <1-5>, "reasoning": "<one line>"}`;
}

/**
 * Extracts and parses JSON from LLM output that may contain markdown fences.
 *
 * @param raw - Raw LLM output string
 * @returns Parsed object, or undefined on failure
 */
function extractJson(raw: string): Record<string, unknown> | undefined {
	const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
	const jsonStr = fenceMatch ? fenceMatch[1] : raw;

	try {
		return JSON.parse(jsonStr.trim());
	} catch {
		const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
		if (objectMatch) {
			try {
				return JSON.parse(objectMatch[0]);
			} catch {
				return undefined;
			}
		}
		return undefined;
	}
}

/**
 * Classify a task's type and complexity using an LLM.
 *
 * By default uses the cheapest available model to break the bootstrapping
 * cycle. Pass `classifierModel` in the options to override this — useful
 * when the cheapest model produces poor structured output, or when the
 * caller already knows which model to trust for classification.
 *
 * @param task - The task description to classify
 * @param primaryType - Agent's default type (used when ambiguous or on failure)
 * @param deps - Injected dependencies: listModels and complete functions
 * @param agentRoleOrOptions - Agent role string (backward compat) or options object
 * @returns Classification result with type, complexity, reasoning, and classifier model
 */
export async function classifyTask(
	task: string,
	primaryType: TaskType,
	deps: { listModels: ModelLister; complete: CompleteFn },
	agentRoleOrOptions?: string | ClassifyTaskOptions
): Promise<ClassificationResult> {
	const opts: ClassifyTaskOptions =
		typeof agentRoleOrOptions === "string"
			? { agentRole: agentRoleOrOptions }
			: (agentRoleOrOptions ?? {});

	const fallback: ClassificationResult = {
		type: primaryType,
		complexity: 3,
		reasoning: "fallback: classification unavailable",
	};

	const model = opts.classifierModel ?? findCheapestModel(deps.listModels);
	if (!model) return fallback;

	const prompt = buildPrompt(task, primaryType, opts.agentRole);

	try {
		const output = await deps.complete(model.provider, model.id, prompt);
		const parsed = extractJson(output);
		if (!parsed) return { ...fallback, classifierModel: model };

		const type = String(parsed.type);
		const complexity = Number(parsed.complexity);
		const reasoning = String(parsed.reasoning ?? "");

		if (!VALID_TYPES.has(type) || !VALID_COMPLEXITIES.has(complexity)) {
			return { ...fallback, classifierModel: model };
		}

		return {
			type: type as TaskType,
			complexity: complexity as TaskComplexity,
			reasoning,
			classifierModel: model,
		};
	} catch {
		return { ...fallback, classifierModel: model };
	}
}
