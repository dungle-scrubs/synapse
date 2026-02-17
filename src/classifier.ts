/**
 * Task classification via cheap LLM call.
 *
 * Determines a task's type (code/vision/text) and complexity (1-5)
 * using the cheapest available model from the registry. Uses pi-ai's
 * `completeSimple` for in-process inference — no CLI subprocess.
 */

import { completeSimple, getModel, getModels, getProviders } from "@mariozechner/pi-ai";
import type { ClassificationResult, TaskComplexity, TaskType } from "./types.js";

/** Valid task types for validation. */
const VALID_TYPES: ReadonlySet<string> = new Set<TaskType>(["code", "vision", "text"]);

/** Valid complexity values for validation. */
const VALID_COMPLEXITIES: ReadonlySet<number> = new Set<TaskComplexity>([1, 2, 3, 4, 5]);

/** Cheapest model info with the data needed to call completeSimple. */
interface CheapestModelInfo {
	provider: string;
	id: string;
}

/**
 * Finds the cheapest available model by effective cost.
 *
 * @returns Provider and ID of the cheapest model, or undefined if no models available
 */
export function findCheapestModel(): CheapestModelInfo | undefined {
	let cheapest: CheapestModelInfo | undefined;
	let cheapestCost = Number.POSITIVE_INFINITY;

	for (const provider of getProviders()) {
		for (const m of getModels(provider)) {
			const effective = (m.cost.input + m.cost.output) / 2;
			if (effective < cheapestCost) {
				cheapestCost = effective;
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
	// Strip markdown code fences if present
	const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
	const jsonStr = fenceMatch ? fenceMatch[1] : raw;

	try {
		return JSON.parse(jsonStr.trim());
	} catch {
		// Try to find a JSON object anywhere in the string
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
 * Extracts text content from an AssistantMessage's content array.
 *
 * @param content - Array of content blocks from pi-ai response
 * @returns Concatenated text content
 */
function extractText(content: Array<{ type: string; text?: string }>): string {
	return content
		.filter((c) => c.type === "text" && c.text)
		.map((c) => c.text as string)
		.join("");
}

/**
 * Classify a task's type and complexity using the cheapest available LLM.
 *
 * Picks the cheapest model from the registry by (input + output) / 2 cost,
 * sends a structured classification prompt via `completeSimple`, and parses
 * the JSON response. Falls back to primaryType + complexity 3 on any failure.
 *
 * @param task - The task description to classify
 * @param primaryType - Agent's default type (used when ambiguous or on failure)
 * @param agentRole - Optional agent role for additional context
 * @returns Classification result with type, complexity, and reasoning
 */
export async function classifyTask(
	task: string,
	primaryType: TaskType,
	agentRole?: string
): Promise<ClassificationResult> {
	const fallback: ClassificationResult = {
		type: primaryType,
		complexity: 3,
		reasoning: "fallback: classification unavailable",
	};

	const cheapest = findCheapestModel();
	if (!cheapest) return fallback;

	const prompt = buildPrompt(task, primaryType, agentRole);

	try {
		const model = getModel(cheapest.provider as never, cheapest.id as never);
		const response = await completeSimple(model, {
			messages: [
				{ role: "user", content: [{ type: "text", text: prompt }], timestamp: Date.now() },
			],
		});

		const output = extractText(response.content as Array<{ type: string; text?: string }>);
		const parsed = extractJson(output);
		if (!parsed) return fallback;

		const type = String(parsed.type);
		const complexity = Number(parsed.complexity);
		const reasoning = String(parsed.reasoning ?? "");

		if (!VALID_TYPES.has(type) || !VALID_COMPLEXITIES.has(complexity)) {
			return fallback;
		}

		return {
			type: type as TaskType,
			complexity: complexity as TaskComplexity,
			reasoning,
		};
	} catch {
		return fallback;
	}
}
