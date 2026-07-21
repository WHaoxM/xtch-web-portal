import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { endDateFromDuration, inclusiveDayCount } from '@/lib/dateOnly';
import {
  destinationName,
  type DepartureEditDraft,
} from '@/lib/departureDraft';
import type { Destination } from '@/lib/destinationsClient';
import {
  canResellDeparture,
  canRunDangerAction,
  DEPARTURE_STATUS_VALUES,
  departureActionConfirm,
  departureActionLabel,
  departureStatusLabel,
  travelerBuyConclusion,
  type DepartureDangerAction,
} from '@/lib/departureOpsCopy';
import type { RouteRecord } from '@/lib/routesClient';

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

type DepartureEditorProps = {
  token: string;
  initialDraft: DepartureEditDraft;
  isCreate: boolean;
  routes: RouteRecord[];
  destinations: Destination[];
  refillChains: Array<{ key: string; routeSlug: string }>;
  /** Known available seats when editing; create uses capacity. */
  availableSeats?: number;
  onCancel: () => void;
  onSaved: (message: string) => void;
};

export function DepartureEditor({
  token,
  initialDraft,
  isCreate,
  routes,
  destinations,
  refillChains,
  availableSeats,
  onCancel,
  onSaved,
}: DepartureEditorProps) {
  const [draft, setDraft] = useState<DepartureEditDraft>(initialDraft);
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState<DepartureDangerAction | null>(null);
  const lastAutoEndDateRef = useRef(
    (() => {
      const route = routes.find((item) => item.slug === initialDraft.routeSlug);
      const suggested =
        initialDraft.startDate && route?.durationDays
          ? endDateFromDuration(initialDraft.startDate, route.durationDays)
          : '';
      return suggested && initialDraft.endDate === suggested ? suggested : '';
    })(),
  );

  const selectedRoute = routes.find((route) => route.slug === draft.routeSlug);
  const destinationOptions = selectedRoute?.destinationSlugs ?? [];
  const seatsForConclusion =
    availableSeats ?? (Number(draft.capacity) > 0 ? Number(draft.capacity) : 0);
  const buyConclusion = travelerBuyConclusion(draft.status, seatsForConclusion);
  const tripDayCount =
    draft.startDate && draft.endDate
      ? inclusiveDayCount(draft.startDate, draft.endDate)
      : null;
  const durationMismatch =
    Boolean(selectedRoute?.durationDays) &&
    tripDayCount != null &&
    tripDayCount !== selectedRoute!.durationDays;

  function applyRouteSelection(slug: string) {
    const route = routes.find((item) => item.slug === slug);
    const destSlug = route?.destinationSlugs[0] ?? '';
    setDraft((current) => {
      const next = {
        ...current,
        routeSlug: slug,
        routeTitle: route?.title ?? current.routeTitle,
        destinationSlug: destSlug,
        departureCity:
          current.departureCity.trim() ||
          (destSlug ? destinationName(destinations, destSlug) : ''),
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
    setDraft((current) => {
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

  function validateForSave(nextStatus: string): string | null {
    if (!draft.routeSlug) return '请选择路线。';
    if (!draft.startDate || !draft.endDate) return '请填写开始与结束日期。';
    const priceUsd = Number(draft.adultUnitPriceUsd);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) return '成人单价须为正数（美元）。';
    const capacity = Number(draft.capacity);
    if (!Number.isFinite(capacity) || capacity < 1) return '容量须至少为 1。';
    if (!draft.departureCity.trim() && !draft.destinationSlug) return '请填写出发城市。';
    if (draft.refillChainKey.trim()) {
      const sequence = Number(draft.refillSequence);
      const maxActivations = Number(draft.refillMaxAutoActivations);
      if (!Number.isInteger(sequence) || sequence < 1) return '补团顺序须为正整数。';
      if (!Number.isInteger(maxActivations) || maxActivations < 1) {
        return '最多自动激活数须为正整数。';
      }
      if (sequence > 1 && nextStatus !== 'draft' && draft.status !== 'sellable') {
        return '后续班期须先存为草稿，不能手动上架。';
      }
    }
    return null;
  }

  async function saveWithStatus(nextStatus: string, successMessage: string) {
    const validationError = validateForSave(nextStatus);
    if (validationError) {
      setError(validationError);
      return;
    }

    const priceUsd = Number(draft.adultUnitPriceUsd);

    setBusy(true);
    setError('');
    const payload = {
      action: isCreate ? 'create' : 'update',
      publicId: draft.publicId || undefined,
      routeSlug: draft.routeSlug,
      routeTitle: draft.routeTitle,
      destinationSlug: draft.destinationSlug || undefined,
      departureCity: draft.departureCity.trim() || destinationName(destinations, draft.destinationSlug),
      startDate: draft.startDate,
      endDate: draft.endDate,
      status: nextStatus,
      guaranteed: draft.guaranteed,
      adultUnitPriceCents: Math.round(priceUsd * 100),
      capacity: Number(draft.capacity) || 8,
      featuredOnHome: draft.featuredOnHome,
      featuredPriority: Number(draft.featuredPriority) || 0,
      refillChainKey: draft.refillChainKey.trim() || undefined,
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
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setError(result.error || `HTTP ${response.status}`);
        return;
      }
      onSaved(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存班期失败。');
    } finally {
      setBusy(false);
    }
  }

  async function runDangerAction(action: DepartureDangerAction) {
    if (!draft.publicId) return;
    setBusy(true);
    setError('');
    setPendingAction(null);
    try {
      const response = await fetch(
        `/api/admin/departures?publicId=${encodeURIComponent(draft.publicId)}&action=${action}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setError(result.error || `HTTP ${response.status}`);
        return;
      }
      onSaved(`班期已${departureActionLabel(action)}。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败。');
    } finally {
      setBusy(false);
    }
  }

  const confirmCopy = pendingAction ? departureActionConfirm(pendingAction) : null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{isCreate ? '快速开班' : `编辑班期`}</CardTitle>
          {!isCreate && draft.publicId ? (
            <p className="text-xs font-mono text-muted-foreground">{draft.publicId}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {error && <p className="text-destructive">{error}</p>}

          <div
            className={`rounded-md border px-4 py-3 text-sm ${
              buyConclusion.canBuy
                ? 'border-green-200 bg-green-50 text-green-900'
                : 'border-amber-200 bg-amber-50 text-amber-950'
            }`}
            role="status"
          >
            <p className="font-medium">旅客现在：{buyConclusion.label}</p>
            <p className="mt-0.5 text-xs opacity-90">{buyConclusion.detail}</p>
          </div>

          <FormSection title="开班信息" description="路线、日期、价格与容量即可开班。">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm md:col-span-2">
                <span>路线</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={draft.routeSlug}
                  onChange={(event) => applyRouteSelection(event.target.value)}
                >
                  {routes.map((route) => (
                    <option key={route.slug} value={route.slug}>
                      {route.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span>目的地</span>
                {destinationOptions.length > 0 ? (
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={draft.destinationSlug}
                    onChange={(event) => {
                      const slug = event.target.value;
                      setDraft((current) => ({
                        ...current,
                        destinationSlug: slug,
                        departureCity:
                          current.departureCity.trim() ||
                          destinationName(destinations, slug),
                      }));
                    }}
                  >
                    {destinationOptions.map((slug) => (
                      <option key={slug} value={slug}>
                        {destinationName(destinations, slug)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={draft.destinationSlug}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        destinationSlug: event.target.value,
                      }))
                    }
                    placeholder="目的地"
                  />
                )}
                <FieldHint>随路线带出；存的是内部标识，界面显示名称。</FieldHint>
              </label>
              <label className="space-y-2 text-sm">
                <span>出发城市</span>
                <Input
                  value={draft.departureCity}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      departureCity: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-2 text-sm">
                <span>开始日期</span>
                <Input
                  type="date"
                  value={draft.startDate}
                  onChange={(event) => applyStartDate(event.target.value)}
                />
              </label>
              <label className="space-y-2 text-sm">
                <span>结束日期</span>
                <Input
                  type="date"
                  value={draft.endDate}
                  onChange={(event) => {
                    lastAutoEndDateRef.current = '';
                    setDraft((current) => ({ ...current, endDate: event.target.value }));
                  }}
                />
                <FieldHint>
                  默认按路线天数推算（开始日 + {selectedRoute?.durationDays ?? 'N'} − 1）。可改。
                </FieldHint>
              </label>
              {durationMismatch && (
                <p className="text-sm text-amber-700 md:col-span-2" role="status">
                  与路线 {selectedRoute?.durationDays} 天不一致（当前 {tripDayCount}{' '}
                  天），确认后仍可保存。
                </p>
              )}
              <label className="space-y-2 text-sm">
                <span>成人单价（美元）</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.adultUnitPriceUsd}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      adultUnitPriceUsd: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-2 text-sm">
                <span>容量（总名额）</span>
                <Input
                  type="number"
                  min="1"
                  value={draft.capacity}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, capacity: event.target.value }))
                  }
                />
              </label>
              <label className="flex items-start gap-2 text-sm md:col-span-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={draft.guaranteed}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      guaranteed: event.target.checked,
                    }))
                  }
                />
                <span>
                  对外宣传：保证发团
                  <FieldHint>
                    仅影响对外文案，与「能否购买 / 班期状态」无关。
                  </FieldHint>
                </span>
              </label>
            </div>
          </FormSection>

          <FormSection title="售卖动作" description="用任务按钮改状态；售罄由库存自动体现，勿手选为主。">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void saveWithStatus('draft', isCreate ? '已存为草稿。' : '已存为草稿。')}
              >
                {busy ? '处理中…' : '存草稿'}
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void saveWithStatus('sellable', isCreate ? '已上架可售。' : '已保存并上架可售。')
                }
              >
                {busy ? '处理中…' : '保存并上架可售'}
              </Button>
              {!isCreate && canResellDeparture(draft.status) && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void saveWithStatus('sellable', '已重新上架可售。')}
                >
                  重新上架可售
                </Button>
              )}
              {!isCreate &&
                canRunDangerAction(draft.status) &&
                (['lock', 'close', 'cancel'] as const).map((action) => (
                  <Button
                    key={action}
                    variant="outline"
                    disabled={busy}
                    onClick={() => setPendingAction(action)}
                  >
                    {departureActionLabel(action)}
                  </Button>
                ))}
            </div>
            <FieldHint>
              当前状态：{departureStatusLabel(draft.status)}
              {!isCreate && draft.status === 'sold_out'
                ? '（售罄为库存结果，一般不必手改）'
                : ''}
            </FieldHint>
          </FormSection>

          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-0 text-muted-foreground"
              onClick={() => setShowMore((value) => !value)}
            >
              {showMore ? '收起更多设置' : '更多设置'}
            </Button>
          </div>

          {showMore && (
            <>
              <FormSection
                title="满团自动补团"
                description="把同一路线的完整草稿班期排成显式链；只有已确认订单坐满当前班期才激活下一期。"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm md:col-span-2">
                    <span>补团链标识</span>
                    <Input
                      list="departure-refill-chain-options"
                      value={draft.refillChainKey}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          refillChainKey: event.target.value,
                          refillEnabled: event.target.value.trim()
                            ? current.refillEnabled
                            : false,
                        }))
                      }
                      placeholder="例如 beijing-summer-2026"
                    />
                    <datalist id="departure-refill-chain-options">
                      {refillChains
                        .filter((chain) => chain.routeSlug === draft.routeSlug)
                        .map((chain) => (
                          <option key={chain.key} value={chain.key} />
                        ))}
                    </datalist>
                    <FieldHint>同一路线各班期填写同一标识；清空即退出该链。</FieldHint>
                  </label>
                  <label className="space-y-2 text-sm">
                    <span>链内顺序</span>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={draft.refillSequence}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          refillSequence: event.target.value,
                        }))
                      }
                      disabled={!draft.refillChainKey.trim()}
                    />
                    <FieldHint>当前在售期通常为 1，后续预建草稿依次为 2、3…</FieldHint>
                  </label>
                  <label className="space-y-2 text-sm">
                    <span>最多自动激活期数</span>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={draft.refillMaxAutoActivations}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          refillMaxAutoActivations: event.target.value,
                        }))
                      }
                      disabled={!draft.refillChainKey.trim()}
                    />
                  </label>
                  <label className="flex items-start gap-2 text-sm md:col-span-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={draft.refillEnabled}
                      disabled={!draft.refillChainKey.trim()}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          refillEnabled: event.target.checked,
                        }))
                      }
                    />
                    <span>
                      启用这条补团链
                      <FieldHint>
                        先保存至少两个完整班期，再启用。新激活班期继承满团班期的首页推荐开关与优先级；退款不会撤销已激活班期。
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
                      checked={draft.featuredOnHome}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          featuredOnHome: event.target.checked,
                        }))
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
                      value={draft.featuredPriority}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          featuredPriority: event.target.value,
                        }))
                      }
                    />
                    <FieldHint>数字越小越靠前。</FieldHint>
                  </label>
                </div>
              </FormSection>

              <FormSection
                title="旅客可见说明"
                description="展示在班期/下单相关页的英文文案（内容值仍英文）。"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm md:col-span-2">
                    <span>确认规则</span>
                    <Textarea
                      value={draft.confirmationRule}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          confirmationRule: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span>费用包含（每行一条）</span>
                    <Textarea
                      rows={5}
                      value={draft.includedText}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          includedText: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span>费用不含（每行一条）</span>
                    <Textarea
                      rows={5}
                      value={draft.excludedText}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          excludedText: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-2 text-sm md:col-span-2">
                    <span>重要提示（每行一条）</span>
                    <Textarea
                      rows={3}
                      value={draft.notesText}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          notesText: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              </FormSection>

              <FormSection
                title="高级状态"
                description="极少手改；售罄优先看库存。主路径请用上方任务按钮。"
              >
                <label className="space-y-2 text-sm max-w-sm">
                  <span>班期状态（高级）</span>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={draft.status}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, status: event.target.value }))
                    }
                  >
                    {DEPARTURE_STATUS_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {departureStatusLabel(value)}
                      </option>
                    ))}
                  </select>
                  <FieldHint>
                    「存草稿 / 上架」会覆盖此处选择。确需手改时点下方按钮写入。
                  </FieldHint>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void saveWithStatus(draft.status, `已保存为「${departureStatusLabel(draft.status)}」。`)
                  }
                >
                  按高级状态保存
                </Button>
              </FormSection>
            </>
          )}

          <div className="flex gap-2 border-t pt-4">
            <Button variant="outline" disabled={busy} onClick={onCancel}>
              返回列表
            </Button>
          </div>
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
            <AlertDialogCancel disabled={busy}>再想想</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || !pendingAction}
              onClick={(event) => {
                event.preventDefault();
                if (pendingAction) void runDangerAction(pendingAction);
              }}
            >
              确认{pendingAction ? departureActionLabel(pendingAction) : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
