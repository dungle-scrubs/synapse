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

const { getDefaultModePolicy, ROUTING_MODES, selectModels, selectModelsExplained } = await import(
	"../src/selector.js"
);

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

	it("discards stale signals when maxSignalAgeMs is set", () => {
		const staleTime = Date.now() - 600_000; // 10 minutes ago
		// Stale signals + maxSignalAgeMs → signals discarded, gemini NOT filtered.
		const withStaleness = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco", {
			routingMode: "reliable",
			maxSignalAgeMs: 300_000, // 5 minutes
			routingSignals: {
				generatedAtMs: staleTime,
				routes: {
					"google/gemini-3-flash": { uptime: 0.82, observedAtMs: staleTime },
				},
			},
		});
		expect(withStaleness.map((m) => `${m.provider}/${m.id}`)).toContain("google/gemini-3-flash");

		// Without maxSignalAgeMs, same signals ARE applied and gemini is filtered.
		const withoutStaleness = selectModels(
			{ type: "code", complexity: 3, reasoning: "test" },
			"eco",
			{
				routingMode: "reliable",
				routingSignals: {
					generatedAtMs: staleTime,
					routes: {
						"google/gemini-3-flash": { uptime: 0.82, observedAtMs: staleTime },
					},
				},
			}
		);
		expect(withoutStaleness.map((m) => `${m.provider}/${m.id}`)).not.toContain(
			"google/gemini-3-flash"
		);
	});
});

describe("selectModelsExplained — legacy path", () => {
	it("returns explanation with path=legacy and filter summary", () => {
		const result = selectModelsExplained({ type: "code", complexity: 4, reasoning: "test" }, "eco");
		expect(result.explanation.path).toBe("legacy");
		expect(result.explanation.signalsApplied).toBe(false);
		expect(result.explanation.routingMode).toBeUndefined();
		expect(result.explanation.effectivePolicy).toBeUndefined();
		expect(result.models.length).toBeGreaterThan(0);
		expect(result.explanation.rankedScores.length).toBe(result.models.length);
		// haiku (code:3) should be filtered as belowFloor
		expect(result.explanation.filterSummary.belowFloor).toBeGreaterThan(0);
		expect(result.explanation.filterSummary.failedConstraints).toBe(0);
	});

	it("rankedScores have taskRating, effectiveCost, and no components", () => {
		const result = selectModelsExplained({ type: "code", complexity: 3, reasoning: "test" }, "eco");
		for (const score of result.explanation.rankedScores) {
			expect(score.taskRating).toBeDefined();
			expect(score.effectiveCost).toBeGreaterThanOrEqual(0);
			expect(score.components).toBeUndefined();
			expect(score.compositeScore).toBeUndefined();
		}
	});

	it("models array matches selectModels output", () => {
		const classification = { type: "code" as const, complexity: 3 as const, reasoning: "test" };
		const explained = selectModelsExplained(classification, "balanced");
		const simple = selectModels(classification, "balanced");
		expect(explained.models.map((m) => `${m.provider}/${m.id}`)).toEqual(
			simple.map((m) => `${m.provider}/${m.id}`)
		);
	});

	it("tracks excluded count in filter summary", () => {
		const result = selectModelsExplained(
			{ type: "code", complexity: 3, reasoning: "test" },
			"eco",
			{ exclude: ["openai"] }
		);
		// "openai" prefix excludes openai and openai-codex providers
		expect(result.explanation.filterSummary.excluded).toBeGreaterThan(0);
	});

	it("returns empty rankedScores when no candidates match", () => {
		const result = selectModelsExplained({ type: "code", complexity: 6, reasoning: "test" }, "eco");
		expect(result.models).toEqual([]);
		expect(result.explanation.rankedScores).toEqual([]);
		expect(result.explanation.filterSummary.belowFloor).toBeGreaterThan(0);
	});

	it("tracks noTaskRating for models missing the required task type", () => {
		// Override gpt-5.1 to remove vision, so the 3 providers serving it get filtered
		const result = selectModelsExplained(
			{ type: "vision", complexity: 1, reasoning: "test" },
			"eco",
			{ matrixOverrides: { "gpt-5.1": { code: 3, text: 4 } } }
		);
		expect(result.explanation.filterSummary.noTaskRating).toBeGreaterThan(0);
	});
});

describe("selectModelsExplained — mode path", () => {
	it("returns explanation with path=mode and component scores", () => {
		const result = selectModelsExplained(
			{ type: "code", complexity: 3, reasoning: "test" },
			"eco",
			{ routingMode: "balanced" }
		);
		expect(result.explanation.path).toBe("mode");
		expect(result.explanation.routingMode).toBe("balanced");
		expect(result.explanation.effectivePolicy).toBeDefined();
		expect(result.explanation.effectivePolicy?.weights).toBeDefined();
		expect(result.models.length).toBeGreaterThan(0);

		for (const score of result.explanation.rankedScores) {
			expect(score.compositeScore).toBeDefined();
			expect(typeof score.compositeScore).toBe("number");
			expect(score.components).toBeDefined();
			expect(score.components?.capability).toBeGreaterThanOrEqual(0);
			expect(score.components?.capability).toBeLessThanOrEqual(1);
			expect(score.components?.cost).toBeGreaterThanOrEqual(0);
			expect(score.components?.cost).toBeLessThanOrEqual(1);
		}
	});

	it("rankedScores are in descending composite score order", () => {
		const result = selectModelsExplained(
			{ type: "code", complexity: 3, reasoning: "test" },
			"eco",
			{ routingMode: "quality" }
		);
		const scores = result.explanation.rankedScores.map((s) => s.compositeScore ?? 0);
		for (let i = 1; i < scores.length; i++) {
			expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
		}
	});

	it("signals applied is true when fresh signals provided", () => {
		const result = selectModelsExplained(
			{ type: "code", complexity: 3, reasoning: "test" },
			"eco",
			{
				routingMode: "fast",
				routingSignals: {
					generatedAtMs: Date.now(),
					routes: {
						"anthropic/claude-opus-4-6": { latencyP90Ms: 3000, observedAtMs: Date.now() },
					},
				},
			}
		);
		expect(result.explanation.signalsApplied).toBe(true);
	});

	it("signals applied is false when signals are stale", () => {
		const result = selectModelsExplained(
			{ type: "code", complexity: 3, reasoning: "test" },
			"eco",
			{
				routingMode: "fast",
				maxSignalAgeMs: 300_000,
				routingSignals: {
					generatedAtMs: Date.now() - 600_000,
					routes: {},
				},
			}
		);
		expect(result.explanation.signalsApplied).toBe(false);
	});

	it("tracks failedConstraints count", () => {
		const result = selectModelsExplained(
			{ type: "code", complexity: 3, reasoning: "test" },
			"eco",
			{
				routingMode: "reliable",
				routingSignals: {
					generatedAtMs: Date.now(),
					routes: {
						"google/gemini-3-flash": { uptime: 0.82, observedAtMs: Date.now() },
					},
				},
			}
		);
		expect(result.explanation.filterSummary.failedConstraints).toBeGreaterThan(0);
	});

	it("effective policy reflects overrides", () => {
		const result = selectModelsExplained(
			{ type: "code", complexity: 3, reasoning: "test" },
			"eco",
			{
				routingMode: "balanced",
				routingModePolicyOverride: {
					weights: { capability: 0.9 },
				},
			}
		);
		expect(result.explanation.effectivePolicy?.weights.capability).toBe(0.9);
		// Other weights remain from the base balanced policy
		expect(result.explanation.effectivePolicy?.weights.cost).toBe(0.1);
	});

	it("arena scores appear in candidate scores when available", () => {
		const result = selectModelsExplained(
			{ type: "code", complexity: 3, reasoning: "test" },
			"eco",
			{ routingMode: "balanced" }
		);
		const opusScore = result.explanation.rankedScores.find((s) => s.model.id === "claude-opus-4-6");
		expect(opusScore).toBeDefined();
		expect(opusScore?.arenaScore).toBeDefined();
		expect(typeof opusScore?.arenaScore).toBe("number");
	});
});

describe("selectModels — constraint graceful degradation", () => {
	it("falls back to capable candidates when ALL fail hard constraints", () => {
		// Set ALL routes to fail reliable mode's strict uptime constraint (minUptime: 0.97)
		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "eco", {
			routingMode: "reliable",
			routingSignals: {
				generatedAtMs: Date.now(),
				routes: {
					"anthropic/claude-opus-4-6": { uptime: 0.8, observedAtMs: Date.now() },
					"anthropic/claude-sonnet-4-5-20250514": { uptime: 0.85, observedAtMs: Date.now() },
					"anthropic/claude-haiku-4-5-20250514": { uptime: 0.82, observedAtMs: Date.now() },
					"google/gemini-3-flash": { uptime: 0.81, observedAtMs: Date.now() },
					"openai/gpt-5.1": { uptime: 0.83, observedAtMs: Date.now() },
					"openai-codex/gpt-5.1": { uptime: 0.84, observedAtMs: Date.now() },
					"github-copilot/gpt-5.1": { uptime: 0.79, observedAtMs: Date.now() },
				},
			},
		});
		// Should NOT be empty — graceful degradation includes all capable candidates
		expect(ranked.length).toBeGreaterThan(0);
	});

	it("reports failedConstraints count matching total when all fail", () => {
		const result = selectModelsExplained(
			{ type: "code", complexity: 3, reasoning: "test" },
			"eco",
			{
				routingMode: "reliable",
				routingSignals: {
					generatedAtMs: Date.now(),
					routes: {
						"anthropic/claude-opus-4-6": { uptime: 0.8, observedAtMs: Date.now() },
						"anthropic/claude-sonnet-4-5-20250514": {
							uptime: 0.85,
							observedAtMs: Date.now(),
						},
						"anthropic/claude-haiku-4-5-20250514": {
							uptime: 0.82,
							observedAtMs: Date.now(),
						},
						"google/gemini-3-flash": { uptime: 0.81, observedAtMs: Date.now() },
						"openai/gpt-5.1": { uptime: 0.83, observedAtMs: Date.now() },
						"openai-codex/gpt-5.1": { uptime: 0.84, observedAtMs: Date.now() },
						"github-copilot/gpt-5.1": { uptime: 0.79, observedAtMs: Date.now() },
					},
				},
			}
		);
		// All capable candidates failed constraints
		expect(result.explanation.filterSummary.failedConstraints).toBe(result.models.length);
		expect(result.models.length).toBeGreaterThan(0);
	});
});

describe("selectModels — model signal prefix fallback", () => {
	it("resolves model signal via prefix key when exact key is missing", () => {
		// "claude-sonnet-4-5" is a prefix of "claude-sonnet-4-5-20250514"
		// The model key should be found via the prefix fallback path
		const result = selectModelsExplained(
			{ type: "code", complexity: 3, reasoning: "test" },
			"eco",
			{
				routingMode: "fast",
				routingSignals: {
					generatedAtMs: Date.now(),
					models: {
						// Prefix key that should match claude-sonnet-4-5-20250514
						"claude-sonnet-4-5": {
							observedAtMs: Date.now(),
							ttftMedianMs: 100,
							outputTpsMedian: 200,
						},
						// Exact key for opus — should match directly
						"claude-opus-4-6": {
							observedAtMs: Date.now(),
							ttftMedianMs: 2000,
							outputTpsMedian: 50,
						},
					},
					routes: {
						"anthropic/claude-sonnet-4-5-20250514": {
							latencyP90Ms: 300,
							observedAtMs: Date.now(),
						},
						"anthropic/claude-opus-4-6": {
							latencyP90Ms: 3000,
							observedAtMs: Date.now(),
						},
					},
				},
			}
		);
		expect(result.explanation.signalsApplied).toBe(true);
		// Sonnet should rank higher than Opus due to much lower latency
		const sonnetIdx = result.models.findIndex((m) => m.id.includes("sonnet"));
		const opusIdx = result.models.findIndex((m) => m.id.includes("opus"));
		expect(sonnetIdx).toBeLessThan(opusIdx);
	});

	it("resolves model signal via provider-scoped key", () => {
		const result = selectModelsExplained(
			{ type: "code", complexity: 3, reasoning: "test" },
			"eco",
			{
				routingMode: "balanced",
				routingSignals: {
					generatedAtMs: Date.now(),
					models: {
						// Provider-scoped key (second lookup path)
						"anthropic/claude-opus-4-6": {
							observedAtMs: Date.now(),
							ttftMedianMs: 500,
							outputTpsMedian: 100,
						},
					},
				},
			}
		);
		expect(result.explanation.signalsApplied).toBe(true);
		expect(result.models.length).toBeGreaterThan(0);
	});
});

describe("ROUTING_MODES", () => {
	it("contains all five routing modes", () => {
		expect(ROUTING_MODES).toEqual(["balanced", "cheap", "fast", "quality", "reliable"]);
	});

	it("is frozen", () => {
		expect(Object.isFrozen(ROUTING_MODES)).toBe(true);
	});
});

describe("getDefaultModePolicy", () => {
	it("returns the default policy for each mode", () => {
		for (const mode of ROUTING_MODES) {
			const policy = getDefaultModePolicy(mode);
			expect(policy.weights).toBeDefined();
			expect(policy.complexityBias).toBeDefined();
			expect(typeof policy.weights.capability).toBe("number");
			expect(typeof policy.weights.cost).toBe("number");
		}
	});

	it("default policies have weights summing to 1", () => {
		for (const mode of ROUTING_MODES) {
			const policy = getDefaultModePolicy(mode);
			const sum =
				policy.weights.capability +
				policy.weights.cost +
				policy.weights.latency +
				policy.weights.reliability +
				policy.weights.throughput;
			expect(Math.abs(sum - 1)).toBeLessThan(1e-10);
		}
	});

	it("returns a defensive copy — mutations do not affect defaults", () => {
		const policy = getDefaultModePolicy("balanced");
		const originalCapability = policy.weights.capability;
		(policy.weights as { capability: number }).capability = 99;

		const fresh = getDefaultModePolicy("balanced");
		expect(fresh.weights.capability).toBe(originalCapability);
	});

	it("quality mode has positive complexityBias", () => {
		expect(getDefaultModePolicy("quality").complexityBias).toBe(1);
	});

	it("cheap mode has negative complexityBias", () => {
		expect(getDefaultModePolicy("cheap").complexityBias).toBe(-1);
	});
});
