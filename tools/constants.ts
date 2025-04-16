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
