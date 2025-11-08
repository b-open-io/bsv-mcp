import { BSM, type PrivateKey, Utils } from "@bsv/sdk";
import { AIP_PREFIX } from "../constants";

const { toArray, toBase64, toUTF8 } = Utils;

/**
 * Sign OP_RETURN data with AIP (Author Identity Protocol)
 * @param dataArrays - Array of data arrays to sign
 * @param signingKey - Private key to sign with
 * @param signingAddress - Address associated with the signing key
 * @returns Object containing signed data array
 */
export async function signOpReturnWithAIP(
	dataArrays: Uint8Array[],
	signingKey: PrivateKey,
	signingAddress: string,
): Promise<{ signedData: Uint8Array[] }> {
	// Concatenate all data arrays to create message to sign
	let messageToSign = new Uint8Array();
	for (const data of dataArrays) {
		const temp = new Uint8Array(messageToSign.length + data.length);
		temp.set(messageToSign);
		temp.set(data, messageToSign.length);
		messageToSign = temp;
	}

	// Create BSM signature
	const signature = BSM.sign(messageToSign, signingKey);

	// Convert signature to base64
	const signatureBase64 = toBase64(signature.toCompact());

	// Add AIP data to the arrays
	const aipData: Uint8Array[] = [
		toArray("|", "utf8"), // Separator
		toArray(AIP_PREFIX, "utf8"),
		toArray("BITCOIN_ECDSA", "utf8"),
		toArray(signingAddress, "utf8"),
		toArray(signatureBase64, "utf8"),
	];

	// Return combined data
	return {
		signedData: [...dataArrays, ...aipData],
	};
}
