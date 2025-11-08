import * as fs from "node:fs";
import * as path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// TypeScript interfaces for BigBlocks registry
interface BigBlocksComponent {
	name: string;
	type: string;
	description: string;
	files?: string[];
	dependencies?: string[];
	registryDependencies?: string[];
}

interface BigBlocksRegistry {
	components: BigBlocksComponent[];
	version?: string;
}

// Load BigBlocks registry data
function loadBigBlocksRegistry(): BigBlocksRegistry | null {
	try {
		const registryPath = path.resolve(
			"node_modules/bigblocks/registry/registry.json",
		);
		const registryData = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
		return registryData as BigBlocksRegistry;
	} catch (error) {
		console.error("Failed to load BigBlocks registry:", error);
		return null;
	}
}

// Code generation templates
const TEMPLATES = {
	"auth-setup": {
		description: "Complete authentication setup with providers",
		code: `import { 
  BitcoinAuthProvider, 
  BitcoinThemeProvider, 
  BitcoinQueryProvider,
  type BitcoinAuthConfig 
} from 'bigblocks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';

const queryClient = new QueryClient();

const authConfig: BitcoinAuthConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || '/api/auth',
  storage: {
    async get(key: string): Promise<string | null> {
      return localStorage.getItem(key);
    },
    async set(key: string, value: string): Promise<void> {
      localStorage.setItem(key, value);
    },
    async remove(key: string): Promise<void> {
      localStorage.removeItem(key);
    }
  },
  storageNamespace: 'my-app-auth',
  oauthProviders: ['google', 'github'],
  backupTypes: {
    enabled: ['BapMasterBackup', 'BapMemberBackup', 'OneSatBackup', 'WifBackup']
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Theme appearance="dark" accentColor="amber">
        <BitcoinThemeProvider>
          <BitcoinQueryProvider>
            <BitcoinAuthProvider config={authConfig}>
              {children}
            </BitcoinAuthProvider>
          </BitcoinQueryProvider>
        </BitcoinThemeProvider>
      </Theme>
    </QueryClientProvider>
  );
}`,
	},
	"auth-flow": {
		description: "Complete authentication flow component",
		code: `import { 
  AuthFlowOrchestrator, 
  useBitcoinAuth,
  type AuthFlowType 
} from 'bigblocks';
import { useState } from 'react';

interface AuthFlowProps {
  onSuccess?: () => void;
  flowType?: AuthFlowType;
}

export function AuthFlow({ onSuccess, flowType = 'unified' }: AuthFlowProps) {
  const { user, isAuthenticated } = useBitcoinAuth();

  const handleSuccess = (user: any) => {
    console.log('Authentication successful:', user);
    onSuccess?.();
  };

  const handleError = (error: Error) => {
    console.error('Authentication error:', error);
  };

  if (isAuthenticated) {
    return (
      <div className="text-center">
        <h2>Welcome, {user?.profile?.name || 'User'}!</h2>
        <p>You are successfully authenticated.</p>
      </div>
    );
  }

  return (
    <AuthFlowOrchestrator
      flowType={flowType}
      enableOAuth={true}
      enableFileImport={true}
      enableLocalBackup={true}
      onSuccess={handleSuccess}
      onError={handleError}
      title="Sign In"
      subtitle="Secure authentication using Bitcoin signatures"
      showHeader={true}
      showFooter={true}
      layout="centered"
      autoDetectFlow={true}
      persistFlow={true}
    />
  );
}`,
	},
	"social-feed": {
		description: "Social media feed with BigBlocks components",
		code: `import { 
  SocialFeed, 
  PostButton, 
  LikeButton,
  FollowButton,
  PostCard 
} from 'bigblocks';
import { useState, useEffect } from 'react';

export function MySocialFeed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleNewPost = (txid: string) => {
    console.log('New post created:', txid);
    // Refresh posts or add new post to feed
    loadPosts();
  };

  const loadPosts = async () => {
    try {
      // Fetch posts from your API or BMAP
      const response = await fetch('/api/posts');
      const data = await response.json();
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="mb-6">
        <PostButton
          onSuccess={handleNewPost}
          encryption={false}
          placeholder="What's happening?"
        />
      </div>

      <SocialFeed
        posts={posts}
        loading={loading}
        onLoadMore={() => {
          // Load more posts
          console.log('Load more posts');
        }}
        showActions={true}
      />
    </div>
  );
}`,
	},
	"wallet-interface": {
		description: "Complete wallet interface with BigBlocks",
		code: `import { 
  WalletOverview, 
  SendBSVButton, 
  TokenBalance,
  QuickSendButton,
  DonateButton 
} from 'bigblocks';
import { useState } from 'react';

export function WalletInterface() {
  const [selectedAmount, setSelectedAmount] = useState(0.001);

  const handleSendSuccess = (txid: string) => {
    console.log('Payment sent successfully:', txid);
    // Refresh wallet data
  };

  const handleDonation = (txid: string) => {
    console.log('Donation sent:', txid);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">My Wallet</h1>
      
      {/* Wallet Overview */}
      <div className="mb-8">
        <WalletOverview
          showHistory={true}
          showTokens={true}
          compact={false}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Send BSV</h2>
          <SendBSVButton
            amount={selectedAmount}
            onSuccess={handleSendSuccess}
            confirmRequired={true}
          />
          
          <QuickSendButton
            presetAmounts={[0.001, 0.01, 0.1]}
            onSend={handleSendSuccess}
          />
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Donations</h2>
          <DonateButton
            recipient="1DonationAddressExample..."
            amounts={[0.01, 0.05, 0.1]}
            message="Thank you for your support!"
            onDonate={handleDonation}
          />
        </div>
      </div>

      {/* Token Balances */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Token Balances</h2>
        <TokenBalance
          showTokens={true}
          showUSD={true}
          refreshInterval={30000}
        />
      </div>
    </div>
  );
}`,
	},
};

const generatorSchema = z.object({
	template: z
		.string()
		.optional()
		.describe(
			"Template to generate (auth-setup, auth-flow, social-feed, wallet-interface)",
		),
	component: z
		.string()
		.optional()
		.describe("Specific component to generate code for"),
	framework: z
		.enum(["react", "next", "astro"])
		.optional()
		.describe("Framework-specific code generation"),
	listTemplates: z
		.boolean()
		.optional()
		.describe("List all available templates"),
});

/**
 * Register the BigBlocks code generator tool
 */
export function registerBigBlocksGeneratorTool(server: McpServer): void {
	server.tool(
		"bigblocks_generate",
		"Generate BigBlocks integration code and boilerplate. Get ready-to-use code snippets for authentication, social features, wallet interfaces, and more.\n\n" +
			"Available templates:\n" +
			"- auth-setup: Complete authentication provider setup\n" +
			"- auth-flow: Authentication flow component\n" +
			"- social-feed: Social media feed interface\n" +
			"- wallet-interface: Complete wallet dashboard\n\n" +
			"Usage examples:\n" +
			'- Generate template: {"template": "auth-setup"}\n' +
			'- Component code: {"component": "auth-flow"}\n' +
			'- List templates: {"listTemplates": true}',
		{ args: generatorSchema },
		async ({ args }) => {
			try {
				const { template, component, framework, listTemplates } = args;

				// List all templates
				if (listTemplates) {
					let result = "# BigBlocks Code Generator Templates\n\n";

					for (const [name, data] of Object.entries(TEMPLATES)) {
						result += `## ${name}\n`;
						result += `${data.description}\n\n`;
					}

					result +=
						'Use {"template": "template-name"} to generate specific code.';
					return { content: [{ type: "text", text: result }] };
				}

				// Generate specific template
				if (template) {
					const templateData = TEMPLATES[template];
					if (!templateData) {
						const available = Object.keys(TEMPLATES).join(", ");
						return {
							content: [
								{
									type: "text",
									text: `Template "${template}" not found. Available templates: ${available}`,
								},
							],
							isError: true,
						};
					}

					let result = `# ${template} - ${templateData.description}\n\n`;
					result += "```tsx\n";
					result += templateData.code;
					result += "\n```\n\n";

					// Add usage instructions
					result += "## Usage Instructions\n\n";
					if (template === "auth-setup") {
						result +=
							"1. Install dependencies: `npm install @tanstack/react-query @radix-ui/themes`\n";
						result += "2. Wrap your app with the AuthProvider component\n";
						result += "3. Configure your authentication API endpoint\n";
						result += "4. Customize the theme and storage options\n";
					} else if (template === "auth-flow") {
						result += "1. Use this component on your login/signup pages\n";
						result += "2. Customize the flow type and callbacks\n";
						result += "3. Handle success/error states appropriately\n";
					} else if (template === "social-feed") {
						result += "1. Implement your posts API endpoint\n";
						result += "2. Configure BMAP integration if needed\n";
						result += "3. Customize the feed appearance and actions\n";
					} else if (template === "wallet-interface") {
						result += "1. Ensure wallet provider is configured\n";
						result += "2. Set up transaction handling\n";
						result += "3. Configure recipient addresses for donations\n";
					}

					return { content: [{ type: "text", text: result }] };
				}

				// Generate code for specific component
				if (component) {
					const registry = loadBigBlocksRegistry();
					if (!registry) {
						return {
							content: [
								{
									type: "text",
									text: "Error: Could not load BigBlocks registry data",
								},
							],
							isError: true,
						};
					}

					const comp = registry.components.find((c) => c.name === component);
					if (!comp) {
						return {
							content: [
								{
									type: "text",
									text: `Component "${component}" not found in registry`,
								},
							],
							isError: true,
						};
					}

					// Determine the actual component name from files
					const mainFile = comp.files?.[0];
					const componentName = mainFile
						? path.basename(mainFile, path.extname(mainFile))
						: component;

					let result = `# ${componentName} Integration\n\n`;
					result += `**Description:** ${comp.description}\n\n`;

					// Basic usage example
					result += "## Basic Usage\n\n";
					result += "```tsx\n";
					result += `import { ${componentName}`;

					// Add dependencies to import
					if (comp.registryDependencies?.length) {
						result += `, ${comp.registryDependencies.join(", ")}`;
					}

					result += " } from 'bigblocks';\n\n";

					// Generate basic component usage
					result += `export function My${componentName}() {\n`;
					result += "  return (\n";
					result += `    <${componentName}\n`;
					result += "      // Add your props here\n";
					result += "    />\n";
					result += "  );\n";
					result += "}\n";
					result += "```\n\n";

					// Add dependencies info
					if (comp.dependencies?.length) {
						result += `## Dependencies\n\nInstall required packages:\n\`\`\`bash\nnpm install ${comp.dependencies.join(" ")}\n\`\`\`\n\n`;
					}

					return { content: [{ type: "text", text: result }] };
				}

				// Default: show available options
				return {
					content: [
						{
							type: "text",
							text: `# BigBlocks Code Generator

Generate ready-to-use BigBlocks integration code.

**Available templates:**
${Object.entries(TEMPLATES)
	.map(([name, data]) => `- **${name}**: ${data.description}`)
	.join("\n")}

**Usage:**
- Generate template: {"template": "template-name"}
- Component code: {"component": "component-name"}
- List all templates: {"listTemplates": true}

Get started with {"template": "auth-setup"} for authentication or {"template": "wallet-interface"} for wallet functionality.`,
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
