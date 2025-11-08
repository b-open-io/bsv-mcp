import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const EXAMPLES = {
	"next-auth": {
		title: "Next.js Authentication Setup",
		description: "Complete BigBlocks authentication integration for Next.js",
		tags: ["nextjs", "authentication", "setup"],
		files: {
			"app/providers.tsx": `'use client';

import { BitcoinAuthProvider, BitcoinThemeProvider, BitcoinQueryProvider } from 'bigblocks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Theme appearance="dark" accentColor="amber">
        <BitcoinThemeProvider>
          <BitcoinQueryProvider>
            <BitcoinAuthProvider config={{
              apiUrl: '/api/auth',
              storageNamespace: 'my-app',
              oauthProviders: ['google', 'github']
            }}>
              {children}
            </BitcoinAuthProvider>
          </BitcoinQueryProvider>
        </BitcoinThemeProvider>
      </Theme>
    </QueryClientProvider>
  );
}`,
			"app/layout.tsx": `import { Providers } from './providers';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}`,
			"app/auth/page.tsx": `import { AuthFlowOrchestrator } from 'bigblocks';

export default function AuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <AuthFlowOrchestrator
        flowType="unified"
        enableOAuth={true}
        onSuccess={() => {
          window.location.href = '/dashboard';
        }}
      />
    </div>
  );
}`,
		},
	},
	"social-app": {
		title: "Social Media App",
		description: "Twitter-like social app using BigBlocks social components",
		tags: ["social", "posts", "feed"],
		files: {
			"components/SocialApp.tsx": `import { 
  SocialFeed, 
  PostButton, 
  LikeButton, 
  FollowButton,
  ProfileCard 
} from 'bigblocks';
import { useState, useEffect } from 'react';

export function SocialApp() {
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);

  const handleNewPost = (txid: string) => {
    // Post created successfully
    loadPosts();
  };

  const loadPosts = async () => {
    try {
      const response = await fetch('/api/posts');
      const data = await response.json();
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Failed to load posts:', error);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Profile Sidebar */}
        <div className="lg:col-span-1">
          <ProfileCard 
            profile={user}
            showActions={false}
            editable={false}
          />
        </div>

        {/* Main Feed */}
        <div className="lg:col-span-3">
          {/* Post Creation */}
          <div className="mb-6 p-4 border rounded-lg">
            <PostButton
              onSuccess={handleNewPost}
              placeholder="What's happening?"
              encryption={false}
            />
          </div>

          {/* Social Feed */}
          <SocialFeed
            posts={posts}
            showActions={true}
            onLoadMore={loadPosts}
          />
        </div>
      </div>
    </div>
  );
}`,
			"pages/api/posts.ts": `import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    // Fetch posts from BMAP API or your database
    const posts = await fetchPosts();
    res.status(200).json({ posts });
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end('Method not allowed');
  }
}

async function fetchPosts() {
  // Implementation to fetch posts from BMAP or database
  return [];
}`,
		},
	},
	"wallet-dashboard": {
		title: "Wallet Dashboard",
		description: "Complete Bitcoin wallet interface with all features",
		tags: ["wallet", "payments", "dashboard"],
		files: {
			"components/WalletDashboard.tsx": `import { 
  WalletOverview, 
  SendBSVButton, 
  TokenBalance,
  QuickSendButton,
  useBitcoinAuth,
  useBitcoinWallet 
} from 'bigblocks';
import { useState } from 'react';

export function WalletDashboard() {
  const { user, isAuthenticated } = useBitcoinAuth();
  const { balance, transactions, refreshBalance } = useBitcoinWallet();
  const [selectedAmount, setSelectedAmount] = useState(0.001);

  const handleSendSuccess = (txid: string) => {
    console.log('Payment sent:', txid);
    refreshBalance();
  };

  if (!isAuthenticated) {
    return <div>Please sign in to access your wallet.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Wallet Dashboard</h1>
      
      {/* Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-2">
          <WalletOverview
            showHistory={true}
            showTokens={true}
          />
        </div>
        
        <div>
          <TokenBalance
            showUSD={true}
            refreshInterval={30000}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Send Bitcoin</h2>
          
          <SendBSVButton
            amount={selectedAmount}
            onSuccess={handleSendSuccess}
            confirmRequired={true}
          />
          
          <QuickSendButton
            presetAmounts={[0.001, 0.01, 0.1, 1]}
            onSend={handleSendSuccess}
          />
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Recent Transactions</h2>
          <div className="space-y-2">
            {transactions?.slice(0, 5).map((tx, index) => (
              <div key={index} className="p-3 border rounded">
                <div className="flex justify-between">
                  <span className="font-mono text-sm">{tx.txid?.slice(0, 16)}...</span>
                  <span className={tx.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount} BSV
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}`,
		},
	},
	marketplace: {
		title: "NFT Marketplace",
		description: "Complete marketplace with buying, selling, and browsing",
		tags: ["marketplace", "nft", "trading"],
		files: {
			"components/Marketplace.tsx": `import { 
  MarketTable, 
  CreateListingButton, 
  BuyListingButton,
  useMarketplace 
} from 'bigblocks';
import { useState, useEffect } from 'react';

export function Marketplace() {
  const { listings, createListing, buyListing } = useMarketplace();
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleCreateListing = async (data: any) => {
    try {
      const txid = await createListing(data);
      console.log('Listing created:', txid);
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create listing:', error);
    }
  };

  const handleBuyListing = async (listing: any) => {
    try {
      const txid = await buyListing(listing);
      console.log('Purchase successful:', txid);
    } catch (error) {
      console.error('Purchase failed:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">NFT Marketplace</h1>
        
        <CreateListingButton
          onList={handleCreateListing}
          asset={selectedAsset}
        />
      </div>

      {/* Marketplace Table */}
      <MarketTable
        listings={listings}
        onSelect={setSelectedAsset}
        sortBy="price"
        showActions={true}
        customActions={(listing) => (
          <BuyListingButton
            listing={listing}
            onBuy={() => handleBuyListing(listing)}
            confirmRequired={true}
          />
        )}
      />
    </div>
  );
}`,
		},
	},
};

const examplesSchema = z.object({
	example: z
		.string()
		.optional()
		.describe(
			"Specific example to view (next-auth, social-app, wallet-dashboard, marketplace)",
		),
	tag: z
		.string()
		.optional()
		.describe(
			"Filter examples by tag (nextjs, authentication, social, wallet, marketplace, nft)",
		),
	file: z.string().optional().describe("View specific file from an example"),
	listAll: z.boolean().optional().describe("List all available examples"),
});

/**
 * Register the BigBlocks examples tool
 */
export function registerBigBlocksExamplesTool(server: McpServer): void {
	server.tool(
		"bigblocks_examples",
		"Browse real-world BigBlocks integration examples and patterns. See complete applications built with BigBlocks components.\n\n" +
			"Available examples:\n" +
			"- next-auth: Next.js authentication setup\n" +
			"- social-app: Twitter-like social media app\n" +
			"- wallet-dashboard: Complete wallet interface\n" +
			"- marketplace: NFT marketplace with trading\n\n" +
			"Usage examples:\n" +
			'- View example: {"example": "next-auth"}\n' +
			'- Filter by tag: {"tag": "authentication"}\n' +
			'- View specific file: {"example": "social-app", "file": "components/SocialApp.tsx"}\n' +
			'- List all: {"listAll": true}',
		{ args: examplesSchema },
		async ({ args }) => {
			try {
				const { example, tag, file, listAll } = args;

				// List all examples
				if (listAll) {
					let result = "# BigBlocks Integration Examples\n\n";

					for (const [name, data] of Object.entries(EXAMPLES)) {
						result += `## ${data.title}\n`;
						result += `**ID:** ${name}\n`;
						result += `**Description:** ${data.description}\n`;
						result += `**Tags:** ${data.tags.join(", ")}\n`;
						result += `**Files:** ${Object.keys(data.files).length} files\n\n`;
					}

					result += 'Use {"example": "example-id"} to view a complete example.';
					return { content: [{ type: "text", text: result }] };
				}

				// Filter by tag
				if (tag && !example) {
					const filtered = Object.entries(EXAMPLES).filter(([_, data]) =>
						data.tags.includes(tag.toLowerCase()),
					);

					if (filtered.length === 0) {
						const allTags = Array.from(
							new Set(Object.values(EXAMPLES).flatMap((e) => e.tags)),
						).join(", ");
						return {
							content: [
								{
									type: "text",
									text: `No examples found with tag "${tag}". Available tags: ${allTags}`,
								},
							],
							isError: true,
						};
					}

					let result = `# BigBlocks Examples: ${tag}\n\n`;
					for (const [name, data] of filtered) {
						result += `## ${data.title}\n`;
						result += `**ID:** ${name}\n`;
						result += `${data.description}\n\n`;
					}

					return { content: [{ type: "text", text: result }] };
				}

				// View specific example
				if (example) {
					const exampleData = EXAMPLES[example];
					if (!exampleData) {
						const available = Object.keys(EXAMPLES).join(", ");
						return {
							content: [
								{
									type: "text",
									text: `Example "${example}" not found. Available examples: ${available}`,
								},
							],
							isError: true,
						};
					}

					// View specific file
					if (file) {
						const fileContent = exampleData.files[file];
						if (!fileContent) {
							const availableFiles = Object.keys(exampleData.files).join(", ");
							return {
								content: [
									{
										type: "text",
										text: `File "${file}" not found in example "${example}". Available files: ${availableFiles}`,
									},
								],
								isError: true,
							};
						}

						let result = `# ${exampleData.title} - ${file}\n\n`;
						result += "```tsx\n";
						result += fileContent;
						result += "\n```";

						return { content: [{ type: "text", text: result }] };
					}

					// View complete example
					let result = `# ${exampleData.title}\n\n`;
					result += `${exampleData.description}\n\n`;
					result += `**Tags:** ${exampleData.tags.join(", ")}\n\n`;

					// Show all files
					for (const [fileName, fileContent] of Object.entries(
						exampleData.files,
					)) {
						result += `## ${fileName}\n\n`;
						result += "```tsx\n";
						result += fileContent;
						result += "\n```\n\n";
					}

					// Add setup instructions
					result += "## Setup Instructions\n\n";
					if (example === "next-auth") {
						result +=
							"1. Install dependencies: `npm install bigblocks @tanstack/react-query @radix-ui/themes`\n";
						result += "2. Add the providers to your app\n";
						result += "3. Create authentication pages\n";
						result += "4. Configure your API routes\n";
					} else if (example === "social-app") {
						result += "1. Set up authentication first\n";
						result += "2. Implement posts API endpoint\n";
						result += "3. Configure BMAP integration\n";
						result += "4. Style components as needed\n";
					} else if (example === "wallet-dashboard") {
						result += "1. Ensure authentication is working\n";
						result += "2. Configure wallet provider\n";
						result += "3. Set up transaction monitoring\n";
						result += "4. Add error handling\n";
					} else if (example === "marketplace") {
						result += "1. Set up wallet functionality\n";
						result += "2. Configure marketplace API\n";
						result += "3. Implement asset management\n";
						result += "4. Add payment processing\n";
					}

					return { content: [{ type: "text", text: result }] };
				}

				// Default: show overview
				return {
					content: [
						{
							type: "text",
							text: `# BigBlocks Integration Examples

Browse complete application examples built with BigBlocks:

${Object.entries(EXAMPLES)
	.map(([name, data]) => `- **${data.title}** (${name}): ${data.description}`)
	.join("\n")}

**Usage:**
- View example: {"example": "example-id"}
- Filter by tag: {"tag": "authentication"}
- View specific file: {"example": "social-app", "file": "components/SocialApp.tsx"}
- List all examples: {"listAll": true}

These examples show complete, production-ready patterns for building Bitcoin applications with BigBlocks.`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		},
	);
}
