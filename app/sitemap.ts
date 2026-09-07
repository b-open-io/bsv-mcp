import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
	const lastModified = new Date();

	return [
		{
			url: `${SITE_URL}/docs`,
			lastModified,
			changeFrequency: "weekly",
			priority: 0.9,
		},
		{
			url: `${SITE_URL}/docs.md`,
			lastModified,
			changeFrequency: "weekly",
			priority: 0.5,
		},
		{
			url: `${SITE_URL}/`,
			lastModified,
			changeFrequency: "weekly",
			priority: 1,
		},
		{
			url: `${SITE_URL}/connect`,
			lastModified,
			changeFrequency: "monthly",
			priority: 0.8,
		},
		{
			url: `${SITE_URL}/index.md`,
			lastModified,
			changeFrequency: "weekly",
			priority: 0.5,
		},
		{
			url: `${SITE_URL}/connect.md`,
			lastModified,
			changeFrequency: "monthly",
			priority: 0.4,
		},
		{
			url: `${SITE_URL}/llms.txt`,
			lastModified,
			changeFrequency: "weekly",
			priority: 0.5,
		},
	];
}
