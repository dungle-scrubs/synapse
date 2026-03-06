/**
 * Shared utility functions used across synapse modules.
 */

/**
 * Check whether an unknown value is a plain object record.
 *
 * @param value - Value to test
 * @returns True when value is a non-null, non-array object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Build a provider preference lookup map from an ordered list.
 *
 * @param preferredProviders - Ordered preferred provider names (earlier = higher priority)
 * @returns Provider name to priority index (lower = higher priority)
 */
export function buildProviderPreferenceMap(preferredProviders?: string[]): Map<string, number> {
	const prefMap = new Map<string, number>();
	if (!preferredProviders) return prefMap;
	for (let i = 0; i < preferredProviders.length; i++) {
		prefMap.set(preferredProviders[i], i);
	}
	return prefMap;
}

/**
 * Resolve provider priority from a preference map.
 *
 * @param prefMap - Provider priority map (from buildProviderPreferenceMap)
 * @param provider - Provider to score
 * @returns Priority index (lower is better, Infinity if not preferred)
 */
export function providerPriority(prefMap: ReadonlyMap<string, number>, provider: string): number {
	return prefMap.get(provider) ?? Number.POSITIVE_INFINITY;
}
