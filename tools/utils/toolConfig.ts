/**
 * Tool category configuration
 */
export interface ToolCategory {
	name: string;
	envVar: string;
	defaultEnabled: boolean;
	register: (server: unknown, config?: unknown) => void;
	dependencies?: string[]; // Other categories this depends on
}

/**
 * Check if a tool category is enabled based on environment and config
 */
export function isToolEnabled(
	category: ToolCategory,
	config: Record<string, boolean | undefined> = {},
): boolean {
	const configKey = `enable${category.name}Tools`;

	// Check config override first
	if (configKey in config && config[configKey] !== undefined) {
		return config[configKey] as boolean;
	}

	// Check environment variable
	const envValue = process.env[category.envVar];
	if (envValue !== undefined) {
		// For ENABLE_* vars, check if === "true"
		// For DISABLE_* vars, check if !== "true"
		if (category.envVar.startsWith("ENABLE_")) {
			return envValue === "true";
		}
		return envValue !== "true";
	}

	// Return default
	return category.defaultEnabled;
}

/**
 * Register multiple tool categories with their dependencies
 */
export function registerToolCategories(
	server: unknown,
	categories: ToolCategory[],
	config: Record<string, boolean | undefined> = {},
): void {
	const enabled: Set<string> = new Set();

	// First pass: determine what's enabled
	for (const category of categories) {
		if (isToolEnabled(category, config)) {
			enabled.add(category.name);
		}
	}

	// Second pass: register enabled categories
	for (const category of categories) {
		if (enabled.has(category.name)) {
			// Check dependencies
			const missingDeps =
				category.dependencies?.filter((dep) => !enabled.has(dep)) || [];
			if (missingDeps.length > 0) {
				console.warn(
					`⚠️ ${category.name} tools not registered (missing dependencies: ${missingDeps.join(", ")})`,
				);
				continue;
			}

			// Register the category
			try {
				category.register(server, config);
				console.log(`✅ Registered ${category.name} tools`);
			} catch (error) {
				console.error(`❌ Failed to register ${category.name} tools:`, error);
			}
		}
	}
}
