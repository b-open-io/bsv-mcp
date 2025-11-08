import { promises as fs } from "node:fs";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Wallet } from "./wallet";

const gatherCollectionInfoArgsSchema = z.object({
	folderPath: z
		.string()
		.describe("Path to folder containing images to analyze for collection"),
});

type GatherCollectionInfoArgs = z.infer<typeof gatherCollectionInfoArgsSchema>;

interface ImageInfo {
	fileName: string;
	filePath: string;
	size: number;
	sizeKB: number;
	contentType: string;
	valid: boolean;
	error?: string;
}

interface CollectionAnalysis {
	folderPath: string;
	totalImages: number;
	validImages: number;
	invalidImages: number;
	totalSizeKB: number;
	imageTypes: Record<string, number>;
	images: ImageInfo[];
	suggestedMetadata: {
		collectionName: string;
		description: string;
		quantity: number;
	};
	costEstimate: {
		collectionInscriptionCost: number;
		perItemCost: number;
		totalItemsCost: number;
		totalCost: number;
		totalCostBSV: number;
	};
	walletInfo: {
		address: string;
		balance: number;
		balanceBSV: number;
		hasEnoughFunds: boolean;
		shortfall?: number;
	};
	warnings: string[];
	errors: string[];
}

async function analyzeImageFile(filePath: string): Promise<ImageInfo> {
	const fileName = path.basename(filePath);
	const ext = path.extname(fileName).toLowerCase();

	const contentTypeMap: Record<string, string> = {
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".png": "image/png",
		".gif": "image/gif",
		".webp": "image/webp",
		".svg": "image/svg+xml",
	};

	try {
		const stat = await fs.stat(filePath);
		const contentType = contentTypeMap[ext];

		if (!contentType) {
			return {
				fileName,
				filePath,
				size: stat.size,
				sizeKB: Math.round(stat.size / 1024),
				contentType: "unknown",
				valid: false,
				error: `Unsupported file type: ${ext}`,
			};
		}

		// Check file size (warn if over 50KB)
		const sizeKB = Math.round(stat.size / 1024);
		const warnings: string[] = [];

		if (sizeKB > 50) {
			warnings.push(
				`Large file size: ${sizeKB}KB (consider optimizing for lower fees)`,
			);
		}

		return {
			fileName,
			filePath,
			size: stat.size,
			sizeKB,
			contentType,
			valid: true,
			error: warnings.length > 0 ? warnings.join("; ") : undefined,
		};
	} catch (error) {
		return {
			fileName,
			filePath,
			size: 0,
			sizeKB: 0,
			contentType: "unknown",
			valid: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

function estimateInscriptionCost(sizeKB: number): number {
	// Base cost for inscription (1 sat)
	const baseCost = 1;
	// Additional cost based on size (rough estimate: 10 sats per KB)
	const sizeCost = Math.ceil(sizeKB * 10);
	// Mining fee estimate
	const miningFee = 500;

	return baseCost + sizeCost + miningFee;
}

export function registerGatherCollectionInfoTool(
	server: McpServer,
	wallet: Wallet,
) {
	server.tool(
		"wallet_gatherCollectionInfo",
		"Analyzes a folder of images and gathers all necessary information for minting an ordinals collection. This includes validating images, checking wallet balance, estimating costs, and suggesting metadata. Use this before minting to ensure everything is ready.",
		{ args: gatherCollectionInfoArgsSchema },
		async ({
			args,
		}: { args: GatherCollectionInfoArgs }): Promise<CallToolResult> => {
			try {
				const analysis: CollectionAnalysis = {
					folderPath: args.folderPath,
					totalImages: 0,
					validImages: 0,
					invalidImages: 0,
					totalSizeKB: 0,
					imageTypes: {},
					images: [],
					suggestedMetadata: {
						collectionName: "",
						description: "",
						quantity: 0,
					},
					costEstimate: {
						collectionInscriptionCost: 0,
						perItemCost: 0,
						totalItemsCost: 0,
						totalCost: 0,
						totalCostBSV: 0,
					},
					walletInfo: {
						address: "",
						balance: 0,
						balanceBSV: 0,
						hasEnoughFunds: false,
					},
					warnings: [],
					errors: [],
				};

				// Check if folder exists
				try {
					const folderStat = await fs.stat(args.folderPath);
					if (!folderStat.isDirectory()) {
						throw new Error(`Path is not a directory: ${args.folderPath}`);
					}
				} catch (error) {
					analysis.errors.push(
						`Folder not found or inaccessible: ${args.folderPath}`,
					);
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(analysis, null, 2),
							},
						],
						isError: true,
					};
				}

				// Get wallet info
				const paymentPk = wallet.getPrivateKey();
				if (!paymentPk) {
					analysis.errors.push("No payment key available in wallet");
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(analysis, null, 2),
							},
						],
						isError: true,
					};
				}

				analysis.walletInfo.address = paymentPk.toAddress().toString();

				// Get wallet balance
				try {
					const { paymentUtxos } = await wallet.getUtxos();
					const balance = paymentUtxos.reduce(
						(sum, utxo) => sum + utxo.satoshis,
						0,
					);
					analysis.walletInfo.balance = balance;
					analysis.walletInfo.balanceBSV = balance / 100000000;
				} catch (error) {
					analysis.warnings.push("Could not fetch wallet balance");
				}

				// Scan folder for images
				const files = await fs.readdir(args.folderPath);
				const imageExtensions = [
					".jpg",
					".jpeg",
					".png",
					".gif",
					".webp",
					".svg",
				];

				for (const file of files) {
					const filePath = path.join(args.folderPath, file);
					const stat = await fs.stat(filePath);

					if (stat.isFile()) {
						const ext = path.extname(file).toLowerCase();
						if (imageExtensions.includes(ext)) {
							const imageInfo = await analyzeImageFile(filePath);
							analysis.images.push(imageInfo);
							analysis.totalImages++;

							if (imageInfo.valid) {
								analysis.validImages++;
								analysis.totalSizeKB += imageInfo.sizeKB;

								// Track image types
								const type = imageInfo.contentType.split("/")[1] || "unknown";
								analysis.imageTypes[type] =
									(analysis.imageTypes[type] || 0) + 1;
							} else {
								analysis.invalidImages++;
								if (imageInfo.error) {
									analysis.errors.push(
										`${imageInfo.fileName}: ${imageInfo.error}`,
									);
								}
							}
						}
					}
				}

				// Sort images by name for consistent ordering
				analysis.images.sort((a, b) => a.fileName.localeCompare(b.fileName));

				if (analysis.validImages === 0) {
					analysis.errors.push("No valid images found in the folder");
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(analysis, null, 2),
							},
						],
						isError: true,
					};
				}

				// Suggest metadata based on folder name
				const folderName = path.basename(args.folderPath);
				analysis.suggestedMetadata = {
					collectionName: folderName
						.replace(/[-_]/g, " ")
						.replace(/\b\w/g, (l) => l.toUpperCase()),
					description: `A collection of ${analysis.validImages} unique digital artifacts`,
					quantity: analysis.validImages,
				};

				// Estimate costs
				const collectionIconSizeKB = 1; // SVG icon is small
				analysis.costEstimate.collectionInscriptionCost =
					estimateInscriptionCost(collectionIconSizeKB);

				// Average cost per item
				const avgItemSizeKB = analysis.totalSizeKB / analysis.validImages;
				analysis.costEstimate.perItemCost =
					estimateInscriptionCost(avgItemSizeKB);
				analysis.costEstimate.totalItemsCost =
					analysis.costEstimate.perItemCost * analysis.validImages;
				analysis.costEstimate.totalCost =
					analysis.costEstimate.collectionInscriptionCost +
					analysis.costEstimate.totalItemsCost;
				analysis.costEstimate.totalCostBSV =
					analysis.costEstimate.totalCost / 100000000;

				// Check if wallet has enough funds
				analysis.walletInfo.hasEnoughFunds =
					analysis.walletInfo.balance >= analysis.costEstimate.totalCost;
				if (!analysis.walletInfo.hasEnoughFunds) {
					analysis.walletInfo.shortfall =
						analysis.costEstimate.totalCost - analysis.walletInfo.balance;
					analysis.warnings.push(
						`Insufficient funds: need ${analysis.costEstimate.totalCost} sats, have ${analysis.walletInfo.balance} sats (shortfall: ${analysis.walletInfo.shortfall} sats)`,
					);
				}

				// Add warnings for large collections
				if (analysis.validImages > 100) {
					analysis.warnings.push(
						`Large collection (${analysis.validImages} items) will take time and multiple transactions to mint`,
					);
				}

				if (analysis.totalSizeKB > 1000) {
					analysis.warnings.push(
						`Large total size (${Math.round(analysis.totalSizeKB / 1024)}MB) will result in higher fees`,
					);
				}

				// Generate summary
				const summary = {
					ready:
						analysis.errors.length === 0 && analysis.walletInfo.hasEnoughFunds,
					summary: `Found ${analysis.validImages} valid images in "${folderName}". Total size: ${Math.round(analysis.totalSizeKB)}KB. Estimated cost: ${analysis.costEstimate.totalCost} sats (${analysis.costEstimate.totalCostBSV.toFixed(8)} BSV). Wallet balance: ${analysis.walletInfo.balance} sats. ${
						analysis.walletInfo.hasEnoughFunds
							? "Ready to mint!"
							: "Insufficient funds."
					}`,
				};

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									...analysis,
									...summary,
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
							text: `Error analyzing collection: ${errorMessage}`,
						},
					],
					isError: true,
				};
			}
		},
	);
}
