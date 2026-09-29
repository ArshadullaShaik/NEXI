import SignInPanel from '@/components/SignInPanel';

// Server component on purpose: `SignInPanel` is a client component, and this is the only
// place that can read the server-side FIREBASE_PROJECT_ID to pass down. The project id is
// not a secret — it is visible in the Firebase console URL and in every client id — and
// knowing it lets the unconfigured screen name the exact values still needed instead of
// saying "add the NEXT_PUBLIC_FIREBASE_* variables", which is no help to anyone.
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return <SignInPanel mode="signin" serverProjectId={process.env.FIREBASE_PROJECT_ID || ''} />;
}
