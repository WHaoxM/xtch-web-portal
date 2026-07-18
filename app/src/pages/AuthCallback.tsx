import { useEffect, useState } from 'react';
import {
  TRAVELER_DEFAULT_RETURN_PATH,
  completeAuthRedirectNavigation,
  readStoredAuthSession,
  resolvePostAuthReturnPath,
} from '../lib/authClient';

/**
 * Neutral landing for Supabase redirects: /#/auth/callback
 * Consumes tokens from the URL, then returns to the pending hash path.
 */
export default function AuthCallback() {
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    completeAuthRedirectNavigation()
      .then(async (ok) => {
        if (cancelled) return;
        if (ok) return;
        // Tokens already consumed (or link opened twice) but session may exist.
        const session = readStoredAuthSession();
        if (session) {
          window.location.hash = await resolvePostAuthReturnPath(session);
          return;
        }
        setError('No sign-in session was found. Request a new sign-in code or try Google again.');
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Sign-in failed.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-lg font-semibold">Sign-in problem</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="flex flex-col gap-2 text-sm">
            <a className="underline" href={TRAVELER_DEFAULT_RETURN_PATH}>
              Back to sign in
            </a>
            <a className="underline text-muted-foreground" href="#/admin">
              Admin sign in
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-sm text-muted-foreground">
      Completing sign-in…
    </div>
  );
}
