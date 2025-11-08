/**
 * JWT validation middleware for OAuth 2.1 authentication
 *
 * This module validates JWT access tokens issued by the sigma-auth server
 * according to MCP 2025 specification and OAuth 2.1 standards.
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

/**
 * Extended JWT payload with BSV-specific claims
 */
export interface BSVJWTPayload extends JWTPayload {
	sub: string; // User ID
	email?: string;
	pubkey?: string; // Bitcoin public key
	bitcoinAddress?: string; // Bitcoin address
	scope?: string; // OAuth scopes
}

/**
 * JWT validation options
 */
export interface JWTValidationOptions {
	issuer: string; // Authorization server URL
	audience: string; // This resource server's URL
	jwksUrl?: string; // JWKS endpoint (default: issuer/.well-known/jwks.json)
}

/**
 * JWT validator class
 *
 * Validates JWT access tokens from the authorization server (sigma-auth).
 * Performs the following checks:
 * 1. Signature verification using JWKS
 * 2. Issuer validation
 * 3. Audience validation
 * 4. Expiration check
 * 5. Not-before check
 */
export class JWTValidator {
	private readonly issuer: string;
	private readonly audience: string;
	private readonly jwksUrl: string;
	private jwks: ReturnType<typeof createRemoteJWKSet>;

	constructor(options: JWTValidationOptions) {
		this.issuer = options.issuer;
		this.audience = options.audience;
		this.jwksUrl =
			options.jwksUrl || `${options.issuer}/.well-known/jwks.json`;

		// Create JWKS fetcher with caching
		this.jwks = createRemoteJWKSet(new URL(this.jwksUrl), {
			// Cache for 1 hour by default
			cacheMaxAge: 3600000,
			// Cooldown period to prevent JWKS refetch spam
			cooldownDuration: 30000,
		});
	}

	/**
	 * Validate a JWT access token
	 *
	 * @param token - The JWT access token to validate
	 * @returns The validated JWT payload
	 * @throws Error if validation fails
	 */
	async validate(token: string): Promise<BSVJWTPayload> {
		try {
			// Verify JWT signature and claims
			const { payload } = await jwtVerify(token, this.jwks, {
				issuer: this.issuer,
				audience: this.audience,
				// Require the standard claims
				requiredClaims: ["sub", "iss", "aud", "exp"],
			});

			// Return typed payload
			return payload as BSVJWTPayload;
		} catch (error) {
			if (error instanceof Error) {
				// Provide more specific error messages
				if (error.message.includes("signature")) {
					throw new Error("Invalid token signature");
				}
				if (error.message.includes("expired")) {
					throw new Error("Token has expired");
				}
				if (error.message.includes("issuer")) {
					throw new Error(`Invalid issuer. Expected: ${this.issuer}`);
				}
				if (error.message.includes("audience")) {
					throw new Error(`Invalid audience. Expected: ${this.audience}`);
				}
				throw new Error(`Token validation failed: ${error.message}`);
			}
			throw error;
		}
	}

	/**
	 * Extract and validate token from Authorization header
	 *
	 * @param authHeader - The Authorization header value
	 * @returns The validated JWT payload, or null if no token
	 * @throws Error if token is present but invalid
	 */
	async validateFromHeader(
		authHeader: string | null
	): Promise<BSVJWTPayload | null> {
		if (!authHeader) {
			return null;
		}

		// Check for Bearer token format
		if (!authHeader.startsWith("Bearer ")) {
			throw new Error('Authorization header must use Bearer scheme');
		}

		// Extract token
		const token = authHeader.substring(7).trim();
		if (!token) {
			throw new Error("Bearer token is empty");
		}

		// Validate and return
		return await this.validate(token);
	}

	/**
	 * Extract and validate token from Request object
	 *
	 * @param request - The HTTP request
	 * @returns The validated JWT payload, or null if no token
	 * @throws Error if token is present but invalid
	 */
	async validateFromRequest(
		request: Request
	): Promise<BSVJWTPayload | null> {
		const authHeader = request.headers.get("Authorization");
		return await this.validateFromHeader(authHeader);
	}
}

/**
 * Create a JWT validator instance for the MCP server
 *
 * @param resourceUrl - This MCP server's resource URL
 * @returns JWT validator instance
 */
export function createMCPJWTValidator(resourceUrl?: string): JWTValidator {
	const issuer =
		process.env.OAUTH_ISSUER || "https://auth.sigmaidentity.com";
	const audience = resourceUrl || process.env.RESOURCE_URL || "http://localhost:3000";

	return new JWTValidator({
		issuer,
		audience,
	});
}

/**
 * Generate WWW-Authenticate header for 401 responses
 *
 * Per RFC 9728 Section 5.1, the WWW-Authenticate header must include
 * the resource_metadata URL pointing to the Protected Resource Metadata endpoint.
 *
 * @param resourceUrl - The resource server URL
 * @param error - Optional error code (invalid_token, insufficient_scope, etc.)
 * @param errorDescription - Optional error description
 * @returns WWW-Authenticate header value
 */
export function generateWWWAuthenticate(
	resourceUrl: string,
	error?: string,
	errorDescription?: string
): string {
	let header = `Bearer realm="BSV-MCP", resource_metadata="${resourceUrl}/.well-known/oauth-protected-resource"`;

	if (error) {
		header += `, error="${error}"`;
	}

	if (errorDescription) {
		header += `, error_description="${errorDescription}"`;
	}

	return header;
}
