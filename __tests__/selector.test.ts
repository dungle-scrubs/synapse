import { describe, expect, it, mock } from "bun:test";

/**
 * Tests for the model selection algorithm (selectModels).
 *
 * Mocks @mariozechner/pi-ai to provide deterministic model data.
 */

mock.module("@mariozechner/pi-ai", () => ({
	getProviders: () => ["anthropic", "google", "openai", "openai-codex", "github-copilot"],
	getModels: (provider: string) => {
		const models: Record<string, Array<Record<string, unknown>>> = {
			anthropic: [
				{
					id: "claude-opus-4-6",
					name: "Claude Opus 4.6",
					provider: "anthropic",
					cost: { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 15 },
				},
				{
					id: "claude-sonnet-4-5-20250514",
					name: "Claude Sonnet 4.5",
					provider: "anthropic",
					cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3 },
				},
				{
					id: "claude-haiku-4-5-20250514",
					name: "Claude Haiku 4.5",
					provider: "anthropic",
					cost: { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 0.8 },
				},
			],
			google: [
				{
					id: "gemini-3-flash",
					name: "Gemini 3 Flash",
					provider: "google",
					cost: { input: 0.15, output: 0.6, cacheRead: 0.015, cacheWrite: 0.15 },
				},
			],
			openai: [
				{
					id: "gpt-5.1",
					name: "GPT-5.1",
					provider: "openai",
					cost: { input: 1.25, output: 10, cacheRead: 0.13, cacheWrite: 0 },
				},
			],
			"openai-codex": [
				{
					id: "gpt-5.1",
					name: "GPT-5.1",
					provider: "openai-codex",
					cost: { input: 1.25, output: 10, cacheRead: 0.13, cacheWrite: 0 },
				},
			],
			"github-copilot": [
				{
					id: "gpt-5.1",
					name: "GPT-5.1",
					provider: "github-copilot",
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				},
			],
		};
		return models[provider] ?? [];
	},
}));

const { selectModels } = await import("../src/selector.js");

describe("selectModels", () => {
	it("eco: ranks cheapest models first", () => {
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco");
		expect(ranked.length).toBeGreaterThan(0);
		// github-copilot/gpt-5.1 has cost 0, cheapest → should be first
		expect(ranked[0].id).toBe("gpt-5.1");
		expect(ranked[0].provider).toBe("github-copilot");
	});

	it("premium: ranks most expensive models first", () => {
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "premium");
		expect(ranked.length).toBeGreaterThan(0);
		expect(ranked[0].id).toBe("claude-opus-4-6");
	});

	it("balanced: prefers exact rating match, then cheapest", () => {
		const ranked = selectModels({ type: "code", complexity: 4, reasoning: "test" }, "balanced");
		expect(ranked.length).toBeGreaterThan(0);
		// Sonnet has code:4, exact match for complexity 4
		expect(ranked[0].id).toContain("sonnet");
	});

	it("filters out models that don't meet complexity requirement", () => {
		// Haiku has code:3, should be filtered for complexity 4+
		const ranked = selectModels({ type: "code", complexity: 4, reasoning: "test" }, "eco");
		expect(ranked.length).toBeGreaterThan(0);
		const ids = ranked.map((m) => m.id);
		expect(ids).not.toContain("claude-haiku-4-5-20250514");
	});

	it("returns multiple fallback candidates", () => {
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco");
		// Should have at least 3 candidates (gemini, haiku, sonnet, opus all have code >= 3)
		expect(ranked.length).toBeGreaterThanOrEqual(3);
	});

	it("returns empty array when no model meets requirements", () => {
		// No model has code:6 (max is 5)
		const ranked = selectModels({ type: "code", complexity: 6, reasoning: "test" }, "eco");
		expect(ranked).toEqual([]);
	});

	it("excludes text-only models for vision tasks", () => {
		const ranked = selectModels({ type: "vision", complexity: 3, reasoning: "test" }, "eco");
		// Only models with vision rating >= 3: Opus (3), Sonnet (3), Gemini (5)
		const ids = ranked.map((m) => m.id);
		expect(ids).not.toContain("claude-haiku-4-5-20250514"); // haiku has vision:2
	});

	it("accepts legacy pool array (backward compat)", () => {
		const pool = [
			{ provider: "anthropic", id: "claude-opus-4-6", displayName: "anthropic/claude-opus-4-6" },
		];
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco", pool);
		expect(ranked.length).toBe(1);
		expect(ranked[0].id).toBe("claude-opus-4-6");
	});

	it("skips pooled models missing registry cost metadata", () => {
		const pool = [{ provider: "unknown", id: "gpt-5.1", displayName: "unknown/gpt-5.1" }];
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco", pool);
		expect(ranked).toEqual([]);
	});

	it("respects matrixOverrides when filtering candidates", () => {
		const withoutOverride = selectModels({ type: "code", complexity: 4, reasoning: "test" }, "eco");
		expect(withoutOverride.map((m) => m.id)).not.toContain("claude-haiku-4-5-20250514");

		const withOverride = selectModels({ type: "code", complexity: 4, reasoning: "test" }, "eco", {
			matrixOverrides: {
				"claude-haiku-4-5": { code: 4, text: 3, vision: 2 },
			},
		});
		expect(withOverride.map((m) => m.id)).toContain("claude-haiku-4-5-20250514");
	});
});

describe("selectModels — preferredProviders", () => {
	it("breaks cost ties in favor of preferred provider (eco)", () => {
		// openai and openai-codex both have gpt-5.1 at identical cost
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco", {
			preferredProviders: ["openai-codex"],
		});
		// Find the gpt-5.1 entries
		const gpt51 = ranked.filter((m) => m.id === "gpt-5.1");
		expect(gpt51.length).toBeGreaterThanOrEqual(2);
		// openai-codex should come before openai when they tie on cost
		const codexIdx = gpt51.findIndex((m) => m.provider === "openai-codex");
		const openaiIdx = gpt51.findIndex((m) => m.provider === "openai");
		expect(codexIdx).toBeLessThan(openaiIdx);
	});

	it("breaks cost ties in favor of preferred provider (balanced)", () => {
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "balanced", {
			preferredProviders: ["openai-codex"],
		});
		const gpt51 = ranked.filter((m) => m.id === "gpt-5.1");
		expect(gpt51.length).toBeGreaterThanOrEqual(2);
		const codexIdx = gpt51.findIndex((m) => m.provider === "openai-codex");
		const openaiIdx = gpt51.findIndex((m) => m.provider === "openai");
		expect(codexIdx).toBeLessThan(openaiIdx);
	});

	it("breaks cost ties in favor of preferred provider (premium)", () => {
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "premium", {
			preferredProviders: ["openai-codex"],
		});
		const gpt51 = ranked.filter((m) => m.id === "gpt-5.1");
		expect(gpt51.length).toBeGreaterThanOrEqual(2);
		const codexIdx = gpt51.findIndex((m) => m.provider === "openai-codex");
		const openaiIdx = gpt51.findIndex((m) => m.provider === "openai");
		expect(codexIdx).toBeLessThan(openaiIdx);
	});

	it("does not override cost ranking — cheaper models still win", () => {
		// github-copilot has cost 0, so it should beat openai-codex even if
		// openai-codex is preferred — cost still takes priority
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco", {
			preferredProviders: ["openai-codex"],
		});
		const gpt51 = ranked.filter((m) => m.id === "gpt-5.1");
		expect(gpt51.length).toBeGreaterThanOrEqual(3);
		// github-copilot is cheapest (cost 0), should be first gpt-5.1 regardless
		expect(gpt51[0].provider).toBe("github-copilot");
	});

	it("respects priority order among preferred providers", () => {
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco", {
			preferredProviders: ["openai-codex", "openai"],
		});
		const gpt51 = ranked.filter((m) => m.id === "gpt-5.1");
		// Among the non-copilot gpt-5.1 models (same cost), codex should be before openai
		const paidModels = gpt51.filter((m) => m.provider !== "github-copilot");
		expect(paidModels[0].provider).toBe("openai-codex");
		expect(paidModels[1].provider).toBe("openai");
	});

	it("no-op when preferredProviders is empty", () => {
		const withPref = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco", {
			preferredProviders: [],
		});
		const withoutPref = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco");
		// Same ordering
		expect(withPref.map((m) => `${m.provider}/${m.id}`)).toEqual(
			withoutPref.map((m) => `${m.provider}/${m.id}`)
		);
	});
});

describe("selectModels — exclude", () => {
	it("excludes all models from a provider by prefix", () => {
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco", {
			exclude: ["openai"],
		});
		const providers = ranked.map((m) => m.provider);
		expect(providers).not.toContain("openai");
		expect(providers).not.toContain("openai-codex");
		// github-copilot serves gpt-5.1 but its provider doesn't start with "openai"
		expect(providers).toContain("github-copilot");
	});

	it("excludes a specific provider without affecting similar names", () => {
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco", {
			exclude: ["openai-codex"],
		});
		const providers = ranked.map((m) => m.provider);
		expect(providers).not.toContain("openai-codex");
		expect(providers).toContain("openai");
	});

	it("excludes by model ID prefix across all providers", () => {
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco", {
			exclude: ["gpt-5"],
		});
		const ids = ranked.map((m) => m.id);
		expect(ids).not.toContain("gpt-5.1");
		// Anthropic and Google models still present
		expect(ranked.some((m) => m.provider === "anthropic")).toBe(true);
		expect(ranked.some((m) => m.provider === "google")).toBe(true);
	});

	it("excludes by exact provider/model combo", () => {
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco", {
			exclude: ["openai/gpt-5.1"],
		});
		const keys = ranked.map((m) => `${m.provider}/${m.id}`);
		expect(keys).not.toContain("openai/gpt-5.1");
		// Same model from other providers still present
		expect(keys).toContain("openai-codex/gpt-5.1");
		expect(keys).toContain("github-copilot/gpt-5.1");
	});

	it("supports multiple exclude patterns", () => {
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco", {
			exclude: ["openai", "google"],
		});
		const providers = ranked.map((m) => m.provider);
		expect(providers).not.toContain("openai");
		expect(providers).not.toContain("openai-codex");
		expect(providers).not.toContain("google");
		expect(providers).toContain("anthropic");
		expect(providers).toContain("github-copilot");
	});

	it("returns empty when all candidates are excluded", () => {
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco", {
			exclude: ["anthropic", "openai", "google", "github-copilot"],
		});
		expect(ranked).toEqual([]);
	});

	it("ignores empty strings in exclude patterns", () => {
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco", {
			exclude: [""],
		});
		expect(ranked.length).toBeGreaterThan(0);
	});

	it("works with routing modes", () => {
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco", {
			exclude: ["anthropic"],
			routingMode: "balanced",
		});
		const providers = ranked.map((m) => m.provider);
		expect(providers).not.toContain("anthropic");
		expect(ranked.length).toBeGreaterThan(0);
	});
});

describe("selectModels — routing modes", () => {
	it("cheap mode can override premium sorting and pick cheaper models", () => {
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "premium", {
			routingMode: "cheap",
		});
		expect(ranked.length).toBeGreaterThan(0);
		expect(ranked[0].provider).toBe("github-copilot");
		expect(ranked[0].id).toBe("gpt-5.1");
	});

	it("quality mode raises effective complexity floor", () => {
		const ranked = selectModels({ type: "code", complexity: 4, reasoning: "test" }, "balanced", {
			routingMode: "quality",
		});
		const ids = ranked.map((m) => m.id);
		expect(ids).not.toContain("claude-sonnet-4-5-20250514");
		expect(ids).not.toContain("claude-haiku-4-5-20250514");
	});

	it("fast mode uses latency signals for ranking", () => {
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco", {
			routingMode: "fast",
			routingSignals: {
				generatedAtMs: Date.now(),
				routes: {
					"anthropic/claude-opus-4-6": { latencyP90Ms: 3500, observedAtMs: Date.now() },
					"anthropic/claude-sonnet-4-5-20250514": {
						latencyP90Ms: 400,
						observedAtMs: Date.now(),
					},
					"google/gemini-3-flash": { latencyP90Ms: 2200, observedAtMs: Date.now() },
					"github-copilot/gpt-5.1": { latencyP90Ms: 1800, observedAtMs: Date.now() },
					"openai-codex/gpt-5.1": { latencyP90Ms: 1700, observedAtMs: Date.now() },
					"openai/gpt-5.1": { latencyP90Ms: 1600, observedAtMs: Date.now() },
				},
			},
		});
		expect(ranked.length).toBeGreaterThan(0);
		expect(ranked[0].id).toBe("claude-sonnet-4-5-20250514");
	});

	it("reliable mode filters out low-uptime candidates", () => {
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco", {
			routingMode: "reliable",
			routingSignals: {
				generatedAtMs: Date.now(),
				routes: {
					"google/gemini-3-flash": { uptime: 0.82, observedAtMs: Date.now() },
					"github-copilot/gpt-5.1": { uptime: 0.995, observedAtMs: Date.now() },
				},
			},
		});
		expect(ranked.map((m) => `${m.provider}/${m.id}`)).not.toContain("google/gemini-3-flash");
	});

	it("mode policy override can relax strict quality floor", () => {
		const ranked = selectModels({ type: "code", complexity: 4, reasoning: "test" }, "balanced", {
			routingMode: "quality",
			routingModePolicyOverride: {
				complexityBias: 0,
			},
		});
		expect(ranked.map((m) => m.id)).toContain("claude-sonnet-4-5-20250514");
	});

	it("normalizes legacy pipe route keys via runtime sanitization", () => {
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco", {
			routingMode: "fast",
			routingSignals: {
				generatedAtMs: Date.now(),
				routes: {
					"anthropic|claude-sonnet-4-5-20250514": {
						latencyP90Ms: 250,
						observedAtMs: Date.now(),
					},
					"anthropic/claude-opus-4-6": {
						latencyP90Ms: 3000,
						observedAtMs: Date.now(),
					},
				},
			},
		});
		expect(ranked[0].id).toBe("claude-sonnet-4-5-20250514");
	});

	it("ignores invalid routing signal values instead of applying them", () => {
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco", {
			routingMode: "reliable",
			routingSignals: {
				generatedAtMs: Date.now(),
				routes: {
					"google/gemini-3-flash": {
						// invalid (>1), should be dropped at sanitization and not filtered
						uptime: 2,
						observedAtMs: Date.now(),
					},
				},
			},
		});
		expect(ranked.map((m) => `${m.provider}/${m.id}`)).toContain("google/gemini-3-flash");
	});
});
