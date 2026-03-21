import { describe, expect, it } from "bun:test";
import { listAvailableModels, resolveModelCandidates, resolveModelFuzzy } from "../src/resolver.js";
import type { ModelSource } from "../src/types.js";

/**
 * Tests for fuzzy model resolution.
 *
 * Uses dependency injection (ModelSource) to test resolution cascade tiers
 * in isolation without requiring real provider configs or fragile mock.module.
 */

const testModels: ReturnType<ModelSource> = [
	{ id: "claude-opus-4-5-20250514", name: "Claude Opus 4.5", provider: "anthropic" },
	{ id: "claude-sonnet-4-5-20250514", name: "Claude Sonnet 4.5", provider: "anthropic" },
	{ id: "claude-haiku-4-5-20250514", name: "Claude Haiku 4.5", provider: "anthropic" },
	{ id: "gpt-5.2", name: "GPT-5.2", provider: "openai" },
	{ id: "gpt-5.1-codex", name: "GPT-5.1 Codex", provider: "openai" },
	{ id: "gemini-3-pro", name: "Gemini 3 Pro", provider: "google" },
];

/** @returns Static test model list */
const source: ModelSource = () => testModels;

describe("resolveModelFuzzy", () => {
	it("returns undefined for empty query", () => {
		expect(resolveModelFuzzy("", source)).toBeUndefined();
		expect(resolveModelFuzzy("  ", source)).toBeUndefined();
	});

	it("tier 1: exact ID match", () => {
		const result = resolveModelFuzzy("claude-opus-4-5-20250514", source);
		expect(result).toBeDefined();
		expect(result?.id).toBe("claude-opus-4-5-20250514");
		expect(result?.provider).toBe("anthropic");
	});

	it("tier 2: case-insensitive ID match", () => {
		const result = resolveModelFuzzy("Claude-Opus-4-5-20250514", source);
		expect(result).toBeDefined();
		expect(result?.id).toBe("claude-opus-4-5-20250514");
	});

	it("tier 2.5: normalized match — strips separators", () => {
		const result = resolveModelFuzzy("gpt5.1codex", source);
		expect(result).toBeDefined();
		expect(result?.id).toBe("gpt-5.1-codex");
	});

	it("tier 3: provider/id format", () => {
		const result = resolveModelFuzzy("anthropic/claude-opus-4-5-20250514", source);
		expect(result).toBeDefined();
		expect(result?.id).toBe("claude-opus-4-5-20250514");
		expect(result?.provider).toBe("anthropic");
	});

	it("tier 4: token overlap — 'opus' matches Opus model", () => {
		const result = resolveModelFuzzy("opus", source);
		expect(result).toBeDefined();
		expect(result?.id).toContain("opus");
	});

	it("tier 4: token overlap — 'sonnet 4.5' matches Sonnet 4.5", () => {
		const result = resolveModelFuzzy("sonnet 4.5", source);
		expect(result).toBeDefined();
		expect(result?.id).toContain("sonnet");
	});

	it("supports matrixOverrides for capability-based tiebreaking", () => {
		const sonnetModels: ReturnType<ModelSource> = [
			{ id: "claude-sonnet-4-5-20250514", name: "Claude Sonnet 4.5", provider: "anthropic" },
			{ id: "claude-sonnet-4-6-20250514", name: "Claude Sonnet 4.6", provider: "anthropic" },
		];
		const result = resolveModelFuzzy("sonnet", () => sonnetModels, undefined, {
			matrixOverrides: {
				"claude-sonnet-4-5": { code: 5, text: 5, vision: 5 },
				"claude-sonnet-4-6": { code: 1, text: 1, vision: 1 },
			},
		});
		expect(result).toBeDefined();
		expect(result?.id).toBe("claude-sonnet-4-5-20250514");
	});

	it("tier 4: tiebreak prefers shorter ID", () => {
		const result = resolveModelFuzzy("gpt 5.2", source);
		expect(result).toBeDefined();
		expect(result?.id).toBe("gpt-5.2");
	});

	it("tier 4: numeric-aware ID tiebreak prefers 5.10 over 5.2", () => {
		const versionModels: ReturnType<ModelSource> = [
			{ id: "model-5.2-pro", name: "Model 5.2 Pro", provider: "vendor" },
			{ id: "model-5.10-pro", name: "Model 5.10 Pro", provider: "vendor" },
		];
		const result = resolveModelFuzzy("model", () => versionModels);
		expect(result).toBeDefined();
		expect(result?.id).toBe("model-5.10-pro");
	});

	it("tier 5: substring match", () => {
		const result = resolveModelFuzzy("gemini", source);
		expect(result).toBeDefined();
		expect(result?.id).toBe("gemini-3-pro");
	});

	it("tier 6: normalized substring match — strips separators before substring compare", () => {
		// "flash3" normalized is "flash3", gemini-3-flash normalized is "gemini3flash" which contains "flash3"?
		// No — need a query whose normalized form is a substring of a normalized model ID
		// but does NOT match at tiers 1-5.
		// Use a model source where the query can only match via tier 6.
		const tier6Models: ReturnType<ModelSource> = [
			{ id: "my-special-model-v2", name: "Special Model V2", provider: "vendor" },
		];
		// "specialv2" normalized = "specialv2", model ID normalized = "myspecialmodelv2"
		// "specialv2" is NOT a token match (tokens: ["special", "v2"] would match at tier 4)
		// Actually tokens would match at tier 4. Need something that fails tier 4 too.
		// Query that is a single token not in ID/name, but normalized substring works:
		// "modelv2" → tokens ["model", "v2"] → tier 4 matches (model appears in name).
		// Better: use a query where token-overlap ties with another but substring doesn't.
		// Simplest: a query that's a normalized substring but whose raw form contains no spaces/separators
		const result = resolveModelFuzzy("specialmodelv", () => tier6Models);
		// tokens: ["specialmodelv"] — not in id "my-special-model-v2" as raw substring (tier 5 fails)
		// normalized id: "myspecialmodelv2" contains "specialmodelv" → tier 6 hits
		expect(result).toBeDefined();
		expect(result?.id).toBe("my-special-model-v2");
	});

	it("returns undefined for no match", () => {
		expect(resolveModelFuzzy("nonexistent-model-xyz", source)).toBeUndefined();
	});
});

describe("resolveModelFuzzy — preferredProviders", () => {
	const multiProviderModels: ReturnType<ModelSource> = [
		{ id: "claude-sonnet-4-6-20250514", name: "Claude Sonnet 4.6", provider: "anthropic" },
		{ id: "claude-sonnet-4-6-20250514", name: "Claude Sonnet 4.6", provider: "openrouter" },
		{ id: "claude-sonnet-4-6-20250514", name: "Claude Sonnet 4.6", provider: "anthropic-sub" },
		{ id: "claude-sonnet-4-5-20250514", name: "Claude Sonnet 4.5", provider: "anthropic" },
		{ id: "claude-sonnet-4-5-20250514", name: "Claude Sonnet 4.5", provider: "openrouter" },
	];
	const mpSource: ModelSource = () => multiProviderModels;

	it("prefers subscription provider over API key and aggregator", () => {
		const result = resolveModelFuzzy("sonnet", mpSource, [
			"anthropic-sub",
			"anthropic",
			"openrouter",
		]);
		expect(result).toBeDefined();
		expect(result?.id).toBe("claude-sonnet-4-6-20250514");
		expect(result?.provider).toBe("anthropic-sub");
	});

	it("prefers API key over aggregator when no subscription available", () => {
		const noSubModels: ReturnType<ModelSource> = [
			{ id: "claude-sonnet-4-6-20250514", name: "Claude Sonnet 4.6", provider: "anthropic" },
			{ id: "claude-sonnet-4-6-20250514", name: "Claude Sonnet 4.6", provider: "openrouter" },
		];
		const result = resolveModelFuzzy("sonnet", () => noSubModels, [
			"anthropic-sub",
			"anthropic",
			"openrouter",
		]);
		expect(result).toBeDefined();
		expect(result?.provider).toBe("anthropic");
	});

	it("falls back gracefully when no preferred provider matches", () => {
		const result = resolveModelFuzzy("sonnet", mpSource, ["some-other-provider"]);
		expect(result).toBeDefined();
		// All providers tie on preference (all Infinity), falls through to model-ID tiebreaks
		expect(result?.id).toBe("claude-sonnet-4-6-20250514");
	});

	it("does not override capability score — higher capability still wins", () => {
		// sonnet-4-6 has higher capability than sonnet-4-5
		// Even if sonnet-4-5's provider is preferred first, capability wins
		const result = resolveModelFuzzy("sonnet", mpSource, [
			"openrouter", // openrouter has both 4-5 and 4-6
			"anthropic-sub",
			"anthropic",
		]);
		expect(result).toBeDefined();
		// 4-6 should still win (higher capability), from openrouter since that's preferred
		expect(result?.id).toBe("claude-sonnet-4-6-20250514");
		expect(result?.provider).toBe("openrouter");
	});

	it("no-op when preferredProviders is empty", () => {
		const withPref = resolveModelFuzzy("sonnet", mpSource, []);
		const withoutPref = resolveModelFuzzy("sonnet", mpSource);
		expect(withPref?.id).toBe(withoutPref?.id);
	});
});

describe("resolveModelCandidates", () => {
	it("returns all tied candidates for ambiguous query", () => {
		// "glm" matches glm-5 from both z-ai and openrouter
		const multiSource: ModelSource = () => [
			{ id: "glm-5", name: "GLM 5", provider: "z-ai" },
			{ id: "glm-5", name: "GLM 5", provider: "openrouter" },
			{ id: "gpt-5.2", name: "GPT-5.2", provider: "openai" },
		];
		const candidates = resolveModelCandidates("glm-5", multiSource);
		expect(candidates.length).toBe(2);
		for (const c of candidates) {
			expect(c.id).toBe("glm-5");
		}
	});

	it("returns empty for no match", () => {
		expect(resolveModelCandidates("nonexistent", source)).toEqual([]);
	});
});

describe("listAvailableModels", () => {
	it("lists all models from all providers", () => {
		const models = listAvailableModels(source);
		expect(models.length).toBe(6);
		expect(models).toContain("anthropic/claude-opus-4-5-20250514");
		expect(models).toContain("openai/gpt-5.2");
		expect(models).toContain("google/gemini-3-pro");
	});
});
