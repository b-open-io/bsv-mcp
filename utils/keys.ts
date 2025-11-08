import { HD, Hash, Utils } from "@bsv/sdk";
import type { PrivateKey, PublicKey } from "@bsv/sdk";

/**
 * Get a signing path from a hex number
 *
 * @param hexString {string}
 * @param hardened {boolean} Whether to return a hardened path
 * @returns {string}
 */
const getSigningPathFromHex = (hexString: string, hardened = true) => {
	// "m/0/0/1"
	let signingPath = "m";
	const signingHex = hexString.match(/.{1,8}/g);
	const maxNumber = 2147483648 - 1; // 0x80000000

	if (!signingHex) return signingPath;

	for (const hexNumber of signingHex) {
		let number = Number(`0x${hexNumber}`);
		if (number > maxNumber) number -= maxNumber;
		signingPath += `/${number}${hardened ? "'" : ""}`;
	}
	return signingPath;
};

export const friendPrivateKeyFromSeedString = (
	seedString: string,
	xprv: string,
): PrivateKey => {
	if (!xprv) {
		throw new Error("no xprv!");
	}
	// Generate a key based on the other users id hash
	const seedHex = Utils.toHex(Hash.sha256(Utils.toArray(seedString)));
	const signingPath = getSigningPathFromHex(seedHex);

	const hdPrivateFriendKey = HD.fromString(xprv).derive(signingPath);

	return hdPrivateFriendKey.privKey;
};

export const friendPrivateKeyFromMemberIdKey = (
	memberIdKey: PrivateKey,
	targetBapId: string,
) => {
	return memberIdKey.deriveChild(memberIdKey.toPublicKey(), targetBapId);
};

export const friendPublicKeyFromSeedString = (
	seedString: string,
	xprv: string,
) => {
	return friendPrivateKeyFromSeedString(seedString, xprv).toPublicKey();
};
