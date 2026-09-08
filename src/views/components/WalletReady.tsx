import type { AvailableSetupTool } from "../../../utils/vaultSetup";
import { AvailableTools } from "./AvailableTools";
export function WalletReady({ tools }: { tools?: AvailableSetupTool[] }) {
	return (
		<div className="wallet-ready">
			<div className="ready-copy">
				<span className="ready-check" aria-hidden="true">
					✓
				</span>
				<p className="ready-eyebrow">Setup complete</p>
				<h1>
					Your wallet.
					<br />
					Ready for anything.
				</h1>
				<p className="ready-description">
					Your keys are encrypted in your local Vault.
					<br />
					Return to your MCP client to get started.
				</p>
			</div>
			<AvailableTools tools={tools} />
		</div>
	);
}
