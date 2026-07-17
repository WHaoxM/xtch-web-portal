import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import {
  readStoredAuthSession,
  signInWithOAuth,
  sendEmailMagicLink,
  clearStoredAuthSession,
  consumeAuthRedirectSession,
  type AuthSession,
} from '../lib/authClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageFieldPicker } from '@/components/admin/ImageFieldPicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  type CustomTripFormOption,
  type FormControlType,
  type FormGroup,
} from '@/lib/customTripFormClient';
import { endDateFromDuration, inclusiveDayCount } from '@/lib/dateOnly';
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
  type RoutePriceMode,
  type RoutePrimaryType,
  type RouteRecord,
} from '@/lib/routesClient';
import {
  fetchAdminMedia,
  postAdminMedia,
  presignMediaUpload,
  uploadFileToPresignedUrl,
  type MediaAsset,
  type MediaAssetStatus,
  type MediaAssetType,
} from '@/lib/mediaClient';
import {
  fetchAdminInquiries,
  fetchAdminInquiry,
  updateAdminInquiryNotes,
  updateAdminInquiryStatus,
  type AdminInquiry,
  type AdminInquiryListItem,
  type InquiryStatus,
} from '@/lib/inquiriesAdminClient';
import { cn } from '@/lib/utils';

const ADMIN_NAV_GROUPS = [
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
      { value: 'categories', label: '分类' },
      { value: 'media', label: '素材' },
    ],
  },
  {
    title: '配置',
    items: [
      { value: 'custom-trip-form', label: '表单配置' },
    ],
  },
] as const;

type AdminNavItem = (typeof ADMIN_NAV_GROUPS)[number]['items'][number];
type AdminTab = AdminNavItem['value'];

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
};

type AdminDeparture = {
  public_id: string;
  status: string;
  route_slug: string;
  route_title: string;
  destination_slug?: string | null;
  departure_city: string;
  start_date: string;
  end_date: string;
  available_seats: number;
  capacity: number;
  adult_unit_price_cents: number;
  guaranteed?: boolean;
  featured_on_home?: boolean;
  featured_priority?: number;
  confirmation_rule?: string;
  included_core_items?: unknown[];
  excluded_core_items?: unknown[];
  important_notes?: unknown[];
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
            status === 'closed' ||
            status === 'sold_out' ||
            status === 'failed'
          ? 'destructive'
          : 'outline';
  return <Badge variant={variant as never}>{label ?? status}</Badge>;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: '待支付',
  confirmed: '已确认',
  cancellation_requested: '取消申请中',
  cancelled: '已取消',
  refunded: '已退款',
  failed: '失败',
  expired: '已过期',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: '未支付',
  paid: '已支付',
  partially_refunded: '部分退款',
  refunded: '已退款',
  failed: '支付失败',
};

const DEPARTURE_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  sellable: '可售',
  locked: '已锁团',
  closed: '已关闭',
  sold_out: '售罄',
  cancelled: '已取消',
};

const DEPARTURE_STATUS_VALUES = [
  'draft',
  'sellable',
  'locked',
  'closed',
  'sold_out',
  'cancelled',
] as const;

const ORDER_STATUS_FILTER_VALUES = [
  'pending_payment',
  'confirmed',
  'cancellation_requested',
  'cancelled',
  'refunded',
  'failed',
  'expired',
] as const;

const DEPARTURE_ACTION_LABELS: Record<'lock' | 'close' | 'cancel', string> = {
  lock: '锁团',
  close: '关闭',
  cancel: '取消',
};

function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] ?? status;
}

function departureStatusLabel(status: string): string {
  return DEPARTURE_STATUS_LABELS[status] ?? status;
}

const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  new: '新询盘',
  in_progress: '跟进中',
  closed: '已关闭',
};

const INQUIRY_TYPE_LABELS: Record<string, string> = {
  quick_contact: '快捷联系',
  custom_trip: '定制行程',
  route_private: '路线私人定制',
};

function inquiryStatusLabel(status: string): string {
  return INQUIRY_STATUS_LABELS[status as InquiryStatus] ?? status;
}

function inquiryTypeLabel(type: string): string {
  return INQUIRY_TYPE_LABELS[type] ?? type;
}

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

function formatInquiryValue(value: unknown): string {
  if (value == null || value === '') return '-';
  if (Array.isArray(value)) {
    if (value.length === 0) return '-';
    return value.map((item) => String(item)).join(', ');
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 0) return '-';
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function SignInView({ onSignedIn }: { onSignedIn: (session: AuthSession) => void }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleGoogle = async () => {
    try {
      await signInWithOAuth('google', 'account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    }
  };

  const handleEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('loading');
    setError('');
    try {
      await sendEmailMagicLink(email, 'account');
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'We could not send the magic link.');
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
          <form onSubmit={handleEmail} className="space-y-3">
            <Input
              type="email"
              placeholder="Admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={status === 'loading'}>
              {status === 'loading' ? 'Sending...' : 'Send magic link'}
            </Button>
          </form>
          {status === 'sent' && (
            <p className="text-sm text-green-600">Check your email for the sign-in link.</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
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
    key: string;
    title: string;
    description: string;
    count: number | null;
    filter: PendingListFilter;
  }> = [
    {
      key: 'openInquiries',
      title: '未关闭询盘',
      description: '新询盘与跟进中，需及时回复。',
      count: counts?.openInquiries ?? null,
      filter: { tab: 'inquiries', status: 'open' },
    },
    {
      key: 'cancellationRequestedOrders',
      title: '取消请求订单',
      description: '旅客已申请取消，待处理。',
      count: counts?.cancellationRequestedOrders ?? null,
      filter: { tab: 'orders', status: 'cancellation_requested' },
    },
    {
      key: 'draftRoutes',
      title: '草稿路线',
      description: '尚未发布的路线草稿。',
      count: counts?.draftRoutes ?? null,
      filter: { tab: 'routes', status: 'draft' },
    },
    {
      key: 'reviewMedia',
      title: '待审素材',
      description: '等待审核的图片或视频。',
      count: counts?.reviewMedia ?? null,
      filter: { tab: 'media', status: 'review' },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">今日待办总览。点击卡片进入对应列表并带上默认筛选。</p>
        <Button type="button" variant="outline" onClick={() => void loadCounts()} disabled={loading}>
          {loading ? '加载中...' : '刷新'}
        </Button>
      </div>

      {error && <p className="text-destructive">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => onNavigate(card.filter)}
            className="rounded-lg border border-border bg-card p-5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p className="text-sm font-medium text-foreground">{card.title}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
              {loading && counts == null ? '—' : (card.count ?? '—')}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{card.description}</p>
          </button>
        ))}
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
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [notes, setNotes] = useState('');
  const [actionStatus, setActionStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [actionMessage, setActionMessage] = useState('');

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

  async function resendConfirmation(orderNumber: string) {
    setActionStatus('loading');
    setActionMessage('');
    setError('');
    try {
      const response = await fetch(
        `/api/admin/orders?orderNumber=${encodeURIComponent(orderNumber)}&action=resend-confirmation`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) throw new Error('重发确认邮件失败。');
      setActionStatus('done');
      setActionMessage('确认邮件已重发');
      setTimeout(() => {
        setActionStatus('idle');
        setActionMessage('');
      }, 1500);
    } catch (err) {
      setActionStatus('idle');
      setError(err instanceof Error ? err.message : '重发确认邮件失败。');
    }
  }

  async function updateNotes(orderNumber: string) {
    setActionStatus('loading');
    setActionMessage('');
    setError('');
    try {
      const response = await fetch(
        `/api/admin/orders?orderNumber=${encodeURIComponent(orderNumber)}&action=internal-notes`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ notes }),
        },
      );
      if (!response.ok) throw new Error('保存备注失败。');
      setActionStatus('done');
      setActionMessage('备注已保存');
      setTimeout(() => {
        setActionStatus('idle');
        setActionMessage('');
      }, 1500);
    } catch (err) {
      setActionStatus('idle');
      setError(err instanceof Error ? err.message : '保存备注失败。');
    }
  }

  if (selectedOrder) {
    return (
      <AdminEditShell
        title={selectedOrder.order_number}
        backLabel="← 返回列表"
        onBack={() => {
          setSelectedOrder(null);
          setActionMessage('');
        }}
      >
        {error && <p className="text-destructive">{error}</p>}
        {actionMessage && <p className="text-sm text-green-600">{actionMessage}</p>}

        <Card>
          <CardHeader>
            <CardTitle>订单信息</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">客户：</span>
              {selectedOrder.lead_traveler_name}
            </div>
            <div>
              <span className="text-muted-foreground">邮箱：</span>
              {selectedOrder.lead_email}
            </div>
            <div>
              <span className="text-muted-foreground">订单状态：</span>
              <StatusBadge
                status={selectedOrder.status}
                label={orderStatusLabel(selectedOrder.status)}
              />
            </div>
            <div>
              <span className="text-muted-foreground">支付状态：</span>
              {paymentStatusLabel(selectedOrder.payment_status)}
            </div>
            <div>
              <span className="text-muted-foreground">金额：</span>
              {formatCents(selectedOrder.total_price_cents)}
            </div>
            <div>
              <span className="text-muted-foreground">创建时间：</span>
              {formatDate(selectedOrder.created_at)}
            </div>
            <div>
              <span className="text-muted-foreground">路线：</span>
              {selectedOrder.route_title || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">出发地：</span>
              {selectedOrder.departure_city || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">行程日期：</span>
              {selectedOrder.start_date
                ? `${formatDate(selectedOrder.start_date)}${selectedOrder.end_date ? ` – ${formatDate(selectedOrder.end_date)}` : ''}`
                : '-'}
            </div>
            <div>
              <span className="text-muted-foreground">成人数：</span>
              {selectedOrder.adult_quantity}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>跟进</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => void resendConfirmation(selectedOrder.order_number)}
              disabled={actionStatus === 'loading'}
            >
              重发确认邮件
            </Button>
            <label className="block space-y-2 text-sm">
              <span className="font-medium">内部备注</span>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="仅内部可见"
              />
            </label>
            <Button
              onClick={() => void updateNotes(selectedOrder.order_number)}
              disabled={actionStatus === 'loading'}
            >
              保存备注
            </Button>
          </CardContent>
        </Card>
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
        <Button onClick={() => void fetchOrders()} disabled={loading}>
          {loading ? '加载中...' : '搜索'}
        </Button>
      </div>

      {error && <p className="text-destructive">{error}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订单号</TableHead>
                <TableHead>路线</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>创建时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow
                  key={order.order_number}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedOrder(order);
                    setNotes('');
                    setActionMessage('');
                  }}
                >
                  <TableCell className="font-medium">{order.order_number}</TableCell>
                  <TableCell>{order.route_title || '-'}</TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} label={orderStatusLabel(order.status)} />
                  </TableCell>
                  <TableCell>{order.lead_traveler_name}</TableCell>
                  <TableCell>{formatCents(order.total_price_cents)}</TableCell>
                  <TableCell>{formatDate(order.created_at)}</TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
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
  const [statusDraft, setStatusDraft] = useState<InquiryStatus>('new');
  const [notes, setNotes] = useState('');
  const [actionStatus, setActionStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [actionMessage, setActionMessage] = useState('');

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
    setActionMessage('');
    try {
      const inquiry = await fetchAdminInquiry(token, id);
      setSelected(inquiry);
      setStatusDraft(
        (['new', 'in_progress', 'closed'] as const).includes(inquiry.status as InquiryStatus)
          ? (inquiry.status as InquiryStatus)
          : 'new',
      );
      setNotes(inquiry.internal_notes ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法加载询盘详情。');
    } finally {
      setDetailLoading(false);
    }
  }

  async function saveStatus() {
    if (!selected) return;
    setActionStatus('loading');
    setActionMessage('');
    setError('');
    try {
      const inquiry = await updateAdminInquiryStatus(token, selected.id, statusDraft);
      setSelected(inquiry);
      setActionStatus('done');
      setActionMessage('状态已保存');
      setTimeout(() => {
        setActionStatus('idle');
        setActionMessage('');
      }, 1500);
      await fetchInquiries();
    } catch (err) {
      setActionStatus('idle');
      setError(err instanceof Error ? err.message : '无法更新询盘状态。');
    }
  }

  async function saveNotes() {
    if (!selected) return;
    setActionStatus('loading');
    setActionMessage('');
    setError('');
    try {
      const inquiry = await updateAdminInquiryNotes(token, selected.id, notes);
      setSelected(inquiry);
      setNotes(inquiry.internal_notes ?? '');
      setActionStatus('done');
      setActionMessage('备注已保存');
      setTimeout(() => {
        setActionStatus('idle');
        setActionMessage('');
      }, 1500);
    } catch (err) {
      setActionStatus('idle');
      setError(err instanceof Error ? err.message : '无法保存内部备注。');
    }
  }

  if (selected) {
    return (
      <AdminEditShell
        title={`${selected.name} · ${inquiryTypeLabel(selected.type)}`}
        backLabel="← 返回列表"
        onBack={() => {
          setSelected(null);
          setActionMessage('');
          void fetchInquiries();
        }}
      >
        {error && <p className="text-destructive">{error}</p>}
        {actionMessage && <p className="text-sm text-green-600">{actionMessage}</p>}

        <Card>
          <CardHeader>
            <CardTitle>提交信息</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">类型：</span>
              {inquiryTypeLabel(selected.type)}
            </div>
            <div>
              <span className="text-muted-foreground">状态：</span>
              {inquiryStatusLabel(selected.status)}
            </div>
            <div>
              <span className="text-muted-foreground">姓名：</span>
              {selected.name}
            </div>
            <div>
              <span className="text-muted-foreground">邮箱：</span>
              {selected.email}
            </div>
            <div>
              <span className="text-muted-foreground">电话：</span>
              {formatInquiryValue(selected.phone)}
            </div>
            <div>
              <span className="text-muted-foreground">出行月份：</span>
              {formatInquiryValue(selected.travel_month)}
            </div>
            <div>
              <span className="text-muted-foreground">人数：</span>
              {formatInquiryValue(selected.travelers)}
            </div>
            <div>
              <span className="text-muted-foreground">行程天数：</span>
              {formatInquiryValue(selected.trip_length)}
            </div>
            <div>
              <span className="text-muted-foreground">预算：</span>
              {formatInquiryValue(selected.budget)}
            </div>
            <div>
              <span className="text-muted-foreground">酒店等级：</span>
              {formatInquiryValue(selected.hotel_level)}
            </div>
            <div>
              <span className="text-muted-foreground">旅行风格：</span>
              {formatInquiryValue(selected.travel_style)}
            </div>
            <div>
              <span className="text-muted-foreground">支持偏好：</span>
              {formatInquiryValue(selected.support_preference)}
            </div>
            <div>
              <span className="text-muted-foreground">意向路线：</span>
              {selected.type === 'route_private' && selected.requested_tour?.trim()
                ? selected.requested_tour.trim()
                : formatInquiryValue(selected.requested_tour)}
            </div>
            <div>
              <span className="text-muted-foreground">意向目的地：</span>
              {formatInquiryValue(selected.requested_destination)}
            </div>
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">目的地：</span>
              {formatInquiryValue(selected.destinations)}
            </div>
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">兴趣：</span>
              {formatInquiryValue(selected.interests)}
            </div>
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">留言：</span>
              <p className="mt-1 whitespace-pre-wrap">{formatInquiryValue(selected.message)}</p>
            </div>
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">定制偏好：</span>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs">
                {formatInquiryValue(selected.custom_preferences)}
              </pre>
            </div>
            <div>
              <span className="text-muted-foreground">来源路径：</span>
              {formatInquiryValue(selected.source_path)}
            </div>
            <div>
              <span className="text-muted-foreground">邮件状态：</span>
              {formatInquiryValue(selected.email_status)}
            </div>
            <div>
              <span className="text-muted-foreground">提交时间：</span>
              {formatDate(selected.created_at)}
            </div>
            <div>
              <span className="text-muted-foreground">更新时间：</span>
              {formatDate(selected.updated_at)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>跟进</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-2 text-sm">
              <span className="font-medium">状态</span>
              <select
                className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={statusDraft}
                onChange={(event) => setStatusDraft(event.target.value as InquiryStatus)}
              >
                <option value="new">新询盘</option>
                <option value="in_progress">跟进中</option>
                <option value="closed">已关闭</option>
              </select>
            </label>
            <Button onClick={() => void saveStatus()} disabled={actionStatus === 'loading'}>
              保存状态
            </Button>
            <label className="block space-y-2 text-sm">
              <span className="font-medium">内部备注</span>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={5}
                placeholder="仅内部可见，保存后覆盖"
              />
            </label>
            <Button onClick={() => void saveNotes()} disabled={actionStatus === 'loading'}>
              保存备注
            </Button>
          </CardContent>
        </Card>
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
                  <TableCell>{formatDate(inquiry.created_at)}</TableCell>
                  <TableCell>{inquiryTypeLabel(inquiry.type)}</TableCell>
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

type DepartureEditDraft = {
  publicId: string;
  routeSlug: string;
  routeTitle: string;
  destinationSlug: string;
  departureCity: string;
  startDate: string;
  endDate: string;
  status: string;
  guaranteed: boolean;
  adultUnitPriceUsd: string;
  capacity: string;
  featuredOnHome: boolean;
  featuredPriority: string;
  confirmationRule: string;
  includedText: string;
  excludedText: string;
  notesText: string;
};

function emptyDepartureDraft(routes: RouteRecord[]): DepartureEditDraft {
  const firstRoute = routes[0];
  return {
    publicId: '',
    routeSlug: firstRoute?.slug ?? '',
    routeTitle: firstRoute?.title ?? '',
    destinationSlug: firstRoute?.destinationSlugs[0] ?? '',
    departureCity: '',
    startDate: '',
    endDate: '',
    status: 'sellable',
    guaranteed: true,
    adultUnitPriceUsd: '',
    capacity: '8',
    featuredOnHome: false,
    featuredPriority: '0',
    confirmationRule:
      'Minimum travelers may apply. If the minimum is not met, you will be offered a full refund or a date change.',
    includedText: 'Hotel accommodation\nDaily breakfast\nLocal guide\nEntrance fees',
    excludedText: 'International flights\nTravel insurance\nPersonal expenses',
    notesText: '',
  };
}

function departureToDraft(departure: AdminDeparture): DepartureEditDraft {
  return {
    publicId: departure.public_id,
    routeSlug: departure.route_slug,
    routeTitle: departure.route_title,
    destinationSlug: departure.destination_slug || '',
    departureCity: departure.departure_city,
    startDate: departure.start_date.slice(0, 10),
    endDate: departure.end_date.slice(0, 10),
    status: departure.status || 'sellable',
    guaranteed: Boolean(departure.guaranteed),
    adultUnitPriceUsd: (departure.adult_unit_price_cents / 100).toFixed(2),
    capacity: String(departure.capacity),
    featuredOnHome: Boolean(departure.featured_on_home),
    featuredPriority: String(departure.featured_priority ?? 0),
    confirmationRule: departure.confirmation_rule || '',
    includedText: (departure.included_core_items ?? []).map(String).join('\n'),
    excludedText: (departure.excluded_core_items ?? []).map(String).join('\n'),
    notesText: (departure.important_notes ?? []).map(String).join('\n'),
  };
}

function DeparturesPanel({ token }: { token: string }) {
  const [departures, setDepartures] = useState<AdminDeparture[]>([]);
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionStatus, setActionStatus] = useState<Record<string, 'idle' | 'loading'>>({});
  const [editing, setEditing] = useState<DepartureEditDraft | null>(null);
  const [isCreate, setIsCreate] = useState(false);
  /** Last end date we auto-filled; only overwrite end when empty or still equal to this. */
  const lastAutoEndDateRef = useRef('');

  useEffect(() => {
    fetchAdminRoutes(token)
      .then(setRoutes)
      .catch((err) => setError(err instanceof Error ? err.message : '无法加载路线列表。'));
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

  async function runAction(publicId: string, action: 'lock' | 'close' | 'cancel') {
    setActionStatus((current) => ({ ...current, [`${publicId}:${action}`]: 'loading' }));
    setError('');
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
      setStatus(`班期 ${publicId} 已${DEPARTURE_ACTION_LABELS[action]}。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败。');
    } finally {
      setActionStatus((current) => ({ ...current, [`${publicId}:${action}`]: 'idle' }));
    }
  }

  async function saveDeparture() {
    if (!editing) return;
    setBusy(true);
    setError('');
    setStatus('');
    const priceUsd = Number(editing.adultUnitPriceUsd);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      setError('成人单价须为正数（美元）。');
      setBusy(false);
      return;
    }

    const payload = {
      action: isCreate ? 'create' : 'update',
      publicId: editing.publicId || undefined,
      routeSlug: editing.routeSlug,
      routeTitle: editing.routeTitle,
      destinationSlug: editing.destinationSlug || undefined,
      departureCity: editing.departureCity,
      startDate: editing.startDate,
      endDate: editing.endDate,
      status: editing.status,
      guaranteed: editing.guaranteed,
      adultUnitPriceCents: Math.round(priceUsd * 100),
      capacity: Number(editing.capacity),
      featuredOnHome: editing.featuredOnHome,
      featuredPriority: Number(editing.featuredPriority) || 0,
      confirmationRule: editing.confirmationRule,
      includedCoreItems: editing.includedText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      excludedCoreItems: editing.excludedText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      importantNotes: editing.notesText
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
      setStatus(isCreate ? '班期已创建。' : '班期已更新。');
      setEditing(null);
      setIsCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存班期失败。');
    } finally {
      setBusy(false);
    }
  }

  function applyRouteSelection(slug: string) {
    const route = routes.find((item) => item.slug === slug);
    setEditing((current) => {
      if (!current) return current;
      const next = {
        ...current,
        routeSlug: slug,
        routeTitle: route?.title ?? current.routeTitle,
        destinationSlug: route?.destinationSlugs[0] ?? '',
        departureCity: current.departureCity || route?.destinationSlugs[0] || '',
      };
      const suggested =
        next.startDate && route?.durationDays
          ? endDateFromDuration(next.startDate, route.durationDays)
          : '';
      const shouldAutoEnd =
        Boolean(suggested) &&
        (!next.endDate || next.endDate === lastAutoEndDateRef.current);
      if (shouldAutoEnd && suggested) {
        lastAutoEndDateRef.current = suggested;
        return { ...next, endDate: suggested };
      }
      return next;
    });
  }

  function applyStartDate(startDate: string) {
    setEditing((current) => {
      if (!current) return current;
      const route = routes.find((item) => item.slug === current.routeSlug);
      const suggested =
        startDate && route?.durationDays
          ? endDateFromDuration(startDate, route.durationDays)
          : '';
      const shouldAutoEnd =
        Boolean(suggested) &&
        (!current.endDate || current.endDate === lastAutoEndDateRef.current);
      if (shouldAutoEnd && suggested) {
        lastAutoEndDateRef.current = suggested;
        return { ...current, startDate, endDate: suggested };
      }
      return { ...current, startDate };
    });
  }

  const selectedRoute = editing
    ? routes.find((route) => route.slug === editing.routeSlug)
    : undefined;
  const destinationOptions = selectedRoute?.destinationSlugs ?? [];
  const tripDayCount =
    editing?.startDate && editing?.endDate
      ? inclusiveDayCount(editing.startDate, editing.endDate)
      : null;
  const durationMismatch =
    Boolean(selectedRoute?.durationDays) &&
    tripDayCount != null &&
    tripDayCount !== selectedRoute!.durationDays;

  if (editing) {
    return (
      <AdminEditShell
        title={isCreate ? '新建班期' : `编辑：${editing.publicId}`}
        backLabel="← 返回列表"
        onBack={() => {
          setEditing(null);
          setIsCreate(false);
        }}
      >
        {error && <p className="text-destructive">{error}</p>}
        <Card>
          <CardHeader>
            <CardTitle>{isCreate ? '新建班期' : `编辑：${editing.publicId}`}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormSection title="关联与行程" description="绑定路线、目的地与出行日期。">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm md:col-span-2">
                  <span>路线</span>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editing.routeSlug}
                    onChange={(event) => applyRouteSelection(event.target.value)}
                  >
                    {routes.map((route) => (
                      <option key={route.slug} value={route.slug}>
                        {route.title}
                      </option>
                    ))}
                  </select>
                </label>
                {!isCreate && (
                  <label className="space-y-2 text-sm">
                    <span>班期 ID</span>
                    <Input value={editing.publicId} disabled />
                  </label>
                )}
                {isCreate && (
                  <label className="space-y-2 text-sm">
                    <span>班期 ID（可选）</span>
                    <Input
                      value={editing.publicId}
                      placeholder="留空则自动生成"
                      onChange={(event) =>
                        setEditing((current) =>
                          current ? { ...current, publicId: event.target.value } : current,
                        )
                      }
                    />
                  </label>
                )}
                <label className="space-y-2 text-sm">
                  <span>目的地</span>
                  {destinationOptions.length > 0 ? (
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={editing.destinationSlug}
                      onChange={(event) =>
                        setEditing((current) =>
                          current
                            ? { ...current, destinationSlug: event.target.value }
                            : current,
                        )
                      }
                    >
                      {destinationOptions.map((slug) => (
                        <option key={slug} value={slug}>
                          {slug}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={editing.destinationSlug}
                      onChange={(event) =>
                        setEditing((current) =>
                          current
                            ? { ...current, destinationSlug: event.target.value }
                            : current,
                        )
                      }
                      placeholder="目的地 slug"
                    />
                  )}
                  <FieldHint>关联目的地；通常随路线自动带出。</FieldHint>
                </label>
                <label className="space-y-2 text-sm">
                  <span>出发城市</span>
                  <Input
                    value={editing.departureCity}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, departureCity: event.target.value } : current,
                      )
                    }
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span>开始日期</span>
                  <Input
                    type="date"
                    value={editing.startDate}
                    onChange={(event) => applyStartDate(event.target.value)}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span>结束日期</span>
                  <Input
                    type="date"
                    value={editing.endDate}
                    onChange={(event) => {
                      lastAutoEndDateRef.current = '';
                      setEditing((current) =>
                        current ? { ...current, endDate: event.target.value } : current,
                      );
                    }}
                  />
                  <FieldHint>
                    结束日默认按路线天数推算（开始日 + {selectedRoute?.durationDays ?? 'N'} − 1）。可改。
                  </FieldHint>
                </label>
                {durationMismatch && (
                  <p className="text-sm text-amber-700 md:col-span-2" role="status">
                    与路线 {selectedRoute?.durationDays} 天不一致（当前 {tripDayCount}{' '}
                    天），确认后仍可保存。
                  </p>
                )}
              </div>
            </FormSection>

            <FormSection title="售卖与库存" description="控制是否可售、价格与名额。">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span>班期状态</span>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editing.status}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, status: event.target.value } : current,
                      )
                    }
                  >
                    {DEPARTURE_STATUS_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {DEPARTURE_STATUS_LABELS[value]}
                      </option>
                    ))}
                  </select>
                  <FieldHint>
                    仅「可售」可被旅客下单；锁团/关闭/售罄/取消后不可新订。
                  </FieldHint>
                </label>
                <label className="space-y-2 text-sm">
                  <span>成人单价（美元）</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editing.adultUnitPriceUsd}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, adultUnitPriceUsd: event.target.value } : current,
                      )
                    }
                  />
                  <FieldHint>界面按美元填写；入库为美分（自动 ×100）。</FieldHint>
                </label>
                <label className="space-y-2 text-sm">
                  <span>容量（总名额）</span>
                  <Input
                    type="number"
                    min="1"
                    value={editing.capacity}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, capacity: event.target.value } : current,
                      )
                    }
                  />
                  <FieldHint>本团总座位数；剩余名额 = 容量 − 已订。</FieldHint>
                </label>
                <label className="flex items-start gap-2 text-sm md:col-span-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={editing.guaranteed}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, guaranteed: event.target.checked } : current,
                      )
                    }
                  />
                  <span>
                    保证成团
                    <FieldHint>
                      勾选表示该班期保证发团；与「班期状态」无关，勿与可售混淆。
                    </FieldHint>
                  </span>
                </label>
              </div>
            </FormSection>

            <FormSection title="首页推荐" description="控制是否进入移动端首页热门拼团。">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-start gap-2 text-sm md:col-span-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={editing.featuredOnHome}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, featuredOnHome: event.target.checked } : current,
                      )
                    }
                  />
                  <span>
                    首页推荐
                    <FieldHint>
                      勾选后可出现在移动端首页；还需状态为「可售」且有剩余名额。
                    </FieldHint>
                  </span>
                </label>
                <label className="space-y-2 text-sm">
                  <span>推荐优先级</span>
                  <Input
                    type="number"
                    min="0"
                    value={editing.featuredPriority}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, featuredPriority: event.target.value } : current,
                      )
                    }
                  />
                  <FieldHint>仅作用于首页推荐列表；数字越小越靠前。</FieldHint>
                </label>
              </div>
            </FormSection>

            <FormSection title="旅客可见说明" description="展示在班期/下单相关页的英文文案（内容值仍英文）。">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm md:col-span-2">
                  <span>确认规则</span>
                  <Textarea
                    value={editing.confirmationRule}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, confirmationRule: event.target.value } : current,
                      )
                    }
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span>费用包含（每行一条）</span>
                  <Textarea
                    rows={5}
                    value={editing.includedText}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, includedText: event.target.value } : current,
                      )
                    }
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span>费用不含（每行一条）</span>
                  <Textarea
                    rows={5}
                    value={editing.excludedText}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, excludedText: event.target.value } : current,
                      )
                    }
                  />
                </label>
                <label className="space-y-2 text-sm md:col-span-2">
                  <span>重要提示（每行一条）</span>
                  <Textarea
                    rows={3}
                    value={editing.notesText}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, notesText: event.target.value } : current,
                      )
                    }
                  />
                </label>
              </div>
            </FormSection>

            <div className="flex gap-2">
              <Button onClick={() => void saveDeparture()} disabled={busy}>
                {busy ? '保存中…' : isCreate ? '创建班期' : '保存修改'}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  setIsCreate(false);
                }}
              >
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          管理可售班期与首页热门拼团。首页推荐需状态为「可售」且有剩余名额才会展示。
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={busy || loading}
            onClick={() => {
              lastAutoEndDateRef.current = '';
              setIsCreate(true);
              setEditing(emptyDepartureDraft(routes));
            }}
          >
            新建班期
          </Button>
          <Button onClick={() => void fetchDepartures()} disabled={loading || busy}>
            {loading ? '加载中...' : '刷新'}
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
                <TableHead>路线</TableHead>
                <TableHead>出发城市</TableHead>
                <TableHead>日期</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>名额</TableHead>
                <TableHead>单价</TableHead>
                <TableHead>首页</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departures.map((departure) => (
                <TableRow key={departure.public_id}>
                  <TableCell className="font-medium">
                    <div>{departure.route_title}</div>
                    <div className="font-mono text-xs text-muted-foreground">{departure.public_id}</div>
                  </TableCell>
                  <TableCell>{departure.departure_city}</TableCell>
                  <TableCell>
                    {formatDate(departure.start_date)} - {formatDate(departure.end_date)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={departure.status}
                      label={departureStatusLabel(departure.status)}
                    />
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
                          const draft = departureToDraft(departure);
                          const route = routes.find((item) => item.slug === draft.routeSlug);
                          const suggested =
                            draft.startDate && route?.durationDays
                              ? endDateFromDuration(draft.startDate, route.durationDays)
                              : '';
                          lastAutoEndDateRef.current =
                            suggested && draft.endDate === suggested ? suggested : '';
                          setEditing(draft);
                        }}
                      >
                        编辑
                      </Button>
                      {(['lock', 'close', 'cancel'] as const).map((action) => (
                        <Button
                          key={action}
                          size="sm"
                          variant="outline"
                          title={
                            action === 'lock'
                              ? '锁团：停止新订，已有订单保留'
                              : action === 'close'
                                ? '关闭：班期结束售卖'
                                : '取消：整团取消'
                          }
                          disabled={
                            departure.status !== 'sellable' ||
                            actionStatus[`${departure.public_id}:${action}`] === 'loading'
                          }
                          onClick={() => void runAction(departure.public_id, action)}
                        >
                          {DEPARTURE_ACTION_LABELS[action]}
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {departures.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    暂无班期
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

function formatDefaultSummary(field: CustomTripFormField): string {
  const value = field.defaultValue;
  if (Array.isArray(value)) return value.length ? value.join(', ') : '(empty)';
  if (value == null || value === '') return '(empty)';
  return String(value);
}

function optionsToTextarea(options: CustomTripFormOption[]): string {
  return options
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    .map((option) => `${option.optionKey}|${option.label}|${option.enabled ? 'enabled' : 'disabled'}`)
    .join('\n');
}

function parseOptionsTextarea(text: string): CustomTripFormOption[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [optionKey = '', label = '', enabledRaw = 'enabled'] = line.split('|').map((part) => part.trim());
      const enabled = enabledRaw.toLowerCase() !== 'disabled' && enabledRaw !== '0' && enabledRaw !== 'false';
      return {
        id: '',
        optionKey,
        label: label || optionKey,
        sortOrder: index,
        enabled,
      };
    });
}

function defaultValueToEditString(field: CustomTripFormField): string {
  if (field.controlType === 'multi_select') {
    return Array.isArray(field.defaultValue) ? field.defaultValue.map(String).join(', ') : '';
  }
  return field.defaultValue == null ? '' : String(field.defaultValue);
}

function parseDefaultValueInput(controlType: FormControlType, raw: string): unknown {
  if (controlType === 'multi_select') {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return raw;
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

type FieldEditDraft = {
  id: string;
  fieldKey: string;
  label: string;
  description: string;
  controlType: FormControlType;
  formGroup: FormGroup;
  required: boolean;
  sortOrder: number;
  enabled: boolean;
  keyLocked: boolean;
  useOnRoutePrivate: boolean;
  defaultValueText: string;
  optionsText: string;
};

function emptyFieldDraft(): FieldEditDraft {
  return {
    id: '',
    fieldKey: '',
    label: '',
    description: '',
    controlType: 'single_select',
    formGroup: 'more',
    required: false,
    sortOrder: 100,
    enabled: true,
    keyLocked: false,
    useOnRoutePrivate: false,
    defaultValueText: '',
    optionsText: '',
  };
}

function fieldToDraft(field: CustomTripFormField): FieldEditDraft {
  return {
    id: field.id,
    fieldKey: field.fieldKey,
    label: field.label,
    description: field.description,
    controlType: field.controlType,
    formGroup: field.formGroup,
    required: field.required,
    sortOrder: field.sortOrder,
    enabled: field.enabled,
    keyLocked: field.keyLocked,
    useOnRoutePrivate: Boolean(field.useOnRoutePrivate),
    defaultValueText: defaultValueToEditString(field),
    optionsText: optionsToTextarea(field.options),
  };
}

function CustomTripFormPanel({ token }: { token: string }) {
  const [fields, setFields] = useState<CustomTripFormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<FieldEditDraft | null>(null);

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
      setStatus(`${field.fieldKey} 已${enabled ? '启用' : '停用'}。`);
      await loadFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新字段失败。');
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
    setBusy(true);
    setError('');
    setStatus('');
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
        fieldKey: editing.fieldKey,
        label: editing.label,
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
      setStatus(`${editing.fieldKey} 已保存。`);
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
    return (
      <AdminEditShell
        title={isCreate ? '新建字段' : `编辑字段：${editing.fieldKey}`}
        backLabel="← 返回列表"
        onBack={() => setEditing(null)}
      >
        {error && <p className="text-destructive">{error}</p>}
        <Card>
          <CardHeader>
            <CardTitle>{isCreate ? '新建字段' : `编辑字段：${editing.fieldKey}`}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormSection
              title="标识"
              description="系统键与旅客可见文案分开维护；label/description 值仍建议写英文。"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span>系统字段键（fieldKey）</span>
                  <Input
                    value={editing.fieldKey}
                    disabled={editing.keyLocked}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, fieldKey: event.target.value } : current,
                      )
                    }
                  />
                  <FieldHint>
                    用于存储答案和后端识别；{editing.keyLocked ? '当前字段已锁定，不可重命名。' : '创建后请谨慎修改。'}
                  </FieldHint>
                </label>
                <label className="space-y-2 text-sm">
                  <span>旅客可见标题（label）</span>
                  <Input
                    value={editing.label}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, label: event.target.value } : current,
                      )
                    }
                  />
                  <FieldHint>显示在询盘偏好区，面向旅客。</FieldHint>
                </label>
                <label className="space-y-2 text-sm md:col-span-2">
                  <span>旅客可见说明（description）</span>
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
                  <FieldHint>控制字段在「从零定制」完整表单里出现在基础信息还是更多偏好；保存值仍是英文枚举。</FieldHint>
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
                    <FieldHint>勾选后，该字段会出现在「基于此路线」的私人短询盘偏好区（与分组无关）。</FieldHint>
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
                  <FieldHint>入库仍为英文枚举；多选默认值用英文 optionKey 逗号分隔。</FieldHint>
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
                    <FieldHint>开启后旅客提交表单时必须填写该字段。</FieldHint>
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
                  <FieldHint>optionKey 是入库值；label 是旅客可见英文文案；enabled 可写 disabled 隐藏单个选项。</FieldHint>
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
                    <FieldHint>停用只会隐藏新表单字段，历史询盘已保存答案会保留。</FieldHint>
                  </span>
                </label>
              </div>
            </FormSection>
            <div className="flex gap-2">
              <Button onClick={saveField} disabled={busy}>
                {busy ? '保存中...' : '保存字段'}
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
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          统一配置询盘偏好字段：从零定制表单按「基础信息 / 更多偏好」分组；勾选「路线私人」的字段会出现在基于路线的短表单。停用只影响新表单；fieldKey
          已锁定后不能改名。
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={loadFields} disabled={loading || busy}>
            {loading ? '加载中...' : '刷新'}
          </Button>
          <Button
            onClick={() =>
              setEditing({
                ...emptyFieldDraft(),
                sortOrder: (fields[fields.length - 1]?.sortOrder ?? 0) + 10,
              })
            }
            disabled={loading || busy}
          >
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
                <TableHead>字段键</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>分组</TableHead>
                <TableHead>路线私人</TableHead>
                <TableHead>控件</TableHead>
                <TableHead>必填</TableHead>
                <TableHead>启用</TableHead>
                <TableHead>默认值</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell className="font-mono text-xs">{field.fieldKey}</TableCell>
                  <TableCell className="font-medium">{field.label}</TableCell>
                  <TableCell>{CUSTOM_TRIP_GROUP_LABELS[field.formGroup]}</TableCell>
                  <TableCell>{field.useOnRoutePrivate ? '是' : '否'}</TableCell>
                  <TableCell>{CUSTOM_TRIP_CONTROL_LABELS[field.controlType]}</TableCell>
                  <TableCell>{field.required ? '是' : '否'}</TableCell>
                  <TableCell>
                    <Badge variant={field.enabled ? 'default' : 'secondary'}>
                      {field.enabled ? '已启用' : '已停用'}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs">
                    {formatDefaultSummary(field)}
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
                        onClick={() => setEditing(fieldToDraft(field))}
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

    </div>
  );
}

const CONTENT_STATUSES: ContentStatus[] = ['published', 'draft', 'archived'];

const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  published: '已发布',
  draft: '草稿',
  archived: '已归档',
};

const ROUTE_PRICE_MODE_LABELS: Record<RoutePriceMode, string> = {
  'on-request': '询价',
  'fixed-from': '固定起价',
  'seasonal-table': '季节价表',
  'per-person-range': '人均区间',
  unavailable: '暂不可订',
};

const ROUTE_PRIMARY_TYPE_LABELS: Record<RoutePrimaryType, string> = {
  private: '私人定制',
  'group-tour': '拼团',
  customizable: '可定制',
  'fixed-departure': '固定班期',
};

type DestinationEditDraft = {
  slug: string;
  name: string;
  description: string;
  image: string;
  displayOrder: string;
  status: ContentStatus;
  travelStyles: string[];
  featuredOnHome: boolean;
  featuredPriority: string;
};

function emptyDestinationDraft(): DestinationEditDraft {
  return {
    slug: '',
    name: '',
    description: '',
    image: '',
    displayOrder: '0',
    status: 'published',
    travelStyles: [],
    featuredOnHome: false,
    featuredPriority: '0',
  };
}

function destinationToDraft(destination: Destination): DestinationEditDraft {
  return {
    slug: destination.slug,
    name: destination.name,
    description: destination.description,
    image: destination.image,
    displayOrder: String(destination.displayOrder),
    status: destination.status,
    travelStyles: destination.travelStyles,
    featuredOnHome: destination.featuredOnHome,
    featuredPriority: String(destination.featuredPriority ?? 0),
  };
}

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

  async function saveDestination() {
    if (!editing) return;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const result = await postAdminDestination(token, {
        action: isCreate ? 'create' : 'update',
        slug: editing.slug,
        name: editing.name,
        description: editing.description,
        image: editing.image,
        displayOrder: Number(editing.displayOrder) || 0,
        status: editing.status,
        travelStyles: editing.travelStyles,
        featuredOnHome: editing.featuredOnHome,
        featuredPriority: Number(editing.featuredPriority) || 0,
      });
      setDestinations(result.destinations);
      setStatus(isCreate ? '目的地已创建。' : '目的地已更新。');
      setEditing(null);
      setIsCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存目的地失败。');
    } finally {
      setBusy(false);
    }
  }

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
        title={isCreate ? '新建目的地' : `编辑：${editing.slug}`}
        backLabel="← 返回列表"
        onBack={() => {
          setEditing(null);
          setIsCreate(false);
        }}
      >
        {error && <p className="text-destructive">{error}</p>}
        <Card>
          <CardHeader>
            <CardTitle>{isCreate ? '新建目的地' : `编辑：${editing.slug}`}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormSection title="基本信息" description="详情页门面：名称、简介与主图。">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span>标识（slug）</span>
                  <Input
                    value={editing.slug}
                    disabled={!isCreate}
                    placeholder="例如 beijing"
                    onChange={(event) =>
                      setEditing((current) => (current ? { ...current, slug: event.target.value } : current))
                    }
                  />
                  <FieldHint>公网 URL 与关联用的唯一标识；创建后不可改。</FieldHint>
                </label>
                <label className="space-y-2 text-sm">
                  <span>名称</span>
                  <Input
                    value={editing.name}
                    onChange={(event) =>
                      setEditing((current) => (current ? { ...current, name: event.target.value } : current))
                    }
                  />
                </label>
                <label className="space-y-2 text-sm md:col-span-2">
                  <span>简介</span>
                  <Textarea
                    value={editing.description}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, description: event.target.value } : current,
                      )
                    }
                  />
                </label>
                <div className="space-y-2 text-sm md:col-span-2">
                  <span>图片</span>
                  <ImageFieldPicker
                    value={editing.image}
                    token={token}
                    disabled={busy}
                    onChange={(url) =>
                      setEditing((current) => (current ? { ...current, image: url } : current))
                    }
                  />
                </div>
              </div>
            </FormSection>

            <FormSection title="首页与排序" description="控制是否进入首页推荐，以及列表中的先后顺序。">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-start gap-2 text-sm md:col-span-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={editing.featuredOnHome}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, featuredOnHome: event.target.checked } : current,
                      )
                    }
                  />
                  <span>
                    首页推荐
                    <FieldHint>勾选后出现在移动端/首页「热门目的地」区域。</FieldHint>
                  </span>
                </label>
                <label className="space-y-2 text-sm">
                  <span>推荐优先级</span>
                  <Input
                    type="number"
                    min="0"
                    value={editing.featuredPriority}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, featuredPriority: event.target.value } : current,
                      )
                    }
                  />
                  <FieldHint>仅作用于首页推荐列表；数字越小越靠前。</FieldHint>
                </label>
                <label className="space-y-2 text-sm">
                  <span>展示排序</span>
                  <Input
                    type="number"
                    value={editing.displayOrder}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, displayOrder: event.target.value } : current,
                      )
                    }
                  />
                  <FieldHint>目的地列表等处的默认排序权重。</FieldHint>
                </label>
              </div>
            </FormSection>

            <FormSection title="分类" description="用于公网目的地筛选（分类在「分类」模块维护）。">
              <div className="space-y-2 text-sm">
                <span>旅行风格</span>
                <div className="flex flex-wrap gap-3 rounded-md border border-input p-3">
                  {categories.length === 0 && (
                    <span className="text-muted-foreground">
                      暂无目的地分类。请先到「分类」模块创建。
                    </span>
                  )}
                  {categories.map((category) => (
                    <label key={category.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editing.travelStyles.includes(category.key)}
                        onChange={(event) =>
                          setEditing((current) => {
                            if (!current) return current;
                            const travelStyles = event.target.checked
                              ? [...current.travelStyles, category.key]
                              : current.travelStyles.filter((key) => key !== category.key);
                            return { ...current, travelStyles };
                          })
                        }
                      />
                      {category.label}
                    </label>
                  ))}
                </div>
                <FieldHint>决定旅客按风格筛选时能否找到此目的地。</FieldHint>
              </div>
            </FormSection>

            <FormSection title="状态">
              <label className="space-y-2 text-sm max-w-xs">
                <span>发布状态</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editing.status}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, status: event.target.value as ContentStatus } : current,
                    )
                  }
                >
                  {CONTENT_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {CONTENT_STATUS_LABELS[value]}
                    </option>
                  ))}
                </select>
                <FieldHint>仅「已发布」对旅客可见；草稿/归档不出现在公网列表。</FieldHint>
              </label>
            </FormSection>

            <div className="flex gap-2">
              <Button onClick={saveDestination} disabled={busy}>
                {busy ? '保存中…' : isCreate ? '创建目的地' : '保存修改'}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  setIsCreate(false);
                }}
              >
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          管理公网展示的目的地（目的地页、页脚、导航等）。填写内容仍用英文（面向旅客）。
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

const ROUTE_PRICE_MODES: RoutePriceMode[] = [
  'on-request',
  'fixed-from',
  'seasonal-table',
  'per-person-range',
  'unavailable',
];
const ROUTE_PRIMARY_TYPES: RoutePrimaryType[] = ['private', 'group-tour', 'customizable', 'fixed-departure'];

type ItineraryDayDraft = {
  title: string;
  city: string;
  summary: string;
  attractionsText: string;
  meals: string;
  accommodation: string;
  transport: string;
  notesText: string;
};

function emptyItineraryDayDraft(): ItineraryDayDraft {
  return {
    title: '',
    city: '',
    summary: '',
    attractionsText: '',
    meals: '',
    accommodation: '',
    transport: '',
    notesText: '',
  };
}

type RouteEditDraft = {
  slug: string;
  legacyNumericId: string;
  title: string;
  subtitle: string;
  summary: string;
  durationDays: string;
  groupSizeDisplay: string;
  category: string;
  themes: string[];
  status: ContentStatus;
  featured: boolean;
  heroImage: string;
  pdfUrl: string;
  priceMode: RoutePriceMode;
  priceDisplay: string;
  primaryType: RoutePrimaryType;
  availableTypesText: string;
  destinationSlugsText: string;
  experienceText: string;
  momentsText: string;
  includedSupportText: string;
  itineraryDays: ItineraryDayDraft[];
};

function emptyRouteDraft(): RouteEditDraft {
  return {
    slug: '',
    legacyNumericId: '',
    title: '',
    subtitle: '',
    summary: '',
    durationDays: '1',
    groupSizeDisplay: 'Private / Group tour',
    category: '',
    themes: [],
    status: 'published',
    featured: false,
    heroImage: '',
    pdfUrl: '',
    priceMode: 'on-request',
    priceDisplay: 'On request',
    primaryType: 'customizable',
    availableTypesText: 'customizable',
    destinationSlugsText: '',
    experienceText: '',
    momentsText: '',
    includedSupportText: '',
    itineraryDays: [],
  };
}

function routeToDraft(route: RouteRecord): RouteEditDraft {
  return {
    slug: route.slug,
    legacyNumericId: route.legacyNumericId == null ? '' : String(route.legacyNumericId),
    title: route.title,
    subtitle: route.subtitle,
    summary: route.summary,
    durationDays: String(route.durationDays),
    groupSizeDisplay: route.groupSizeDisplay,
    category: route.category,
    themes: route.themes,
    status: route.status,
    featured: route.featured,
    heroImage: route.heroImage,
    pdfUrl: route.pdfUrl,
    priceMode: route.priceMode,
    priceDisplay: route.priceDisplay,
    primaryType: route.primaryType,
    availableTypesText: route.availableTypes.join(', '),
    destinationSlugsText: route.destinationSlugs.join(', '),
    experienceText: route.experience.join('\n'),
    momentsText: route.moments.join('\n'),
    includedSupportText: route.includedSupport.join('\n'),
    itineraryDays: route.itineraryDays.map((day) => ({
      title: day.title,
      city: day.city,
      summary: day.summary,
      attractionsText: day.attractions.join('\n'),
      meals: day.meals,
      accommodation: day.accommodation,
      transport: day.transport,
      notesText: day.notes.join('\n'),
    })),
  };
}

function csvToList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function linesToList(value: string): string[] {
  return value
    .split('\n')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function saveRoute() {
    if (!editing) return;
    const durationDays = Number(editing.durationDays);
    if (!Number.isFinite(durationDays) || durationDays <= 0) {
      setError('行程天数须为正数。');
      return;
    }
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await postAdminRoute(token, {
        action: isCreate ? 'create' : 'update',
        slug: editing.slug,
        legacyNumericId: editing.legacyNumericId ? Number(editing.legacyNumericId) : null,
        title: editing.title,
        subtitle: editing.subtitle,
        summary: editing.summary,
        durationDays,
        groupSizeDisplay: editing.groupSizeDisplay,
        category: editing.category,
        themes: editing.themes,
        status: editing.status,
        featured: editing.featured,
        heroImage: editing.heroImage,
        pdfUrl: editing.pdfUrl,
        priceMode: editing.priceMode,
        priceDisplay: editing.priceDisplay,
        primaryType: editing.primaryType,
        availableTypes: csvToList(editing.availableTypesText),
        destinationSlugs: csvToList(editing.destinationSlugsText),
        experience: linesToList(editing.experienceText),
        moments: linesToList(editing.momentsText),
        includedSupport: linesToList(editing.includedSupportText),
        itineraryDays: editing.itineraryDays.map((day, index) => ({
          dayNumber: index + 1,
          title: day.title.trim(),
          city: day.city.trim(),
          summary: day.summary.trim(),
          attractions: linesToList(day.attractionsText),
          meals: day.meals.trim(),
          accommodation: day.accommodation.trim(),
          transport: day.transport.trim(),
          notes: linesToList(day.notesText),
        })),
      });
      setStatus(isCreate ? '路线已创建。' : '路线已更新。');
      setEditing(null);
      setIsCreate(false);
      await loadRoutes();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存路线失败。');
    } finally {
      setBusy(false);
    }
  }

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

  function updateItineraryDay(index: number, patch: Partial<ItineraryDayDraft>) {
    setEditing((current) => {
      if (!current) return current;
      const itineraryDays = current.itineraryDays.map((day, i) => (i === index ? { ...day, ...patch } : day));
      return { ...current, itineraryDays };
    });
  }

  function addItineraryDay() {
    setEditing((current) =>
      current ? { ...current, itineraryDays: [...current.itineraryDays, emptyItineraryDayDraft()] } : current,
    );
  }

  function removeItineraryDay(index: number) {
    setEditing((current) => {
      if (!current) return current;
      return { ...current, itineraryDays: current.itineraryDays.filter((_, i) => i !== index) };
    });
  }

  function moveItineraryDay(index: number, direction: -1 | 1) {
    setEditing((current) => {
      if (!current) return current;
      const target = index + direction;
      if (target < 0 || target >= current.itineraryDays.length) return current;
      const itineraryDays = [...current.itineraryDays];
      [itineraryDays[index], itineraryDays[target]] = [itineraryDays[target], itineraryDays[index]];
      return { ...current, itineraryDays };
    });
  }

  if (editing) {
    return (
      <AdminEditShell
        title={isCreate ? '新建路线' : `编辑：${editing.slug}`}
        backLabel="← 返回列表"
        onBack={() => {
          setEditing(null);
          setIsCreate(false);
        }}
      >
        {error && <p className="text-destructive">{error}</p>}
        <Card>
          <CardHeader>
            <CardTitle>{isCreate ? '新建路线' : `编辑：${editing.slug}`}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormSection title="基本信息" description="详情页门面与关联目的地。">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span>标识（slug）</span>
                  <Input
                    value={editing.slug}
                    disabled={!isCreate}
                    placeholder="例如 beijing-shanghai-classic"
                    onChange={(event) =>
                      setEditing((current) => (current ? { ...current, slug: event.target.value } : current))
                    }
                  />
                  <FieldHint>公网路线页 URL 与关联用的唯一标识；创建后不可改。</FieldHint>
                </label>
                <label className="space-y-2 text-sm">
                  <span>旧版数字 ID（可选）</span>
                  <Input
                    type="number"
                    value={editing.legacyNumericId}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, legacyNumericId: event.target.value } : current,
                      )
                    }
                  />
                  <FieldHint>用于回退到旧 PDF/通用行程文案；无结构化逐日行程时才有用。</FieldHint>
                </label>
                <label className="space-y-2 text-sm md:col-span-2">
                  <span>标题</span>
                  <Input
                    value={editing.title}
                    onChange={(event) =>
                      setEditing((current) => (current ? { ...current, title: event.target.value } : current))
                    }
                  />
                </label>
                <label className="space-y-2 text-sm md:col-span-2">
                  <span>副标题</span>
                  <Input
                    value={editing.subtitle}
                    onChange={(event) =>
                      setEditing((current) => (current ? { ...current, subtitle: event.target.value } : current))
                    }
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span>行程天数</span>
                  <Input
                    type="number"
                    min="1"
                    value={editing.durationDays}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, durationDays: event.target.value } : current,
                      )
                    }
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span>团型展示文案</span>
                  <Input
                    value={editing.groupSizeDisplay}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, groupSizeDisplay: event.target.value } : current,
                      )
                    }
                  />
                </label>
                <label className="space-y-2 text-sm md:col-span-2">
                  <span>关联目的地（slug，逗号分隔）</span>
                  <Input
                    value={editing.destinationSlugsText}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, destinationSlugsText: event.target.value } : current,
                      )
                    }
                  />
                  <FieldHint>决定此路线出现在哪些目的地页；须与已有目的地标识一致。</FieldHint>
                </label>
              </div>
            </FormSection>

            <FormSection title="卡片与筛选" description="列表卡、筛选与推荐位。">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm md:col-span-2">
                  <span>摘要（卡片描述）</span>
                  <Textarea
                    value={editing.summary}
                    onChange={(event) =>
                      setEditing((current) => (current ? { ...current, summary: event.target.value } : current))
                    }
                  />
                </label>
                <div className="space-y-2 text-sm md:col-span-2">
                  <span>主图</span>
                  <ImageFieldPicker
                    value={editing.heroImage}
                    token={token}
                    disabled={busy}
                    onChange={(url) =>
                      setEditing((current) => (current ? { ...current, heroImage: url } : current))
                    }
                  />
                </div>
                <div className="space-y-2 text-sm md:col-span-2">
                  <span>主题 / 分类</span>
                  <div className="flex flex-wrap gap-3 rounded-md border border-input p-3">
                    {categories.length === 0 && (
                      <span className="text-muted-foreground">
                        暂无路线分类。请先到「分类」模块创建。
                      </span>
                    )}
                    {categories.map((category) => (
                      <label key={category.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editing.themes.includes(category.key)}
                          onChange={(event) =>
                            setEditing((current) => {
                              if (!current) return current;
                              const themes = event.target.checked
                                ? [...current.themes, category.key]
                                : current.themes.filter((key) => key !== category.key);
                              return { ...current, themes };
                            })
                          }
                        />
                        {category.label}
                      </label>
                    ))}
                  </div>
                  <FieldHint>控制列表筛选与标签展示；选项在「分类」模块维护。</FieldHint>
                </div>
                <label className="space-y-2 text-sm">
                  <span>分类文案</span>
                  <Input
                    value={editing.category}
                    onChange={(event) =>
                      setEditing((current) => (current ? { ...current, category: event.target.value } : current))
                    }
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span>主产品类型</span>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editing.primaryType}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, primaryType: event.target.value as RoutePrimaryType } : current,
                      )
                    }
                  >
                    {ROUTE_PRIMARY_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {ROUTE_PRIMARY_TYPE_LABELS[value]}
                      </option>
                    ))}
                  </select>
                  <FieldHint>详情页主展示的产品类型；入库仍为英文枚举。</FieldHint>
                </label>
                <label className="space-y-2 text-sm md:col-span-2">
                  <span>可选产品类型（逗号分隔英文值）</span>
                  <Input
                    value={editing.availableTypesText}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, availableTypesText: event.target.value } : current,
                      )
                    }
                  />
                </label>
                <label className="flex items-start gap-2 text-sm md:col-span-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={editing.featured}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, featured: event.target.checked } : current,
                      )
                    }
                  />
                  <span>
                    推荐路线
                    <FieldHint>勾选后进入 China Trips / 移动端推荐位。</FieldHint>
                  </span>
                </label>
              </div>
            </FormSection>

            <FormSection
              title="详情页内容"
              description="详情页正文块（亮点与含括支持）。每行一条。"
            >
              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2 text-sm">
                  <span>体验亮点</span>
                  <Textarea
                    rows={4}
                    value={editing.experienceText}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, experienceText: event.target.value } : current,
                      )
                    }
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span>招牌时刻</span>
                  <Textarea
                    rows={4}
                    value={editing.momentsText}
                    onChange={(event) =>
                      setEditing((current) => (current ? { ...current, momentsText: event.target.value } : current))
                    }
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span>含括支持</span>
                  <Textarea
                    rows={4}
                    value={editing.includedSupportText}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, includedSupportText: event.target.value } : current,
                      )
                    }
                  />
                </label>
              </div>
            </FormSection>

            <FormSection
              title="逐日行程"
              description="详情页按日叙事。留空则回退到旧版 PDF/通用行程（若配置了旧版数字 ID）。"
            >
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button type="button" variant="outline" size="sm" onClick={addItineraryDay}>
                  添加一天
                </Button>
              </div>

              <div className="space-y-4">
                {editing.itineraryDays.map((day, index) => (
                  <div key={index} className="space-y-3 rounded-md border border-input p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold">第 {index + 1} 天</span>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={index === 0}
                          onClick={() => moveItineraryDay(index, -1)}
                        >
                          上移
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={index === editing.itineraryDays.length - 1}
                          onClick={() => moveItineraryDay(index, 1)}
                        >
                          下移
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => removeItineraryDay(index)}
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-2 text-sm">
                        <span>标题（可选，如 Arrival in Beijing）</span>
                        <Input
                          value={day.title}
                          onChange={(event) => updateItineraryDay(index, { title: event.target.value })}
                        />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span>城市</span>
                        <Input
                          value={day.city}
                          onChange={(event) => updateItineraryDay(index, { city: event.target.value })}
                        />
                      </label>
                      <label className="space-y-2 text-sm md:col-span-2">
                        <span>景点（每行一个，按游览顺序）</span>
                        <Textarea
                          rows={3}
                          value={day.attractionsText}
                          onChange={(event) =>
                            updateItineraryDay(index, { attractionsText: event.target.value })
                          }
                        />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span>餐饮</span>
                        <Input
                          value={day.meals}
                          onChange={(event) => updateItineraryDay(index, { meals: event.target.value })}
                        />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span>住宿</span>
                        <Input
                          value={day.accommodation}
                          onChange={(event) => updateItineraryDay(index, { accommodation: event.target.value })}
                        />
                      </label>
                      <label className="space-y-2 text-sm md:col-span-2">
                        <span>交通</span>
                        <Input
                          value={day.transport}
                          onChange={(event) => updateItineraryDay(index, { transport: event.target.value })}
                        />
                      </label>
                      <label className="space-y-2 text-sm md:col-span-2">
                        <span>内部摘要（可选）</span>
                        <Textarea
                          rows={2}
                          value={day.summary}
                          onChange={(event) => updateItineraryDay(index, { summary: event.target.value })}
                        />
                        <FieldHint>不展示给旅客，仅供运营备注。</FieldHint>
                      </label>
                      <label className="space-y-2 text-sm md:col-span-2">
                        <span>补充说明（每行一条，可选）</span>
                        <Textarea
                          rows={2}
                          value={day.notesText}
                          onChange={(event) => updateItineraryDay(index, { notesText: event.target.value })}
                        />
                        <FieldHint>会拼入公网逐日叙述，请用英文旅客文案。</FieldHint>
                      </label>
                    </div>
                  </div>
                ))}
                {editing.itineraryDays.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    尚无结构化日程。当前会回退到旧版 PDF 行程（若已填旧版数字 ID）或通用模板。
                  </p>
                )}
              </div>
            </FormSection>

            <FormSection title="价格与状态" description="售卖展示与发布状态。">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span>价格模式</span>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editing.priceMode}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, priceMode: event.target.value as RoutePriceMode } : current,
                      )
                    }
                  >
                    {ROUTE_PRICE_MODES.map((value) => (
                      <option key={value} value={value}>
                        {ROUTE_PRICE_MODE_LABELS[value]}
                      </option>
                    ))}
                  </select>
                  <FieldHint>影响价格如何展示/计算；入库仍为英文枚举。</FieldHint>
                </label>
                <label className="space-y-2 text-sm">
                  <span>价格展示文案</span>
                  <Input
                    value={editing.priceDisplay}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, priceDisplay: event.target.value } : current,
                      )
                    }
                  />
                </label>
                <label className="space-y-2 text-sm md:col-span-2">
                  <span>PDF URL（可选）</span>
                  <Input
                    value={editing.pdfUrl}
                    onChange={(event) =>
                      setEditing((current) => (current ? { ...current, pdfUrl: event.target.value } : current))
                    }
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span>发布状态</span>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editing.status}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, status: event.target.value as ContentStatus } : current,
                      )
                    }
                  >
                    {CONTENT_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {CONTENT_STATUS_LABELS[value]}
                      </option>
                    ))}
                  </select>
                  <FieldHint>仅「已发布」对旅客可见；草稿/归档不出现在公网列表。</FieldHint>
                </label>
              </div>
            </FormSection>

            <div className="flex gap-2">
              <Button onClick={saveRoute} disabled={busy}>
                {busy ? '保存中…' : isCreate ? '创建路线' : '保存修改'}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  setIsCreate(false);
                }}
              >
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          管理 China Trips、目的地页与路线详情上的路线卡片。填写内容仍用英文（面向旅客）。
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
                <TableHead>分类</TableHead>
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
  title: string;
  altText: string;
  destinationSlugsText: string;
  routeSlugsText: string;
  tagsText: string;
  status: MediaAssetStatus;
};

function emptyMediaDraft(): MediaEditDraft {
  return {
    id: '',
    type: 'image',
    publicUrl: '',
    title: '',
    altText: '',
    destinationSlugsText: '',
    routeSlugsText: '',
    tagsText: '',
    status: 'published',
  };
}

function mediaToDraft(media: MediaAsset): MediaEditDraft {
  return {
    id: media.id,
    type: media.type,
    publicUrl: media.publicUrl,
    title: media.title,
    altText: media.altText,
    destinationSlugsText: media.destinationSlugs.join(', '),
    routeSlugsText: media.routeSlugs.join(', '),
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

type CategoryEditDraft = {
  id: string | null;
  key: string;
  label: string;
  scope: CategoryScope;
  sortOrder: string;
  enabled: boolean;
};

function emptyCategoryDraft(scope: CategoryScope): CategoryEditDraft {
  return { id: null, key: '', label: '', scope, sortOrder: '0', enabled: true };
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
              <TableHead>名称</TableHead>
              <TableHead>标识</TableHead>
              <TableHead>排序</TableHead>
              <TableHead>启用</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scoped.map((category, index) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.label}</TableCell>
                <TableCell className="font-mono text-xs">{category.key}</TableCell>
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
                <TableCell colSpan={5} className="text-center text-muted-foreground">
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
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<CategoryEditDraft | null>(null);

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

  async function saveCategory() {
    if (!editing) return;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const result = await postAdminCategory(token, {
        action: editing.id ? 'update' : 'create',
        id: editing.id,
        key: editing.key,
        label: editing.label,
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
      setStatus(`分类 ${category.label} 已停用。`);
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
    return (
      <AdminEditShell
        title={editing.id
          ? `编辑${categoryScopeLabel(editing.scope)}分类：${editing.label || editing.key}`
          : `新建${categoryScopeLabel(editing.scope)}分类`}
        backLabel="← 返回列表"
        onBack={() => setEditing(null)}
      >
        {error && <p className="text-destructive">{error}</p>}
        <Card>
          <CardHeader>
            <CardTitle>{editing.id ? `编辑：${editing.label || editing.key}` : '新建分类'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormSection title="标识" description="分类分为目的地筛选和路线筛选两个 scope；本次不合并。">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span>标识（key）</span>
                  <Input
                    value={editing.key}
                    disabled={Boolean(editing.id)}
                    placeholder="例如 culture"
                    onChange={(event) =>
                      setEditing((current) => (current ? { ...current, key: event.target.value } : current))
                    }
                  />
                  <FieldHint>创建后不要随意修改；路线/目的地用这个英文 key 存储分类关系。</FieldHint>
                </label>
                <label className="space-y-2 text-sm">
                  <span>显示名称（label）</span>
                  <Input
                    value={editing.label}
                    placeholder="例如 Culture & history"
                    onChange={(event) =>
                      setEditing((current) => (current ? { ...current, label: event.target.value } : current))
                    }
                  />
                  <FieldHint>显示给旅客的筛选文案，建议仍用英文。</FieldHint>
                </label>
                <label className="space-y-2 text-sm md:col-span-2">
                  <span>分类范围（scope）</span>
                  <Input value={categoryScopeLabel(editing.scope)} disabled />
                  <FieldHint>只读；目的地分类用于 Places tab，路线分类用于 Routes tab。</FieldHint>
                </label>
              </div>
            </FormSection>

            <FormSection title="展示" description="控制筛选栏显示和排序。">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span>排序值</span>
                  <Input
                    type="number"
                    value={editing.sortOrder}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, sortOrder: event.target.value } : current,
                      )
                    }
                  />
                  <FieldHint>数字越小越靠前；列表里的上移/下移也会更新排序。</FieldHint>
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
                    <FieldHint>启用后出现在移动端筛选栏；停用不会删除已打在内容上的 key。</FieldHint>
                  </span>
                </label>
              </div>
            </FormSection>
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
      <p className="text-sm text-muted-foreground">
        管理移动端 China Trips 的 Places 和 Routes 筛选分类。停用分类只会从筛选栏隐藏，不会删除已打在目的地或路线上的分类 key。
      </p>

      {error && <p className="text-destructive">{error}</p>}
      {status && <p className="text-sm text-green-700">{status}</p>}

      <CategoryScopeSection
        scope="destination"
        title="目的地分类（Places tab）"
        categories={categories}
        busy={busy || loading}
        onEdit={(category) => setEditing(categoryToDraft(category))}
        onCreate={() => setEditing(emptyCategoryDraft('destination'))}
        onArchive={archiveCategoryRow}
        onMove={moveCategory}
      />

      <CategoryScopeSection
        scope="route"
        title="路线分类（Routes tab）"
        categories={categories}
        busy={busy || loading}
        onEdit={(category) => setEditing(categoryToDraft(category))}
        onCreate={() => setEditing(emptyCategoryDraft('route'))}
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
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<MediaEditDraft | null>(null);
  const [isCreate, setIsCreate] = useState(false);

  async function loadMedia() {
    setLoading(true);
    setError('');
    try {
      setMedia(
        await fetchAdminMedia(token, {
          status: statusFilter || undefined,
          search: search.trim() || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载素材失败。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function saveMedia() {
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
        title: editing.title,
        altText: editing.altText,
        destinationSlugs: csvToList(editing.destinationSlugsText),
        routeSlugs: csvToList(editing.routeSlugsText),
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

  async function uploadSelectedFile(file: File) {
    if (!editing) return;
    setUploading(true);
    setError('');
    setStatus('');
    try {
      const contentType = file.type || 'application/octet-stream';
      const presigned = await presignMediaUpload(token, {
        filename: file.name,
        contentType,
      });
      await uploadFileToPresignedUrl(presigned.uploadUrl, file, presigned.contentType);
      setEditing((current) =>
        current
          ? {
              ...current,
              publicUrl: presigned.publicUrl,
              type: contentType.startsWith('video/') ? 'video' : 'image',
              title: current.title || file.name.replace(/\.[^.]+$/, ''),
            }
          : current,
      );
      setStatus('文件已上传，下方已生成预览；仍需保存，素材才会写入数据库。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传文件失败。');
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
                  <FieldHint>上传后仍需保存，素材才会写入数据库。</FieldHint>
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

            <FormSection title="素材说明" description="给运营识别和图片无障碍说明使用。内容建议仍用英文。">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span>标题</span>
                  <Input
                    value={editing.title}
                    onChange={(event) =>
                      setEditing((current) => (current ? { ...current, title: event.target.value } : current))
                    }
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span>标签（逗号分隔）</span>
                  <Input
                    value={editing.tagsText}
                    onChange={(event) =>
                      setEditing((current) => (current ? { ...current, tagsText: event.target.value } : current))
                    }
                  />
                </label>
                <label className="space-y-2 text-sm md:col-span-2">
                  <span>替代文本（altText）</span>
                  <Input
                    value={editing.altText}
                    onChange={(event) =>
                      setEditing((current) => (current ? { ...current, altText: event.target.value } : current))
                    }
                  />
                  <FieldHint>用于图片无法加载和无障碍阅读；不是运营备注。</FieldHint>
                </label>
              </div>
            </FormSection>

            <FormSection
              title="关联与发布"
              description="关联 slug 只是素材元数据，不会自动替换产品封面或详情页图片。"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span>关联目的地（slug，逗号分隔）</span>
                  <Input
                    value={editing.destinationSlugsText}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, destinationSlugsText: event.target.value } : current,
                      )
                    }
                  />
                  <FieldHint>例如 beijing, shanghai；需与已有目的地标识一致。</FieldHint>
                </label>
                <label className="space-y-2 text-sm">
                  <span>关联路线（slug，逗号分隔）</span>
                  <Input
                    value={editing.routeSlugsText}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, routeSlugsText: event.target.value } : current,
                      )
                    }
                  />
                  <FieldHint>仅记录素材和路线的关系，前台引用仍需在对应内容里选择图片 URL。</FieldHint>
                </label>
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
                  <FieldHint>显示为中文，保存值仍是 review / published / rejected / archived。</FieldHint>
                </label>
              </div>
            </FormSection>
            <div className="flex gap-2">
              <Button onClick={saveMedia} disabled={busy || uploading}>
                {busy ? '保存中...' : isCreate ? '创建素材' : '保存修改'}
              </Button>
              <Button variant="outline" disabled={busy || uploading} onClick={() => setEditing(null)}>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          管理素材元数据，或通过预签名 URL 上传文件到 MinIO。关联 slug 仅用于检索，不会自动替换产品图片。
        </p>
        <Button
          variant="outline"
          disabled={busy || loading}
          onClick={() => {
            setIsCreate(true);
            setEditing(emptyMediaDraft());
          }}
        >
          新建素材
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Input
          placeholder="搜索标题或 URL"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void loadMedia();
          }}
          className="sm:max-w-xs"
        />
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:max-w-[10rem]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">全部状态</option>
          {MEDIA_STATUSES.map((value) => (
            <option key={value} value={value}>
              {MEDIA_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <Button onClick={() => void loadMedia()} disabled={loading || busy}>
          {loading ? '加载中...' : '搜索'}
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
                <TableHead>类型</TableHead>
                <TableHead>关联</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {media.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    <div>{item.title}</div>
                    <div className="max-w-[240px] truncate font-mono text-xs text-muted-foreground">
                      {item.publicUrl}
                    </div>
                  </TableCell>
                  <TableCell>{MEDIA_TYPE_LABELS[item.type]}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {[...item.destinationSlugs, ...item.routeSlugs].join(', ') || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'published' ? 'default' : 'secondary'}>
                      {MEDIA_STATUS_LABELS[item.status]}
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {media.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {search.trim() || statusFilter ? '无匹配结果' : '暂无素材。'}
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

function AdminNav({
  activeTab,
  onSelect,
  className,
}: {
  activeTab: AdminTab;
  onSelect: (tab: AdminTab) => void;
  className?: string;
}) {
  return (
    <nav className={cn('flex flex-col gap-4', className)} aria-label="Admin modules">
      {ADMIN_NAV_GROUPS.map((group) => (
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
        const stored = readStoredAuthSession();
        if (redirected) {
          setSession(redirected);
        } else if (stored) {
          setSession(stored);
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

  const activeLabel =
    ADMIN_NAV_ITEMS.find((item) => item.value === activeTab)?.label ?? 'Admin';

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="border-b border-border px-4 py-5">
          <h1 className="text-lg font-bold">Admin</h1>
          <p className="mt-1 truncate text-xs text-muted-foreground">{session.user.email}</p>
        </div>
        <div className="flex flex-1 flex-col justify-between gap-6 p-3">
          <AdminNav activeTab={activeTab} onSelect={handleSelectTab} />
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
              <AdminNav activeTab={activeTab} onSelect={handleSelectTab} />
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
            <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
          </div>
        </header>

        <div className="min-w-0 flex-1 overflow-x-auto p-4 md:p-6">
          <div className="mb-6 hidden md:block">
            <h2 className="text-2xl font-bold">{activeLabel}</h2>
            <p className="text-sm text-muted-foreground">Signed in as {session.user.email}</p>
          </div>

          {error && <p className="mb-4 text-destructive">{error}</p>}

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
