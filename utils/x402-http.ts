import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";

export const MAX_BODY = 1024 * 1024;
export function requestURL(value: string): URL {
	const url = new URL(value);
	if (url.protocol !== "https:" || url.username || url.password || url.hash)
		throw new Error(
			"Paid service URLs must use HTTPS without embedded credentials or fragments",
		);
	return url;
}
function publicIP(ip: string): boolean {
	if (isIP(ip) === 4) {
		const [a, b] = ip.split(".").map(Number);
		return !(
			a === 0 ||
			a === 10 ||
			a === 127 ||
			a >= 224 ||
			(a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 168) ||
			(a === 100 && b >= 64 && b <= 127) ||
			(a === 198 && [18, 19].includes(b))
		);
	}
	// Only global-unicast IPv6; exclude mapped IPv4 and reserved/local ranges.
	return /^[23]/i.test(ip) && !ip.toLowerCase().startsWith("2001:db8:");
}
/** Resolve once and pin the connection to that public IP; redirects never get credentials or proofs. */
export async function serviceFetch(
	input: string | URL | Request,
	init: RequestInit = {},
): Promise<Response> {
	const url = requestURL(String(input));
	const host = url.hostname.replace(/^\[|\]$/g, "");
	const addresses = await lookup(host, { all: true });
	if (!addresses.length || addresses.some((a) => !publicIP(a.address)))
		throw new Error("Paid services must resolve to public IP addresses");
	const address = addresses[0];
	const headers = Object.fromEntries(new Headers(init.headers));
	const body =
		init.body == null
			? undefined
			: typeof init.body === "string"
				? Buffer.from(init.body)
				: init.body instanceof Uint8Array
					? Buffer.from(init.body)
					: (() => {
							throw new Error("Unsupported request body encoding");
						})();
	if (body && body.length > MAX_BODY)
		throw new Error("Request body exceeds 1 MiB");
	return new Promise((resolve, reject) => {
		const request = httpsRequest(
			url,
			{
				method: init.method ?? "GET",
				family: address.family,
				headers,
				lookup: (_hostname, _options, callback) =>
					callback(null, address.address, address.family),
				signal: init.signal ?? AbortSignal.timeout(30_000),
			},
			(response) => {
				const chunks: Buffer[] = [];
				let size = 0;
				response.on("data", (chunk: Buffer) => {
					size += chunk.length;
					if (size > MAX_BODY) {
						request.destroy(new Error("Service response exceeds 1 MiB"));
						return;
					}
					chunks.push(chunk);
				});
				response.on("error", reject);
				response.on("end", () => {
					try {
						const resultHeaders = new Headers();
						for (const [key, value] of Object.entries(response.headers))
							if (value !== undefined)
								resultHeaders.set(
									key,
									Array.isArray(value) ? value.join(", ") : value,
								);
						const status = response.statusCode ?? 500;
						if (status >= 300 && status < 400) {
							reject(
								new Error(
									"Service redirects are not followed; request the intended URL explicitly",
								),
							);
							return;
						}
						let data = Buffer.concat(chunks);
						const encoding = response.headers["content-encoding"];
						if (encoding && encoding !== "identity") {
							const decode =
								encoding === "gzip"
									? gunzipSync
									: encoding === "br"
										? brotliDecompressSync
										: encoding === "deflate"
											? inflateSync
											: undefined;
							if (!decode)
								throw new Error("Unsupported response content encoding");
							data = decode(data, { maxOutputLength: MAX_BODY });
							resultHeaders.delete("content-encoding");
							resultHeaders.delete("content-length");
						}
						resolve(
							new Response([204, 205, 304].includes(status) ? null : data, {
								status,
								headers: resultHeaders,
							}),
						);
					} catch (error) {
						reject(error);
					}
				});
			},
		);
		request.on("error", reject);
		request.end(body);
	});
}
