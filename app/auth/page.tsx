import { redirect } from "next/navigation";

// The /auth route is no longer used. The onboarding flow lives at /connect.
export default function AuthPage() {
	redirect("/connect");
}
