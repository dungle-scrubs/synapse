import { describe, expect, it } from "bun:test";
import {
	MODEL_ARENA_PRIORS,
	MODEL_MATRIX,
	createModelMatrixOverrideTemplate,
	getModelArenaPriors,
	getModelRatings,
	modelSupportsTask,
	parseModelMatrixOverrides,
	parseSynapseConfig,
} from "../src/matrix.js";

describe("getModelRatings", () => {
	it("returns exact match for known model", () => {
		const ratings = getModelRatings("claude-sonnet-4-5");
		expect(ratings).toEqual({ code: 4, vision: 3, text: 4 });
	});

	it("matches model IDs with date suffixes via prefix matching", () => {
		const ratings = getModelRatings("claude-sonnet-4-5-20250929");
		expect(ratings).toEqual({ code: 4, vision: 3, text: 4 });
	});

	it("strips provider prefix before matching", () => {
		const ratings = getModelRatings("anthropic/claude-opus-4-6");
		expect(ratings).toEqual({ code: 5, vision: 3, text: 5 });
	});

	it("strips nested provider prefixes before matching", () => {
		expect(getModelRatings("openrouter/z-ai/glm-5")).toEqual({ code: 5, text: 4 });
		expect(getModelRatings("openrouter/minimax/minimax-m2.1")).toEqual({ code: 4, text: 3 });
	});

	it("returns undefined for unknown model", () => {
		expect(getModelRatings("unknown-model-xyz")).toBeUndefined();
	});

	it("matches longest prefix (claude-haiku-4-5 not claude-haiku-4)", () => {
		const ratings = getModelRatings("claude-haiku-4-5-20250514");
		expect(ratings).toEqual({ code: 3, vision: 2, text: 3 });
	});

	it("handles models with only partial type coverage", () => {
		const ratings = getModelRatings("devstral-2");
		expect(ratings).toEqual({ code: 2 });
		expect(ratings?.vision).toBeUndefined();
		expect(ratings?.text).toBeUndefined();
	});

	it("handles models without code rating", () => {
		const ratings = getModelRatings("gemini-2.5-flash");
		expect(ratings).toEqual({ vision: 4, text: 4 });
		expect(ratings?.code).toBeUndefined();
	});
});

describe("getModelArenaPriors", () => {
	it("returns priors for known models", () => {
		expect(getModelArenaPriors("gemini-3-pro")).toEqual({ code: 1444, vision: 1288, text: 1486 });
	});

	it("supports nested provider-qualified IDs", () => {
		expect(getModelArenaPriors("openrouter/z-ai/glm-5")).toEqual({ code: 1456, text: 1452 });
	});

	it("returns undefined for unknown models", () => {
		expect(getModelArenaPriors("unknown-model")).toBeUndefined();
	});
});

describe("matrix overrides", () => {
	it("overrides base ratings when matrixOverrides provides a matching prefix", () => {
		const ratings = getModelRatings("claude-sonnet-4-5-20250929", {
			matrixOverrides: {
				"claude-sonnet-4-5": { code: 2, text: 2, vision: 2 },
			},
		});
		expect(ratings).toEqual({ code: 2, text: 2, vision: 2 });
	});

	it("adds entirely new model prefixes via matrixOverrides", () => {
		const ratings = getModelRatings("my-custom-model-v2", {
			matrixOverrides: {
				"my-custom-model": { code: 4, text: 5 },
			},
		});
		expect(ratings).toEqual({ code: 4, text: 5 });
	});

	it("removes base entries when override value is null", () => {
		const ratings = getModelRatings("claude-opus-4-6", {
			matrixOverrides: {
				"claude-opus-4-6": null,
			},
		});
		expect(ratings).toBeUndefined();
	});

	it("applies overrides in modelSupportsTask", () => {
		expect(
			modelSupportsTask("claude-sonnet-4-5", "code", 4, {
				matrixOverrides: {
					"claude-sonnet-4-5": { code: 2 },
				},
			})
		).toBe(false);
	});
});

describe("parseModelMatrixOverrides", () => {
	it("accepts direct override maps", () => {
		const parsed = parseModelMatrixOverrides({
			"claude-opus-4-6": { code: 3, text: 4, vision: 2 },
		});
		expect(parsed).toEqual({
			"claude-opus-4-6": { code: 3, text: 4, vision: 2 },
		});
	});

	it("accepts wrapped template files with matrixOverrides", () => {
		const parsed = parseModelMatrixOverrides({
			matrixOverrides: {
				"gemini-3-pro": { code: 5, text: 4, vision: 5 },
			},
		});
		expect(parsed).toEqual({
			"gemini-3-pro": { code: 5, text: 4, vision: 5 },
		});
	});

	it("drops invalid entries and keeps valid ones", () => {
		const parsed = parseModelMatrixOverrides({
			"bad-shape": "nope",
			"bad-rating": { code: 9 },
			"good-model": { code: 4, text: 2 },
		});
		expect(parsed).toEqual({
			"good-model": { code: 4, text: 2 },
		});
	});

	it("returns undefined when wrapped payload has invalid matrixOverrides root", () => {
		const parsed = parseModelMatrixOverrides({ matrixOverrides: "invalid" });
		expect(parsed).toBeUndefined();
	});
});

describe("createModelMatrixOverrideTemplate", () => {
	it("includes current matrix and empty exclude by default", () => {
		const template = createModelMatrixOverrideTemplate();
		expect(template.matrixOverrides["claude-opus-4-6"]).toEqual({ code: 5, vision: 3, text: 5 });
		expect(template.exclude).toEqual([]);
	});

	it("supports empty template generation", () => {
		const template = createModelMatrixOverrideTemplate({ includeCurrentMatrix: false });
		expect(template).toEqual({ exclude: [], matrixOverrides: {} });
	});
});

describe("parseSynapseConfig", () => {
	it("parses both exclude and matrixOverrides", () => {
		const config = parseSynapseConfig({
			exclude: ["openai", "google"],
			matrixOverrides: {
				"claude-opus-4-6": { code: 4, text: 4 },
			},
		});
		expect(config).toBeDefined();
		expect(config?.exclude).toEqual(["openai", "google"]);
		expect(config?.matrixOverrides).toEqual({
			"claude-opus-4-6": { code: 4, text: 4 },
		});
	});

	it("parses exclude-only config", () => {
		const config = parseSynapseConfig({ exclude: ["openai"] });
		expect(config).toBeDefined();
		expect(config?.exclude).toEqual(["openai"]);
		expect(config?.matrixOverrides).toBeUndefined();
	});

	it("parses matrixOverrides-only config", () => {
		const config = parseSynapseConfig({
			matrixOverrides: { "claude-opus-4-6": { code: 4 } },
		});
		expect(config).toBeDefined();
		expect(config?.exclude).toBeUndefined();
		expect(config?.matrixOverrides).toEqual({ "claude-opus-4-6": { code: 4 } });
	});

	it("drops non-string entries from exclude", () => {
		const config = parseSynapseConfig({
			exclude: ["openai", 42, null, "google", "", true],
		});
		expect(config?.exclude).toEqual(["openai", "google"]);
	});

	it("omits exclude when array has no valid entries", () => {
		const config = parseSynapseConfig({ exclude: [42, null, ""] });
		expect(config?.exclude).toBeUndefined();
	});

	it("returns empty config for empty object", () => {
		const config = parseSynapseConfig({});
		expect(config).toEqual({});
	});

	it("returns undefined for non-object input", () => {
		expect(parseSynapseConfig("string")).toBeUndefined();
		expect(parseSynapseConfig(null)).toBeUndefined();
		expect(parseSynapseConfig(42)).toBeUndefined();
		expect(parseSynapseConfig([])).toBeUndefined();
	});

	it("ignores unknown fields", () => {
		const config = parseSynapseConfig({
			exclude: ["openai"],
			unknownField: "hello",
		});
		expect(config).toEqual({ exclude: ["openai"] });
	});

	it("round-trips with createModelMatrixOverrideTemplate output", () => {
		const template = createModelMatrixOverrideTemplate({ includeCurrentMatrix: false });
		const config = parseSynapseConfig(template);
		expect(config).toEqual({});
	});
});

describe("modelSupportsTask", () => {
	it("returns true when rating meets minimum", () => {
		expect(modelSupportsTask("claude-opus-4-6", "code", 5)).toBe(true);
		expect(modelSupportsTask("claude-opus-4-6", "code", 3)).toBe(true);
	});

	it("returns false when rating is below minimum", () => {
		expect(modelSupportsTask("claude-haiku-4-5", "code", 4)).toBe(false);
	});

	it("returns false when type is not supported", () => {
		expect(modelSupportsTask("devstral-2", "vision", 1)).toBe(false);
		expect(modelSupportsTask("qwen3-max", "code", 1)).toBe(false);
	});

	it("returns false for unknown model", () => {
		expect(modelSupportsTask("unknown-model", "code", 1)).toBe(false);
	});

	it("cross-modality: vision task excludes text-only models", () => {
		expect(modelSupportsTask("glm-5", "vision", 1)).toBe(false);
		expect(modelSupportsTask("gemini-3-pro", "vision", 5)).toBe(true);
	});
});

describe("MODEL_ARENA_PRIORS completeness", () => {
	it("all prior scores are positive", () => {
		for (const [_modelId, priors] of Object.entries(MODEL_ARENA_PRIORS)) {
			for (const [_type, score] of Object.entries(priors)) {
				expect(score).toBeGreaterThan(0);
			}
		}
	});
});

describe("MODEL_MATRIX completeness", () => {
	it("has entries for all major providers", () => {
		const keys = Object.keys(MODEL_MATRIX);
		expect(keys.some((k) => k.startsWith("claude-"))).toBe(true);
		expect(keys.some((k) => k.startsWith("gpt-"))).toBe(true);
		expect(keys.some((k) => k.startsWith("gemini-"))).toBe(true);
		expect(keys.some((k) => k.startsWith("grok-"))).toBe(true);
	});

	it("all ratings are between 1 and 5", () => {
		for (const [_modelId, ratings] of Object.entries(MODEL_MATRIX)) {
			for (const [_type, rating] of Object.entries(ratings)) {
				expect(rating).toBeGreaterThanOrEqual(1);
				expect(rating).toBeLessThanOrEqual(5);
			}
		}
	});
});
