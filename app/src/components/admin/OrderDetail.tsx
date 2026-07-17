import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  CANCEL_REQUEST_BANNER,
  canResendConfirmation,
  confirmationEmailStatusLabel,
  formatOrderDateTime,
  orderStatusHint,
  orderStatusLabel,
  orderStatusPlain,
  paymentStatusLabel,
  paymentStatusPlain,
  refundStatusLabel,
} from '@/lib/orderOpsCopy';

export type AdminOrderDetail = {
  order_number: string;
  status: string;
  payment_status: string;
  refund_status?: string;
  confirmation_email_status?: string;
  lead_traveler_name: string;
  lead_email: string;
  adult_quantity: number;
  total_price_cents: number;
  currency?: string;
  route_title?: string;
  departure_city?: string;
  start_date?: string;
  end_date?: string;
  route_slug?: string;
  created_at: string;
  updated_at?: string;
  internal_notes?: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_charge_id?: string | null;
  stripe_refund_id?: string | null;
  paid_at?: string | null;
  confirmed_at?: string | null;
  cancelled_at?: string | null;
  refunded_at?: string | null;
  cancellation_requested_at?: string | null;
  expired_at?: string | null;
};

type OrderDetailProps = {
  token: string;
  order: AdminOrderDetail;
  onOrderChange: (order: AdminOrderDetail) => void;
  onListRefresh: () => Promise<void>;
};

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap font-medium text-foreground">{value}</dd>
    </div>
  );
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTripDates(start?: string, end?: string): string {
  if (!start) return '';
  const startLabel = formatDateOnly(start);
  if (!end) return startLabel;
  return `${startLabel} – ${formatDateOnly(end)}`;
}

function formatDateOnly(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split('-');
    return `${Number(m)}月${Number(d)}日（${y}）`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getMonth() + 1}月${date.getDate()}日（${date.getFullYear()}）`;
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'confirmed') return 'default';
  if (status === 'pending_payment') return 'secondary';
  if (
    status === 'cancellation_requested' ||
    status === 'cancelled' ||
    status === 'failed' ||
    status === 'expired' ||
    status === 'refunded'
  ) {
    return 'destructive';
  }
  return 'outline';
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function OrderDetail({ token, order, onOrderChange, onListRefresh }: OrderDetailProps) {
  const [notes, setNotes] = useState(order.internal_notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setNotes(order.internal_notes ?? '');
  }, [order.order_number, order.internal_notes]);

  const resendEligible = canResendConfirmation(order);
  const emailFailed = order.confirmation_email_status === 'confirmation_email_failed';
  const isCancelRequest = order.status === 'cancellation_requested';

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 1600);
  }

  async function handleCopyEmail() {
    const ok = await copyText(order.lead_email);
    flash(ok ? '已复制邮箱' : '复制邮箱失败，请手动选择');
  }

  async function saveNotes() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/admin/orders?orderNumber=${encodeURIComponent(order.order_number)}&action=internal-notes`,
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
      onOrderChange({ ...order, internal_notes: notes });
      flash('备注已保存');
      await onListRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存备注失败。');
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (!resendEligible) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/admin/orders?orderNumber=${encodeURIComponent(order.order_number)}&action=resend-confirmation`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const result = (await response.json()) as { ok?: boolean; emailStatus?: string; error?: string };
      if (!response.ok || !result.ok) {
        throw new Error(result.error || '重发确认邮件失败。');
      }
      const nextEmailStatus =
        result.emailStatus === 'sent' ? 'confirmation_email_sent' : 'confirmation_email_failed';
      onOrderChange({ ...order, confirmation_email_status: nextEmailStatus });
      flash(result.emailStatus === 'sent' ? '确认邮件已重发' : '重发失败，请查看邮件状态');
      await onListRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '重发确认邮件失败。');
    } finally {
      setBusy(false);
    }
  }

  const guestRows: { label: string; value: string }[] = [
    { label: '客户', value: order.lead_traveler_name },
    { label: '邮箱', value: order.lead_email },
  ];
  if (order.route_title) guestRows.push({ label: '路线', value: order.route_title });
  if (order.departure_city) guestRows.push({ label: '出发地', value: order.departure_city });
  const tripDates = formatTripDates(order.start_date, order.end_date);
  if (tripDates) guestRows.push({ label: '行程日期', value: tripDates });
  guestRows.push({ label: '成人数', value: String(order.adult_quantity) });
  guestRows.push({ label: '金额', value: formatCents(order.total_price_cents) });

  return (
    <div className="space-y-4">
      {error ? <p className="text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <Card className={isCancelRequest ? 'border-destructive/60' : undefined}>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">下一步</CardTitle>
            <Badge variant={statusBadgeVariant(order.status)}>{orderStatusLabel(order.status)}</Badge>
            <Badge variant="outline">{paymentStatusLabel(order.payment_status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{orderStatusHint(order.status)}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {isCancelRequest ? (
            <div
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive"
              role="alert"
            >
              {CANCEL_REQUEST_BANNER}
            </div>
          ) : null}

          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium">订单状态 vs 支付状态</p>
            <dl className="mt-2 space-y-2">
              <div>
                <dt className="text-muted-foreground">
                  订单状态（履约/业务）· {orderStatusLabel(order.status)}
                </dt>
                <dd className="mt-0.5">{orderStatusPlain(order.status)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  支付状态（钱）· {paymentStatusLabel(order.payment_status)}
                </dt>
                <dd className="mt-0.5">{paymentStatusPlain(order.payment_status)}</dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void handleCopyEmail()}>
              复制邮箱
            </Button>
            {resendEligible ? (
              <Button
                type="button"
                variant={emailFailed ? 'default' : 'secondary'}
                disabled={busy}
                onClick={() => void resendConfirmation()}
              >
                {emailFailed ? '重发确认邮件（上次失败）' : '重发确认邮件'}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                重发确认邮件仅适用于「已确认 + 已支付」订单。
              </p>
            )}
          </div>

          {order.confirmation_email_status ? (
            <p className="text-sm text-muted-foreground">
              确认邮件：{confirmationEmailStatusLabel(order.confirmation_email_status)}
            </p>
          ) : null}

          <label className="block space-y-2 text-sm">
            <span className="font-medium">内部备注</span>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="仅内部可见；保存后覆盖"
            />
          </label>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void saveNotes()}>
            保存备注
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">客人 / 行程 / 金额</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            {guestRows.map((row) => (
              <FieldRow key={`${row.label}-${row.value}`} label={row.label} value={row.value} />
            ))}
          </dl>
        </CardContent>
      </Card>

      <details className="rounded-lg border border-border bg-card">
        <summary className="cursor-pointer px-6 py-4 text-sm font-medium">支付与技术</summary>
        <div className="space-y-3 border-t border-border px-6 py-4 text-sm">
          <FieldRow label="订单号" value={order.order_number} />
          <FieldRow label="订单状态" value={orderStatusLabel(order.status)} />
          <FieldRow label="支付状态" value={paymentStatusLabel(order.payment_status)} />
          {order.refund_status ? (
            <FieldRow label="退款状态" value={refundStatusLabel(order.refund_status)} />
          ) : null}
          {order.confirmation_email_status ? (
            <FieldRow
              label="确认邮件状态"
              value={confirmationEmailStatusLabel(order.confirmation_email_status)}
            />
          ) : null}
          <FieldRow label="创建时间" value={formatOrderDateTime(order.created_at)} />
          {order.updated_at ? (
            <FieldRow label="更新时间" value={formatOrderDateTime(order.updated_at)} />
          ) : null}
          {order.paid_at ? <FieldRow label="支付时间" value={formatOrderDateTime(order.paid_at)} /> : null}
          {order.confirmed_at ? (
            <FieldRow label="确认时间" value={formatOrderDateTime(order.confirmed_at)} />
          ) : null}
          {order.cancellation_requested_at ? (
            <FieldRow
              label="取消申请时间"
              value={formatOrderDateTime(order.cancellation_requested_at)}
            />
          ) : null}
          {order.cancelled_at ? (
            <FieldRow label="取消时间" value={formatOrderDateTime(order.cancelled_at)} />
          ) : null}
          {order.refunded_at ? (
            <FieldRow label="退款时间" value={formatOrderDateTime(order.refunded_at)} />
          ) : null}
          {order.expired_at ? (
            <FieldRow label="过期时间" value={formatOrderDateTime(order.expired_at)} />
          ) : null}
          {order.stripe_checkout_session_id ? (
            <FieldRow label="Stripe Checkout Session" value={order.stripe_checkout_session_id} />
          ) : null}
          {order.stripe_payment_intent_id ? (
            <FieldRow label="Stripe Payment Intent" value={order.stripe_payment_intent_id} />
          ) : null}
          {order.stripe_charge_id ? (
            <FieldRow label="Stripe Charge" value={order.stripe_charge_id} />
          ) : null}
          {order.stripe_refund_id ? (
            <FieldRow label="Stripe Refund" value={order.stripe_refund_id} />
          ) : null}
        </div>
      </details>
    </div>
  );
}
