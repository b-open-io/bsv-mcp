"use client";

import { ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

/**
 * Route-level error boundary. Offers a retry of the failed route first —
 * most failures here are transient (network, wallet backend) — with the
 * home page as the fallback.
 */
export default function RouteError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
			<div className="space-y-3">
				<p className="font-mono text-sm text-primary">error</p>
				<h1 className="text-3xl font-bold tracking-tight">
					Something went wrong
				</h1>
				<p className="text-muted-foreground">
					This page hit an error while rendering. Try it again, or head back to
					BSV MCP home.
				</p>
			</div>

			<Card className="bg-card/60">
				<CardHeader>
					<CardTitle className="font-mono text-sm">What failed</CardTitle>
					<CardDescription className="break-words font-mono text-xs">
						{error.message || "Unknown error"}
						{error.digest ? ` · ${error.digest}` : null}
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-3 sm:flex-row">
					<Button onClick={reset}>
						<RefreshCw />
						Try again
					</Button>
					<Button variant="outline" asChild>
						<Link href="/">
							Back to home
							<ArrowRight />
						</Link>
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
