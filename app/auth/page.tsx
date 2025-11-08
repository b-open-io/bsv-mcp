import { BigblocksAuthFlow } from "../../components/auth/BigblocksAuthFlow";
import { BigblocksAuthProvider } from "../../components/auth/BigblocksAuthProvider";

export default function AuthPage() {
	return (
		<BigblocksAuthProvider>
			<div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
				<div className="w-full max-w-md">
					<BigblocksAuthFlow className="w-full" />
				</div>
			</div>
		</BigblocksAuthProvider>
	);
}
