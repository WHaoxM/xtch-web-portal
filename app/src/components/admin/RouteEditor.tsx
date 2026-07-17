import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ImageFieldPicker } from '@/components/admin/ImageFieldPicker';
import { RouteMobilePreview } from '@/components/admin/RouteMobilePreview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Category } from '@/lib/categoriesClient';
import type { Destination } from '@/lib/destinationsClient';
import { postAdminRoute } from '@/lib/routesClient';
import {
  applyPrimaryTypeDefaults,
  buildRouteSavePayload,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUSES,
  deriveCategoryFromThemes,
  detectGuestCopyCjk,
  emptyItineraryDayDraft,
  hasGuestCopyCjk,
  ROUTE_PRICE_MODE_LABELS,
  ROUTE_PRICE_MODES,
  ROUTE_PRIMARY_TYPE_LABELS,
  ROUTE_PRIMARY_TYPES,
  validateQuickFields,
  type ItineraryDayDraft,
  type RouteEditDraft,
} from '@/lib/routeDraft';
import { SLUG_PATTERN, slugify, slugifyOrFallback } from '@/lib/slugify';

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

type RouteEditorProps = {
  token: string;
  initialDraft: RouteEditDraft;
  isCreate: boolean;
  categories: Category[];
  destinations: Destination[];
  onCancel: () => void;
  onSaved: (message: string) => void;
};

export function RouteEditor({
  token,
  initialDraft,
  isCreate,
  categories,
  destinations,
  onCancel,
  onSaved,
}: RouteEditorProps) {
  const [draft, setDraft] = useState<RouteEditDraft>(initialDraft);
  const [editorMode, setEditorMode] = useState<'quick' | 'full'>('quick');
  const [fullTab, setFullTab] = useState('summary');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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

  const destinationNames = useMemo(() => {
    const bySlug = new Map(destinations.map((item) => [item.slug, item.name]));
    return draft.destinationSlugs.map((slug) => bySlug.get(slug) || slug).filter(Boolean);
  }, [destinations, draft.destinationSlugs]);

  const cjkFlags = detectGuestCopyCjk(draft);
  const cjkWarning =
    hasGuestCopyCjk(draft)
      ? `旅客可见文案疑似含中文（${[
          cjkFlags.title ? '标题' : '',
          cjkFlags.subtitle ? '副标题' : '',
          cjkFlags.summary ? '摘要' : '',
        ]
          .filter(Boolean)
          .join('、')}）。存草稿可用；上架前请改为英文客文案。`
      : '';

  function patchDraft(patch: Partial<RouteEditDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function toggleDestination(slug: string, checked: boolean) {
    setDraft((current) => {
      const destinationSlugs = checked
        ? current.destinationSlugs.includes(slug)
          ? current.destinationSlugs
          : [...current.destinationSlugs, slug]
        : current.destinationSlugs.filter((item) => item !== slug);
      return { ...current, destinationSlugs };
    });
  }

  function toggleTheme(key: string, checked: boolean) {
    setDraft((current) => {
      const themes = checked
        ? current.themes.includes(key)
          ? current.themes
          : [...current.themes, key]
        : current.themes.filter((item) => item !== key);
      const category =
        current.categoryManual
          ? current.category
          : deriveCategoryFromThemes(themes, categories);
      return { ...current, themes, category };
    });
  }

  function updateItineraryDay(index: number, patch: Partial<ItineraryDayDraft>) {
    setDraft((current) => ({
      ...current,
      itineraryDays: current.itineraryDays.map((day, i) => (i === index ? { ...day, ...patch } : day)),
    }));
  }

  function addItineraryDay() {
    setDraft((current) => ({
      ...current,
      itineraryDays: [...current.itineraryDays, emptyItineraryDayDraft()],
    }));
  }

  function removeItineraryDay(index: number) {
    setDraft((current) => ({
      ...current,
      itineraryDays: current.itineraryDays.filter((_, i) => i !== index),
    }));
  }

  function moveItineraryDay(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.itineraryDays.length) return current;
      const itineraryDays = [...current.itineraryDays];
      [itineraryDays[index], itineraryDays[target]] = [itineraryDays[target], itineraryDays[index]];
      return { ...current, itineraryDays };
    });
  }

  async function save(status: 'draft' | 'published') {
    setError('');
    setWarning('');
    setFieldErrors({});

    const errors = validateQuickFields(draft, { forPublish: status === 'published', isCreate });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors as Record<string, string>);
      setError(status === 'published' ? '上架前请补全必填项。' : '请先修正标出的字段。');
      return;
    }

    if (status === 'published' && hasGuestCopyCjk(draft)) {
      setError('上架已拦截：标题/副标题/摘要含中文。请改为英文旅客文案后再上架，或先存草稿。');
      setWarning(cjkWarning);
      return;
    }

    if (status === 'draft' && hasGuestCopyCjk(draft)) {
      setWarning(cjkWarning);
    }

    setBusy(true);
    try {
      const payload = buildRouteSavePayload(draft, {
        isCreate,
        status,
        categories,
      });
      if (isCreate && !draft.slug.trim()) {
        patchDraft({ slug: payload.slug });
      }
      await postAdminRoute(token, payload);
      onSaved(status === 'published' ? '路线已上架。' : isCreate ? '草稿已保存。' : '草稿已更新。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存路线失败。');
    } finally {
      setBusy(false);
    }
  }

  const quickFields = (
    <FormSection title="快速填写" description="门面信息会同步到移动端列表卡与详情预览。">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm md:col-span-2">
          <span>标题</span>
          <Input
            value={draft.title}
            onChange={(event) => {
              const title = event.target.value;
              setDraft((current) => {
                const next = { ...current, title };
                if (isCreate && (!current.slug || current.slug === slugify(current.title))) {
                  const nextSlug = slugify(title);
                  if (nextSlug && SLUG_PATTERN.test(nextSlug)) {
                    next.slug = nextSlug;
                  }
                }
                return next;
              });
            }}
          />
          {fieldErrors.title ? <p className="text-xs text-destructive">{fieldErrors.title}</p> : null}
          <FieldHint>公网旅客可见，请用英文。</FieldHint>
        </label>
        <label className="space-y-2 text-sm md:col-span-2">
          <span>副标题</span>
          <Input
            value={draft.subtitle}
            onChange={(event) => patchDraft({ subtitle: event.target.value })}
          />
        </label>
        <label className="space-y-2 text-sm md:col-span-2">
          <span>摘要</span>
          <Textarea
            value={draft.summary}
            onChange={(event) => patchDraft({ summary: event.target.value })}
          />
          {fieldErrors.summary ? <p className="text-xs text-destructive">{fieldErrors.summary}</p> : null}
        </label>
        <label className="space-y-2 text-sm">
          <span>行程天数</span>
          <Input
            type="number"
            min="1"
            value={draft.durationDays}
            onChange={(event) => patchDraft({ durationDays: event.target.value })}
          />
          {fieldErrors.durationDays ? (
            <p className="text-xs text-destructive">{fieldErrors.durationDays}</p>
          ) : null}
        </label>
        <label className="space-y-2 text-sm">
          <span>主产品类型</span>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={draft.primaryType}
            onChange={(event) =>
              setDraft((current) =>
                applyPrimaryTypeDefaults(current, event.target.value as RouteEditDraft['primaryType']),
              )
            }
          >
            {ROUTE_PRIMARY_TYPES.map((value) => (
              <option key={value} value={value}>
                {ROUTE_PRIMARY_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm md:col-span-2">
          <span>价格展示文案</span>
          <Input
            value={draft.priceDisplay}
            onChange={(event) => patchDraft({ priceDisplay: event.target.value })}
          />
          {fieldErrors.priceDisplay ? (
            <p className="text-xs text-destructive">{fieldErrors.priceDisplay}</p>
          ) : null}
        </label>
        <div className="space-y-2 text-sm md:col-span-2">
          <span>主图</span>
          <ImageFieldPicker
            value={draft.heroImage}
            token={token}
            disabled={busy}
            contextRouteSlug={draft.slug.trim() || undefined}
            onChange={(url) => patchDraft({ heroImage: url })}
          />
          {fieldErrors.heroImage ? <p className="text-xs text-destructive">{fieldErrors.heroImage}</p> : null}
        </div>
        <div className="space-y-2 text-sm md:col-span-2">
          <span>关联目的地</span>
          <div className="flex flex-wrap gap-3 rounded-md border border-input p-3">
            {destinations.length === 0 ? (
              <span className="text-muted-foreground">
                暂无目的地。请先到「目的地」模块创建；也可暂不勾选并先存草稿。
              </span>
            ) : (
              destinations.map((destination) => (
                <label key={destination.slug} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.destinationSlugs.includes(destination.slug)}
                    onChange={(event) => toggleDestination(destination.slug, event.target.checked)}
                  />
                  {destination.name}
                  <span className="font-mono text-xs text-muted-foreground">{destination.slug}</span>
                </label>
              ))
            )}
          </div>
          {fieldErrors.destinationSlugs ? (
            <p className="text-xs text-destructive">{fieldErrors.destinationSlugs}</p>
          ) : (
            <FieldHint>上架前建议至少勾选一个；存草稿可不勾选。</FieldHint>
          )}
        </div>
        <div className="space-y-2 text-sm md:col-span-2">
          <span>主题 / 分类（可选）</span>
          <div className="flex flex-wrap gap-3 rounded-md border border-input p-3">
            {categories.length === 0 ? (
              <span className="text-muted-foreground">暂无路线分类。可到「分类」模块创建。</span>
            ) : (
              categories.map((category) => (
                <label key={category.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.themes.includes(category.key)}
                    onChange={(event) => toggleTheme(category.key, event.target.checked)}
                  />
                  {category.label}
                </label>
              ))
            )}
          </div>
          <FieldHint>
            分类文案默认取首个已选主题：{draft.category || '（未设置）'}
          </FieldHint>
        </div>
      </div>
    </FormSection>
  );

  const fullEditor = (
    <Tabs value={fullTab} onValueChange={setFullTab}>
      <TabsList className="flex h-auto flex-wrap">
        <TabsTrigger value="summary">概要</TabsTrigger>
        <TabsTrigger value="display">展示与筛选</TabsTrigger>
        <TabsTrigger value="copy">详情文案</TabsTrigger>
        <TabsTrigger value="itinerary">逐日行程</TabsTrigger>
        <TabsTrigger value="advanced">高级</TabsTrigger>
      </TabsList>

      <TabsContent value="summary" className="space-y-4 pt-4">
        {quickFields}
        <FormSection title="团型展示" description="详情统计行 format 文案。">
          <label className="space-y-2 text-sm">
            <span>团型展示文案</span>
            <Input
              value={draft.groupSizeDisplay}
              onChange={(event) => patchDraft({ groupSizeDisplay: event.target.value })}
            />
          </label>
        </FormSection>
      </TabsContent>

      <TabsContent value="display" className="space-y-4 pt-4">
        <FormSection title="展示与筛选">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span>分类文案</span>
              <Input
                value={draft.category}
                onChange={(event) =>
                  patchDraft({ category: event.target.value, categoryManual: true })
                }
              />
              <FieldHint>勾选主题时默认自动写入；此处修改后不再自动覆盖。</FieldHint>
            </label>
            <label className="flex items-start gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={draft.featured}
                onChange={(event) => patchDraft({ featured: event.target.checked })}
              />
              <span>
                推荐路线
                <FieldHint>勾选后进入 China Trips / 移动端推荐位。</FieldHint>
              </span>
            </label>
            <label className="space-y-2 text-sm">
              <span>发布状态（完整编辑）</span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.status}
                onChange={(event) =>
                  patchDraft({ status: event.target.value as RouteEditDraft['status'] })
                }
              >
                {CONTENT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {CONTENT_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
              <FieldHint>日常请用下方「存草稿 / 上架」按钮；此处供高级调整。</FieldHint>
            </label>
          </div>
        </FormSection>
      </TabsContent>

      <TabsContent value="copy" className="space-y-4 pt-4">
        <FormSection title="详情页内容" description="每行一条；请用英文旅客文案。">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2 text-sm">
              <span>体验亮点</span>
              <Textarea
                rows={4}
                value={draft.experienceText}
                onChange={(event) => patchDraft({ experienceText: event.target.value })}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>招牌时刻</span>
              <Textarea
                rows={4}
                value={draft.momentsText}
                onChange={(event) => patchDraft({ momentsText: event.target.value })}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>含括支持</span>
              <Textarea
                rows={4}
                value={draft.includedSupportText}
                onChange={(event) => patchDraft({ includedSupportText: event.target.value })}
              />
            </label>
          </div>
        </FormSection>
      </TabsContent>

      <TabsContent value="itinerary" className="space-y-4 pt-4">
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
            {draft.itineraryDays.map((day, index) => (
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
                      disabled={index === draft.itineraryDays.length - 1}
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
                    <span>标题（可选）</span>
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
                    <span>景点（每行一个）</span>
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
                      onChange={(event) =>
                        updateItineraryDay(index, { accommodation: event.target.value })
                      }
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
                  </label>
                  <label className="space-y-2 text-sm md:col-span-2">
                    <span>补充说明（每行一条，可选）</span>
                    <Textarea
                      rows={2}
                      value={day.notesText}
                      onChange={(event) => updateItineraryDay(index, { notesText: event.target.value })}
                    />
                  </label>
                </div>
              </div>
            ))}
            {draft.itineraryDays.length === 0 ? (
              <p className="text-sm text-muted-foreground">尚无结构化日程。</p>
            ) : null}
          </div>
        </FormSection>
      </TabsContent>

      <TabsContent value="advanced" className="space-y-4 pt-4">
        <FormSection title="高级" description="标识、价格模式与兼容字段。">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span>标识（slug）</span>
              <Input
                value={draft.slug}
                disabled={!isCreate}
                placeholder={isCreate ? slugifyOrFallback(draft.title || 'untitled') : undefined}
                onChange={(event) => patchDraft({ slug: event.target.value })}
              />
              <FieldHint>仅新建可改；创建后不可改。中文标题常会生成 route-日期-短码。</FieldHint>
              {fieldErrors.slug ? <p className="text-xs text-destructive">{fieldErrors.slug}</p> : null}
            </label>
            <label className="space-y-2 text-sm">
              <span>旧版数字 ID（可选）</span>
              <Input
                type="number"
                value={draft.legacyNumericId}
                onChange={(event) => patchDraft({ legacyNumericId: event.target.value })}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>价格模式</span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.priceMode}
                onChange={(event) =>
                  patchDraft({ priceMode: event.target.value as RouteEditDraft['priceMode'] })
                }
              >
                {ROUTE_PRICE_MODES.map((value) => (
                  <option key={value} value={value}>
                    {ROUTE_PRICE_MODE_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>PDF URL（可选）</span>
              <Input
                value={draft.pdfUrl}
                onChange={(event) => patchDraft({ pdfUrl: event.target.value })}
              />
            </label>
            <p className="text-xs text-muted-foreground md:col-span-2">
              可选产品类型已固定为当前主产品类型（{ROUTE_PRIMARY_TYPE_LABELS[draft.primaryType]}），不再手填
              CSV。
            </p>
          </div>
        </FormSection>
      </TabsContent>
    </Tabs>
  );

  const actions = (
    <div className="flex flex-wrap gap-2 border-t pt-4">
      <Button onClick={() => void save('draft')} disabled={busy}>
        {busy ? '保存中…' : '存草稿'}
      </Button>
      <Button variant="secondary" onClick={() => void save('published')} disabled={busy}>
        上架
      </Button>
      <Button variant="outline" disabled={busy} onClick={onCancel}>
        取消
      </Button>
    </div>
  );

  return (
    <div className={widePreview ? 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]' : 'space-y-4'}>
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{isCreate ? '新建路线' : `编辑：${draft.slug || draft.title}`}</CardTitle>
            <div className="inline-flex h-9 items-center rounded-lg bg-muted p-[3px] text-muted-foreground">
              <button
                type="button"
                className={
                  editorMode === 'quick'
                    ? 'rounded-md bg-background px-3 py-1 text-sm font-medium text-foreground shadow-sm'
                    : 'rounded-md px-3 py-1 text-sm font-medium'
                }
                onClick={() => setEditorMode('quick')}
              >
                快速模式
              </button>
              <button
                type="button"
                className={
                  editorMode === 'full'
                    ? 'rounded-md bg-background px-3 py-1 text-sm font-medium text-foreground shadow-sm'
                    : 'rounded-md px-3 py-1 text-sm font-medium'
                }
                onClick={() => setEditorMode('full')}
              >
                完整编辑
              </button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            默认快速模式即可完成门面；需要逐日行程或高级字段时再切完整编辑。旅客可见文案请用英文。
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="text-destructive">{error}</p> : null}
          {warning ? <p className="text-sm text-amber-700">{warning}</p> : null}
          {editorMode === 'quick' ? quickFields : fullEditor}
          {actions}
          {!widePreview ? (
            <RouteMobilePreview
              draft={draft}
              categories={categories}
              destinationNames={destinationNames}
              embedded={false}
            />
          ) : null}
        </CardContent>
      </Card>

      {widePreview ? (
        <RouteMobilePreview
          draft={draft}
          categories={categories}
          destinationNames={destinationNames}
          embedded
        />
      ) : null}
    </div>
  );
}
