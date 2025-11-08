import type { Identity, IdentityData, SchemaType } from "./types";

type AllFields = {
	schemaType: SchemaType;
	alternateName: string;
	description: string;
	bitcoinAddress: string;
};

export const buildIdentity = ({
	schemaType,
	alternateName,
	description,
	bitcoinAddress,
}: AllFields): string => {
	const identity: Identity = {
		"@context": "https://schema.org",
		"@type": schemaType as SchemaType,
		alternateName,
		description,
		bitcoinAddress,
	};

	if (description) {
		identity.description = description;
	}

	if (bitcoinAddress) {
		identity.bitcoinAddress = bitcoinAddress;
	}

	return JSON.stringify(identity);
};
