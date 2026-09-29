import SignInPanel from '@/components/SignInPanel';

// Server component — see the note in app/login/page.js about why.
export const dynamic = 'force-dynamic';

export default function SignupPage() {
  return <SignInPanel mode="signup" serverProjectId={process.env.FIREBASE_PROJECT_ID || ''} />;
}
