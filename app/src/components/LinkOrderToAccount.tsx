import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  readStoredAuthSession,
  subscribeAuthSession,
  type AuthSession,
} from '@/lib/authClient';
import { claimOrderToAccount, type ClaimOrderProof } from '@/lib/orderClient';
import { Button } from '@/components/ui/button';

type LinkOrderToAccountProps = {
  /** Bind this proof from the confirmation / success URL (order + token or session). */
  proof?: ClaimOrderProof | null;
  /** Auto-attempt claim once when signed in and proof is present. */
  autoClaim?: boolean;
  variant?: 'card' | 'mobile';
  onLinked?: () => void;
  className?: string;
};

/**
 * One-tap / auto bind when the traveler already has an order proof in the URL
 * (confirmation email link or checkout success). Do not ask them to paste links.
 */
export function LinkOrderToAccount({
  proof,
  autoClaim = true,
  variant = 'card',
  onLinked,
  className,
}: LinkOrderToAccountProps) {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredAuthSession());
  const [status, setStatus] = useState<'idle' | 'working' | 'linked' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const autoTriedKey = useRef('');

  useEffect(() => {
    return subscribeAuthSession((next) => {
      setSession((prev) => {
        if (prev?.accessToken === next?.accessToken && prev?.user.id === next?.user.id) {
          return prev;
        }
        return next;
      });
    });
  }, []);

  const activeProof =
    proof && proof.orderNumber && (proof.token || proof.sessionId) ? proof : null;

  useEffect(() => {
    if (!autoClaim) return;
    if (!activeProof) return;
    if (!session?.accessToken) return;

    const key = `${session.accessToken}:${activeProof.orderNumber}:${activeProof.token || ''}:${activeProof.sessionId || ''}`;
    if (autoTriedKey.current === key) return;
    autoTriedKey.current = key;

    let cancelled = false;

    claimOrderToAccount(session.accessToken, activeProof)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setStatus('linked');
          setMessage(
            result.status === 'already_linked'
              ? 'This booking is already on your account.'
              : 'Saved to your account. You can find it under My Orders.',
          );
          onLinked?.();
          return;
        }
        setStatus('error');
        setMessage(result.error);
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
        setMessage('We could not link this booking. Please try again.');
      });

    return () => {
      cancelled = true;
    };
  }, [autoClaim, activeProof, session?.accessToken, onLinked]);

  async function handleClaim() {
    if (!session?.accessToken) {
      setStatus('error');
      setMessage('Sign in first, then return to this page to save the booking.');
      return;
    }
    if (!activeProof) {
      setStatus('error');
      setMessage('This page is missing a secure booking link. Open the link from your confirmation email.');
      return;
    }

    setStatus('working');
    setMessage('');
    try {
      const result = await claimOrderToAccount(session.accessToken, activeProof);
      if (result.ok) {
        setStatus('linked');
        setMessage(
          result.status === 'already_linked'
            ? 'This booking is already on your account.'
            : 'Saved to your account. You can find it under My Orders.',
        );
        onLinked?.();
        return;
      }
      setStatus('error');
      setMessage(result.error);
    } catch {
      setStatus('error');
      setMessage('We could not link this booking. Please try again.');
    }
  }

  if (!activeProof) {
    return null;
  }

  const isMobile = variant === 'mobile';
  const shellClass = isMobile
    ? 'iosapp-booking-link-account'
    : 'mt-6 rounded-lg border bg-slate-50 p-4';

  return (
    <div className={[shellClass, className].filter(Boolean).join(' ')}>
      <p className={isMobile ? 'iosapp-booking-cta-note' : 'text-sm font-medium text-slate-900'}>
        Save this booking to your account
      </p>
      <p className={isMobile ? 'iosapp-checkout-note' : 'mt-1 text-sm text-muted-foreground'}>
        Works even if your login email differs from the booking form email.
      </p>

      {!session ? (
        <div className="mt-3">
          <p className={isMobile ? 'iosapp-checkout-note' : 'mb-2 text-sm text-muted-foreground'}>
            {isMobile
              ? 'Open Me → Sign in, then return to this confirmation link to save the booking.'
              : 'Sign in first, then return to this confirmation link to save the booking.'}
          </p>
          {!isMobile && (
            <Button asChild variant="outline" size="sm">
              <Link to="/china-trips">Sign in</Link>
            </Button>
          )}
        </div>
      ) : status === 'linked' ? (
        <p className={isMobile ? 'iosapp-checkout-note' : 'mt-3 text-sm text-emerald-700'}>{message}</p>
      ) : (
        <div className={isMobile ? 'iosapp-booking-actions mt-3' : 'mt-3 space-y-3'}>
          {isMobile ? (
            <button
              type="button"
              className="iosapp-primary-button"
              disabled={status === 'working'}
              onClick={() => void handleClaim()}
            >
              {status === 'working' ? 'Saving…' : 'Save to my account'}
            </button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={status === 'working'}
              onClick={() => void handleClaim()}
            >
              {status === 'working' ? 'Saving…' : 'Save to my account'}
            </Button>
          )}

          {status === 'working' && (
            <p className={isMobile ? 'iosapp-checkout-note' : 'text-sm text-muted-foreground'}>
              Linking to {session.user.email}…
            </p>
          )}
          {message && status === 'error' && (
            <p
              className={isMobile ? 'iosapp-checkout-note text-destructive' : 'text-sm text-destructive'}
              role="alert"
            >
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
