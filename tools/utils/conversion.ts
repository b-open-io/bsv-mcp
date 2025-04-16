import { Utils } from "@bsv/sdk";
import { z } from "zod";
const {
	toArray: bsvToArray,
	toBase64: bsvToBase64,
	toHex: bsvToHex,
	toUTF8: bsvToUTF8,
} = Utils;

const encodingSchema = z.enum(["utf8", "hex", "base64", "binary"]);

/**
 * Convert data between hex, base64, utf8, and binary (number array) formats.
 * @param data - The input data as a string (hex, base64, utf8, or JSON array string for binary)
 * @param from - The encoding of the input data
 * @param to - The desired encoding of the output data
 * @returns The converted data as a string (except for binary, which is a JSON array string)
 */
export function convertData({
	data,
	from,
	to,
}: {
	data: string;
	from: "hex" | "base64" | "utf8" | "binary";
	to: "hex" | "base64" | "utf8" | "binary";
}): string {
	encodingSchema.parse(from);
	encodingSchema.parse(to);

	let arr: number[];
	if (from === "binary") {
		try {
			arr = JSON.parse(data);
			if (!Array.isArray(arr) || !arr.every((n) => typeof n === "number")) {
				throw new Error();
			}
		} catch {
			throw new Error("Invalid binary input: must be a JSON array of numbers");
		}
	} else {
		arr = bsvToArray(data, from);
	}

	if (to === "binary") {
		return JSON.stringify(arr);
	}
	if (to === "hex") {
		return bsvToHex(arr);
	}
	if (to === "base64") {
		return bsvToBase64(arr);
	}
	if (to === "utf8") {
		return bsvToUTF8(arr);
	}
	throw new Error("Invalid 'to' encoding");
}
