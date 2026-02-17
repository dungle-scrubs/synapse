import { describe, expect, it } from "bun:test";
import {
	type ClassifierModel,
	type CompleteFn,
	type ModelLister,
	classifyTask,
	findCheapestModel,
} from "../src/classifier.js";

/** Test model list with known costs. */
const testModels: ClassifierModel[] = [
	{ provider: "openai", id: "gpt-cheap", cost: { input: 0.1, output: 0.2 } },
	{ provider: "openai", id: "gpt-expensive", cost: { input: 10, output: 20 } },
];

/** @returns Static test model list */
const listModels: ModelLister = () => testModels;

/** Fake complete function that returns a classification JSON. */
const complete: CompleteFn = async () =>
	'{"type": "code", "complexity": 4, "reasoning": "Multi-file refactor"}';

const deps = { listModels, complete };

describe("findCheapestModel", () => {
	it("returns the cheapest model info", () => {
		const cheapest = findCheapestModel(listModels);
		expect(cheapest).toBeDefined();
		expect(cheapest?.id).toBe("gpt-cheap");
		expect(cheapest?.provider).toBe("openai");
	});

	it("returns undefined when no models available", () => {
		expect(findCheapestModel(() => [])).toBeUndefined();
	});
});

describe("classifyTask", () => {
	it("classifies a task using the LLM", async () => {
		const result = await classifyTask("Refactor the auth module", "code", deps);
		expect(result.type).toBe("code");
		expect(result.complexity).toBe(4);
		expect(result.reasoning).toBe("Multi-file refactor");
	});

	it("uses primaryType as default", async () => {
		const result = await classifyTask("Simple task", "text", deps);
		expect(result.type).toBeDefined();
		expect(result.complexity).toBeGreaterThanOrEqual(1);
		expect(result.complexity).toBeLessThanOrEqual(5);
	});

	it("returns fallback when complete throws", async () => {
		const failDeps = {
			listModels,
			complete: async () => {
				throw new Error("network error");
			},
		};
		const result = await classifyTask("Something", "code", failDeps);
		expect(result.type).toBe("code");
		expect(result.complexity).toBe(3);
		expect(result.reasoning).toContain("fallback");
	});

	it("returns fallback when no models available", async () => {
		const emptyDeps = { listModels: () => [] as ClassifierModel[], complete };
		const result = await classifyTask("Something", "text", emptyDeps);
		expect(result.type).toBe("text");
		expect(result.complexity).toBe(3);
	});

	it("handles markdown-fenced JSON response", async () => {
		const fencedComplete: CompleteFn = async () =>
			'```json\n{"type": "vision", "complexity": 2, "reasoning": "Screenshot analysis"}\n```';
		const result = await classifyTask("Analyze this screenshot", "vision", {
			listModels,
			complete: fencedComplete,
		});
		expect(result.type).toBe("vision");
		expect(result.complexity).toBe(2);
	});

	it("returns fallback for invalid type in response", async () => {
		const badComplete: CompleteFn = async () =>
			'{"type": "invalid", "complexity": 3, "reasoning": "bad"}';
		const result = await classifyTask("Something", "code", {
			listModels,
			complete: badComplete,
		});
		expect(result.type).toBe("code");
		expect(result.complexity).toBe(3);
		expect(result.reasoning).toContain("fallback");
	});
});
