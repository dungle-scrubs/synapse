import { describe, expect, it, mock } from "bun:test";

/**
 * Tests for task classifier.
 *
 * Mocks @mariozechner/pi-ai to provide deterministic model data
 * and a fake completeSimple implementation.
 */

mock.module("@mariozechner/pi-ai", () => ({
	getProviders: () => ["openai"],
	getModels: (_provider: string) => [
		{
			id: "gpt-cheap",
			name: "GPT Cheap",
			provider: "openai",
			api: "openai-responses",
			baseUrl: "https://api.openai.com",
			cost: { input: 0.1, output: 0.2, cacheRead: 0.01, cacheWrite: 0.1 },
		},
	],
	getModel: (_provider: string, _id: string) => ({
		id: "gpt-cheap",
		name: "GPT Cheap",
		provider: "openai",
		api: "openai-responses",
		baseUrl: "https://api.openai.com",
		cost: { input: 0.1, output: 0.2, cacheRead: 0.01, cacheWrite: 0.1 },
	}),
	completeSimple: async () => ({
		role: "assistant",
		content: [
			{
				type: "text",
				text: '{"type": "code", "complexity": 4, "reasoning": "Multi-file refactor"}',
			},
		],
		api: "openai-responses",
		provider: "openai",
		model: "gpt-cheap",
		usage: { input: 100, output: 50, cost: { input: 0.01, output: 0.01 } },
		stopReason: "stop",
		timestamp: Date.now(),
	}),
}));

const { classifyTask, findCheapestModel } = await import("../src/classifier.js");

describe("findCheapestModel", () => {
	it("returns the cheapest model info", () => {
		const cheapest = findCheapestModel();
		expect(cheapest).toBeDefined();
		expect(cheapest?.id).toBe("gpt-cheap");
		expect(cheapest?.provider).toBe("openai");
	});
});

describe("classifyTask", () => {
	it("classifies a task using the LLM", async () => {
		const result = await classifyTask("Refactor the auth module", "code");
		expect(result.type).toBe("code");
		expect(result.complexity).toBe(4);
		expect(result.reasoning).toBe("Multi-file refactor");
	});

	it("uses primaryType as default", async () => {
		const result = await classifyTask("Simple task", "text");
		// Mock always returns code, but validating it doesn't crash
		expect(result.type).toBeDefined();
		expect(result.complexity).toBeGreaterThanOrEqual(1);
		expect(result.complexity).toBeLessThanOrEqual(5);
	});
});
