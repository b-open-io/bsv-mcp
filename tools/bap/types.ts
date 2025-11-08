import type { Place, PostalAddress } from "schema-dts";

export interface BapPublicKey {
	id: string;
	controller: string;
	type: "EcdsaSecp256k1VerificationKey2019";
	bitcoinAddress: string;
}

export enum SchemaType {
	Person = "Person",
	Organization = "Organization",
}

// Define our base Identity interface including common fields + custom ones
export interface Identity {
	// Common Schema.org fields we use
	"@context"?: string;
	"@type": SchemaType;
	alternateName?: string;
	description?: string;
	image?: string; // Used for Person
	logo?: string; // Used for Organization
	address?: string | PostalAddress;
	location?: Place; // Use Place from schema-dts
	homeLocation?: Place; // Use Place from schema-dts
	url?: string;
	email?: string;

	// Person specific (optional)
	givenName?: string;
	familyName?: string;

	// Organization specific (optional)
	legalName?: string;

	// Custom properties
	_id?: string;
	paymail?: string;
	bitcoinAddress?: string;
	banner?: string;
}

// Address related to BAP/blockchain context, not Schema.org PostalAddress
export type BapAddress = {
	address: string;
	txId: string;
	block: number;
};

export type IdentityData = {
	addresses?: BapAddress[]; // Use BapAddress type
	block: number;
	currentAddress: string;
	firstSeen: number;
	idKey: string; // BAP ID format
	identity: Identity;
	rootAddress: string;
	timestamp: number;
	valid: boolean;
};

// The API response structure for fetching a profile
export interface SigmaIdentityProfile {
	result: IdentityData;
}
