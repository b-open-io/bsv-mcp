import { redirect } from "next/navigation";

// The /auth route is no longer used. The onboarding flow lives at /.
export default function AuthPage() {
	redirect("/");
}
