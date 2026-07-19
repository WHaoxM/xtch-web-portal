import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { fetchAdminCustomTripForm, type CustomTripFormField } from '@/lib/customTripFormClient';
import {
  formatInquiryDateTime,
  inquiryStatusHint,
  inquiryStatusLabel,
  inquiryTypeLabel,
  inquiryTypeOps,
} from '@/lib/inquiryOpsCopy';
import {
  formatInquiryPreferences,
  formatInquiryScalar,
} from '@/lib/inquiryPreferencesDisplay';
import {
  updateAdminInquiryNotes,
  updateAdminInquiryStatus,
  type AdminInquiry,
  type InquiryStatus,
} from '@/lib/inquiriesAdminClient';

type InquiryDetailProps = {
  token: string;
  inquiry: AdminInquiry;
  onInquiryChange: (inquiry: AdminInquiry) => void;
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

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'closed') return 'destructive';
  if (status === 'in_progress') return 'default';
  return 'secondary';
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function InquiryDetail({
  token,
  inquiry,
  onInquiryChange,
  onListRefresh,
}: InquiryDetailProps) {
  const [notes, setNotes] = useState(inquiry.internal_notes ?? '');
  const [formFields, setFormFields] = useState<CustomTripFormField[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setNotes(inquiry.internal_notes ?? '');
  }, [inquiry.id, inquiry.internal_notes]);

  useEffect(() => {
    let cancelled = false;
    fetchAdminCustomTripForm(token)
      .then((fields) => {
        if (!cancelled) setFormFields(fields);
      })
      .catch(() => {
        if (!cancelled) setFormFields([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const typeOps = inquiryTypeOps(inquiry.type);
  const preferenceRows = useMemo(
    () => formatInquiryPreferences(inquiry.custom_preferences, formFields),
    [inquiry.custom_preferences, formFields],
  );

  const phone = formatInquiryScalar(inquiry.phone);
  const messageText = formatInquiryScalar(inquiry.message);
  const requestedTour = formatInquiryScalar(inquiry.requested_tour);
  const requestedDestination = formatInquiryScalar(inquiry.requested_destination);
  const destinations = formatInquiryScalar(inquiry.destinations);
  const interests = formatInquiryScalar(inquiry.interests);
  const travelMonth = formatInquiryScalar(inquiry.travel_month);
  const travelers = formatInquiryScalar(inquiry.travelers);
  const tripLength = formatInquiryScalar(inquiry.trip_length);
  const budget = formatInquiryScalar(inquiry.budget);
  const hotelLevel = formatInquiryScalar(inquiry.hotel_level);
  const travelStyle = formatInquiryScalar(inquiry.travel_style);
  const supportPreference = formatInquiryScalar(inquiry.support_preference);

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 1600);
  }

  async function setStatus(next: InquiryStatus) {
    setBusy(true);
    setError('');
    try {
      const updated = await updateAdminInquiryStatus(token, inquiry.id, next);
      onInquiryChange(updated);
      flash(`已标为「${inquiryStatusLabel(next)}」`);
      await onListRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法更新询盘状态。');
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes() {
    setBusy(true);
    setError('');
    try {
      const updated = await updateAdminInquiryNotes(token, inquiry.id, notes);
      onInquiryChange(updated);
      setNotes(updated.internal_notes ?? '');
      flash('备注已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法保存内部备注。');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy(label: string, value: string) {
    const ok = await copyText(value);
    flash(ok ? `已复制${label}` : `复制${label}失败，请手动选择`);
  }

  const highlightRows: { label: string; value: string }[] = [];
  if ((inquiry.type === 'route_private' || inquiry.type === 'group_tour_inquiry') && requestedTour) {
    highlightRows.push({ label: '意向路线', value: requestedTour });
  }
  if (inquiry.type === 'group_tour_inquiry') {
    if (travelMonth) highlightRows.push({ label: '意向出发', value: travelMonth });
    if (travelers) highlightRows.push({ label: '人数', value: travelers });
  }
  if (inquiry.type === 'custom_trip') {
    if (destinations) highlightRows.push({ label: '目的地', value: destinations });
    if (requestedDestination) highlightRows.push({ label: '意向目的地', value: requestedDestination });
    if (tripLength) highlightRows.push({ label: '行程天数', value: tripLength });
    if (budget) highlightRows.push({ label: '预算', value: budget });
  }
  if (inquiry.type === 'quick_contact') {
    if (messageText) highlightRows.push({ label: '留言', value: messageText });
    highlightRows.push({ label: '邮箱', value: inquiry.email });
    if (phone) highlightRows.push({ label: '电话', value: phone });
  }

  const secondaryRows: { label: string; value: string }[] = [
    { label: '姓名', value: inquiry.name },
    { label: '邮箱', value: inquiry.email },
  ];
  if (phone && inquiry.type !== 'quick_contact') secondaryRows.push({ label: '电话', value: phone });
  if (requestedTour && inquiry.type !== 'route_private' && inquiry.type !== 'group_tour_inquiry') {
    secondaryRows.push({ label: '意向路线', value: requestedTour });
  }
  if (requestedDestination && inquiry.type !== 'custom_trip') {
    secondaryRows.push({ label: '意向目的地', value: requestedDestination });
  }
  if (destinations && inquiry.type !== 'custom_trip') {
    secondaryRows.push({ label: '目的地', value: destinations });
  }
  if (travelMonth && inquiry.type !== 'group_tour_inquiry') {
    secondaryRows.push({ label: '出行月份', value: travelMonth });
  }
  if (travelers && inquiry.type !== 'group_tour_inquiry') {
    secondaryRows.push({ label: '人数', value: travelers });
  }
  if (tripLength && inquiry.type !== 'custom_trip') {
    secondaryRows.push({ label: '行程天数', value: tripLength });
  }
  if (budget && inquiry.type !== 'custom_trip') {
    secondaryRows.push({ label: '预算', value: budget });
  }
  if (hotelLevel) secondaryRows.push({ label: '酒店等级', value: hotelLevel });
  if (travelStyle) secondaryRows.push({ label: '旅行风格', value: travelStyle });
  if (supportPreference) secondaryRows.push({ label: '支持偏好', value: supportPreference });
  if (interests) secondaryRows.push({ label: '兴趣', value: interests });
  if (messageText && inquiry.type !== 'quick_contact') {
    secondaryRows.push({ label: '留言', value: messageText });
  }

  const shownLabels = new Set(highlightRows.map((row) => row.label));
  const uniqueSecondary = secondaryRows.filter((row) => !shownLabels.has(row.label));

  const currentStatus = (
    ['new', 'in_progress', 'closed'] as const
  ).includes(inquiry.status as InquiryStatus)
    ? (inquiry.status as InquiryStatus)
    : 'new';

  return (
    <div className="space-y-4">
      {error ? <p className="text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">下一步</CardTitle>
            <Badge variant={statusBadgeVariant(currentStatus)}>
              {inquiryStatusLabel(currentStatus)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{inquiryStatusHint(currentStatus)}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {currentStatus === 'new' ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => void setStatus('in_progress')}
              >
                标为跟进中
              </Button>
            ) : null}
            {currentStatus !== 'closed' ? (
              <Button
                type="button"
                variant={currentStatus === 'in_progress' ? 'default' : 'outline'}
                disabled={busy}
                onClick={() => void setStatus('closed')}
              >
                标为已关闭
              </Button>
            ) : (
              <Button
                type="button"
                disabled={busy}
                onClick={() => void setStatus('in_progress')}
              >
                标为跟进中
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void handleCopy('邮箱', inquiry.email)}
            >
              复制邮箱
            </Button>
            {phone ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void handleCopy('电话', phone)}
              >
                复制电话
              </Button>
            ) : null}
          </div>

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
          <CardTitle className="text-base">客人与出行意向</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="text-sm font-medium">{inquiryTypeLabel(inquiry.type)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{typeOps.summary}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
              {typeOps.replyTips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>

          {highlightRows.length > 0 ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              {highlightRows.map((row) => (
                <div
                  key={`${row.label}-${row.value}`}
                  className={row.label === '留言' ? 'sm:col-span-2' : undefined}
                >
                  <FieldRow label={row.label} value={row.value} />
                </div>
              ))}
            </dl>
          ) : null}

          {uniqueSecondary.length > 0 ? (
            <dl className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
              {uniqueSecondary.map((row) => (
                <div
                  key={`${row.label}-${row.value}`}
                  className={row.label === '留言' ? 'sm:col-span-2' : undefined}
                >
                  <FieldRow label={row.label} value={row.value} />
                </div>
              ))}
            </dl>
          ) : null}

          {preferenceRows.length > 0 ? (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-sm font-medium">表单偏好</p>
              <dl className="grid gap-3 sm:grid-cols-2">
                {preferenceRows.map((row) => (
                  <FieldRow key={row.key} label={row.label} value={row.value} />
                ))}
              </dl>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <details className="rounded-lg border border-border bg-card">
        <summary className="cursor-pointer px-6 py-4 text-sm font-medium">技术信息</summary>
        <div className="space-y-3 border-t border-border px-6 py-4 text-sm">
          <FieldRow label="询盘 ID" value={inquiry.id} />
          {formatInquiryScalar(inquiry.source_path) ? (
            <FieldRow label="来源路径" value={String(inquiry.source_path)} />
          ) : null}
          {formatInquiryScalar(inquiry.user_agent) ? (
            <FieldRow label="User agent" value={String(inquiry.user_agent)} />
          ) : null}
          {formatInquiryScalar(inquiry.email_status) ? (
            <FieldRow label="邮件状态" value={String(inquiry.email_status)} />
          ) : null}
          <FieldRow label="提交时间" value={formatInquiryDateTime(inquiry.created_at)} />
          <FieldRow label="更新时间" value={formatInquiryDateTime(inquiry.updated_at)} />
          {inquiry.custom_preferences != null ? (
            <div>
              <p className="text-muted-foreground">原始偏好 JSON</p>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs">
                {JSON.stringify(inquiry.custom_preferences, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}
