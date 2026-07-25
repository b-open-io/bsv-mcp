import { BigNumber, BSM, OP, type PrivateKey, Utils } from "@bsv/sdk";
import { AIP_PREFIX } from "../constants";

const { toArray } = Utils;

const PIPE = 0x7c;

/**
 * Sign OP_RETURN data with AIP (Author Identity Protocol)
 *
 * The signed message is the OP_RETURN opcode, then every push payload, then
 * the `|` protocol separator — the reconstruction every AIP verifier performs
 * (bsv-bap `verifyAttestationWithAIP`, `@1sat/templates` `AIP.validateAIP`,
 * go-templates). The signature is written as raw compact bytes, not as base64
 * text; verifiers base64-encode the pushdata themselves.
 *
 * @param dataArrays - Push payloads that follow OP_RETURN
 * @param signingKey - Private key to sign with
 * @param signingAddress - Address associated with the signing key
 * @returns Object containing the payloads with the AIP fields appended
 */
export async function signOpReturnWithAIP(
	dataArrays: number[][],
	signingKey: PrivateKey,
	signingAddress: string,
): Promise<{ signedData: number[][] }> {
	const messageToSign = [OP.OP_RETURN, ...dataArrays.flat(), PIPE];

	const signature = BSM.sign(messageToSign, signingKey, "raw");
	if (typeof signature === "string") {
		throw new Error("BSM.sign returned a string in raw mode");
	}

	const magicHash = new BigNumber(BSM.magicHash(messageToSign));
	const recovery = signature.CalculateRecoveryFactor(
		signingKey.toPublicKey(),
		magicHash,
	);
	const compactSignature = signature.toCompact(recovery, true);
	if (!Array.isArray(compactSignature)) {
		throw new Error("Signature.toCompact returned a string without encoding");
	}

	const aipData: number[][] = [
		toArray("|", "utf8"), // Separator
		toArray(AIP_PREFIX, "utf8"),
		toArray("BITCOIN_ECDSA", "utf8"),
		toArray(signingAddress, "utf8"),
		compactSignature,
	];

	return {
		signedData: [...dataArrays, ...aipData],
	};
}
