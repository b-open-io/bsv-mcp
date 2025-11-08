/**
 * Simple logger utility for consistent output formatting
 */
export const logger = {
	info: (message: string) => console.error(`ℹ️ ${message}`),
	success: (message: string) => console.error(`✅ ${message}`),
	warn: (message: string) => console.error(`⚠️ ${message}`),
	error: (message: string, error?: unknown) => {
		if (error) {
			console.error(`❌ ${message}:`, error);
		} else {
			console.error(`❌ ${message}`);
		}
	},
	debug: (message: string, ...args: unknown[]) => {
		if (process.env.DEBUG === "true") {
			console.error(`🐛 ${message}`, ...args);
		}
	},
};
