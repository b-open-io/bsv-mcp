import {
	BAP_PROTOCOL_ID,
	type OneSatContext,
	resolveCurrentKeyId,
} from "@1sat/actions";

export const BAP_IDENTITY_NOT_PUBLISHED = "BAP_IDENTITY_NOT_PUBLISHED";
export const SIGMA_CONTEXT_MISSING = "SIGMA_CONTEXT_MISSING";

export type SigmaSigningContextErrorCode =
	| typeof BAP_IDENTITY_NOT_PUBLISHED
	| typeof SIGMA_CONTEXT_MISSING;

export class SigmaSigningContextError extends Error {
	readonly code: SigmaSigningContextErrorCode;

	constructor(
		code: SigmaSigningContextErrorCode,
		message: string,
		options?: { cause?: unknown },
	) {
		super(message, options);
		this.name = "SigmaSigningContextError";
		this.code = code;
	}
}

export function isSigmaSigningContextError(
	error: unknown,
): error is SigmaSigningContextError {
	return error instanceof SigmaSigningContextError;
}

export interface SigmaSigningContext {
	protocolID: [1, "sigma"];
	keyID: string;
	publicKey: string;
}

const UNPUBLISHED_IDENTITY_PATTERN = /no BAP identity published/i;

export async function resolveSigmaSigningContext(
	ctx: OneSatContext | undefined,
): Promise<SigmaSigningContext> {
	if (!ctx?.wallet) {
		throw new SigmaSigningContextError(
			SIGMA_CONTEXT_MISSING,
			"Cannot resolve the Sigma signing context: no OneSat wallet context was provided.",
		);
	}
	let keyID: string;
	try {
		keyID = await resolveCurrentKeyId(ctx);
	} catch (error) {
		if (
			error instanceof Error &&
			UNPUBLISHED_IDENTITY_PATTERN.test(error.message)
		) {
			throw new SigmaSigningContextError(
				BAP_IDENTITY_NOT_PUBLISHED,
				"The BAP identity is not published: publish a BAP identity before Sigma signing so a current signing key can be resolved.",
				{ cause: error },
			);
		}
		throw error;
	}
	const { publicKey } = await ctx.wallet.getPublicKey({
		protocolID: BAP_PROTOCOL_ID,
		keyID,
		forSelf: true,
	});
	return {
		protocolID: BAP_PROTOCOL_ID as [1, "sigma"],
		keyID,
		publicKey,
	};
}
