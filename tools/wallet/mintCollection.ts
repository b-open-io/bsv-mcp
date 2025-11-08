import { promises as fs } from "node:fs";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	CallToolResult,
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { createOrdinals } from "js-1sat-ord";
import type {
	ChangeResult,
	CollectionItemSubTypeData,
	CollectionSubTypeData,
	CollectionTraits,
	CreateOrdinalsCollectionItemMetadata,
	CreateOrdinalsCollectionMetadata,
	CreateOrdinalsConfig,
	LocalSigner,
	RarityLabels,
} from "js-1sat-ord";
import { z } from "zod";
import { V5Broadcaster } from "../../utils/broadcaster";
import type { Wallet } from "./wallet";

const mintCollectionArgsSchema = z.object({
	folderPath: z
		.string()
		.describe("Path to folder containing images to mint as a collection"),
	collectionName: z.string().describe("Name of the collection"),
	description: z.string().describe("Description of the collection"),
	rarityLabels: z
		.array(
			z.object({
				label: z.string(),
				percentage: z.number().min(0).max(100),
			}),
		)
		.optional()
		.describe("Rarity labels and their percentages"),
	traits: z
		.record(z.array(z.string()))
		.optional()
		.describe(
			"Collection traits as key-value pairs where values are arrays of possible trait values",
		),
	skipBroadcast: z
		.boolean()
		.optional()
		.describe("Skip broadcasting transactions (for testing)"),
});

type MintCollectionArgs = z.infer<typeof mintCollectionArgsSchema>;

interface ImageFile {
	path: string;
	name: string;
	data: Buffer;
	contentType: string;
}

async function getImageFiles(folderPath: string): Promise<ImageFile[]> {
	const files = await fs.readdir(folderPath);
	const imageFiles: ImageFile[] = [];

	const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];

	for (const file of files) {
		const filePath = path.join(folderPath, file);
		const stat = await fs.stat(filePath);

		if (stat.isFile()) {
			const ext = path.extname(file).toLowerCase();
			if (imageExtensions.includes(ext)) {
				const data = await fs.readFile(filePath);
				const contentType =
					{
						".jpg": "image/jpeg",
						".jpeg": "image/jpeg",
						".png": "image/png",
						".gif": "image/gif",
						".webp": "image/webp",
						".svg": "image/svg+xml",
					}[ext] || "application/octet-stream";

				imageFiles.push({
					path: filePath,
					name: path.basename(file, ext),
					data,
					contentType,
				});
			}
		}
	}

	return imageFiles.sort((a, b) => a.name.localeCompare(b.name));
}

function generateItemTraits(
	itemIndex: number,
	collectionTraits?: Record<string, string[]>,
): Array<{ name: string; value: string }> {
	const traits: Array<{ name: string; value: string }> = [];

	if (collectionTraits) {
		// Distribute traits across items deterministically
		for (const [traitName, possibleValues] of Object.entries(
			collectionTraits,
		)) {
			if (possibleValues.length > 0) {
				const valueIndex = itemIndex % possibleValues.length;
				traits.push({
					name: traitName as string, // Object.entries always produces string keys
					value: possibleValues[valueIndex],
				});
			}
		}
	}

	return traits;
}

export function registerMintCollectionTool(server: McpServer, wallet: Wallet) {
	server.tool(
		"wallet_mintCollection",
		"Mint a collection of ordinals from a folder of images with proper metadata. This tool creates a collection inscription first, then mints each image as a collection item with the appropriate metadata linking it to the collection.",
		{ args: mintCollectionArgsSchema },
		async ({ args }: { args: MintCollectionArgs }): Promise<CallToolResult> => {
			try {
				// Get keys from wallet
				const paymentPk = wallet.getPaymentKey();
				if (!paymentPk) {
					throw new Error("No payment key available in wallet");
				}
				const identityPk = wallet.getIdentityKey();

				// Get image files
				const imageFiles = await getImageFiles(args.folderPath);
				if (imageFiles.length === 0) {
					throw new Error("No image files found in the specified folder");
				}

				console.log(`Found ${imageFiles.length} images to mint`);

				// Prepare collection metadata
				const collectionSubTypeData: CollectionSubTypeData = {
					description: args.description,
					quantity: imageFiles.length,
					// Transform rarity labels to correct format
					rarityLabels:
						args.rarityLabels?.map((r) => ({ label: r.label })) || [],
					// Transform traits - need to match the CollectionTraits type
					traits: args.traits
						? Object.entries(args.traits).reduce((acc, [key, values]) => {
								acc[key] = {
									values,
									occurancePercentages: values.map(() =>
										String(100 / values.length),
									),
								};
								return acc;
							}, {} as CollectionTraits)
						: {},
				};

				const collectionMetadata: CreateOrdinalsCollectionMetadata = {
					app: "ord",
					type: "ord",
					subType: "collection",
					name: args.collectionName,
					subTypeData: collectionSubTypeData,
				};

				// Create collection icon
				const collectionIconData = Buffer.from(
					`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
            <rect width="100" height="100" fill="#f0f0f0"/>
            <text x="50" y="55" text-anchor="middle" font-family="Arial" font-size="16">${args.collectionName}</text>
          </svg>`,
				).toString("base64");

				const walletAddress = paymentPk.toAddress().toString();

				// Get UTXOs for collection
				const { paymentUtxos: collectionUtxos } = await wallet.getUtxos();
				if (!collectionUtxos || collectionUtxos.length === 0) {
					throw new Error("No payment UTXOs available");
				}

				// Create collection config
				const collectionConfig: CreateOrdinalsConfig = {
					utxos: collectionUtxos,
					destinations: [
						{
							address: walletAddress,
							inscription: {
								dataB64: collectionIconData,
								contentType: "image/svg+xml",
							},
						},
					],
					paymentPk,
					changeAddress: walletAddress,
					metaData: collectionMetadata,
				};

				if (identityPk) {
					collectionConfig.signer = { idKey: identityPk } as LocalSigner;
				}

				console.log("Creating collection inscription...");
				const collectionResult = (await createOrdinals(
					collectionConfig,
				)) as ChangeResult;

				let collectionTxid = "";
				const disableBroadcasting =
					args.skipBroadcast || process.env.DISABLE_BROADCASTING === "true";

				if (!disableBroadcasting) {
					const broadcaster = new V5Broadcaster();
					await collectionResult.tx.broadcast(broadcaster);
					collectionTxid = collectionResult.tx.id("hex");
					console.log(`✅ Collection created: ${collectionTxid}`);

					// Refresh UTXOs after spending
					await wallet.refreshUtxos();
				} else {
					collectionTxid = collectionResult.tx.id("hex");
					console.log(
						`🔸 Collection created (not broadcast): ${collectionTxid}`,
					);
				}

				// Mint collection items
				const results = {
					collectionTxid,
					itemTxids: [] as string[],
					errors: [] as Array<{ file: string; error: string }>,
					totalCost: collectionResult.tx.getFee(),
				};

				for (let i = 0; i < imageFiles.length; i++) {
					const imageFile = imageFiles[i];
					if (!imageFile) continue;

					console.log(
						`Minting item ${i + 1}/${imageFiles.length}: ${imageFile.name}`,
					);

					try {
						const itemTraits = generateItemTraits(i, args.traits);

						const itemSubTypeData: CollectionItemSubTypeData = {
							collectionId: collectionTxid,
							mintNumber: i + 1,
							traits: itemTraits,
						};

						// Assign rarity if labels provided
						if (args.rarityLabels && args.rarityLabels.length > 0) {
							const rarityIndex = Math.floor(
								(i / imageFiles.length) * args.rarityLabels.length,
							);
							const rarityItem =
								args.rarityLabels[
									Math.min(rarityIndex, args.rarityLabels.length - 1)
								];
							if (rarityItem) {
								itemSubTypeData.rarityLabel = [
									{ [rarityItem.label]: `${rarityItem.percentage}%` },
								];
							}
						}

						const itemMetadata: CreateOrdinalsCollectionItemMetadata = {
							app: "ord",
							type: "ord",
							subType: "collectionItem",
							name: imageFile.name,
							subTypeData: itemSubTypeData,
						};

						// Get fresh UTXOs for each item
						const { paymentUtxos: itemUtxos } = await wallet.getUtxos();
						if (!itemUtxos || itemUtxos.length === 0) {
							throw new Error("No payment UTXOs available for item");
						}

						const itemConfig: CreateOrdinalsConfig = {
							utxos: itemUtxos,
							destinations: [
								{
									address: walletAddress,
									inscription: {
										dataB64: imageFile.data.toString("base64"),
										contentType: imageFile.contentType,
									},
								},
							],
							paymentPk,
							changeAddress: walletAddress,
							metaData: itemMetadata,
						};

						if (identityPk) {
							itemConfig.signer = { idKey: identityPk } as LocalSigner;
						}

						const itemResult = (await createOrdinals(
							itemConfig,
						)) as ChangeResult;

						if (!disableBroadcasting) {
							const broadcaster = new V5Broadcaster();
							await itemResult.tx.broadcast(broadcaster);
							const itemTxid = itemResult.tx.id("hex");
							results.itemTxids.push(itemTxid);
							console.log(`  ✅ Item minted: ${itemTxid}`);

							// Refresh UTXOs after each item
							await wallet.refreshUtxos();
						} else {
							const itemTxid = itemResult.tx.id("hex");
							results.itemTxids.push(itemTxid);
							console.log(`  🔸 Item minted (not broadcast): ${itemTxid}`);
						}

						results.totalCost += itemResult.tx.getFee();
					} catch (error) {
						const errorMessage =
							error instanceof Error ? error.message : String(error);
						results.errors.push({ file: imageFile.name, error: errorMessage });
						console.error(
							`  ❌ Failed to mint ${imageFile.name}: ${errorMessage}`,
						);
					}
				}

				// Return results
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									collectionTxid: results.collectionTxid,
									itemsMinted: results.itemTxids.length,
									totalItems: imageFiles.length,
									errors: results.errors,
									totalCost: results.totalCost,
									summary: `Collection "${args.collectionName}" created with ${results.itemTxids.length}/${imageFiles.length} items successfully minted.${results.errors.length > 0 ? ` ${results.errors.length} items failed.` : ""}`,
								},
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				return {
					content: [
						{
							type: "text",
							text: `Error minting collection: ${errorMessage}`,
						},
					],
					isError: true,
				};
			}
		},
	);
}
