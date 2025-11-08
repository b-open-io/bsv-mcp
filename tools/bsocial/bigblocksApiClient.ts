/**
 * BigBlocks API Client wrapper for MCP tools
 * Leverages the centralized API client from BigBlocks v0.0.13
 */

// Note: In production, this would import from 'bigblocks/src/components/social'
// For now, we'll maintain our custom implementation but with BigBlocks types
import type {
	ApiResponse,
	BapIdentity,
	LikeInfo,
	LikesResponse,
	PostMeta,
	PostResponse,
	PostTransaction,
	PostsParams,
	PostsResponse,
	SearchParams,
} from "bmap-api-types";
import { BMAP_URL } from "../constants";

/**
 * Enhanced API client following BigBlocks v0.0.13 patterns
 */
export const bmapApiClient = {
	posts: {
		async search(params: SearchParams) {
			const queryParams = new URLSearchParams();
			queryParams.append("q", params.q);
			queryParams.append("limit", params.limit.toString());
			queryParams.append("offset", params.offset.toString());

			const response = await fetch(`${BMAP_URL}/posts/search?${queryParams}`);
			if (!response.ok) throw new Error(`Search failed: ${response.status}`);
			return response.json();
		},

		async byBapId(params: PostsParams & { bapId: string }) {
			const queryParams = new URLSearchParams();
			queryParams.append("bapId", params.bapId);
			if (params.limit) queryParams.append("limit", params.limit.toString());
			if (params.page) queryParams.append("page", params.page.toString());

			const response = await fetch(`${BMAP_URL}/posts?${queryParams}`);
			if (!response.ok)
				throw new Error(`Posts by BAP ID failed: ${response.status}`);
			return response.json() as Promise<ApiResponse<PostsResponse>>;
		},

		async byAddress(params: PostsParams & { address: string }) {
			const queryParams = new URLSearchParams();
			queryParams.append("address", params.address);
			if (params.limit) queryParams.append("limit", params.limit.toString());
			if (params.page) queryParams.append("page", params.page.toString());

			const response = await fetch(`${BMAP_URL}/posts?${queryParams}`);
			if (!response.ok)
				throw new Error(`Posts by address failed: ${response.status}`);
			return response.json() as Promise<ApiResponse<PostsResponse>>;
		},

		async single(txid: string) {
			const response = await fetch(`${BMAP_URL}/post/${txid}`);
			if (!response.ok)
				throw new Error(`Single post failed: ${response.status}`);
			return response.json() as Promise<ApiResponse<PostResponse>>;
		},

		async replies(txid: string, page = 1, limit = 20) {
			const queryParams = new URLSearchParams();
			queryParams.append("page", page.toString());
			queryParams.append("limit", limit.toString());

			const response = await fetch(
				`${BMAP_URL}/post/${txid}/replies?${queryParams}`,
			);
			if (!response.ok) throw new Error(`Replies failed: ${response.status}`);
			return response.json();
		},

		async trending(
			timeframe: "hour" | "day" | "week" | "month" = "day",
			limit = 20,
		) {
			const queryParams = new URLSearchParams();
			queryParams.append("timeframe", timeframe);
			queryParams.append("limit", limit.toString());

			const response = await fetch(`${BMAP_URL}/posts/trending?${queryParams}`);
			if (!response.ok)
				throw new Error(`Trending posts failed: ${response.status}`);
			return response.json();
		},
	},

	likes: {
		async forPost(txid: string): Promise<LikeInfo> {
			const response = await fetch(`${BMAP_URL}/likes/${txid}`);
			if (!response.ok)
				throw new Error(`Likes for post failed: ${response.status}`);
			return response.json() as Promise<LikeInfo>;
		},

		async byUser(bapId: string, page = 1, limit = 20): Promise<LikesResponse> {
			const queryParams = new URLSearchParams();
			queryParams.append("page", page.toString());
			queryParams.append("limit", limit.toString());

			const response = await fetch(
				`${BMAP_URL}/users/${bapId}/likes?${queryParams}`,
			);
			if (!response.ok)
				throw new Error(`User likes failed: ${response.status}`);
			return response.json() as Promise<LikesResponse>;
		},
	},

	follows: {
		async getFollowers(bapId: string, page = 1, limit = 20) {
			const queryParams = new URLSearchParams();
			queryParams.append("page", page.toString());
			queryParams.append("limit", limit.toString());

			const response = await fetch(
				`${BMAP_URL}/users/${bapId}/followers?${queryParams}`,
			);
			if (!response.ok)
				throw new Error(`Get followers failed: ${response.status}`);
			return response.json();
		},

		async getFollowing(bapId: string, page = 1, limit = 20) {
			const queryParams = new URLSearchParams();
			queryParams.append("page", page.toString());
			queryParams.append("limit", limit.toString());

			const response = await fetch(
				`${BMAP_URL}/users/${bapId}/following?${queryParams}`,
			);
			if (!response.ok)
				throw new Error(`Get following failed: ${response.status}`);
			return response.json();
		},
	},

	identity: {
		async search(query: string, limit = 10) {
			const queryParams = new URLSearchParams();
			queryParams.append("q", query);
			queryParams.append("limit", limit.toString());

			const response = await fetch(
				`${BMAP_URL}/identity/search?${queryParams}`,
			);
			if (!response.ok)
				throw new Error(`Identity search failed: ${response.status}`);
			return response.json();
		},

		async byBapId(bapId: string) {
			const response = await fetch(`${BMAP_URL}/identity/${bapId}`);
			if (!response.ok)
				throw new Error(`Identity by BAP ID failed: ${response.status}`);
			return response.json();
		},
	},
};

/**
 * Error handling wrapper that follows BigBlocks patterns
 */
export class BmapApiError extends Error {
	constructor(
		public code: string,
		message: string,
		public details?: Record<string, unknown>,
	) {
		super(message);
		this.name = "BmapApiError";
	}

	static fromError(error: unknown, code = "UNKNOWN_ERROR"): BmapApiError {
		if (error instanceof BmapApiError) return error;
		if (error instanceof Error) {
			return new BmapApiError(code, error.message, { originalError: error });
		}
		return new BmapApiError(code, String(error));
	}
}
