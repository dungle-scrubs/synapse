/**
 * Bun test preload — globally mocks @mariozechner/pi-ai.
 *
 * pi-ai is a peer dependency with heavy provider SDK side-effects that
 * fail to resolve in CI. Since all tests either use mock.module or DI,
 * we provide a minimal stub to prevent the real module from loading.
 *
 * Individual test files can override this with their own mock.module calls.
 */
import { mock } from "bun:test";

mock.module("@mariozechner/pi-ai", () => ({
	getProviders: () => [],
	getModels: () => [],
	getModel: () => undefined,
	completeSimple: async () => ({
		role: "assistant",
		content: [],
		api: "stub",
		provider: "stub",
		model: "stub",
		usage: { input: 0, output: 0, cost: { input: 0, output: 0 } },
		stopReason: "stop",
		timestamp: Date.now(),
	}),
}));
