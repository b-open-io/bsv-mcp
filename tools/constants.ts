/**
 * Constants for BSV MCP Tools
 */

/**
 * Market fee percentage applied to all marketplace purchases
 * Expressed as a decimal (e.g., 0.03 = 3%)
 */
export const MARKET_FEE_PERCENTAGE = 0.03;

/**
 * Market wallet address where fees are sent
 * This is the recipient address for marketplace fees
 */
export const MARKET_WALLET_ADDRESS = "15q8YQSqUa9uTh6gh4AVixxq29xkpBBP9z";

/**
 * Minimum fee in satoshis
 * Market fee will never be less than this amount
 */
export const MINIMUM_MARKET_FEE_SATOSHIS = 10000; // 10000 satoshis = 0.0001 BSV

export const BAP_PREFIX = "1BAPSuaPnfGnSBM3GLV9yhxUdYe4vGbdMT";
export const B_PREFIX = "19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut";
export const MAP_PREFIX = "1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5";
export const AIP_PREFIX = "1HPcP7a4kQjpJzyV4HWHKagon76KC3BsZA";
export const STORAGE_MNEMONIC_KEY = "id_mnemonic";
export const PUBLIC_URL = process.env.PUBLIC_URL || "";
export const BMAP_URL =
	process.env.PUBLIC_BMAP_URL || "https://bmap-api-production.up.railway.app";

export const ORDFS_URL =
	process.env.PUBLIC_ORDFS_URL || "https://ordfs.network";
export const YOURS_INSTALL_URL =
	"https://chromewebstore.google.com/detail/yours-wallet/mlbnicldlpdimbjdcncnklfempedeipj";

// export const BSOCIAL_API_URL =
// 	process.env.PUBLIC_BSOCIAL_API_URL ||
// 	"https://bsocial-overlay-production.up.railway.app/api/v1";

export const BSOCIAL_API_URL = "https://api.sigmaidentity.com/api/v1";
export const V5_API_URL = "https://ordinals.1sat.app/v5";
