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

	it("extracts JSON embedded in surrounding text via regex fallback", async () => {
		const embeddedComplete: CompleteFn = async () =>
			'Sure, here is the classification:\n{"type": "code", "complexity": 5, "reasoning": "Cross-system design"}\nHope that helps!';
		const result = await classifyTask("Design the auth system", "code", {
			listModels,
			complete: embeddedComplete,
		});
		expect(result.type).toBe("code");
		expect(result.complexity).toBe(5);
		expect(result.reasoning).toBe("Cross-system design");
	});

	it("returns fallback when response contains no extractable JSON", async () => {
		const noJsonComplete: CompleteFn = async () => "This is just plain text with no JSON at all";
		const result = await classifyTask("Something", "text", {
			listModels,
			complete: noJsonComplete,
		});
		expect(result.type).toBe("text");
		expect(result.complexity).toBe(3);
		expect(result.reasoning).toContain("fallback");
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

	it("includes agentRole in the prompt sent to the LLM", async () => {
		let capturedPrompt = "";
		const capturingComplete: CompleteFn = async (_p, _m, prompt) => {
			capturedPrompt = prompt;
			return '{"type": "code", "complexity": 3, "reasoning": "test"}';
		};
		await classifyTask(
			"Fix a bug",
			"code",
			{ listModels, complete: capturingComplete },
			"security auditor"
		);
		expect(capturedPrompt).toContain("security auditor");
	});

	it("deterministically picks cheapest model on cost tie", () => {
		const tiedModels: ClassifierModel[] = [
			{ provider: "beta", id: "model-a", cost: { input: 1, output: 1 } },
			{ provider: "alpha", id: "model-a", cost: { input: 1, output: 1 } },
		];
		const result = findCheapestModel(() => tiedModels);
		expect(result).toEqual({ provider: "alpha", id: "model-a" });
	});

	it("sets classifierModel on successful classification", async () => {
		const result = await classifyTask("Refactor the auth module", "code", deps);
		expect(result.classifierModel).toEqual({ provider: "openai", id: "gpt-cheap" });
	});

	it("sets classifierModel on fallback (parse failure)", async () => {
		const badComplete: CompleteFn = async () => "not json at all";
		const result = await classifyTask("Something", "code", {
			listModels,
			complete: badComplete,
		});
		expect(result.classifierModel).toEqual({ provider: "openai", id: "gpt-cheap" });
		expect(result.reasoning).toContain("fallback");
	});

	it("sets classifierModel on fallback (network error)", async () => {
		const failDeps = {
			listModels,
			complete: async () => {
				throw new Error("network error");
			},
		};
		const result = await classifyTask("Something", "code", failDeps);
		expect(result.classifierModel).toEqual({ provider: "openai", id: "gpt-cheap" });
	});
});

describe("classifyTask — classifierModel override", () => {
	it("uses the specified classifier model instead of cheapest", async () => {
		let capturedProvider = "";
		let capturedModel = "";
		const capturingComplete: CompleteFn = async (provider, modelId) => {
			capturedProvider = provider;
			capturedModel = modelId;
			return '{"type": "code", "complexity": 3, "reasoning": "test"}';
		};
		const result = await classifyTask(
			"Fix a bug",
			"code",
			{
				listModels,
				complete: capturingComplete,
			},
			{
				classifierModel: { provider: "openai", id: "gpt-expensive" },
			}
		);
		expect(capturedProvider).toBe("openai");
		expect(capturedModel).toBe("gpt-expensive");
		expect(result.classifierModel).toEqual({ provider: "openai", id: "gpt-expensive" });
	});

	it("classifierModel works even when listModels returns empty", async () => {
		const emptyListModels: ModelLister = () => [];
		let capturedModel = "";
		const capturingComplete: CompleteFn = async (_p, modelId) => {
			capturedModel = modelId;
			return '{"type": "text", "complexity": 2, "reasoning": "simple task"}';
		};
		const result = await classifyTask(
			"Write a doc",
			"text",
			{
				listModels: emptyListModels,
				complete: capturingComplete,
			},
			{
				classifierModel: { provider: "anthropic", id: "claude-haiku" },
			}
		);
		expect(capturedModel).toBe("claude-haiku");
		expect(result.type).toBe("text");
		expect(result.complexity).toBe(2);
		expect(result.classifierModel).toEqual({ provider: "anthropic", id: "claude-haiku" });
	});

	it("backward compat: string agentRole still works", async () => {
		let capturedPrompt = "";
		const capturingComplete: CompleteFn = async (_p, _m, prompt) => {
			capturedPrompt = prompt;
			return '{"type": "code", "complexity": 3, "reasoning": "test"}';
		};
		await classifyTask(
			"Fix a bug",
			"code",
			{
				listModels,
				complete: capturingComplete,
			},
			"security auditor"
		);
		expect(capturedPrompt).toContain("security auditor");
	});

	it("options object supports agentRole alongside classifierModel", async () => {
		let capturedPrompt = "";
		let capturedModel = "";
		const capturingComplete: CompleteFn = async (_p, modelId, prompt) => {
			capturedPrompt = prompt;
			capturedModel = modelId;
			return '{"type": "code", "complexity": 4, "reasoning": "complex"}';
		};
		await classifyTask(
			"Audit the auth system",
			"code",
			{
				listModels,
				complete: capturingComplete,
			},
			{
				agentRole: "security auditor",
				classifierModel: { provider: "openai", id: "gpt-expensive" },
			}
		);
		expect(capturedPrompt).toContain("security auditor");
		expect(capturedModel).toBe("gpt-expensive");
	});
});
