import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from "zod";
import type { Wallet } from "./wallet";
import { createOrdinals } from "js-1sat-ord";
import type { Inscription, Destination, ChangeResult, PreMAP } from "js-1sat-ord";
import { Utils } from "@bsv/sdk";
const { toArray, toBase64 } = Utils;

// https://raw.githubusercontent.com/google/A2A/refs/heads/main/specification/json/a2a.json

// A2A AgentCard schema (per A2A spec)
const AgentCapabilitiesSchema = z.object({
  streaming: z.boolean().default(false),
  pushNotifications: z.boolean().default(false),
  stateTransitionHistory: z.boolean().default(false),
});
const AgentSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  examples: z.array(z.string()).nullable(),
  inputModes: z.array(z.string()).nullable(),
  outputModes: z.array(z.string()).nullable(),
});

// Provider per A2A spec
const AgentProviderSchema = z.object({
  organization: z.string(),
  url: z.string().url().nullable().default(null),
}).nullable().default(null);

// Authentication per A2A spec
const AgentAuthenticationSchema = z.object({
  schemes: z.array(z.string()),
  credentials: z.string().nullable().default(null),
}).nullable().default(null);

export const AgentCardSchema = z.object({
  name: z.string(),
  description: z.string().nullable().default(null),
  url: z.string().url(),
  provider: AgentProviderSchema,
  version: z.string(),
  documentationUrl: z.string().url().nullable().default(null),
  capabilities: AgentCapabilitiesSchema,
  authentication: AgentAuthenticationSchema,
  defaultInputModes: z.array(z.string()).default(["text"]),
  defaultOutputModes: z.array(z.string()).default(["text"]),
  skills: z.array(AgentSkillSchema),
});

// Schema for on-chain agent publish parameters
export const a2bPublishArgsSchema = z.object({
  agentUrl: z.string().url().describe("Agent base URL (e.g. https://example.com)"),
  agentName: z.string().describe("Human-friendly agent name"),
  description: z.string().nullable().optional().describe("Optional agent description"),
  providerOrganization: z.string().optional().describe("Optional provider organization name"),
  providerUrl: z.string().url().optional().describe("Optional provider URL"),
  version: z.string().optional().describe("Optional agent version"),
  documentationUrl: z.string().url().nullable().optional().describe("Optional documentation URL"),
  streaming: z.boolean().default(false).describe("Supports SSE (tasks/sendSubscribe)"),
  pushNotifications: z.boolean().default(false).describe("Supports push notifications"),
  stateTransitionHistory: z.boolean().default(false).describe("Supports state transition history"),
  defaultInputModes: z.array(z.string()).default(["text"]).describe("Default input modes"),
  defaultOutputModes: z.array(z.string()).default(["text"]).describe("Default output modes"),
  skills: z.array(AgentSkillSchema).optional().default([]).describe("List of agent skills"),
  destinationAddress: z.string().optional().describe("Optional target address for inscription"),
});
export type A2bPublishArgs = z.infer<typeof a2bPublishArgsSchema>;

/**
 * Registers the wallet_a2bPublish tool for publishing an agent record on-chain
 */
export function registerA2bPublishTool(server: McpServer, wallet: Wallet) {
  server.tool(
    "wallet_a2bPublish",
    "Publish an agent.json record on-chain via Ordinal inscription",
    { args: a2bPublishArgsSchema },
    async (
      { args }: { args: A2bPublishArgs },
      extra: RequestHandlerExtra
    ) => {
      try {
        const paymentPk = wallet.getPrivateKey();
        if (!paymentPk) throw new Error("No private key available");
        const { paymentUtxos } = await wallet.getUtxos();
        if (!paymentUtxos?.length) throw new Error("No payment UTXOs available to fund inscription");

        // Assemble AgentCard with defaults and user overrides
        const agentCard = {
          name: args.agentName,
          description: args.description ?? null,
          url: args.agentUrl,
          provider:
            args.providerOrganization && args.providerUrl
              ? { organization: args.providerOrganization, url: args.providerUrl }
              : null,
          version: args.version ?? "1.0.0",
          documentationUrl: args.documentationUrl ?? null,
          capabilities: {
            streaming: args.streaming,
            pushNotifications: args.pushNotifications,
            stateTransitionHistory: args.stateTransitionHistory,
          },
          authentication: null,
          defaultInputModes: args.defaultInputModes,
          defaultOutputModes: args.defaultOutputModes,
          skills: args.skills,
        };
        // Validate compliance
        AgentCardSchema.parse(agentCard);
        const fileContent = JSON.stringify(agentCard, null, 2);
        // Base64 payload for inscription
        const dataB64 = toBase64(toArray(fileContent));
        const inscription: Inscription = { dataB64, contentType: "application/json" };
        // Destination for the ordinal
        const walletAddress = paymentPk.toAddress().toString();
        const targetAddress = args.destinationAddress ?? walletAddress;
        const destinations: Destination[] = [{ address: targetAddress, inscription }];
        // Default MAP metadata: file path, content type, encoding
        const metaData: PreMAP = { app: 'bsv-mcp', type: 'agent' };

        // Inscribe the ordinal on-chain via js-1sat-ord
        const result = await createOrdinals({ utxos: paymentUtxos, destinations, paymentPk, changeAddress: walletAddress, metaData });
        const changeResult = result as ChangeResult;
        await changeResult.tx.broadcast();
        // Refresh UTXOs
        try { await wallet.refreshUtxos(); } catch {}
        // Return transaction details
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              txid: changeResult.tx.id("hex"),
              spentOutpoints: changeResult.spentOutpoints,
              payChange: changeResult.payChange,
              inscriptionAddress: targetAddress,
              agentCard,
            }),
          }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: msg }], isError: true };
      }
    }
  );
} 