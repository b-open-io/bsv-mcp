import type { OneSatContext } from "@1sat/actions";

/** Presence opts into explicit routing; an unassigned role never borrows another key. */
export interface WalletRoleContexts {
	payments?: OneSatContext;
	identity?: OneSatContext;
	ordinals?: OneSatContext;
	/** Omitted shares the identity key; null explicitly disables encryption. */
	encryption?: OneSatContext | null;
}
