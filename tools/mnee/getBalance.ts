import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from "zod";
import { PrivateKey } from "@bsv/sdk";
import type { MneeInterface } from "mnee";

export const getBalanceArgsSchema = z.object({});

export type GetBalanceArgs = z.infer<typeof getBalanceArgsSchema>;

export function registerGetBalanceTool(
  server: McpServer,
  mnee: MneeInterface
): void {
  server.tool(
    "mnee_getBalance",
    "Retrieves the current MNEE token balance for the wallet. Returns the balance in MNEE tokens.",
    {
      args: getBalanceArgsSchema,
    },
    async (
      { args }: { args: GetBalanceArgs },
      extra: RequestHandlerExtra<any, any>
    ) => {
      try {
        // Get private key from wallet
        const privateKey = PrivateKey.fromWif(process.env.PRIVATE_KEY_WIF!);
        if (!privateKey) {
          throw new Error("No private key available");
        }

        const address = privateKey.toAddress().toString();
        const balance = await mnee.balance(address);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ balance }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : String(error),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
