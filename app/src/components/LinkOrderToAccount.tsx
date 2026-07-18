import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  readStoredAuthSession,
  subscribeAuthSession,
  type AuthSession,
} from '@/lib/authClient';
import {
  claimOrderToAccount,
  parseOrderClaimInput,
  type ClaimOrderProof,
} from '@/lib/orderClient';
import { Button } from '@/components/ui/button';

type LinkOrderToAccountProps = {
  /** When set, bind this proof (success page / email link). */
  proof?: ClaimOrderProof | null;
  /** Show paste form for confirmation link (Account / My Orders). */
  allowPaste?: boolean;
  /** Auto-attempt claim once when signed in and proof is present. */
  autoClaim?: boolean;
  variant?: 'card' | 'mobile';
  onLinked?: () => void;
  className?: string;
};

export function LinkOrderToAccount({
  proof,
  allowPaste = false,
  autoClaim = true,
  variant = 'card',
  onLinked,
  className,
}: LinkOrderToAccountProps) {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredAuthSession());
  const [pasteValue, setPasteValue] = useState('');
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

  const proofFromPaste = allowPaste ? parseOrderClaimInput(pasteValue) : null;
  const activeProof =
    proof && proof.orderNumber && (proof.token || proof.sessionId)
      ? proof
      : proofFromPaste;

  useEffect(() => {
    if (!autoClaim) return;
    if (!proof?.orderNumber || !(proof.token || proof.sessionId)) return;
    if (!session?.accessToken) return;

    const key = `${session.accessToken}:${proof.orderNumber}:${proof.token || ''}:${proof.sessionId || ''}`;
    if (autoTriedKey.current === key) return;
    autoTriedKey.current = key;

    let cancelled = false;

    claimOrderToAccount(session.accessToken, proof)
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
  }, [autoClaim, proof, session?.accessToken, onLinked]);

  async function handleClaim() {
    if (!session?.accessToken) {
      setStatus('error');
      setMessage('Sign in first, then link this booking.');
      return;
    }
    if (!activeProof) {
      setStatus('error');
      setMessage('Paste the full link from your confirmation email (includes token).');
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
        Works even if your login email differs from the booking form email. Use the confirmation
        email link or this page&apos;s secure link.
      </p>

      {!session ? (
        <div className={isMobile ? 'mt-3' : 'mt-3'}>
          <p className={isMobile ? 'iosapp-checkout-note' : 'mb-2 text-sm text-muted-foreground'}>
            {isMobile
              ? 'Open Me → Sign in, then return here or paste the confirmation link under My Orders.'
              : 'Sign in first, then return here or paste the confirmation link under My Orders.'}
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
          {allowPaste && (
            <label className="block space-y-1">
              <span className={isMobile ? 'sr-only' : 'text-xs text-muted-foreground'}>
                Confirmation link
              </span>
              <textarea
                className={
                  isMobile
                    ? 'w-full min-h-[72px] rounded-xl border border-black/10 bg-white px-3 py-2 text-sm'
                    : 'w-full min-h-[72px] rounded-md border px-3 py-2 text-sm'
                }
                placeholder="Paste confirmation link (#/orders/…?token=…)"
                value={pasteValue}
                onChange={(event) => {
                  setPasteValue(event.target.value);
                  if (status === 'error') {
                    setStatus('idle');
                    setMessage('');
                  }
                }}
              />
            </label>
          )}

          {isMobile ? (
            <button
              type="button"
              className="iosapp-primary-button"
              disabled={status === 'working'}
              onClick={() => void handleClaim()}
            >
              {status === 'working' ? 'Saving…' : allowPaste ? 'Link booking' : 'Save to my account'}
            </button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={status === 'working' || (!allowPaste && !activeProof)}
              onClick={() => void handleClaim()}
            >
              {status === 'working' ? 'Saving…' : allowPaste ? 'Link booking' : 'Save to my account'}
            </Button>
          )}

          {status === 'working' && !allowPaste && (
            <p className={isMobile ? 'iosapp-checkout-note' : 'text-sm text-muted-foreground'}>
              Linking to {session.user.email}…
            </p>
          )}
          {message && status === 'error' && (
            <p className={isMobile ? 'iosapp-checkout-note text-destructive' : 'text-sm text-destructive'}>
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
