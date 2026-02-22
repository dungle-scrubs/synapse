import { describe, expect, it } from "bun:test";
import {
	buildModelSignalKey,
	buildProviderModelSignalKey,
	buildRouteSignalKey,
	parseRouteSignalKey,
	sanitizeRoutingModePolicyOverride,
	sanitizeRoutingSignalsSnapshot,
} from "../src/routing-signals.js";

describe("routing signal key helpers", () => {
	it("buildRouteSignalKey normalizes casing and whitespace", () => {
		expect(buildRouteSignalKey(" Anthropic ", " Claude-Sonnet-4-5 ")).toBe(
			"anthropic/claude-sonnet-4-5"
		);
	});

	it("parseRouteSignalKey parses canonical slash keys", () => {
		expect(parseRouteSignalKey("openai/gpt-5.1")).toEqual({
			modelId: "gpt-5.1",
			provider: "openai",
		});
	});

	it("parseRouteSignalKey parses legacy pipe keys", () => {
		expect(parseRouteSignalKey("OpenAI|GPT-5.1")).toEqual({
			modelId: "gpt-5.1",
			provider: "openai",
		});
	});

	it("parseRouteSignalKey rejects malformed keys", () => {
		expect(parseRouteSignalKey("openai")).toBeUndefined();
		expect(parseRouteSignalKey("/gpt-5.1")).toBeUndefined();
		expect(parseRouteSignalKey("openai/")).toBeUndefined();
	});

	it("buildModelSignalKey and buildProviderModelSignalKey normalize keys", () => {
		expect(buildModelSignalKey(" GPT-5.1 ")).toBe("gpt-5.1");
		expect(buildProviderModelSignalKey(" OpenAI ", " GPT-5.1 ")).toBe("openai/gpt-5.1");
	});
});

describe("sanitizeRoutingSignalsSnapshot", () => {
	it("normalizes keys and drops invalid fields", () => {
		const sanitized = sanitizeRoutingSignalsSnapshot({
			generatedAtMs: 123,
			models: {
				" GPT-5.1 ": {
					observedAtMs: 100,
					outputTpsMedian: 120,
					ttftMedianMs: -1,
				},
				"": { observedAtMs: 99 },
			},
			routes: {
				"Anthropic|Claude-Sonnet-4-5-20250514": {
					errorRate: 0.2,
					latencyP90Ms: 450,
					observedAtMs: 1,
					uptime: 1.2,
				},
				"bad-key": {
					latencyP90Ms: 900,
					observedAtMs: 1,
				},
			},
		});

		expect(sanitized).toEqual({
			generatedAtMs: 123,
			models: {
				"gpt-5.1": {
					observedAtMs: 100,
					outputTpsMedian: 120,
				},
			},
			routes: {
				"anthropic/claude-sonnet-4-5-20250514": {
					errorRate: 0.2,
					latencyP90Ms: 450,
					observedAtMs: 1,
				},
			},
		});
	});

	it("returns undefined when root is invalid", () => {
		expect(sanitizeRoutingSignalsSnapshot(undefined)).toBeUndefined();
		expect(sanitizeRoutingSignalsSnapshot({ generatedAtMs: -1 })).toBeUndefined();
		expect(sanitizeRoutingSignalsSnapshot({ generatedAtMs: "123" })).toBeUndefined();
	});
});

describe("sanitizeRoutingModePolicyOverride", () => {
	it("keeps valid fields and drops invalid values", () => {
		const sanitized = sanitizeRoutingModePolicyOverride({
			complexityBias: 1,
			constraints: {
				maxErrorRate: 2,
				maxLatencyP90Ms: 1200,
				minUptime: 0.99,
			},
			taskFloors: {
				code: 7,
				text: 3,
			},
			weights: {
				capability: -1,
				latency: 0.2,
				reliability: 0.5,
			},
		});

		expect(sanitized).toEqual({
			complexityBias: 1,
			constraints: {
				maxLatencyP90Ms: 1200,
				minUptime: 0.99,
			},
			taskFloors: {
				text: 3,
			},
			weights: {
				latency: 0.2,
				reliability: 0.5,
			},
		});
	});

	it("returns undefined when no valid fields remain", () => {
		expect(sanitizeRoutingModePolicyOverride({ weights: { capability: -1 } })).toBeUndefined();
		expect(sanitizeRoutingModePolicyOverride(undefined)).toBeUndefined();
	});
});
