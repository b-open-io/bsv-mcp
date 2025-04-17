import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from "zod";
import {
  transferOrdTokens,
  TokenType,
  TokenInputMode,
  TokenSelectionStrategy,
  selectTokenUtxos,
  type TransferOrdTokensConfig,
  type Utxo,
  type TokenUtxo,
  type Payment,
  type Distribution,
  type TokenChangeResult,
} from "js-1sat-ord";
import type { Wallet } from "../wallet";

// Schema for BSV-20/BSV-21 token transfer arguments
export const transferOrdTokenArgsSchema = z.object({
  protocol: z.enum(["bsv-20", "bsv-21"]),
  tokenID: z.string(),
  sendAmount: z.number(),
  paymentUtxos: z.array(
    z.object({ txid: z.string(), vout: z.number(), satoshis: z.number(), script: z.string() })
  ),
  tokenUtxos: z.array(
    z.object({ txid: z.string(), vout: z.number(), satoshis: z.literal(1), script: z.string(), amt: z.string(), id: z.string() })
  ),
  distributions: z.array(z.object({ address: z.string(), tokens: z.number() })),
  decimals: z.number(),
  additionalPayments: z.array(z.object({ to: z.string(), amount: z.number() })).optional(),
});
export type TransferOrdTokenArgs = z.infer<typeof transferOrdTokenArgsSchema>;

/**
 * Register the wallet_transferOrdToken tool for transferring BSV tokens.
 */
export function registerTransferOrdTokenTool(server: McpServer, wallet: Wallet) {
  server.tool(
    "wallet_transferOrdToken",
    "Transfers BSV-20 or BSV-21 tokens from your wallet via js-1sat-ord transferOrdTokens.",
    { args: transferOrdTokenArgsSchema },
    async (
      { args }: { args: TransferOrdTokenArgs },
      extra: RequestHandlerExtra
    ) => {
      try {
        // fetch keys
        const paymentPk = wallet.getPrivateKey();
        if (!paymentPk) throw new Error("No private key available");
        const ordPk = paymentPk;
        const changeAddress = paymentPk.toAddress().toString();
        const ordAddress = changeAddress;

        // select token UTXOs
        const { selectedUtxos: inputTokens } = selectTokenUtxos(
          args.tokenUtxos as TokenUtxo[],
          args.sendAmount,
          args.decimals,
          { inputStrategy: TokenSelectionStrategy.SmallestFirst, outputStrategy: TokenSelectionStrategy.LargestFirst }
        );

        // build config
        const config: TransferOrdTokensConfig = {
          protocol: args.protocol === "bsv-20" ? TokenType.BSV20 : TokenType.BSV21,
          tokenID: args.tokenID,
          utxos: args.paymentUtxos as Utxo[],
          inputTokens,
          distributions: args.distributions as Distribution[],
          tokenChangeAddress: ordAddress,
          changeAddress,
          paymentPk,
          ordPk,
          additionalPayments: args.additionalPayments as Payment[] || [],
          decimals: args.decimals,
          inputMode: TokenInputMode.Needed,
          splitConfig: { outputs: inputTokens.length === 1 ? 2 : 1, threshold: args.sendAmount },
        };

        // execute transfer
        const result: TokenChangeResult = await transferOrdTokens(config);
        await result.tx.broadcast();

        // refresh UTXOs
        try { await wallet.refreshUtxos(); } catch {}

        // respond
        return {
          content: [{ type: "text", text: JSON.stringify({
            txid: result.tx.id("hex"),
            spentOutpoints: result.spentOutpoints,
            payChange: result.payChange,
            tokenChange: result.tokenChange,
          }) }]
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: msg }], isError: true };
      }
    }
  );
} 