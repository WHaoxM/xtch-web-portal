import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { readStoredAuthSession, clearStoredAuthSession } from '@/lib/authClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SafeOrderSummary } from '@/lib/orderClient';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'confirmed'
      ? 'default'
      : status === 'pending_payment'
        ? 'secondary'
        : status === 'expired' || status === 'cancelled'
          ? 'destructive'
          : 'outline';
  return <Badge variant={variant as never}>{status.replace(/_/g, ' ')}</Badge>;
}

export default function Account() {
  const navigate = useNavigate();
  const [session] = useState(() => readStoredAuthSession());
  const [orders, setOrders] = useState<SafeOrderSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready' | 'unauthenticated'>(() =>
    session ? 'loading' : 'unauthenticated',
  );
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;

    let cancelled = false;

    fetch('/api/my-orders', {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok && Array.isArray(data.orders)) {
          setOrders(data.orders);
          setStatus('ready');
        } else {
          setError(data.error || 'We could not load your orders.');
          setStatus('error');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError('We could not load your orders.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign in to view your orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Sign in to see your bookings, deposits, and trip details.
            </p>
            <Button className="w-full" onClick={() => navigate('/china-trips')}>
              Go to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-muted-foreground">Loading your orders...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-semibold mb-2">Could not load orders</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        {session && (
          <Button
            variant="outline"
            onClick={() => {
              clearStoredAuthSession();
              window.location.reload();
            }}
          >
            Sign out and retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 pt-24">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">My Orders</h1>
        {session?.user.email && (
          <p className="text-muted-foreground">{session.user.email}</p>
        )}
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">You have not placed any orders yet.</p>
            <Button className="mt-4" onClick={() => navigate('/china-trips')}>
              Explore trips
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card
              key={order.order_number}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/orders/${order.order_number}`)}
            >
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Order {order.order_number}</p>
                    <h2 className="font-semibold">{order.route_snapshot.route_title}</h2>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Dates</p>
                    <p className="font-medium">
                      {order.route_snapshot.start_date} – {order.route_snapshot.end_date}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Departure</p>
                    <p className="font-medium">{order.route_snapshot.departure_city}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Travelers</p>
                    <p className="font-medium">{order.adult_quantity} adults</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-medium">{formatCents(order.total_price_cents)} USD</p>
                  </div>
                </div>

                {order.traveler_details_due_at && order.status === 'confirmed' && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-900">
                    Submit traveler details by {formatDate(order.traveler_details_due_at)}.
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
