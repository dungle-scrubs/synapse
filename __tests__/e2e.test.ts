import { describe, expect, it, mock } from "bun:test";

/**
 * End-to-end tests for the full synapse routing pipeline.
 *
 * Exercises the complete flow: resolve → classify → select,
 * including cross-module interactions, config parsing, and
 * the explain API.
 */

mock.module("@mariozechner/pi-ai", () => ({
	getProviders: () => ["anthropic", "google", "openai", "openai-codex"],
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
					id: "gpt-5.1-codex",
					name: "GPT-5.1 Codex",
					provider: "openai-codex",
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				},
			],
		};
		return models[provider] ?? [];
	},
}));

const { classifyTask, findCheapestModel } = await import("../src/classifier.js");
const {
	getModelRatings,
	modelSupportsTask,
	parseSynapseConfig,
	createModelMatrixOverrideTemplate,
	parseModelMatrixOverrides,
	MODEL_MATRIX,
} = await import("../src/matrix.js");
const { resolveModelFuzzy, resolveModelCandidates, listAvailableModels } = await import(
	"../src/resolver.js"
);
const { selectModels, selectModelsExplained, ROUTING_MODES, getDefaultModePolicy } = await import(
	"../src/selector.js"
);
const { sanitizeRoutingSignalsSnapshot, sanitizeRoutingModePolicyOverride, buildRouteSignalKey } =
	await import("../src/routing-signals.js");

import type {
	CandidateModel,
	ClassificationResult,
	CostPreference,
	ModelSource,
	RoutingMode,
} from "../src/types.js";

/** Model source that returns the mocked registry as CandidateModels. */
const registrySource: ModelSource = () => {
	const all: CandidateModel[] = [];
	const providers = ["anthropic", "google", "openai", "openai-codex"];
	const registry: Record<string, CandidateModel[]> = {
		anthropic: [
			{ id: "claude-opus-4-6", name: "Claude Opus 4.6", provider: "anthropic" },
			{ id: "claude-sonnet-4-5-20250514", name: "Claude Sonnet 4.5", provider: "anthropic" },
			{ id: "claude-haiku-4-5-20250514", name: "Claude Haiku 4.5", provider: "anthropic" },
		],
		google: [{ id: "gemini-3-flash", name: "Gemini 3 Flash", provider: "google" }],
		openai: [{ id: "gpt-5.1", name: "GPT-5.1", provider: "openai" }],
		"openai-codex": [{ id: "gpt-5.1-codex", name: "GPT-5.1 Codex", provider: "openai-codex" }],
	};
	for (const p of providers) {
		all.push(...(registry[p] ?? []));
	}
	return all;
};

describe("E2E: resolve → classify → select", () => {
	it("routes 'opus' query to claude-opus via eco", async () => {
		// Step 1: Resolve
		const resolved = resolveModelFuzzy("opus", registrySource);
		expect(resolved).toBeDefined();
		expect(resolved?.id).toBe("claude-opus-4-6");

		// Step 2: Classify
		const classification = await classifyTask(
			"Refactor the authentication module across 5 files",
			"code",
			{
				listModels: () => [
					{ provider: "openai-codex", id: "gpt-5.1-codex", cost: { input: 0, output: 0 } },
				],
				complete: async () =>
					'{"type": "code", "complexity": 4, "reasoning": "Multi-file refactor"}',
			}
		);
		expect(classification.type).toBe("code");
		expect(classification.complexity).toBe(4);

		// Step 3: Select
		const ranked = selectModels(classification, "eco");
		expect(ranked.length).toBeGreaterThan(0);
		// At complexity 4 eco: haiku (code:3) is filtered, rest sorted by cost
		const ids = ranked.map((m) => m.id);
		expect(ids).not.toContain("claude-haiku-4-5-20250514");
	});

	it("routes scoped 'codex' query through pool-based selection", async () => {
		// Step 1: Resolve all codex candidates
		const candidates = resolveModelCandidates("codex", registrySource);
		expect(candidates.length).toBeGreaterThan(0);
		const codexModels = candidates.filter((c) => c.id.includes("codex"));
		expect(codexModels.length).toBeGreaterThan(0);

		// Step 2: Classify
		const classification: ClassificationResult = {
			type: "code",
			complexity: 2,
			reasoning: "Simple edit",
		};

		// Step 3: Select from pool
		const ranked = selectModels(classification, "eco", { pool: codexModels });
		expect(ranked.length).toBeGreaterThan(0);
		for (const m of ranked) {
			expect(m.id).toContain("codex");
		}
	});

	it("full pipeline with routing mode and signals", async () => {
		const classification: ClassificationResult = {
			type: "code",
			complexity: 3,
			reasoning: "Moderate task",
		};

		const signals = sanitizeRoutingSignalsSnapshot({
			generatedAtMs: Date.now(),
			routes: {
				"google/gemini-3-flash": {
					latencyP90Ms: 200,
					uptime: 0.995,
					errorRate: 0.01,
					observedAtMs: Date.now(),
				},
				"anthropic/claude-sonnet-4-5-20250514": {
					latencyP90Ms: 800,
					uptime: 0.98,
					errorRate: 0.02,
					observedAtMs: Date.now(),
				},
				"anthropic/claude-opus-4-6": {
					latencyP90Ms: 3500,
					uptime: 0.99,
					errorRate: 0.03,
					observedAtMs: Date.now(),
				},
			},
		});
		expect(signals).toBeDefined();

		const result = selectModelsExplained(classification, "balanced", {
			routingMode: "fast",
			routingSignals: signals,
		});

		expect(result.explanation.path).toBe("mode");
		expect(result.explanation.signalsApplied).toBe(true);
		expect(result.models.length).toBeGreaterThan(0);

		// In fast mode, low-latency models should rank higher
		// Opus has latencyP90 3500ms > maxLatencyP90Ms 4000, so it's not filtered
		// but should score lower than gemini-flash (200ms) and sonnet (800ms)
		const geminiIdx = result.models.findIndex((m) => m.id === "gemini-3-flash");
		const opusIdx = result.models.findIndex((m) => m.id === "claude-opus-4-6");
		if (geminiIdx !== -1 && opusIdx !== -1) {
			expect(geminiIdx).toBeLessThan(opusIdx);
		}
	});
});

describe("E2E: config → overrides → selection", () => {
	it("parseSynapseConfig output flows through to selectModels", () => {
		const rawConfig = {
			exclude: ["openai-codex"],
			matrixOverrides: {
				"claude-haiku-4-5": { code: 5, text: 5, vision: 5 },
			},
		};

		const config = parseSynapseConfig(rawConfig);
		expect(config).toBeDefined();

		const classification: ClassificationResult = {
			type: "code",
			complexity: 5,
			reasoning: "Expert task",
		};

		const ranked = selectModels(classification, "eco", {
			exclude: config?.exclude,
			matrixOverrides: config?.matrixOverrides,
		});

		// openai-codex should be excluded
		expect(ranked.map((m) => m.provider)).not.toContain("openai-codex");

		// haiku boosted to code:5, should now pass complexity:5 filter
		expect(ranked.some((m) => m.id.includes("haiku"))).toBe(true);
	});

	it("createModelMatrixOverrideTemplate round-trips through parseModelMatrixOverrides", () => {
		const template = createModelMatrixOverrideTemplate({ includeCurrentMatrix: true });
		const overrides = parseModelMatrixOverrides(template);
		expect(overrides).toBeDefined();

		// Every key in MODEL_MATRIX should survive the round-trip
		// Use array form because keys like "gpt-5.2" contain dots that
		// toHaveProperty(string) interprets as nested path separators.
		for (const key of Object.keys(MODEL_MATRIX)) {
			expect(overrides).toHaveProperty([key]);
		}
	});
});

describe("E2E: classifier fallback → select", () => {
	it("fallback classification still produces valid selection results", async () => {
		// Simulate total classifier failure (no models available)
		const classification = await classifyTask("Build something", "code", {
			listModels: () => [],
			complete: async () => {
				throw new Error("no models");
			},
		});

		// Fallback: type=code, complexity=3
		expect(classification.type).toBe("code");
		expect(classification.complexity).toBe(3);

		// Selection should still work with fallback classification
		const ranked = selectModels(classification, "balanced");
		expect(ranked.length).toBeGreaterThan(0);
	});
});

describe("E2E: routing mode sweep", () => {
	it("every routing mode produces non-empty results for a moderate task", () => {
		const classification: ClassificationResult = {
			type: "code",
			complexity: 3,
			reasoning: "Moderate task",
		};

		for (const mode of ROUTING_MODES) {
			const ranked = selectModels(classification, "balanced", { routingMode: mode });
			expect(ranked.length).toBeGreaterThan(0);
		}
	});

	it("mode policies are consistent across all cost preferences", () => {
		const classification: ClassificationResult = {
			type: "text",
			complexity: 2,
			reasoning: "Simple text",
		};

		const costPrefs: CostPreference[] = ["eco", "balanced", "premium"];

		for (const mode of ROUTING_MODES) {
			for (const pref of costPrefs) {
				const result = selectModelsExplained(classification, pref, { routingMode: mode });
				expect(result.explanation.path).toBe("mode");
				expect(result.explanation.routingMode).toBe(mode);
				expect(result.models.length).toBeGreaterThan(0);

				// Composite scores should be in descending order
				const scores = result.explanation.rankedScores.map((s) => s.compositeScore ?? 0);
				for (let i = 1; i < scores.length; i++) {
					expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
				}
			}
		}
	});
});

describe("E2E: signal staleness gate", () => {
	it("stale signals are ignored, fresh signals are applied", () => {
		const classification: ClassificationResult = {
			type: "code",
			complexity: 3,
			reasoning: "test",
		};

		const signals = {
			generatedAtMs: Date.now() - 600_000, // 10 min ago
			routes: {
				"google/gemini-3-flash": { uptime: 0.5, errorRate: 0.5, observedAtMs: Date.now() },
			},
		};

		// With maxSignalAgeMs: signals are stale → ignored → gemini NOT penalized
		const staleResult = selectModelsExplained(classification, "eco", {
			routingMode: "reliable",
			maxSignalAgeMs: 300_000,
			routingSignals: signals,
		});
		expect(staleResult.explanation.signalsApplied).toBe(false);
		expect(staleResult.models.map((m) => `${m.provider}/${m.id}`)).toContain(
			"google/gemini-3-flash"
		);

		// Without maxSignalAgeMs: signals applied → gemini filtered by reliable constraints
		const freshResult = selectModelsExplained(classification, "eco", {
			routingMode: "reliable",
			routingSignals: signals,
		});
		expect(freshResult.explanation.signalsApplied).toBe(true);
		expect(freshResult.explanation.filterSummary.failedConstraints).toBeGreaterThan(0);
	});
});

describe("E2E: exclude + routing mode interaction", () => {
	it("exclusions reduce candidate pool before mode scoring", () => {
		const classification: ClassificationResult = {
			type: "code",
			complexity: 3,
			reasoning: "test",
		};

		const withExclude = selectModelsExplained(classification, "eco", {
			routingMode: "balanced",
			exclude: ["anthropic"],
		});

		const withoutExclude = selectModelsExplained(classification, "eco", {
			routingMode: "balanced",
		});

		// Excluded results should have fewer models
		expect(withExclude.models.length).toBeLessThan(withoutExclude.models.length);
		expect(withExclude.explanation.filterSummary.excluded).toBeGreaterThan(0);

		// No anthropic models in excluded results
		for (const m of withExclude.models) {
			expect(m.provider).not.toBe("anthropic");
		}
	});
});

describe("E2E: matrix overrides affect all downstream consumers", () => {
	it("boosted model appears in ratings, supports task, and gets selected", () => {
		const overrides = {
			"gpt-5.1-codex": { code: 5, text: 5, vision: 5 },
		};

		// Matrix lookup reflects override
		const ratings = getModelRatings("gpt-5.1-codex", { matrixOverrides: overrides });
		expect(ratings).toEqual({ code: 5, text: 5, vision: 5 });

		// modelSupportsTask reflects override
		expect(modelSupportsTask("gpt-5.1-codex", "vision", 5, { matrixOverrides: overrides })).toBe(
			true
		);
		// Without override, gpt-5.1-codex has no vision rating
		expect(modelSupportsTask("gpt-5.1-codex", "vision", 1)).toBe(false);

		// Selection reflects override — codex now passes vision:5 filter
		const ranked = selectModels({ type: "vision", complexity: 5, reasoning: "test" }, "eco", {
			matrixOverrides: overrides,
		});
		expect(ranked.some((m) => m.id === "gpt-5.1-codex")).toBe(true);
	});

	it("nullified model disappears from selection", () => {
		const overrides = { "claude-opus-4-6": null };

		expect(getModelRatings("claude-opus-4-6", { matrixOverrides: overrides })).toBeUndefined();

		const ranked = selectModels({ type: "code", complexity: 3, reasoning: "test" }, "premium", {
			matrixOverrides: overrides,
		});
		expect(ranked.map((m) => m.id)).not.toContain("claude-opus-4-6");
	});
});

describe("E2E: sanitized signals flow correctly into scoring", () => {
	it("legacy pipe-separated keys are normalized and applied", () => {
		const rawSignals = {
			generatedAtMs: Date.now(),
			routes: {
				"Anthropic|Claude-Sonnet-4-5-20250514": {
					latencyP90Ms: 100,
					uptime: 0.999,
					observedAtMs: Date.now(),
				},
			},
		};

		const sanitized = sanitizeRoutingSignalsSnapshot(rawSignals);
		expect(sanitized).toBeDefined();

		// Verify key normalization
		const expectedKey = buildRouteSignalKey("anthropic", "claude-sonnet-4-5-20250514");
		expect(sanitized?.routes).toHaveProperty(expectedKey);

		// Feed sanitized signals into selection
		const result = selectModelsExplained(
			{ type: "code", complexity: 3, reasoning: "test" },
			"eco",
			{
				routingMode: "fast",
				routingSignals: rawSignals, // raw signals get sanitized inside selectModels
			}
		);
		expect(result.explanation.signalsApplied).toBe(true);
	});
});

describe("E2E: listAvailableModels consistency", () => {
	it("every model from listAvailableModels is selectable when matrix covers it", () => {
		const available = listAvailableModels(registrySource);
		expect(available.length).toBeGreaterThan(0);

		// At least some of these should appear in selection results
		const ranked = selectModels({ type: "code", complexity: 1, reasoning: "test" }, "eco");
		expect(ranked.length).toBeGreaterThan(0);

		// All selected models should be from the available list
		for (const m of ranked) {
			expect(available).toContain(`${m.provider}/${m.id}`);
		}
	});
});
