/** Link standard names in prose; leave configuration identifiers untouched. */
export function BrcReferences({ text }: { text: string }) {
	return text.split(/(\bBRC-\d+\b)/g).map((part, index) =>
		/^BRC-\d+$/.test(part) ? (
			<a
				// biome-ignore lint/suspicious/noArrayIndexKey: Static prose fragments have no state or reordering.
				key={`${index}-${part}`}
				href={`https://www.beersy.dev/brc/${part.slice(4)}`}
				className="underline underline-offset-4"
			>
				{part}
			</a>
		) : (
			part
		),
	);
}

export function linkBrcMarkdown(text: string): string {
	return text.replace(
		/\bBRC-(\d+)\b/g,
		(label, number) => `[${label}](https://www.beersy.dev/brc/${number})`,
	);
}
