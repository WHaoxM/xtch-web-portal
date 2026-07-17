import { useEffect, useState, type ReactNode } from 'react';
import { DestinationMobilePreview } from '@/components/admin/DestinationMobilePreview';
import { ImageFieldPicker } from '@/components/admin/ImageFieldPicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Category } from '@/lib/categoriesClient';
import {
  buildDestinationSavePayload,
  detectDestinationGuestCopyCjk,
  hasDestinationGuestCopyCjk,
  validateDestinationQuickFields,
  type DestinationEditDraft,
} from '@/lib/destinationDraft';
import { postAdminDestination } from '@/lib/destinationsClient';
import { slugify, slugifyOrFallback } from '@/lib/slugify';

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

type DestinationEditorProps = {
  token: string;
  initialDraft: DestinationEditDraft;
  isCreate: boolean;
  categories: Category[];
  onCancel: () => void;
  onSaved: (message: string) => void;
};

export function DestinationEditor({
  token,
  initialDraft,
  isCreate,
  categories,
  onCancel,
  onSaved,
}: DestinationEditorProps) {
  const [draft, setDraft] = useState<DestinationEditDraft>(initialDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [homeOpen, setHomeOpen] = useState(
    () => initialDraft.featuredOnHome || Number(initialDraft.featuredPriority) > 0,
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [widePreview, setWidePreview] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1100px)').matches : true,
  );
  const [slugTouched, setSlugTouched] = useState(() => Boolean(initialDraft.slug.trim()));

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1100px)');
    const onChange = () => setWidePreview(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const cjkFlags = detectDestinationGuestCopyCjk(draft);
  const cjkWarning = hasDestinationGuestCopyCjk(draft)
    ? `旅客可见文案疑似含中文（${[cjkFlags.name ? '名称' : '', cjkFlags.description ? '简介' : '']
        .filter(Boolean)
        .join('、')}）。存草稿可用；上架前请改为英文客文案。`
    : '';

  const previewSlug =
    draft.slug.trim() || (draft.name.trim() ? slugify(draft.name) || 'dest-…' : '（自动生成）');

  function patchDraft(patch: Partial<DestinationEditDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function onNameChange(name: string) {
    setDraft((current) => {
      if (!isCreate || slugTouched) {
        return { ...current, name };
      }
      const nextSlug = slugify(name);
      return { ...current, name, slug: nextSlug };
    });
  }

  async function save(status: 'draft' | 'published') {
    setError('');
    setWarning('');
    setFieldErrors({});

    const errors = validateDestinationQuickFields(draft, {
      forPublish: status === 'published',
      isCreate,
    });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors as Record<string, string>);
      setError(status === 'published' ? '上架前请补全必填项。' : '请先修正标出的字段。');
      if (errors.slug) setAdvancedOpen(true);
      return;
    }

    if (status === 'published' && hasDestinationGuestCopyCjk(draft)) {
      setError('上架已拦截：名称/简介含中文。请改为英文旅客文案后再上架，或先存草稿。');
      setWarning(cjkWarning);
      return;
    }

    if (status === 'draft' && hasDestinationGuestCopyCjk(draft)) {
      setWarning(cjkWarning);
    }

    setBusy(true);
    try {
      const payload = buildDestinationSavePayload(draft, { isCreate, status });
      if (isCreate && !draft.slug.trim()) {
        payload.slug = slugifyOrFallback(draft.name, new Date(), 'dest');
      }
      await postAdminDestination(token, payload);
      onSaved(status === 'published' ? '目的地已上架。' : isCreate ? '草稿已保存。' : '草稿已更新。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存目的地失败。');
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle>{isCreate ? '新建目的地' : `编辑：${draft.slug || draft.name}`}</CardTitle>
        <p className="text-sm text-muted-foreground">
          快速填写门面即可存草稿或上架。旅客可见文案请用英文。列表顺序与首页推荐优先级分开设置。
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-destructive">{error}</p> : null}
        {warning ? <p className="text-sm text-amber-700">{warning}</p> : null}

        <FormSection title="快速填写" description="名称、简介、主图与列表顺序会同步到卡片预览。">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm md:col-span-2">
              <span>名称</span>
              <Input
                value={draft.name}
                placeholder="例如 Beijing"
                onChange={(event) => onNameChange(event.target.value)}
              />
              {fieldErrors.name ? <p className="text-xs text-destructive">{fieldErrors.name}</p> : null}
              {isCreate ? (
                <FieldHint>标识（slug）将自动生成：{previewSlug}</FieldHint>
              ) : (
                <FieldHint>标识：{draft.slug}（创建后不可改）</FieldHint>
              )}
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>简介</span>
              <Textarea
                value={draft.description}
                rows={4}
                onChange={(event) => patchDraft({ description: event.target.value })}
              />
              {fieldErrors.description ? (
                <p className="text-xs text-destructive">{fieldErrors.description}</p>
              ) : null}
            </label>
            <div className="space-y-2 text-sm md:col-span-2">
              <span>主图</span>
              <ImageFieldPicker
                value={draft.image}
                token={token}
                disabled={busy}
                contextDestinationSlug={draft.slug.trim() || undefined}
                onChange={(url) => patchDraft({ image: url })}
              />
              {fieldErrors.image ? <p className="text-xs text-destructive">{fieldErrors.image}</p> : null}
            </div>
            <label className="space-y-2 text-sm">
              <span>列表顺序</span>
              <Input
                type="number"
                value={draft.displayOrder}
                onChange={(event) => patchDraft({ displayOrder: event.target.value })}
              />
              <FieldHint>目的地列表等处的默认排序；数字越小越靠前。</FieldHint>
            </label>
            <div className="space-y-2 text-sm md:col-span-2">
              <span>旅行风格</span>
              <div className="flex flex-wrap gap-3 rounded-md border border-input p-3">
                {categories.length === 0 ? (
                  <span className="text-muted-foreground">
                    暂无目的地分类。请先到「分类」模块创建；也可暂不勾选并先存草稿。
                  </span>
                ) : (
                  categories.map((category) => (
                    <label key={category.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={draft.travelStyles.includes(category.key)}
                        onChange={(event) => {
                          const travelStyles = event.target.checked
                            ? [...draft.travelStyles, category.key]
                            : draft.travelStyles.filter((key) => key !== category.key);
                          patchDraft({ travelStyles });
                        }}
                      />
                      {category.label}
                    </label>
                  ))
                )}
              </div>
              <FieldHint>决定旅客按风格筛选时能否找到此目的地；空分类不阻草稿保存。</FieldHint>
            </div>
          </div>
        </FormSection>

        <div className="border-t pt-4">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left text-sm font-semibold"
            onClick={() => setHomeOpen((open) => !open)}
          >
            <span>首页推荐</span>
            <span className="text-muted-foreground">{homeOpen ? '收起' : '展开'}</span>
          </button>
          {homeOpen ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="flex items-start gap-2 text-sm md:col-span-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={draft.featuredOnHome}
                  onChange={(event) => patchDraft({ featuredOnHome: event.target.checked })}
                />
                <span>
                  推荐到首页热门
                  <FieldHint>
                    需「已发布」才会出现在首页热门；草稿即使勾选也不会对旅客可见。推荐优先级与上方列表顺序是两套规则。
                  </FieldHint>
                </span>
              </label>
              <label className="space-y-2 text-sm">
                <span>推荐优先级</span>
                <Input
                  type="number"
                  min="0"
                  value={draft.featuredPriority}
                  onChange={(event) => patchDraft({ featuredPriority: event.target.value })}
                />
                <FieldHint>仅作用于首页推荐列表；数字越小越靠前。</FieldHint>
              </label>
            </div>
          ) : null}
        </div>

        <div className="border-t pt-4">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left text-sm font-semibold"
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            <span>高级</span>
            <span className="text-muted-foreground">{advancedOpen ? '收起' : '展开'}</span>
          </button>
          {advancedOpen ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {isCreate ? (
                <label className="space-y-2 text-sm">
                  <span>标识（slug）</span>
                  <Input
                    value={draft.slug}
                    placeholder="留空则按名称自动生成"
                    onChange={(event) => {
                      setSlugTouched(true);
                      patchDraft({ slug: event.target.value });
                    }}
                  />
                  {fieldErrors.slug ? (
                    <p className="text-xs text-destructive">{fieldErrors.slug}</p>
                  ) : (
                    <FieldHint>公网 URL 与关联用的唯一标识；创建后不可改。日常可留空自动生成。</FieldHint>
                  )}
                </label>
              ) : (
                <p className="text-sm text-muted-foreground md:col-span-2">
                  标识（slug）：<span className="font-mono text-xs">{draft.slug}</span>（不可改）
                </p>
              )}
            </div>
          ) : null}
        </div>

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

        {!widePreview ? (
          <DestinationMobilePreview token={token} draft={draft} embedded={false} />
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <div className={widePreview ? 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]' : 'space-y-4'}>
      {form}
      {widePreview ? <DestinationMobilePreview token={token} draft={draft} embedded /> : null}
    </div>
  );
}
