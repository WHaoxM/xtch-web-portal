import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { LinkOrderToAccount } from '@/components/LinkOrderToAccount';
import { fetchOrderSummary, formatConfirmationEmailNote, formatOrderDateRange, type SafeOrderSummary } from '@/lib/orderClient';

export default function OrderSuccess() {
  const { orderNumber } = useParams<{ orderNumber?: string }>();
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState<SafeOrderSummary | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>(() => (orderNumber ? 'loading' : 'error'));
  const [error, setError] = useState<string>(() => (orderNumber ? '' : 'Order number is missing.'));
  const orderRef = useRef(order);

  const token = searchParams.get('token') || undefined;
  const sessionId = searchParams.get('session_id') || undefined;
  const claimProof =
    orderNumber && (token || sessionId)
      ? { orderNumber, token, sessionId }
      : null;

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  useEffect(() => {
    if (!orderNumber) return;

    const token = searchParams.get('token') || undefined;
    const sessionId = searchParams.get('session_id') || undefined;

    fetchOrderSummary(orderNumber, token, sessionId)
      .then((result) => {
        if (result.ok) {
          setOrder(result.order);
          setStatus('ready');
        } else {
          setError(result.error);
          setStatus('error');
        }
      })
      .catch(() => {
        setError('We could not load your order.');
        setStatus('error');
      });
  }, [orderNumber, searchParams]);

  useEffect(() => {
    if (!orderNumber || status !== 'ready') return;

    const token = searchParams.get('token') || undefined;
    const sessionId = searchParams.get('session_id') || undefined;
    const maxAttempts = 12;
    let attempts = 0;

    const interval = setInterval(() => {
      const currentOrder = orderRef.current;
      if (!currentOrder || currentOrder.status === 'confirmed' || attempts >= maxAttempts) {
        clearInterval(interval);
        return;
      }

      attempts += 1;
      fetchOrderSummary(orderNumber, token, sessionId)
        .then((result) => {
          if (result.ok) {
            setOrder(result.order);
            if (result.order.status === 'confirmed') {
              clearInterval(interval);
            }
          }
        })
        .catch(() => {
          // Ignore polling errors; keep the existing order visible.
        });
    }, 5000);

    return () => clearInterval(interval);
  }, [orderNumber, status, searchParams]);

  if (status === 'loading') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-muted-foreground">Loading your booking...</p>
      </div>
    );
  }

  if (status === 'error' || !order) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-semibold mb-2">Booking not found</h1>
        <p className="text-muted-foreground mb-6">{error || 'This link may have expired or is invalid.'}</p>
      </div>
    );
  }

  const isConfirmed = order.status === 'confirmed';
  const unitPriceDollars = (order.adult_unit_price_cents / 100).toFixed(2);
  const totalPriceDollars = (order.total_price_cents / 100).toFixed(2);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-1">{isConfirmed ? 'Booking confirmed' : 'Booking status'}</h1>
          <p className="text-muted-foreground">Order {order.order_number}</p>
        </div>

        {!isConfirmed && (
          <div className="mb-6 p-4 bg-amber-50 rounded-lg">
            <p className="text-sm text-amber-800">
              We are waiting for payment confirmation. This usually takes a few moments. Please
              refresh the page or check your email.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Route</span>
            <span className="font-medium text-right">{order.route_snapshot.route_title}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Dates</span>
            <span className="font-medium text-right">{formatOrderDateRange(order.route_snapshot.start_date, order.route_snapshot.end_date)}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Departure city</span>
            <span className="font-medium text-right">{order.route_snapshot.departure_city}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Adults</span>
            <span className="font-medium text-right">{order.adult_quantity}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Price per adult</span>
            <span className="font-medium text-right">${unitPriceDollars} USD</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Total paid</span>
            <span className="font-semibold text-right">${totalPriceDollars} USD</span>
          </div>
        </div>

        {isConfirmed && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-blue-900">Add traveler details — coming soon</p>
            <p className="mt-1 text-sm text-blue-900">
              We&apos;ll email you a secure link to add each traveler&apos;s details
              {order.traveler_details_due_at
                ? ` before ${new Date(order.traveler_details_due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`
                : ' before departure.'}
            </p>
          </div>
        )}

        <div className="mt-6 text-sm text-muted-foreground">
          <p>{formatConfirmationEmailNote(order.lead_email, order.confirmation_email_status)}</p>
        </div>

        {claimProof && <LinkOrderToAccount proof={claimProof} />}
      </div>
    </div>
  );
}
