import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import {
  readStoredAuthSession,
  signInWithOAuth,
  sendAdminOtp,
  verifyEmailOtp,
  clearStoredAuthSession,
  consumeAuthRedirectSession,
  ensureFreshSession,
  resolvePostAuthReturnPath,
  fetchAdminQuickLoginEnabled,
  signInAdminPassword,
  type AuthSession,
} from '../lib/authClient';
import {
  adminRoleLabel,
  fetchAdminMe,
  type AdminRole,
} from '../lib/adminSessionClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InquiryDetail } from '@/components/admin/InquiryDetail';
import { OrderDetail, type AdminOrderDetail } from '@/components/admin/OrderDetail';
import { DestinationEditor } from '@/components/admin/DestinationEditor';
import { FormConfigMobilePreview } from '@/components/admin/FormConfigMobilePreview';
import { MediaBrowseFilters } from '@/components/admin/MediaBrowseFilters';
import { looksLikeWeakMediaTitle, mediaHasAssociation } from '@/lib/mediaBrowseHints';
import { RouteEditor } from '@/components/admin/RouteEditor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchAdminCustomTripForm,
  postAdminCustomTripForm,
  type CustomTripFormField,
  type FormControlType,
  type FormGroup,
} from '@/lib/customTripFormClient';
import {
  emptyFieldDraft,
  fieldKeyFromLabel,
  fieldToDraft,
  hasFieldCopyCjk,
  isFieldDraftDirty,
  mergeDraftIntoFields,
  parseDefaultValueInput,
  parseOptionsTextarea,
  resolveFieldKey,
  type FieldEditDraft,
} from '@/lib/formFieldDraft';
import {
  DepartureEditor,
} from '@/components/admin/DepartureEditor';
import {
  departureToDraft,
  emptyDepartureDraft,
  type AdminDepartureRecord,
  type DepartureEditDraft,
} from '@/lib/departureDraft';
import {
  canResellDeparture,
  canRunDangerAction,
  departureActionConfirm,
  departureActionLabel,
  departureStatusLabel,
  departureStatusShortTag,
  travelerBuyConclusion,
  travelerCanBuy,
  type DepartureDangerAction,
} from '@/lib/departureOpsCopy';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  destinationToDraft,
  emptyDestinationDraft,
  type DestinationEditDraft,
} from '@/lib/destinationDraft';
import {
  fetchAdminDestinations,
  postAdminDestination,
  type Destination,
} from '@/lib/destinationsClient';
import {
  fetchAdminCategories,
  fetchCategories,
  postAdminCategory,
  type Category,
  type CategoryScope,
} from '@/lib/categoriesClient';
import {
  fetchAdminRoutes,
  postAdminRoute,
  type ContentStatus,
  type RouteRecord,
} from '@/lib/routesClient';
import { containsCjk, emptyRouteDraft, routeToDraft, type RouteEditDraft } from '@/lib/routeDraft';
import { slugify, slugifyOrFallback } from '@/lib/slugify';
import {
  fetchAdminMedia,
  postAdminMedia,
  presignMediaUpload,
  uploadFileToPresignedUrl,
  type MediaAsset,
  type MediaAssetStatus,
  type MediaAssetType,
} from '@/lib/mediaClient';
import { extractVideoPosterBlob } from '@/lib/videoPoster';
import {
  fetchAdminInquiries,
  fetchAdminInquiry,
  type AdminInquiry,
  type AdminInquiryListItem,
} from '@/lib/inquiriesAdminClient';
import {
  formatInquiryDateTime,
  inquiryStatusLabel,
  inquiryTypeLabel,
} from '@/lib/inquiryOpsCopy';
import {
  formatOrderDateTime,
  ORDER_STATUS_LABELS,
  orderStatusLabel,
  paymentStatusLabel,
} from '@/lib/orderOpsCopy';
import {
  DASHBOARD_CARD_COPY,
  DASHBOARD_PAGE_TIP,
  type DashboardCardKey,
} from '@/lib/dashboardOpsCopy';
import { cn } from '@/lib/utils';

type AdminTab =
  | 'dashboard'
  | 'orders'
  | 'inquiries'
  | 'departures'
  | 'destinations'
  | 'routes'
  | 'categories'
  | 'media'
  | 'custom-trip-form';

type AdminNavItem = {
  value: AdminTab;
  label: string;
  /** When set, only that role (and above) may see the item. Omit = ops and tech. */
  minRole?: 'tech';
};

type AdminNavGroup = {
  title: string;
  items: AdminNavItem[];
};

const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    title: '',
    items: [{ value: 'dashboard', label: '工作台' }],
  },
  {
    title: '交易',
    items: [
      { value: 'orders', label: '订单' },
      { value: 'inquiries', label: '询盘' },
      { value: 'departures', label: '班期' },
    ],
  },
  {
    title: '产品内容',
    items: [
      { value: 'destinations', label: '目的地' },
      { value: 'routes', label: '路线' },
      { value: 'categories', label: '筛选分类' },
      { value: 'media', label: '素材' },
    ],
  },
  {
    title: '配置',
    items: [
      { value: 'custom-trip-form', label: '表单配置' },
    ],
  },
];

function navItemVisible(item: AdminNavItem, role: AdminRole | null): boolean {
  if (!item.minRole) return true;
  if (!role) return false;
  return item.minRole === 'tech' ? role === 'tech' : true;
}

function filterNavGroups(role: AdminRole | null): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => navItemVisible(item, role)),
  })).filter((group) => group.items.length > 0);
}

type PendingListFilter =
  | { tab: 'inquiries'; status: string }
  | { tab: 'orders'; status: string }
  | { tab: 'routes'; status: string }
  | { tab: 'media'; status: string };

type DashboardCounts = {
  openInquiries: number;
  cancellationRequestedOrders: number;
  draftRoutes: number;
  reviewMedia: number;
};

const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((group) => [
  ...group.items,
]);

const ENABLED_CATEGORY_SOFT_LIMIT = 6;

type AdminOrder = {
  order_number: string;
  status: string;
  payment_status: string;
  refund_status?: string;
  confirmation_email_status?: string;
  lead_traveler_name: string;
  lead_email: string;
  adult_quantity: number;
  total_price_cents: number;
  route_title?: string;
  departure_city?: string;
  start_date?: string;
  end_date?: string;
  route_slug?: string;
  created_at: string;
  updated_at?: string;
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(value: string): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
}

function StatusBadge({ status, label }: { status: string; label?: string }) {
  const variant =
    status === 'confirmed' || status === 'in_progress' || status === 'sellable' || status === 'paid'
      ? 'default'
      : status === 'pending_payment' || status === 'new' || status === 'draft' || status === 'unpaid'
        ? 'secondary'
        : status === 'expired' ||
            status === 'cancelled' ||
            status === 'cancellation_requested' ||
            status === 'closed' ||
            status === 'sold_out' ||
            status === 'failed' ||
            status === 'refunded'
          ? 'destructive'
          : 'outline';
  return <Badge variant={variant as never}>{label ?? status}</Badge>;
}

const ORDER_STATUS_FILTER_VALUES = [
  'pending_payment',
  'confirmed',
  'cancellation_requested',
  'cancelled',
  'refunded',
  'failed',
  'expired',
] as const;

function inquirySourceSummary(inquiry: {
  requested_tour?: string | null;
  requested_destination?: string | null;
  source_path?: string | null;
}): string {
  return (
    inquiry.requested_tour?.trim() ||
    inquiry.requested_destination?.trim() ||
    inquiry.source_path?.trim() ||
    '-'
  );
}

function SignInView({ onSignedIn }: { onSignedIn: (session: AuthSession) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [quickLoginEnabled, setQuickLoginEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchAdminQuickLoginEnabled().then((enabled) => {
      if (!cancelled) {
        setQuickLoginEnabled(enabled);
        if (!enabled) setMode('otp');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const handleGoogle = async () => {
    try {
      await signInWithOAuth('google', 'account', { returnPath: '/admin' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    }
  };

  const handlePasswordSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('loading');
    setError('');
    try {
      const session = await signInAdminPassword(email, password);
      onSignedIn(session);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Invalid email or password.');
    }
  };

  const handleSendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('loading');
    setError('');
    try {
      await sendAdminOtp(email);
      setStep('code');
      setResendIn(60);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'We could not send the sign-in code.');
    }
  };

  const handleVerifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('loading');
    setError('');
    try {
      const session = await verifyEmailOtp(email, otpCode);
      const nextPath = await resolvePostAuthReturnPath(session);
      if (nextPath !== '/admin' && !nextPath.startsWith('/admin?')) {
        window.location.replace(nextPath);
        return;
      }
      onSignedIn(session);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'We could not verify that code.');
    }
  };

  const handleResend = async () => {
    if (resendIn > 0) return;
    setStatus('loading');
    setError('');
    try {
      await sendAdminOtp(email);
      setResendIn(60);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'We could not send the sign-in code.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    consumeAuthRedirectSession()
      .then((session) => {
        if (!cancelled && session) onSignedIn(session);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, [onSignedIn]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin Sign In</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button type="button" variant="outline" className="w-full" onClick={handleGoogle}>
            Continue with Google
          </Button>
          <hr className="border-border" />

          {quickLoginEnabled && mode === 'password' ? (
            <form onSubmit={handlePasswordSignIn} className="space-y-3">
              <Input
                type="email"
                placeholder="Admin email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <Button type="submit" className="w-full" disabled={status === 'loading'}>
                {status === 'loading' ? 'Signing in...' : 'Sign in with password'}
              </Button>
              <button
                type="button"
                className="w-full text-sm underline text-muted-foreground"
                onClick={() => {
                  setMode('otp');
                  setStep('email');
                  setPassword('');
                  setError('');
                  setStatus('idle');
                }}
              >
                Use sign-in code instead
              </button>
            </form>
          ) : step === 'email' ? (
            <form onSubmit={handleSendCode} className="space-y-3">
              <Input
                type="email"
                placeholder="Admin email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Button type="submit" className="w-full" disabled={status === 'loading'}>
                {status === 'loading' ? 'Sending...' : 'Send sign-in code'}
              </Button>
              {quickLoginEnabled ? (
                <button
                  type="button"
                  className="w-full text-sm underline text-muted-foreground"
                  onClick={() => {
                    setMode('password');
                    setError('');
                    setStatus('idle');
                  }}
                >
                  Use password instead
                </button>
              ) : null}
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>.
              </p>
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                required
                minLength={6}
              />
              <Button type="submit" className="w-full" disabled={status === 'loading' || otpCode.length < 6}>
                {status === 'loading' ? 'Verifying...' : 'Verify code'}
              </Button>
              <div className="flex items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  className="underline text-muted-foreground"
                  onClick={() => {
                    setStep('email');
                    setOtpCode('');
                    setError('');
                  }}
                >
                  Use a different email
                </button>
                <button
                  type="button"
                  className="underline text-muted-foreground disabled:no-underline disabled:opacity-50"
                  disabled={resendIn > 0 || status === 'loading'}
                  onClick={() => void handleResend()}
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                </button>
              </div>
              {quickLoginEnabled ? (
                <button
                  type="button"
                  className="w-full text-sm underline text-muted-foreground"
                  onClick={() => {
                    setMode('password');
                    setStep('email');
                    setOtpCode('');
                    setError('');
                    setStatus('idle');
                  }}
                >
                  Use password instead
                </button>
              ) : null}
            </form>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function AccessDeniedView({
  email,
  message,
  onSignOut,
}: {
  email: string;
  message: string;
  onSignOut: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Access denied</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{email}</span>, but this account
            is not on the admin allowlist.
          </p>
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="flex-1" onClick={onSignOut}>
              Sign out
            </Button>
            <Button type="button" className="flex-1" asChild>
              <Link to="/">View site</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminEditShell({
  title,
  onBack,
  backLabel = '← Back to list',
  children,
}: {
  title: string;
  onBack: () => void;
  backLabel?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          {backLabel}
        </Button>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function FieldHint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 border-t pt-6 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function DashboardPanel({
  token,
  onNavigate,
}: {
  token: string;
  onNavigate: (filter: PendingListFilter) => void;
}) {
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadCounts() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = (await response.json()) as {
        ok: boolean;
        counts?: DashboardCounts;
        error?: string;
      };
      if (!response.ok || !result.ok || !result.counts) {
        setError(result.error || `HTTP ${response.status}`);
        setCounts(null);
        return;
      }
      setCounts(result.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法加载工作台数据。');
      setCounts(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const cards: Array<{
    key: DashboardCardKey;
    count: number | null;
    filter: PendingListFilter;
  }> = [
    {
      key: 'cancellationRequestedOrders',
      count: counts?.cancellationRequestedOrders ?? null,
      filter: { tab: 'orders', status: 'cancellation_requested' },
    },
    {
      key: 'openInquiries',
      count: counts?.openInquiries ?? null,
      filter: { tab: 'inquiries', status: 'open' },
    },
    {
      key: 'draftRoutes',
      count: counts?.draftRoutes ?? null,
      filter: { tab: 'routes', status: 'draft' },
    },
    {
      key: 'reviewMedia',
      count: counts?.reviewMedia ?? null,
      filter: { tab: 'media', status: 'review' },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{DASHBOARD_PAGE_TIP}</p>
        <Button type="button" variant="outline" onClick={() => void loadCounts()} disabled={loading}>
          {loading ? '加载中...' : '刷新'}
        </Button>
      </div>

      {error && <p className="text-destructive">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const copy = DASHBOARD_CARD_COPY[card.key];
          const hasWork = card.count != null && card.count > 0;
          const isZero = card.count === 0;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => onNavigate(card.filter)}
              className={cn(
                'rounded-lg border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                hasWork &&
                  'border-foreground/30 bg-card shadow-sm ring-1 ring-foreground/10 hover:bg-muted/40',
                isZero && 'border-border/50 bg-muted/20 text-muted-foreground hover:bg-muted/40',
                !hasWork && !isZero && 'border-border bg-card hover:bg-muted/50',
              )}
            >
              <p
                className={cn(
                  'text-sm font-medium',
                  hasWork ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {copy.title}
              </p>
              <p
                className={cn(
                  'mt-3 text-3xl font-semibold tracking-tight tabular-nums',
                  hasWork && 'text-foreground',
                  isZero && 'text-muted-foreground/70 font-medium',
                )}
              >
                {loading && counts == null ? '—' : (card.count ?? '—')}
              </p>
              <p
                className={cn(
                  'mt-2 text-xs',
                  hasWork ? 'text-muted-foreground' : 'text-muted-foreground/80',
                )}
              >
                {copy.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OrdersPanel({
  token,
  initialStatusFilter = '',
}: {
  token: string;
  initialStatusFilter?: string;
}) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function fetchOrders() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const response = await fetch(`/api/admin/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = (await response.json()) as { ok: boolean; orders?: AdminOrder[]; error?: string };
      if (!response.ok || !result.ok) {
        setError(result.error || `HTTP ${response.status}`);
        return;
      }
      setOrders(result.orders ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法加载订单列表。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function openDetail(orderNumber: string) {
    setDetailLoading(true);
    setError('');
    try {
      const response = await fetch(
        `/api/admin/orders?orderNumber=${encodeURIComponent(orderNumber)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const result = (await response.json()) as {
        ok: boolean;
        order?: AdminOrderDetail;
        error?: string;
      };
      if (!response.ok || !result.ok || !result.order) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }
      setSelectedOrder(result.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法加载订单详情。');
    } finally {
      setDetailLoading(false);
    }
  }

  if (selectedOrder) {
    return (
      <AdminEditShell
        title={selectedOrder.order_number}
        backLabel="← 返回列表"
        onBack={() => {
          setSelectedOrder(null);
          void fetchOrders();
        }}
      >
        <OrderDetail
          token={token}
          order={selectedOrder}
          onOrderChange={setSelectedOrder}
          onListRefresh={fetchOrders}
        />
      </AdminEditShell>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Input
          placeholder="搜索订单号、客户或邮箱"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void fetchOrders();
          }}
          className="sm:max-w-xs"
        />
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:max-w-[10rem]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">全部状态</option>
          {ORDER_STATUS_FILTER_VALUES.map((value) => (
            <option key={value} value={value}>
              {ORDER_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <Button onClick={() => void fetchOrders()} disabled={loading || detailLoading}>
          {loading ? '加载中...' : '搜索'}
        </Button>
      </div>

      {error && <p className="text-destructive">{error}</p>}
      {detailLoading && <p className="text-sm text-muted-foreground">正在打开订单详情…</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订单号</TableHead>
                <TableHead>路线</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>支付</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>创建时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const isCancelRequest = order.status === 'cancellation_requested';
                return (
                  <TableRow
                    key={order.order_number}
                    className={cn(
                      'cursor-pointer',
                      isCancelRequest && 'bg-destructive/5 hover:bg-destructive/10',
                    )}
                    onClick={() => void openDetail(order.order_number)}
                  >
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>{order.route_title || '-'}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={order.status}
                        label={orderStatusLabel(order.status)}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={order.payment_status}
                        label={paymentStatusLabel(order.payment_status)}
                      />
                    </TableCell>
                    <TableCell>{order.lead_traveler_name}</TableCell>
                    <TableCell>{formatCents(order.total_price_cents)}</TableCell>
                    <TableCell>{formatOrderDateTime(order.created_at)}</TableCell>
                  </TableRow>
                );
              })}
              {orders.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {search.trim() || statusFilter ? '无匹配结果' : '暂无订单'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function InquiriesPanel({
  token,
  initialStatusFilter = 'open',
}: {
  token: string;
  initialStatusFilter?: string;
}) {
  const [inquiries, setInquiries] = useState<AdminInquiryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<AdminInquiry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function fetchInquiries() {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchAdminInquiries(token, {
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        search: search.trim() || undefined,
      });
      setInquiries(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法加载询盘列表。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInquiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setError('');
    try {
      const inquiry = await fetchAdminInquiry(token, id);
      setSelected(inquiry);
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法加载询盘详情。');
    } finally {
      setDetailLoading(false);
    }
  }

  if (selected) {
    return (
      <AdminEditShell
        title={`${selected.name} · ${inquiryTypeLabel(selected.type)}`}
        backLabel="← 返回列表"
        onBack={() => {
          setSelected(null);
          void fetchInquiries();
        }}
      >
        <InquiryDetail
          token={token}
          inquiry={selected}
          onInquiryChange={setSelected}
          onListRefresh={fetchInquiries}
        />
      </AdminEditShell>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Input
          placeholder="搜索姓名或邮箱"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="sm:max-w-xs"
        />
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:max-w-[10rem]"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="open">未关闭</option>
          <option value="">全部状态</option>
          <option value="new">新询盘</option>
          <option value="in_progress">跟进中</option>
          <option value="closed">已关闭</option>
        </select>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:max-w-[10rem]"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
        >
          <option value="">全部类型</option>
          <option value="quick_contact">快捷联系</option>
          <option value="custom_trip">定制行程</option>
          <option value="route_private">路线私人定制</option>
        </select>
        <Button onClick={() => void fetchInquiries()} disabled={loading || detailLoading}>
          {loading ? '加载中...' : '搜索'}
        </Button>
      </div>

      {error && <p className="text-destructive">{error}</p>}
      {detailLoading && <p className="text-sm text-muted-foreground">加载详情...</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>来源摘要</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inquiries.map((inquiry) => (
                <TableRow
                  key={inquiry.id}
                  className="cursor-pointer"
                  onClick={() => void openDetail(inquiry.id)}
                >
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatInquiryDateTime(inquiry.created_at)}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">{inquiryTypeLabel(inquiry.type)}</span>
                  </TableCell>
                  <TableCell className="font-medium">{inquiry.name}</TableCell>
                  <TableCell>{inquiry.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        inquiry.status === 'closed'
                          ? 'destructive'
                          : inquiry.status === 'in_progress'
                            ? 'default'
                            : 'secondary'
                      }
                    >
                      {inquiryStatusLabel(inquiry.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate">
                    {inquirySourceSummary(inquiry)}
                  </TableCell>
                </TableRow>
              ))}
              {inquiries.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    暂无询盘
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

type AdminDeparture = AdminDepartureRecord;

function DeparturesPanel({ token }: { token: string }) {
  const [departures, setDepartures] = useState<AdminDeparture[]>([]);
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionStatus, setActionStatus] = useState<Record<string, 'idle' | 'loading'>>({});
  const [editing, setEditing] = useState<DepartureEditDraft | null>(null);
  const [isCreate, setIsCreate] = useState(false);
  const [editingSeats, setEditingSeats] = useState<number | undefined>(undefined);
  const [routeFilter, setRouteFilter] = useState('');
  const [saleFilter, setSaleFilter] = useState<'all' | 'sellable' | 'stopped'>('all');
  const [pendingAction, setPendingAction] = useState<{
    publicId: string;
    action: DepartureDangerAction;
  } | null>(null);

  useEffect(() => {
    Promise.all([fetchAdminRoutes(token), fetchAdminDestinations(token)])
      .then(([nextRoutes, nextDestinations]) => {
        setRoutes(nextRoutes);
        setDestinations(nextDestinations);
      })
      .catch((err) => setError(err instanceof Error ? err.message : '无法加载路线或目的地。'));
  }, [token]);

  async function fetchDepartures() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/departures', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = (await response.json()) as {
        ok: boolean;
        departures?: AdminDeparture[];
        error?: string;
      };
      if (!response.ok || !result.ok) {
        setError(result.error || `HTTP ${response.status}`);
        return;
      }
      setDepartures(result.departures ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法加载班期列表。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDepartures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function runAction(publicId: string, action: DepartureDangerAction) {
    setActionStatus((current) => ({ ...current, [`${publicId}:${action}`]: 'loading' }));
    setError('');
    setPendingAction(null);
    try {
      const response = await fetch(
        `/api/admin/departures?publicId=${encodeURIComponent(publicId)}&action=${action}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const result = (await response.json()) as {
        ok: boolean;
        departures?: AdminDeparture[];
        error?: string;
      };
      if (!response.ok || !result.ok) {
        setError(result.error || `HTTP ${response.status}`);
        return;
      }
      if (Array.isArray(result.departures)) {
        setDepartures(result.departures);
      } else {
        await fetchDepartures();
      }
      setStatus(`班期已${departureActionLabel(action)}。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败。');
    } finally {
      setActionStatus((current) => ({ ...current, [`${publicId}:${action}`]: 'idle' }));
    }
  }

  async function resellDeparture(departure: AdminDeparture) {
    setBusy(true);
    setError('');
    setStatus('');
    const draft = departureToDraft(departure);
    const payload = {
      action: 'update',
      publicId: draft.publicId,
      routeSlug: draft.routeSlug,
      routeTitle: draft.routeTitle,
      destinationSlug: draft.destinationSlug || undefined,
      departureCity: draft.departureCity,
      startDate: draft.startDate,
      endDate: draft.endDate,
      status: 'sellable',
      guaranteed: draft.guaranteed,
      adultUnitPriceCents: Math.round(Number(draft.adultUnitPriceUsd) * 100),
      capacity: Number(draft.capacity),
      featuredOnHome: draft.featuredOnHome,
      featuredPriority: Number(draft.featuredPriority) || 0,
      refillChainKey: draft.refillChainKey || undefined,
      refillSequence: Number(draft.refillSequence) || undefined,
      refillEnabled: draft.refillEnabled,
      refillMaxAutoActivations: Number(draft.refillMaxAutoActivations) || undefined,
      confirmationRule: draft.confirmationRule,
      includedCoreItems: draft.includedText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      excludedCoreItems: draft.excludedText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      importantNotes: draft.notesText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    };
    try {
      const response = await fetch('/api/admin/departures', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        ok: boolean;
        departures?: AdminDeparture[];
        error?: string;
      };
      if (!response.ok || !result.ok) {
        setError(result.error || `HTTP ${response.status}`);
        return;
      }
      if (Array.isArray(result.departures)) {
        setDepartures(result.departures);
      } else {
        await fetchDepartures();
      }
      setStatus('已重新上架可售。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '重新上架失败。');
    } finally {
      setBusy(false);
    }
  }

  const filteredDepartures = departures.filter((departure) => {
    if (routeFilter && departure.route_slug !== routeFilter) return false;
    if (saleFilter === 'sellable' && departure.status !== 'sellable') return false;
    if (saleFilter === 'stopped' && departure.status === 'sellable') return false;
    return true;
  });

  const confirmCopy = pendingAction ? departureActionConfirm(pendingAction.action) : null;

  if (editing) {
    return (
      <AdminEditShell
        title={isCreate ? '新建班期' : `编辑：${editing.publicId || '班期'}`}
        backLabel="← 返回列表"
        onBack={() => {
          setEditing(null);
          setIsCreate(false);
          setEditingSeats(undefined);
        }}
      >
        <DepartureEditor
          token={token}
          initialDraft={editing}
          isCreate={isCreate}
          routes={routes}
          destinations={destinations}
          refillChains={Array.from(
            new Map(
              departures
                .filter((departure) => departure.refill_chain_key)
                .map((departure) => [
                  departure.refill_chain_key as string,
                  {
                    key: departure.refill_chain_key as string,
                    routeSlug: departure.route_slug,
                  },
                ]),
            ).values(),
          )}
          availableSeats={editingSeats}
          onCancel={() => {
            setEditing(null);
            setIsCreate(false);
            setEditingSeats(undefined);
          }}
          onSaved={(message) => {
            setStatus(message);
            setEditing(null);
            setIsCreate(false);
            setEditingSeats(undefined);
            void fetchDepartures();
          }}
        />
      </AdminEditShell>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          快速开班后上架可售；锁团可恢复，关闭/取消不提供一键开卖。
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={busy || loading}
            onClick={() => {
              setIsCreate(true);
              setEditingSeats(undefined);
              setEditing(emptyDepartureDraft(routes, destinations));
            }}
          >
            新建班期
          </Button>
          <Button onClick={() => void fetchDepartures()} disabled={loading || busy}>
            {loading ? '加载中...' : '刷新'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">路线</span>
          <select
            className="flex h-10 min-w-[12rem] rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={routeFilter}
            onChange={(event) => setRouteFilter(event.target.value)}
          >
            <option value="">全部路线</option>
            {routes.map((route) => (
              <option key={route.slug} value={route.slug}>
                {route.title}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">售卖</span>
          <select
            className="flex h-10 min-w-[8rem] rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={saleFilter}
            onChange={(event) =>
              setSaleFilter(event.target.value as 'all' | 'sellable' | 'stopped')
            }
          >
            <option value="all">全部</option>
            <option value="sellable">可售</option>
            <option value="stopped">停售</option>
          </select>
        </label>
      </div>

      {error && <p className="text-destructive">{error}</p>}
      {status && <p className="text-sm text-green-700">{status}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>路线</TableHead>
                <TableHead>出发城市</TableHead>
                <TableHead>日期</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>旅客能否买</TableHead>
                <TableHead>名额</TableHead>
                <TableHead>单价</TableHead>
                <TableHead>首页</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDepartures.map((departure) => {
                const shortTag = departureStatusShortTag(departure.status);
                const canBuy = travelerCanBuy(departure.status, departure.available_seats);
                const buy = travelerBuyConclusion(departure.status, departure.available_seats);
                return (
                  <TableRow key={departure.public_id}>
                    <TableCell className="font-medium">
                      <div>{departure.route_title}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {departure.public_id}
                      </div>
                    </TableCell>
                    <TableCell>{departure.departure_city}</TableCell>
                    <TableCell>
                      {formatDate(departure.start_date)} - {formatDate(departure.end_date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <StatusBadge
                          status={departure.status}
                          label={departureStatusLabel(departure.status)}
                        />
                        {shortTag ? (
                          <span className="text-xs text-muted-foreground">{shortTag}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={canBuy ? 'text-green-700' : 'text-muted-foreground'}>
                        {canBuy ? '是' : '否'}
                      </span>
                      {!canBuy && buy.detail.includes('售罄') ? (
                        <div className="text-xs text-muted-foreground">售罄</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {departure.available_seats} / {departure.capacity}
                    </TableCell>
                    <TableCell>{formatCents(departure.adult_unit_price_cents)}</TableCell>
                    <TableCell>
                      {departure.featured_on_home ? (
                        <Badge>P{departure.featured_priority ?? 0}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            setIsCreate(false);
                            setEditingSeats(departure.available_seats);
                            setEditing(departureToDraft(departure));
                          }}
                        >
                          编辑
                        </Button>
                        {canResellDeparture(departure.status) && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void resellDeparture(departure)}
                          >
                            重新上架
                          </Button>
                        )}
                        {canRunDangerAction(departure.status) &&
                          (['lock', 'close', 'cancel'] as const).map((action) => (
                            <Button
                              key={action}
                              size="sm"
                              variant="outline"
                              disabled={
                                actionStatus[`${departure.public_id}:${action}`] === 'loading'
                              }
                              onClick={() =>
                                setPendingAction({ publicId: departure.public_id, action })
                              }
                            >
                              {departureActionLabel(action)}
                            </Button>
                          ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredDepartures.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    暂无班期
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingAction != null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmCopy?.body}
              {confirmCopy?.shortTag ? `（${confirmCopy.shortTag}）` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>再想想</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (pendingAction) {
                  void runAction(pendingAction.publicId, pendingAction.action);
                }
              }}
            >
              确认{pendingAction ? departureActionLabel(pendingAction.action) : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


function formatDefaultSummary(field: CustomTripFormField): string {
  const value = field.defaultValue;
  if (Array.isArray(value)) return value.length ? value.join(', ') : '(empty)';
  if (value == null || value === '') return '(empty)';
  return String(value);
}

const CUSTOM_TRIP_CONTROL_LABELS: Record<FormControlType, string> = {
  single_select: '单选',
  multi_select: '多选',
  select: '下拉选择',
  text: '单行文本',
  textarea: '多行文本',
};

const CUSTOM_TRIP_GROUP_LABELS: Record<FormGroup, string> = {
  basic: '基础信息',
  more: '更多偏好',
};

function CustomTripFormPanel({ token }: { token: string }) {
  const [fields, setFields] = useState<CustomTripFormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [warning, setWarning] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<FieldEditDraft | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [listPreviewOpen, setListPreviewOpen] = useState(false);
  const [widePreview, setWidePreview] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1100px)').matches : true,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1100px)');
    const onChange = () => setWidePreview(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  async function loadFields() {
    setLoading(true);
    setError('');
    try {
      const next = await fetchAdminCustomTripForm(token);
      setFields(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载表单字段失败。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const previewFields = useMemo(() => mergeDraftIntoFields(fields, editing), [fields, editing]);
  const savedField = editing?.id ? fields.find((field) => field.id === editing.id) : undefined;
  const unsavedPreview = Boolean(editing && isFieldDraftDirty(editing, savedField));
  const previewDefaultMode = editing?.useOnRoutePrivate ? 'routePrivate' : 'full';
  const listPreviewFields = useMemo(() => fields.filter((field) => field.enabled), [fields]);
  const previewKey =
    editing &&
    (editing.fieldKey.trim() ||
      (editing.label.trim() ? fieldKeyFromLabel(editing.label) || 'field_…' : '（自动生成）'));

  function onLabelChange(label: string) {
    setEditing((current) => {
      if (!current) return current;
      if (current.id || current.keyLocked) {
        return { ...current, label };
      }
      return { ...current, label, fieldKey: fieldKeyFromLabel(label) };
    });
  }

  function startCreate() {
    setError('');
    setStatus('');
    setWarning('');
    setAdvancedOpen(false);
    setEditing(emptyFieldDraft((fields[fields.length - 1]?.sortOrder ?? 0) + 10));
  }

  function startEdit(field: CustomTripFormField) {
    setError('');
    setStatus('');
    setWarning('');
    setAdvancedOpen(false);
    setEditing(fieldToDraft(field));
  }

  async function setEnabled(field: CustomTripFormField, enabled: boolean) {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await postAdminCustomTripForm(token, {
        action: 'set-enabled',
        id: field.id,
        enabled,
      });
      setStatus(`「${field.label || field.fieldKey}」已${enabled ? '启用' : '停用'}。`);
      await loadFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新字段失败。');
    } finally {
      setBusy(false);
    }
  }

  async function setRequired(field: CustomTripFormField, required: boolean) {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await postAdminCustomTripForm(token, {
        action: 'set-required',
        id: field.id,
        required,
      });
      setStatus(`「${field.label || field.fieldKey}」已设为${required ? '必填' : '选填'}。`);
      await loadFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新必填状态失败。');
    } finally {
      setBusy(false);
    }
  }

  async function moveField(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const orderedIds = fields.map((field) => field.id);
    const [moved] = orderedIds.splice(index, 1);
    orderedIds.splice(target, 0, moved);
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const result = await postAdminCustomTripForm(token, {
        action: 'reorder',
        orderedIds,
      });
      if (Array.isArray(result.fields)) {
        setFields(result.fields);
      } else {
        await loadFields();
      }
      setStatus('字段顺序已更新。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '调整字段顺序失败。');
    } finally {
      setBusy(false);
    }
  }

  async function saveField() {
    if (!editing) return;
    setError('');
    setStatus('');
    setWarning('');

    if (!editing.label.trim()) {
      setError('请填写旅客可见标题（英文）。');
      return;
    }

    if (hasFieldCopyCjk(editing)) {
      setWarning('标题或说明疑似含中文。旅客表单会直接显示这段文案，请改为英文。');
      setError('已拦截：标题或说明含中文。请改为英文后再保存。');
      return;
    }

    const fieldKey = resolveFieldKey(editing);

    setBusy(true);
    try {
      const existing = fields.find((field) => field.id === editing.id);
      const idByKey = new Map(
        (existing?.options ?? []).map((option) => [option.optionKey, option.id] as const),
      );
      const options = parseOptionsTextarea(editing.optionsText).map((option) => ({
        ...option,
        id: idByKey.get(option.optionKey) || undefined,
      }));
      await postAdminCustomTripForm(token, {
        action: 'save-field',
        ...(editing.id ? { id: editing.id } : {}),
        fieldKey,
        label: editing.label.trim(),
        description: editing.description,
        controlType: editing.controlType,
        required: editing.required,
        defaultValue: parseDefaultValueInput(editing.controlType, editing.defaultValueText),
        formGroup: editing.formGroup,
        sortOrder: editing.sortOrder,
        enabled: editing.enabled,
        useOnRoutePrivate: editing.useOnRoutePrivate,
        options,
      });
      setStatus(`「${editing.label.trim()}」已保存。`);
      setEditing(null);
      await loadFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存字段失败。');
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    const isCreate = !editing.id;
    const cjkWarning = hasFieldCopyCjk(editing)
      ? '标题或说明疑似含中文。旅客表单会直接显示这段文案，请改为英文。'
      : '';

    const editorCard = (
      <Card>
        <CardHeader>
          <CardTitle>{isCreate ? '新建偏好字段' : `编辑：${editing.label || editing.fieldKey}`}</CardTitle>
          <p className="text-sm text-muted-foreground">
            运营填写旅客可见英文文案；系统字段键自动生成。右侧可即时预览旅客侧控件。
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-destructive">{error}</p>}
          {warning && <p className="rounded-md bg-amber-100 p-2 text-sm text-amber-900">{warning}</p>}
          {cjkWarning && !warning && (
            <p className="rounded-md bg-amber-100 p-2 text-sm text-amber-900">{cjkWarning}</p>
          )}

          <FormSection title="旅客可见" description="显示在询盘偏好区；请用英文。">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm md:col-span-2">
                <span>标题（英文）</span>
                <Input
                  value={editing.label}
                  placeholder="例如 Hotel level"
                  onChange={(event) => onLabelChange(event.target.value)}
                />
                <FieldHint>
                  旅客看到的问题标题。新建时系统会据此自动生成内部字段键
                  {previewKey ? `（${previewKey}）` : ''}。
                </FieldHint>
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span>说明（英文，可选）</span>
                <Textarea
                  value={editing.description}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, description: event.target.value } : current,
                    )
                  }
                />
              </label>
              <label className="space-y-2 text-sm">
                <span>定制表单分组</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editing.formGroup}
                  onChange={(event) =>
                    setEditing((current) =>
                      current
                        ? { ...current, formGroup: event.target.value as FormGroup }
                        : current,
                    )
                  }
                >
                  {(['basic', 'more'] as FormGroup[]).map((value) => (
                    <option key={value} value={value}>
                      {CUSTOM_TRIP_GROUP_LABELS[value]}
                    </option>
                  ))}
                </select>
                <FieldHint>完整定制里出现在「基础信息」还是「更多偏好」。</FieldHint>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={editing.useOnRoutePrivate}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, useOnRoutePrivate: event.target.checked } : current,
                    )
                  }
                />
                <span>
                  用于路线私人短表单
                  <FieldHint>勾选后出现在「基于此路线」的私人短询盘偏好区。</FieldHint>
                </span>
              </label>
            </div>
          </FormSection>

          <FormSection title="控件" description="控制输入方式、必填规则、默认值和选项。">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span>控件类型</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editing.controlType}
                  onChange={(event) =>
                    setEditing((current) =>
                      current
                        ? { ...current, controlType: event.target.value as FormControlType }
                        : current,
                    )
                  }
                >
                  {(['single_select', 'multi_select', 'select', 'text', 'textarea'] as FormControlType[]).map(
                    (value) => (
                      <option key={value} value={value}>
                        {CUSTOM_TRIP_CONTROL_LABELS[value]}
                      </option>
                    ),
                  )}
                </select>
                <FieldHint>多选默认值用英文 optionKey 逗号分隔。</FieldHint>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={editing.required}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, required: event.target.checked } : current,
                    )
                  }
                />
                <span>
                  必填
                  <FieldHint>开启后旅客提交时必须填写。</FieldHint>
                </span>
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span>
                  默认值
                  {editing.controlType === 'multi_select' ? '（多选用 optionKey 逗号分隔）' : ''}
                </span>
                <Input
                  value={editing.defaultValueText}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, defaultValueText: event.target.value } : current,
                    )
                  }
                />
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span>选项（每行：optionKey|label|enabled）</span>
                <Textarea
                  rows={8}
                  value={editing.optionsText}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, optionsText: event.target.value } : current,
                    )
                  }
                />
                <FieldHint>
                  optionKey 是入库值；label 是旅客可见英文文案；enabled 可写 disabled 隐藏单个选项。
                </FieldHint>
              </label>
            </div>
          </FormSection>

          <FormSection title="展示与发布" description="控制顺序和是否在新询盘表单中露出。">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span>排序值</span>
                <Input
                  type="number"
                  value={editing.sortOrder}
                  onChange={(event) =>
                    setEditing((current) =>
                      current
                        ? { ...current, sortOrder: Number(event.target.value) || 0 }
                        : current,
                    )
                  }
                />
                <FieldHint>数字越小越靠前；列表里的上移/下移也会更新顺序。</FieldHint>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={editing.enabled}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, enabled: event.target.checked } : current,
                    )
                  }
                />
                <span>
                  启用字段
                  <FieldHint>停用只隐藏新表单字段，历史询盘答案会保留。</FieldHint>
                </span>
              </label>
            </div>
          </FormSection>

          <details
            className="rounded-md border border-border/70 bg-muted/20 p-3"
            open={advancedOpen}
            onToggle={(event) => setAdvancedOpen((event.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer text-sm font-medium">高级：系统字段键</summary>
            <div className="mt-3 space-y-2">
              <Input value={String(previewKey || '')} disabled readOnly className="font-mono text-xs" />
              <FieldHint>
                {editing.keyLocked
                  ? '已锁定，不可改名（历史询盘答案按此键存储）。'
                  : isCreate
                    ? '由标题自动生成；保存后若被锁定将不可改。'
                    : '已有字段键请勿随意改动；已锁定字段不可改。'}
              </FieldHint>
            </div>
          </details>

          <div className="flex gap-2">
            <Button onClick={saveField} disabled={busy}>
              {busy ? '保存中...' : '保存字段'}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setEditing(null)}>
              取消
            </Button>
          </div>

          {!widePreview ? (
            <FormConfigMobilePreview
              fields={previewFields}
              unsaved={unsavedPreview}
              defaultMode={previewDefaultMode}
              embedded={false}
            />
          ) : null}
        </CardContent>
      </Card>
    );

    return (
      <AdminEditShell
        title={isCreate ? '新建偏好字段' : `编辑字段：${editing.label || editing.fieldKey}`}
        backLabel="← 返回列表"
        onBack={() => setEditing(null)}
      >
        <div className={widePreview ? 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]' : 'space-y-4'}>
          {editorCard}
          {widePreview ? (
            <FormConfigMobilePreview
              fields={previewFields}
              unsaved={unsavedPreview}
              defaultMode={previewDefaultMode}
              embedded
            />
          ) : null}
        </div>
      </AdminEditShell>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-muted-foreground">
          配置询盘偏好字段。完整定制按「基础信息 / 更多偏好」分组；勾选「路线私人」会出现在基于路线的短表单。列表可直接勾选「必填」；旅客提交缺项时会跳转到对应字段。停用只影响新表单。可用「整表预览」查看旅客侧已启用字段。
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setListPreviewOpen(true)}
            disabled={loading || busy || listPreviewFields.length === 0}
          >
            整表预览
          </Button>
          <Button variant="outline" onClick={loadFields} disabled={loading || busy}>
            {loading ? '加载中...' : '刷新'}
          </Button>
          <Button onClick={startCreate} disabled={loading || busy}>
            新建
          </Button>
        </div>
      </div>

      {error && <p className="text-destructive">{error}</p>}
      {status && <p className="text-sm text-green-700">{status}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>分组</TableHead>
                <TableHead>路线私人</TableHead>
                <TableHead>控件</TableHead>
                <TableHead>必填</TableHead>
                <TableHead>启用</TableHead>
                <TableHead>默认值</TableHead>
                <TableHead className="text-muted-foreground">字段键</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell className="font-medium">{field.label}</TableCell>
                  <TableCell>{CUSTOM_TRIP_GROUP_LABELS[field.formGroup]}</TableCell>
                  <TableCell>{field.useOnRoutePrivate ? '是' : '否'}</TableCell>
                  <TableCell>{CUSTOM_TRIP_CONTROL_LABELS[field.controlType]}</TableCell>
                  <TableCell>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={field.required}
                        disabled={busy}
                        onChange={(event) => setRequired(field, event.target.checked)}
                      />
                      <span>{field.required ? '必填' : '选填'}</span>
                    </label>
                  </TableCell>
                  <TableCell>
                    <Badge variant={field.enabled ? 'default' : 'secondary'}>
                      {field.enabled ? '已启用' : '已停用'}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs">
                    {formatDefaultSummary(field)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {field.fieldKey}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setEnabled(field, !field.enabled)}
                      >
                        {field.enabled ? '停用' : '启用'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || index === 0}
                        onClick={() => moveField(index, -1)}
                      >
                        上移
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || index === fields.length - 1}
                        onClick={() => moveField(index, 1)}
                      >
                        下移
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => startEdit(field)}
                      >
                        编辑
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {fields.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    暂无表单字段。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={listPreviewOpen} onOpenChange={setListPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-[440px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>整表预览（已保存）</DialogTitle>
            <DialogDescription>
              仅显示已启用字段；不含未保存草稿。姓名/邮箱等联系区不在此预览。
            </DialogDescription>
          </DialogHeader>
          <FormConfigMobilePreview fields={listPreviewFields} unsaved={false} defaultMode="full" embedded />
        </DialogContent>
      </Dialog>
    </div>
  );
}

const CONTENT_STATUSES: ContentStatus[] = ['published', 'draft', 'archived'];

const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  published: '已发布',
  draft: '草稿',
  archived: '已归档',
};

function DestinationsPanel({ token }: { token: string }) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<DestinationEditDraft | null>(null);
  const [isCreate, setIsCreate] = useState(false);

  async function loadDestinations() {
    setLoading(true);
    setError('');
    try {
      setDestinations(await fetchAdminDestinations(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载目的地失败。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDestinations();
    fetchCategories('destination')
      .then(setCategories)
      .catch(() => setCategories([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function archiveDestinationRow(slug: string) {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const result = await postAdminDestination(token, { action: 'archive', slug });
      setDestinations(result.destinations);
      setStatus(`目的地 ${slug} 已归档。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '归档目的地失败。');
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <AdminEditShell
        title={isCreate ? '新建目的地' : `编辑：${editing.slug || editing.name}`}
        backLabel="← 返回列表"
        onBack={() => {
          setEditing(null);
          setIsCreate(false);
        }}
      >
        <DestinationEditor
          token={token}
          initialDraft={editing}
          isCreate={isCreate}
          categories={categories}
          onCancel={() => {
            setEditing(null);
            setIsCreate(false);
          }}
          onSaved={async (message) => {
            setStatus(message);
            setEditing(null);
            setIsCreate(false);
            await loadDestinations();
          }}
        />
      </AdminEditShell>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          管理公网展示的目的地。默认快速填写门面；旅客可见文案请用英文。新建默认存为草稿。
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={busy || loading}
            onClick={() => {
              setIsCreate(true);
              setEditing(emptyDestinationDraft());
            }}
          >
            新建目的地
          </Button>
          <Button onClick={loadDestinations} disabled={loading || busy}>
            {loading ? '加载中…' : '刷新'}
          </Button>
        </div>
      </div>

      {error && <p className="text-destructive">{error}</p>}
      {status && <p className="text-sm text-green-700">{status}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标识</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>排序</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {destinations.map((destination) => (
                <TableRow key={destination.slug}>
                  <TableCell className="font-mono text-xs">{destination.slug}</TableCell>
                  <TableCell className="font-medium">{destination.name}</TableCell>
                  <TableCell>{destination.displayOrder}</TableCell>
                  <TableCell>
                    <Badge variant={destination.status === 'published' ? 'default' : 'secondary'}>
                      {CONTENT_STATUS_LABELS[destination.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setIsCreate(false);
                          setEditing(destinationToDraft(destination));
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || destination.status === 'archived'}
                        onClick={() => archiveDestinationRow(destination.slug)}
                      >
                        归档
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {destinations.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    暂无目的地。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}

function csvToList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function RoutesPanel({
  token,
  initialStatusFilter = '',
}: {
  token: string;
  initialStatusFilter?: string;
}) {
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<RouteEditDraft | null>(null);
  const [isCreate, setIsCreate] = useState(false);

  async function loadRoutes() {
    setLoading(true);
    setError('');
    try {
      setRoutes(
        await fetchAdminRoutes(token, {
          status: statusFilter || undefined,
          search: search.trim() || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载路线失败。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoutes();
    fetchCategories('route')
      .then(setCategories)
      .catch(() => setCategories([]));
    fetchAdminDestinations(token)
      .then(setDestinations)
      .catch(() => setDestinations([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function archiveRouteRow(slug: string) {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await postAdminRoute(token, { action: 'archive', slug });
      setStatus(`路线 ${slug} 已归档。`);
      await loadRoutes();
    } catch (err) {
      setError(err instanceof Error ? err.message : '归档路线失败。');
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <AdminEditShell
        title={isCreate ? '新建路线' : `编辑：${editing.slug || editing.title}`}
        backLabel="← 返回列表"
        onBack={() => {
          setEditing(null);
          setIsCreate(false);
        }}
      >
        <RouteEditor
          token={token}
          initialDraft={editing}
          isCreate={isCreate}
          categories={categories}
          destinations={destinations}
          onCancel={() => {
            setEditing(null);
            setIsCreate(false);
          }}
          onSaved={async (message) => {
            setStatus(message);
            setEditing(null);
            setIsCreate(false);
            await loadRoutes();
          }}
        />
      </AdminEditShell>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          管理 China Trips、目的地页与路线详情上的路线卡片。默认快速模式填写门面；旅客可见文案请用英文。
        </p>
        <Button
          variant="outline"
          disabled={busy || loading}
          onClick={() => {
            setIsCreate(true);
            setEditing(emptyRouteDraft());
          }}
        >
          新建路线
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Input
          placeholder="搜索 slug 或标题"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void loadRoutes();
          }}
          className="sm:max-w-xs"
        />
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:max-w-[10rem]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">全部状态</option>
          {CONTENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {CONTENT_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <Button onClick={() => void loadRoutes()} disabled={loading || busy}>
          {loading ? '加载中…' : '搜索'}
        </Button>
      </div>

      {error && <p className="text-destructive">{error}</p>}
      {status && <p className="text-sm text-green-700">{status}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>展示标签</TableHead>
                <TableHead>天数</TableHead>
                <TableHead>推荐</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((route) => (
                <TableRow key={route.slug}>
                  <TableCell className="font-medium">
                    <div>{route.title}</div>
                    <div className="font-mono text-xs text-muted-foreground">{route.slug}</div>
                  </TableCell>
                  <TableCell>{route.category}</TableCell>
                  <TableCell>{route.durationDays} 天</TableCell>
                  <TableCell>{route.featured ? '是' : '否'}</TableCell>
                  <TableCell>
                    <Badge variant={route.status === 'published' ? 'default' : 'secondary'}>
                      {CONTENT_STATUS_LABELS[route.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setIsCreate(false);
                          setEditing(routeToDraft(route));
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || route.status === 'archived'}
                        onClick={() => void archiveRouteRow(route.slug)}
                      >
                        归档
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {routes.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {search.trim() || statusFilter ? '无匹配结果' : '暂无路线。'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

const MEDIA_TYPES: MediaAssetType[] = ['image', 'video'];
const MEDIA_STATUSES: MediaAssetStatus[] = ['review', 'published', 'rejected', 'archived'];

const MEDIA_TYPE_LABELS: Record<MediaAssetType, string> = {
  image: '图片',
  video: '视频',
};

const MEDIA_STATUS_LABELS: Record<MediaAssetStatus, string> = {
  review: '待审',
  published: '已发布',
  rejected: '已驳回',
  archived: '已归档',
};

type MediaEditDraft = {
  id: string;
  type: MediaAssetType;
  publicUrl: string;
  coverUrl: string;
  title: string;
  altText: string;
  destinationSlugs: string[];
  routeSlugs: string[];
  tagsText: string;
  status: MediaAssetStatus;
};

function emptyMediaDraft(): MediaEditDraft {
  return {
    id: '',
    type: 'image',
    publicUrl: '',
    coverUrl: '',
    title: '',
    altText: '',
    destinationSlugs: [],
    routeSlugs: [],
    tagsText: '',
    status: 'review',
  };
}

function mediaToDraft(media: MediaAsset): MediaEditDraft {
  return {
    id: media.id,
    type: media.type,
    publicUrl: media.publicUrl,
    coverUrl: media.coverUrl || '',
    title: media.title,
    altText: media.altText,
    destinationSlugs: [...media.destinationSlugs],
    routeSlugs: [...media.routeSlugs],
    tagsText: media.tags.join(', '),
    status: media.status,
  };
}

function MediaFilePreview({
  publicUrl,
  type,
}: {
  publicUrl: string;
  type: MediaAssetType;
}) {
  const [imageError, setImageError] = useState(false);

  if (!publicUrl.trim()) {
    return (
      <div className="flex h-32 w-full max-w-xs items-center justify-center rounded-md border border-dashed border-input text-xs text-muted-foreground">
        暂无文件
      </div>
    );
  }

  if (type === 'image') {
    if (imageError) {
      return (
        <div className="flex h-32 w-full max-w-xs items-center justify-center rounded-md border border-dashed border-input text-xs text-muted-foreground">
          无法加载预览
        </div>
      );
    }
    return (
      <img
        src={publicUrl}
        alt="素材预览"
        className="h-32 w-full max-w-xs rounded-md border border-input object-cover"
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div className="space-y-2">
      <video
        controls
        src={publicUrl}
        className="h-32 w-full max-w-xs rounded-md border border-input object-cover"
      />
      <a
        href={publicUrl}
        target="_blank"
        rel="noreferrer"
        className="text-sm text-primary underline"
      >
        在新标签页打开视频
      </a>
    </div>
  );
}

function MediaCardThumb({
  publicUrl,
  coverUrl,
  type,
}: {
  publicUrl: string;
  coverUrl?: string;
  type: MediaAssetType;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const placeholderLabel = type === 'video' ? '视频' : '无法预览';
  const resolvedCover = (coverUrl || '').trim();

  if (!publicUrl.trim() && !resolvedCover) {
    return (
      <div className="flex aspect-video w-full items-center justify-center bg-muted text-sm text-muted-foreground">
        {placeholderLabel}
      </div>
    );
  }

  if (type === 'image') {
    if (videoFailed || !publicUrl.trim()) {
      return (
        <div className="flex aspect-video w-full items-center justify-center bg-muted text-sm text-muted-foreground">
          {placeholderLabel}
        </div>
      );
    }
    return (
      <img
        src={publicUrl}
        alt=""
        className="aspect-video w-full object-cover"
        onError={() => setVideoFailed(true)}
      />
    );
  }

  if (resolvedCover && !coverFailed) {
    return (
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        <img
          src={resolvedCover}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setCoverFailed(true)}
        />
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
          视频
        </span>
      </div>
    );
  }

  if (videoFailed || !publicUrl.trim()) {
    return (
      <div className="relative flex aspect-video w-full items-center justify-center bg-muted text-sm text-muted-foreground">
        {placeholderLabel}
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
          视频
        </span>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-muted">
      <video
        src={`${publicUrl}#t=0.1`}
        preload="metadata"
        muted
        playsInline
        className="pointer-events-none h-full w-full object-cover"
        onError={() => setVideoFailed(true)}
      />
      <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
        视频
      </span>
    </div>
  );
}

const MEDIA_LIST_TABS: { value: string; label: string }[] = [
  { value: 'review', label: '待审' },
  { value: 'published', label: '已发布' },
  { value: 'rejected', label: '已驳回' },
  { value: '', label: '全部' },
];

type CategoryEditDraft = {
  id: string | null;
  key: string;
  label: string;
  scope: CategoryScope;
  sortOrder: string;
  enabled: boolean;
};

function emptyCategoryDraft(scope: CategoryScope, nextSortOrder = 0): CategoryEditDraft {
  return { id: null, key: '', label: '', scope, sortOrder: String(nextSortOrder), enabled: true };
}

function categoryToDraft(category: Category): CategoryEditDraft {
  return {
    id: category.id,
    key: category.key,
    label: category.label,
    scope: category.scope,
    sortOrder: String(category.sortOrder),
    enabled: category.enabled,
  };
}

function categoryScopeLabel(scope: CategoryScope): string {
  return scope === 'destination' ? '目的地筛选' : '路线筛选';
}

function nextCategorySortOrder(categories: Category[], scope: CategoryScope): number {
  const scoped = categories.filter((item) => item.scope === scope);
  if (scoped.length === 0) return 0;
  return Math.max(...scoped.map((item) => item.sortOrder)) + 1;
}

function resolveCategoryKey(draft: CategoryEditDraft): string {
  const trimmed = draft.key.trim().toLowerCase();
  if (trimmed) return trimmed;
  return slugifyOrFallback(draft.label || 'category', new Date(), 'cat');
}

function CategoryScopeSection({
  scope,
  title,
  categories,
  busy,
  onEdit,
  onCreate,
  onArchive,
  onMove,
}: {
  scope: CategoryScope;
  title: string;
  categories: Category[];
  busy: boolean;
  onEdit: (category: Category) => void;
  onCreate: () => void;
  onArchive: (category: Category) => void;
  onMove: (category: Category, direction: -1 | 1) => void;
}) {
  const scoped = categories.filter((category) => category.scope === scope).sort((a, b) => a.sortOrder - b.sortOrder);
  const enabledCount = scoped.filter((category) => category.enabled).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{title}</CardTitle>
        <Button size="sm" variant="outline" disabled={busy} onClick={onCreate}>
          新建分类
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {enabledCount > ENABLED_CATEGORY_SOFT_LIMIT && (
          <p className="rounded-md bg-amber-100 p-2 text-sm text-amber-900">
            当前已启用 {enabledCount} 个分类；超过 {ENABLED_CATEGORY_SOFT_LIMIT} 个可能挤占移动端筛选栏，
            建议停用部分低频分类。
          </p>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>显示名称</TableHead>
              <TableHead>排序</TableHead>
              <TableHead>启用</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scoped.map((category, index) => (
              <TableRow key={category.id}>
                <TableCell>
                  <div className="font-medium">{category.label}</div>
                  <div className="mt-0.5 font-mono text-xs text-muted-foreground">{category.key}</div>
                </TableCell>
                <TableCell>{category.sortOrder}</TableCell>
                <TableCell>
                  <Badge variant={category.enabled ? 'default' : 'secondary'}>
                    {category.enabled ? '已启用' : '已停用'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || index === 0}
                      onClick={() => onMove(category, -1)}
                    >
                      上移
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || index === scoped.length - 1}
                      onClick={() => onMove(category, 1)}
                    >
                      下移
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => onEdit(category)}>
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || !category.enabled}
                      onClick={() => onArchive(category)}
                    >
                      停用
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {scoped.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  暂无分类。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CategoriesPanel({ token }: { token: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [warning, setWarning] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<CategoryEditDraft | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  async function loadCategories() {
    setLoading(true);
    setError('');
    try {
      setCategories(await fetchAdminCategories(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载分类失败。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function startCreate(scope: CategoryScope) {
    setError('');
    setStatus('');
    setWarning('');
    setAdvancedOpen(false);
    setEditing(emptyCategoryDraft(scope, nextCategorySortOrder(categories, scope)));
  }

  function startEdit(category: Category) {
    setError('');
    setStatus('');
    setWarning('');
    setAdvancedOpen(false);
    setEditing(categoryToDraft(category));
  }

  function onLabelChange(label: string) {
    setEditing((current) => {
      if (!current) return current;
      if (current.id) {
        return { ...current, label };
      }
      return { ...current, label, key: slugify(label) };
    });
  }

  async function saveCategory() {
    if (!editing) return;
    setError('');
    setStatus('');
    setWarning('');

    if (!editing.label.trim()) {
      setError('请填写显示名称（英文，给旅客看）。');
      return;
    }

    const labelHasCjk = containsCjk(editing.label);
    if (labelHasCjk) {
      setWarning('显示名称疑似含中文。旅客筛选栏会直接显示这段文案，请改为英文。');
      setError('已拦截：显示名称含中文。请改为英文后再保存或启用。');
      return;
    }

    const key = resolveCategoryKey(editing);

    setBusy(true);
    try {
      const result = await postAdminCategory(token, {
        action: editing.id ? 'update' : 'create',
        id: editing.id,
        key,
        label: editing.label.trim(),
        scope: editing.scope,
        sortOrder: Number(editing.sortOrder) || 0,
        enabled: editing.enabled,
      });
      setCategories(result.categories);
      setStatus(editing.id ? '分类已更新。' : '分类已创建。');
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存分类失败。');
    } finally {
      setBusy(false);
    }
  }

  async function archiveCategoryRow(category: Category) {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const result = await postAdminCategory(token, { action: 'archive', id: category.id });
      setCategories(result.categories);
      setStatus(`「${category.label}」已从筛选栏隐藏；已勾选该分类的内容仍保留 key「${category.key}」。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '停用分类失败。');
    } finally {
      setBusy(false);
    }
  }

  async function moveCategory(category: Category, direction: -1 | 1) {
    const scoped = categories
      .filter((item) => item.scope === category.scope)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const index = scoped.findIndex((item) => item.id === category.id);
    const swapWith = index + direction;
    if (index < 0 || swapWith < 0 || swapWith >= scoped.length) return;

    const orderedIds = scoped.map((item) => item.id);
    [orderedIds[index], orderedIds[swapWith]] = [orderedIds[swapWith], orderedIds[index]];

    setBusy(true);
    setError('');
    setStatus('');
    try {
      const result = await postAdminCategory(token, {
        action: 'reorder',
        scope: category.scope,
        orderedIds,
      });
      setCategories(result.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : '调整分类顺序失败。');
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    const isCreate = !editing.id;
    const previewKey =
      editing.key.trim() || (editing.label.trim() ? slugify(editing.label) || 'cat-…' : '（自动生成）');
    const cjkWarning = containsCjk(editing.label)
      ? '显示名称疑似含中文。旅客筛选栏会直接显示这段文案，请改为英文。'
      : '';

    return (
      <AdminEditShell
        title={editing.id
          ? `编辑${categoryScopeLabel(editing.scope)}分类：${editing.label || editing.key}`
          : `新建${categoryScopeLabel(editing.scope)}分类`}
        backLabel="← 返回列表"
        onBack={() => setEditing(null)}
      >
        {error && <p className="text-destructive">{error}</p>}
        {warning && <p className="rounded-md bg-amber-100 p-2 text-sm text-amber-900">{warning}</p>}
        {cjkWarning && !warning && (
          <p className="rounded-md bg-amber-100 p-2 text-sm text-amber-900">{cjkWarning}</p>
        )}
        <Card>
          <CardHeader>
            <CardTitle>{editing.id ? `编辑：${editing.label || editing.key}` : '新建分类'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormSection
              title="基本信息"
              description={
                editing.scope === 'destination'
                  ? '用于移动端 Places（目的地）筛选栏。'
                  : '用于移动端 Routes（路线）筛选栏。'
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm md:col-span-2">
                  <span>显示名称（英文）</span>
                  <Input
                    value={editing.label}
                    placeholder="例如 Culture & history"
                    onChange={(event) => onLabelChange(event.target.value)}
                  />
                  <FieldHint>旅客在筛选栏看到的文案；请用英文。系统会据此自动生成内部标识。</FieldHint>
                </label>
                <label className="space-y-2 text-sm">
                  <span>排序</span>
                  <Input
                    type="number"
                    value={editing.sortOrder}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, sortOrder: event.target.value } : current,
                      )
                    }
                  />
                  <FieldHint>数字越小越靠前；列表里的上移/下移也会更新排序。新建默认排在末尾。</FieldHint>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={editing.enabled}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, enabled: event.target.checked } : current,
                      )
                    }
                  />
                  <span>
                    启用分类
                    <FieldHint>
                      启用后出现在移动端筛选栏。停用只会从筛选栏隐藏，已勾选该分类的目的地/路线仍保留内部标识。
                    </FieldHint>
                  </span>
                </label>
                <label className="space-y-2 text-sm md:col-span-2">
                  <span>分类范围</span>
                  <Input value={categoryScopeLabel(editing.scope)} disabled />
                  <FieldHint>
                    只读。目的地分类管 Places；路线分类管 Routes。两套列表互不合并。
                  </FieldHint>
                </label>
              </div>
            </FormSection>

            {!isCreate && (
              <div className="rounded-md border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
                  onClick={() => setAdvancedOpen((open) => !open)}
                >
                  <span>高级</span>
                  <span className="text-muted-foreground">{advancedOpen ? '收起' : '展开'}</span>
                </button>
                {advancedOpen ? (
                  <div className="space-y-3 border-t px-4 py-3">
                    <label className="space-y-2 text-sm">
                      <span>内部标识（key）</span>
                      <Input
                        value={editing.key}
                        disabled
                        className="font-mono text-xs"
                      />
                      <FieldHint>
                        创建后不可改。目的地/路线勾选分类时按此 key 存储关系；乱改会导致已勾选内容对不上。
                      </FieldHint>
                    </label>
                  </div>
                ) : null}
              </div>
            )}

            {isCreate && (
              <p className="text-xs text-muted-foreground">
                内部标识将自动生成：<span className="font-mono">{previewKey}</span>
              </p>
            )}

            <div className="flex gap-2">
              <Button onClick={saveCategory} disabled={busy}>
                {busy ? '保存中...' : editing.id ? '保存修改' : '创建分类'}
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setEditing(null)}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      </AdminEditShell>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>
          两套筛选分开维护：上方管移动端 Places（目的地）筛选；下方管 Routes（路线）筛选。只填英文显示名、排序和是否启用；内部标识由系统生成。
        </p>
        <p>
          停用分类只会从筛选栏隐藏；已勾选该分类的目的地或路线仍保留内部标识，不会丢关系。
        </p>
      </div>

      {error && <p className="text-destructive">{error}</p>}
      {status && <p className="text-sm text-green-700">{status}</p>}

      <CategoryScopeSection
        scope="destination"
        title="目的地分类（Places 筛选）"
        categories={categories}
        busy={busy || loading}
        onEdit={startEdit}
        onCreate={() => startCreate('destination')}
        onArchive={archiveCategoryRow}
        onMove={moveCategory}
      />

      <CategoryScopeSection
        scope="route"
        title="路线分类（Routes 筛选）"
        categories={categories}
        busy={busy || loading}
        onEdit={startEdit}
        onCreate={() => startCreate('route')}
        onArchive={archiveCategoryRow}
        onMove={moveCategory}
      />

    </div>
  );
}

function MediaPanel({
  token,
  initialStatusFilter = '',
}: {
  token: string;
  initialStatusFilter?: string;
}) {
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [filterDestinationSlug, setFilterDestinationSlug] = useState('');
  const [filterRouteSlug, setFilterRouteSlug] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || 'review');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<MediaEditDraft | null>(null);
  const [isCreate, setIsCreate] = useState(false);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [rejectTarget, setRejectTarget] = useState<MediaAsset | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [assocConfirm, setAssocConfirm] = useState<null | {
    kind: 'save' | 'saveAsPublished' | 'rowPublish';
    item?: MediaAsset;
  }>(null);

  async function loadMedia() {
    setLoading(true);
    setError('');
    try {
      setMedia(
        await fetchAdminMedia(token, {
          status: statusFilter || undefined,
          search: search.trim() || undefined,
          destinationSlug: filterDestinationSlug || undefined,
          routeSlug: filterRouteSlug || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载素材失败。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter, filterDestinationSlug, filterRouteSlug]);

  useEffect(() => {
    let active = true;
    Promise.all([fetchAdminDestinations(token), fetchAdminRoutes(token)])
      .then(([destList, routeList]) => {
        if (!active) return;
        setDestinations(destList);
        setRoutes(routeList);
      })
      .catch(() => {
        // Association pickers stay empty; form still usable.
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function commitSaveMedia() {
    if (!editing) return;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await postAdminMedia(token, {
        action: isCreate ? 'create' : 'update',
        id: editing.id || undefined,
        type: editing.type,
        publicUrl: editing.publicUrl,
        coverUrl: editing.coverUrl,
        title: editing.title,
        altText: editing.altText,
        destinationSlugs: editing.destinationSlugs,
        routeSlugs: editing.routeSlugs,
        tags: csvToList(editing.tagsText),
        status: editing.status,
      });
      setStatus(isCreate ? '素材已创建。' : '素材已更新。');
      setEditing(null);
      setIsCreate(false);
      await loadMedia();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存素材失败。');
    } finally {
      setBusy(false);
    }
  }

  function saveMedia() {
    if (!editing) return;
    if (!mediaHasAssociation(editing)) {
      setAssocConfirm({ kind: 'save' });
      return;
    }
    void commitSaveMedia();
  }

  async function archiveMediaRow(id: string) {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await postAdminMedia(token, { action: 'archive', id });
      setStatus('素材已归档。');
      await loadMedia();
    } catch (err) {
      setError(err instanceof Error ? err.message : '归档素材失败。');
    } finally {
      setBusy(false);
    }
  }

  async function commitMediaRowStatus(item: MediaAsset, nextStatus: 'published' | 'rejected') {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await postAdminMedia(token, {
        action: 'update',
        id: item.id,
        type: item.type,
        publicUrl: item.publicUrl,
        coverUrl: item.coverUrl || '',
        title: item.title,
        altText: item.altText,
        destinationSlugs: item.destinationSlugs,
        routeSlugs: item.routeSlugs,
        tags: item.tags,
        status: nextStatus,
      });
      setStatus(nextStatus === 'published' ? '已通过，素材可用。' : '已驳回。');
      await loadMedia();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新素材状态失败。');
    } finally {
      setBusy(false);
    }
  }

  function requestPublishMediaRow(item: MediaAsset) {
    if (!mediaHasAssociation(item)) {
      setAssocConfirm({ kind: 'rowPublish', item });
      return;
    }
    void commitMediaRowStatus(item, 'published');
  }

  function openRejectDialog(item: MediaAsset) {
    setRejectNote('');
    setRejectTarget(item);
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    const target = rejectTarget;
    setRejectTarget(null);
    setRejectNote('');
    await commitMediaRowStatus(target, 'rejected');
  }

  function startCreate() {
    setIsCreate(true);
    setEditing(emptyMediaDraft());
  }

  function toggleDraftSlug(
    field: 'destinationSlugs' | 'routeSlugs',
    slug: string,
    checked: boolean,
  ) {
    setEditing((current) => {
      if (!current) return current;
      const next = checked
        ? current[field].includes(slug)
          ? current[field]
          : [...current[field], slug]
        : current[field].filter((value) => value !== slug);
      return { ...current, [field]: next };
    });
  }

  async function commitSaveEditingAsStatus(nextStatus: 'published' | 'rejected') {
    if (!editing) return;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await postAdminMedia(token, {
        action: 'update',
        id: editing.id,
        type: editing.type,
        publicUrl: editing.publicUrl,
        coverUrl: editing.coverUrl,
        title: editing.title,
        altText: editing.altText,
        destinationSlugs: editing.destinationSlugs,
        routeSlugs: editing.routeSlugs,
        tags: csvToList(editing.tagsText),
        status: nextStatus,
      });
      setStatus(nextStatus === 'published' ? '已通过，素材可用。' : '已驳回。');
      setEditing(null);
      setIsCreate(false);
      await loadMedia();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新素材状态失败。');
    } finally {
      setBusy(false);
    }
  }

  function saveEditingAsStatus(nextStatus: 'published' | 'rejected') {
    if (!editing) return;
    if (nextStatus === 'published' && !mediaHasAssociation(editing)) {
      setAssocConfirm({ kind: 'saveAsPublished' });
      return;
    }
    void commitSaveEditingAsStatus(nextStatus);
  }

  async function confirmAssociationContinue() {
    const pending = assocConfirm;
    setAssocConfirm(null);
    if (!pending) return;
    if (pending.kind === 'save') {
      await commitSaveMedia();
      return;
    }
    if (pending.kind === 'saveAsPublished') {
      await commitSaveEditingAsStatus('published');
      return;
    }
    if (pending.kind === 'rowPublish' && pending.item) {
      await commitMediaRowStatus(pending.item, 'published');
    }
  }

  async function uploadPosterBlob(blob: Blob, baseName: string): Promise<string> {
    const filename = `${baseName.replace(/\.[^.]+$/, '') || 'poster'}-cover.jpg`;
    const presigned = await presignMediaUpload(token, {
      filename,
      contentType: 'image/jpeg',
    });
    await uploadFileToPresignedUrl(presigned.uploadUrl, blob, presigned.contentType);
    return presigned.publicUrl;
  }

  async function uploadSelectedFile(file: File) {
    if (!editing) return;
    setUploading(true);
    setError('');
    setStatus('');
    try {
      const contentType = file.type || 'application/octet-stream';
      const isVideo = contentType.startsWith('video/');
      const presigned = await presignMediaUpload(token, {
        filename: file.name,
        contentType,
      });
      await uploadFileToPresignedUrl(presigned.uploadUrl, file, presigned.contentType);

      let coverUrl = '';
      let posterNote = '';
      if (isVideo) {
        try {
          const posterBlob = await extractVideoPosterBlob(file);
          coverUrl = await uploadPosterBlob(posterBlob, file.name);
        } catch {
          posterNote = '视频已上传，但自动抽封面失败；仍可保存，列表将回退首帧或占位。';
        }
      }

      setEditing((current) =>
        current
          ? {
              ...current,
              publicUrl: presigned.publicUrl,
              coverUrl: isVideo ? coverUrl : '',
              type: isVideo ? 'video' : 'image',
              title: current.title || file.name.replace(/\.[^.]+$/, ''),
            }
          : current,
      );
      setStatus(
        posterNote ||
          (coverUrl
            ? '文件与封面已上传，下方已生成预览；仍需保存，素材才会写入数据库。'
            : '文件已上传，下方已生成预览；仍需保存，素材才会写入数据库。'),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传文件失败。');
    } finally {
      setUploading(false);
    }
  }

  async function regenerateCoverFromUrl() {
    if (!editing?.publicUrl.trim() || editing.type !== 'video') return;
    setUploading(true);
    setError('');
    setStatus('');
    try {
      const posterBlob = await extractVideoPosterBlob(editing.publicUrl, { crossOrigin: true });
      const coverUrl = await uploadPosterBlob(posterBlob, editing.title || 'video');
      setEditing((current) => (current ? { ...current, coverUrl } : current));
      setStatus('封面已重新生成；仍需保存才会写入数据库。');
    } catch {
      setError('无法从当前视频 URL 抽帧（常见原因：跨域）。请重新上传本地视频文件以生成封面。');
    } finally {
      setUploading(false);
    }
  }

  if (editing) {
    return (
      <AdminEditShell
        title={isCreate ? '新建素材' : '编辑素材'}
        backLabel="← 返回列表"
        onBack={() => {
          setEditing(null);
          setIsCreate(false);
        }}
      >
        {error && <p className="text-destructive">{error}</p>}
        {status && <p className="text-sm text-green-700">{status}</p>}
        {isCreate || editing.status === 'review' ? (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            待审 = 素材库入库尚未正式可用。通过后，路线/目的地选图器才能选到它。在选图器里直接上传的图是「已发布」，不会走这道确认。
          </p>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>{isCreate ? '新建素材' : '编辑素材'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormSection title="文件与预览" description="上传文件，或在高级模式手动填写已存在的公开 URL。">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3 md:col-span-2">
                  <MediaFilePreview
                    key={`${editing.publicUrl}::${editing.type}`}
                    publicUrl={editing.publicUrl}
                    type={editing.type}
                  />
                  {editing.type === 'video' && editing.coverUrl.trim() ? (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">封面预览</p>
                      <img
                        src={editing.coverUrl}
                        alt="视频封面"
                        className="h-32 w-full max-w-xs rounded-md border border-input object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <label
                      className={
                        busy || uploading
                          ? 'inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground opacity-50 pointer-events-none'
                          : 'inline-flex h-10 cursor-pointer items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90'
                      }
                    >
                      <input
                        type="file"
                        accept="image/*,video/mp4,video/webm,application/pdf"
                        className="hidden"
                        disabled={busy || uploading}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = '';
                          if (file) {
                            void uploadSelectedFile(file);
                          }
                        }}
                      />
                      {uploading
                        ? '上传中…'
                        : editing.publicUrl.trim()
                          ? '替换文件'
                          : '上传本地文件'}
                    </label>
                    {editing.type === 'video' && editing.publicUrl.trim() ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy || uploading}
                        onClick={() => void regenerateCoverFromUrl()}
                      >
                        重新生成封面
                      </Button>
                    ) : null}
                  </div>
                  <FieldHint>
                    上传视频会尽量自动抽封面。上传后仍需保存，素材才会写入数据库。
                  </FieldHint>
                </div>
                <details className="space-y-2 text-sm md:col-span-2" open={!isCreate}>
                  <summary className="cursor-pointer text-muted-foreground">
                    高级：手动填写 URL
                  </summary>
                  <Input
                    className="mt-2"
                    value={editing.publicUrl}
                    placeholder="https://..."
                    onChange={(event) =>
                      setEditing((current) => (current ? { ...current, publicUrl: event.target.value } : current))
                    }
                  />
                  <FieldHint>只在素材已上传到别处或需要修正 URL 时使用。</FieldHint>
                </details>
                <label className="space-y-2 text-sm">
                  <span>素材类型</span>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editing.type}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, type: event.target.value as MediaAssetType } : current,
                      )
                    }
                  >
                    {MEDIA_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {MEDIA_TYPE_LABELS[value]}
                      </option>
                    ))}
                  </select>
                  <FieldHint>入库仍为英文枚举，用于区分图片/视频处理。</FieldHint>
                </label>
              </div>
            </FormSection>

            <FormSection title="素材说明" description="标题方便运营查找；替代文本给读屏和裂图用。">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span>标题</span>
                  <Input
                    value={editing.title}
                    onChange={(event) =>
                      setEditing((current) => (current ? { ...current, title: event.target.value } : current))
                    }
                  />
                  {looksLikeWeakMediaTitle(editing.title) ? (
                    <p className="text-xs text-amber-800">
                      建议改成「地点 + 主题」，方便以后搜索（例如 Daocheng autumn lake）。
                    </p>
                  ) : null}
                </label>
                <label className="space-y-2 text-sm">
                  <span>标签（逗号分隔）</span>
                  <Input
                    value={editing.tagsText}
                    onChange={(event) =>
                      setEditing((current) => (current ? { ...current, tagsText: event.target.value } : current))
                    }
                  />
                  <FieldHint>可选，用于检索，例如 beijing, great-wall。</FieldHint>
                </label>
                <label className="space-y-2 text-sm md:col-span-2">
                  <span>替代文本（给读屏 / 裂图用的英文描述）</span>
                  <Input
                    value={editing.altText}
                    onChange={(event) =>
                      setEditing((current) => (current ? { ...current, altText: event.target.value } : current))
                    }
                  />
                  <FieldHint>不是运营备注；图片打不开或读屏软件会读这段英文。</FieldHint>
                </label>
              </div>
            </FormSection>

            <FormSection
              title="关联与发布"
              description="勾选关联只是素材元数据，方便以后按路线/目的地筛选；不会自动替换产品封面或详情页图片。"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 text-sm md:col-span-2">
                  <span>关联目的地</span>
                  <div className="flex max-h-40 flex-wrap gap-3 overflow-y-auto rounded-md border border-input p-3">
                    {destinations.length === 0 ? (
                      <span className="text-muted-foreground">暂无目的地可选。</span>
                    ) : (
                      destinations.map((destination) => (
                        <label key={destination.slug} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editing.destinationSlugs.includes(destination.slug)}
                            onChange={(event) =>
                              toggleDraftSlug('destinationSlugs', destination.slug, event.target.checked)
                            }
                          />
                          {destination.name}
                          <span className="font-mono text-xs text-muted-foreground">{destination.slug}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <div className="space-y-2 text-sm md:col-span-2">
                  <span>关联路线</span>
                  <div className="flex max-h-40 flex-wrap gap-3 overflow-y-auto rounded-md border border-input p-3">
                    {routes.length === 0 ? (
                      <span className="text-muted-foreground">暂无线路可选。</span>
                    ) : (
                      routes.map((route) => (
                        <label key={route.slug} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editing.routeSlugs.includes(route.slug)}
                            onChange={(event) =>
                              toggleDraftSlug('routeSlugs', route.slug, event.target.checked)
                            }
                          />
                          {route.title}
                          <span className="font-mono text-xs text-muted-foreground">{route.slug}</span>
                        </label>
                      ))
                    )}
                  </div>
                  <FieldHint>关联 ≠ 自动换封面。前台仍要在对应内容里选图片 URL。</FieldHint>
                </div>
                <label className="space-y-2 text-sm">
                  <span>状态</span>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editing.status}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, status: event.target.value as MediaAssetStatus } : current,
                      )
                    }
                  >
                    {MEDIA_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {MEDIA_STATUS_LABELS[value]}
                      </option>
                    ))}
                  </select>
                  <FieldHint>
                    新建默认「待审」。通过 → 已发布（选图器可用）；驳回 → 已驳回。
                  </FieldHint>
                </label>
              </div>
            </FormSection>
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveMedia} disabled={busy || uploading}>
                {busy ? '保存中...' : isCreate ? '创建素材' : '保存修改'}
              </Button>
              {!isCreate && editing.status === 'review' ? (
                <>
                  <Button
                    type="button"
                    disabled={busy || uploading}
                    onClick={() => void saveEditingAsStatus('published')}
                  >
                    通过并保存
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || uploading}
                    onClick={() => void saveEditingAsStatus('rejected')}
                  >
                    驳回并保存
                  </Button>
                </>
              ) : null}
              <Button variant="outline" disabled={busy || uploading} onClick={() => setEditing(null)}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      </AdminEditShell>
    );
  }

  const hasBrowseFilters = Boolean(
    search.trim() || filterDestinationSlug || filterRouteSlug,
  );
  const showReviewEmpty =
    !loading &&
    media.length === 0 &&
    statusFilter === 'review' &&
    !hasBrowseFilters;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          本页先审待审素材。配图请去路线/目的地里的选图器；关联不会自动换封面。
        </p>
        <Button variant="outline" disabled={busy || loading} onClick={startCreate}>
          新建素材
        </Button>
      </div>

      <div
        className="flex flex-wrap gap-1 border-b border-border"
        role="tablist"
        aria-label="素材状态"
      >
        {MEDIA_LIST_TABS.map((tab) => {
          const active = statusFilter === tab.value;
          return (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={loading || busy}
              className={cn(
                'px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setStatusFilter(tab.value)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <MediaBrowseFilters
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => void loadMedia()}
        destinationSlug={filterDestinationSlug}
        onDestinationChange={setFilterDestinationSlug}
        routeSlug={filterRouteSlug}
        onRouteChange={setFilterRouteSlug}
        destinations={destinations.map((item) => ({ value: item.slug, label: item.name }))}
        routes={routes.map((item) => ({ value: item.slug, label: item.title }))}
        disabled={loading || busy}
        searchLoading={loading}
      />

      {error && <p className="text-destructive">{error}</p>}
      {status && <p className="text-sm text-green-700">{status}</p>}

      {showReviewEmpty ? (
        <div className="flex flex-col items-center gap-4 rounded-md border border-dashed border-input px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">暂无待审素材</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setStatusFilter('')}>
              查看全部素材
            </Button>
            <Button disabled={busy} onClick={startCreate}>
              新建素材
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {media.map((item) => (
            <article
              key={item.id}
              className="flex flex-col overflow-hidden rounded-md border border-border bg-card"
            >
              <MediaCardThumb
                publicUrl={item.publicUrl}
                coverUrl={item.coverUrl}
                type={item.type}
              />
              <div className="flex flex-1 flex-col gap-3 p-3">
                <div className="space-y-1">
                  <h3 className="line-clamp-2 text-sm font-medium leading-snug">{item.title}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{MEDIA_TYPE_LABELS[item.type]}</Badge>
                    <Badge variant={item.status === 'published' ? 'default' : 'secondary'}>
                      {MEDIA_STATUS_LABELS[item.status]}
                    </Badge>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  {item.status === 'review' ? (
                    <>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => requestPublishMediaRow(item)}
                      >
                        通过
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => openRejectDialog(item)}
                      >
                        驳回
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setIsCreate(false);
                          setEditing(mediaToDraft(item));
                        }}
                      >
                        编辑
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setIsCreate(false);
                          setEditing(mediaToDraft(item));
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || item.status === 'archived'}
                        onClick={() => void archiveMediaRow(item.id)}
                      >
                        归档
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {!showReviewEmpty && media.length === 0 && !loading && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {hasBrowseFilters || statusFilter ? '无匹配结果' : '暂无素材。'}
        </p>
      )}

      <Dialog
        open={assocConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setAssocConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>尚未关联目的地或路线</DialogTitle>
            <DialogDescription>
              没有关联时，选图器和素材库按目的地/路线筛选会很难找到它。建议先勾选关联；也可以仍要继续。
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                const pending = assocConfirm;
                setAssocConfirm(null);
                if (pending?.kind === 'rowPublish' && pending.item) {
                  setIsCreate(false);
                  setEditing(mediaToDraft(pending.item));
                }
              }}
            >
              去勾选关联
            </Button>
            <Button type="button" disabled={busy} onClick={() => void confirmAssociationContinue()}>
              仍要继续
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectNote('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确定驳回？</DialogTitle>
            <DialogDescription>
              驳回后该素材不会出现在选图器中。备注本版仅供确认时参考，不会入库。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm" htmlFor="media-reject-note">
              备注（可选）
            </label>
            <Textarea
              id="media-reject-note"
              value={rejectNote}
              placeholder="例如：画质不足、与产品无关…"
              onChange={(event) => setRejectNote(event.target.value)}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setRejectTarget(null);
                setRejectNote('');
              }}
            >
              取消
            </Button>
            <Button type="button" disabled={busy || !rejectTarget} onClick={() => void confirmReject()}>
              驳回
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminNav({
  activeTab,
  onSelect,
  role,
  className,
}: {
  activeTab: AdminTab;
  onSelect: (tab: AdminTab) => void;
  role: AdminRole | null;
  className?: string;
}) {
  const groups = filterNavGroups(role);
  return (
    <nav className={cn('flex flex-col gap-4', className)} aria-label="Admin modules">
      {groups.map((group) => (
        <div key={group.title || group.items[0]?.value} className="flex flex-col gap-1">
          {group.title ? (
            <p className="px-3 text-xs font-medium text-muted-foreground">{group.title}</p>
          ) : null}
          {group.items.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onSelect(item.value)}
              className={cn(
                'rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
                activeTab === item.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}

function AdminShellActions({
  onSignOut,
  className,
}: {
  onSignOut: () => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Button asChild variant="outline" className="w-full justify-start">
        <Link to="/">View site</Link>
      </Button>
      <Button type="button" variant="outline" className="w-full justify-start" onClick={onSignOut}>
        Sign out
      </Button>
    </div>
  );
}

export default function Admin() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [roleStatus, setRoleStatus] = useState<'pending' | 'ok' | 'denied'>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [seededListFilters, setSeededListFilters] = useState<
    Partial<Record<PendingListFilter['tab'], string>>
  >({});
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const redirected = await consumeAuthRedirectSession();
        if (cancelled) return;
        if (redirected) {
          setSession(redirected);
          return;
        }
        const fresh = await ensureFreshSession();
        if (!cancelled && fresh) {
          setSession(fresh);
        } else if (!cancelled) {
          const stored = readStoredAuthSession();
          if (stored) setSession(stored);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Auth check failed.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setAdminRole(null);
      setRoleStatus('pending');
      return;
    }

    let cancelled = false;
    setRoleStatus('pending');
    setAdminRole(null);
    fetchAdminMe(session.accessToken)
      .then((me) => {
        if (!cancelled) {
          setAdminRole(me.role);
          setRoleStatus('ok');
          setError('');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setAdminRole(null);
        const message = err instanceof Error ? err.message : 'Failed to load admin role.';
        // Stale bypass / expired JWT: drop client session so Sign In is shown, not a hollow shell.
        if (/invalid or expired admin session|admin authentication required/i.test(message)) {
          clearStoredAuthSession();
          setSession(null);
          setRoleStatus('pending');
          setError(message);
          return;
        }
        // Not on allowlist (or other gate failure): never render the admin shell/nav.
        setError(message);
        setRoleStatus('denied');
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    const visible = filterNavGroups(adminRole).flatMap((group) => group.items);
    if (visible.some((item) => item.value === activeTab)) return;
    setActiveTab('dashboard');
  }, [adminRole, activeTab]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  const handleSignOut = () => {
    clearStoredAuthSession();
    setSession(null);
    setAdminRole(null);
    setRoleStatus('pending');
    setError('');
    setMobileNavOpen(false);
  };

  const handleSelectTab = (tab: AdminTab) => {
    setSeededListFilters((prev) => {
      if (tab !== 'orders' && tab !== 'inquiries' && tab !== 'routes' && tab !== 'media') {
        return prev;
      }
      if (!(tab in prev)) return prev;
      const next = { ...prev };
      delete next[tab];
      return next;
    });
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  const handleDashboardNavigate = (filter: PendingListFilter) => {
    setSeededListFilters((prev) => ({ ...prev, [filter.tab]: filter.status }));
    setActiveTab(filter.tab);
    setMobileNavOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <SignInView onSignedIn={setSession} />;
  }

  if (roleStatus === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Checking access...</p>
      </div>
    );
  }

  if (roleStatus === 'denied' || !adminRole) {
    return (
      <AccessDeniedView
        email={session.user.email}
        message={error || 'You are not authorized to access admin features.'}
        onSignOut={handleSignOut}
      />
    );
  }

  const activeLabel =
    ADMIN_NAV_ITEMS.find((item) => item.value === activeTab)?.label ?? 'Admin';
  const roleLabel = adminRoleLabel(adminRole);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="border-b border-border px-4 py-5">
          <h1 className="text-lg font-bold">Admin</h1>
          <p className="mt-1 truncate text-xs text-muted-foreground">{session.user.email}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{roleLabel}</p>
        </div>
        <div className="flex flex-1 flex-col justify-between gap-6 p-3">
          <AdminNav activeTab={activeTab} onSelect={handleSelectTab} role={adminRole} />
          <AdminShellActions onSignOut={handleSignOut} />
        </div>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu overlay"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold">Admin</p>
                <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
                <p className="text-xs text-muted-foreground">{roleLabel}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close menu"
                onClick={() => setMobileNavOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <div className="flex flex-1 flex-col justify-between gap-6 p-3">
              <AdminNav activeTab={activeTab} onSelect={handleSelectTab} role={adminRole} />
              <AdminShellActions onSignOut={handleSignOut} />
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0">
            <p className="truncate font-semibold">{activeLabel}</p>
            <p className="truncate text-xs text-muted-foreground">
              {session.user.email} · {roleLabel}
            </p>
          </div>
        </header>

        <div className="min-w-0 flex-1 overflow-x-auto p-4 md:p-6">
          <div className="mb-6 hidden md:block">
            <h2 className="text-2xl font-bold">{activeLabel}</h2>
            <p className="text-sm text-muted-foreground">
              Signed in as {session.user.email} · {roleLabel}
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={(value) => handleSelectTab(value as AdminTab)}>
            <TabsContent value="dashboard" className="mt-0">
              <DashboardPanel token={session.accessToken} onNavigate={handleDashboardNavigate} />
            </TabsContent>
            <TabsContent value="orders" className="mt-0">
              <OrdersPanel
                key={`orders-${seededListFilters.orders ?? 'default'}`}
                token={session.accessToken}
                initialStatusFilter={seededListFilters.orders ?? ''}
              />
            </TabsContent>
            <TabsContent value="inquiries" className="mt-0">
              <InquiriesPanel
                key={`inquiries-${seededListFilters.inquiries ?? 'default'}`}
                token={session.accessToken}
                initialStatusFilter={seededListFilters.inquiries ?? 'open'}
              />
            </TabsContent>
            <TabsContent value="departures" className="mt-0">
              <DeparturesPanel token={session.accessToken} />
            </TabsContent>
            <TabsContent value="destinations" className="mt-0">
              <DestinationsPanel token={session.accessToken} />
            </TabsContent>
            <TabsContent value="routes" className="mt-0">
              <RoutesPanel
                key={`routes-${seededListFilters.routes ?? 'default'}`}
                token={session.accessToken}
                initialStatusFilter={seededListFilters.routes ?? ''}
              />
            </TabsContent>
            <TabsContent value="categories" className="mt-0">
              <CategoriesPanel token={session.accessToken} />
            </TabsContent>
            <TabsContent value="media" className="mt-0">
              <MediaPanel
                key={`media-${seededListFilters.media ?? 'default'}`}
                token={session.accessToken}
                initialStatusFilter={seededListFilters.media ?? ''}
              />
            </TabsContent>
            <TabsContent value="custom-trip-form" className="mt-0">
              <CustomTripFormPanel token={session.accessToken} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
