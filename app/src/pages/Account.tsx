import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  clearStoredAuthSession,
  readStoredAuthSession,
  subscribeAuthSession,
  type AuthSession,
} from '@/lib/authClient';
import { fetchMyOrders, type SafeOrderSummary } from '@/lib/orderClient';
import { LinkOrderToAccount } from '@/components/LinkOrderToAccount';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
  const [session, setSession] = useState<AuthSession | null>(() => readStoredAuthSession());
  const [orders, setOrders] = useState<SafeOrderSummary[]>([]);
  const [error, setError] = useState('');
  const [loadedForToken, setLoadedForToken] = useState('');
  const [ordersEpoch, setOrdersEpoch] = useState(0);

  const accessToken = session?.accessToken ?? '';
  const status = !accessToken
    ? 'unauthenticated'
    : loadedForToken !== accessToken
      ? 'loading'
      : error
        ? 'error'
        : 'ready';

  useEffect(() => {
    const syncSession = (next: AuthSession | null = readStoredAuthSession()) => {
      setSession((prev) => {
        if (prev?.accessToken === next?.accessToken && prev?.user.id === next?.user.id) {
          return prev;
        }
        return next;
      });
    };

    const unsubscribe = subscribeAuthSession((next) => syncSession(next));
    const onFocus = () => syncSession();
    window.addEventListener('focus', onFocus);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;

    fetchMyOrders(accessToken)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setOrders(result.orders);
          setError('');
          setLoadedForToken(accessToken);
          return;
        }
        if (result.unauthorized) {
          clearStoredAuthSession();
          setSession(null);
          setOrders([]);
          setError('');
          setLoadedForToken('');
          return;
        }
        setOrders([]);
        setError(result.error);
        setLoadedForToken(accessToken);
      })
      .catch(() => {
        if (cancelled) return;
        setOrders([]);
        setError('We could not load your orders.');
        setLoadedForToken(accessToken);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, ordersEpoch]);

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

      <LinkOrderToAccount
        allowPaste
        autoClaim={false}
        className="mb-8"
        onLinked={() => setOrdersEpoch((value) => value + 1)}
      />

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
            <Link
              key={order.order_number}
              to={`/orders/${order.order_number}`}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Card className="hover:shadow-md transition-shadow">
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
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
