import { useEffect, useMemo, useState } from 'react';
import {
  CustomTripPreferenceSections,
  PreferenceFieldControl,
} from '@/components/CustomTripPreferenceFields';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  preferenceFieldsByGroup,
  preferenceFieldsForRoutePrivate,
  type CustomPreferences,
  type CustomTripFormField,
} from '@/lib/customTripFormClient';
import { previewDefaultsFromFields } from '@/lib/formFieldDraft';
import '@/components/chinaTripsMobile.css';

export type FormPreviewMode = 'full' | 'routePrivate';

type FormConfigMobilePreviewProps = {
  fields: CustomTripFormField[];
  /** Highlight that preview includes unsaved draft merges. */
  unsaved?: boolean;
  /** Prefer short form when the edited field is marked for route private. */
  defaultMode?: FormPreviewMode;
  embedded?: boolean;
};

function PreviewPhone({
  fields,
  unsaved,
  defaultMode = 'full',
}: {
  fields: CustomTripFormField[];
  unsaved?: boolean;
  defaultMode?: FormPreviewMode;
}) {
  const [mode, setMode] = useState<FormPreviewMode>(defaultMode);
  const [moreOpen, setMoreOpen] = useState(true);
  const [values, setValues] = useState<CustomPreferences>(() => previewDefaultsFromFields(fields));

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  useEffect(() => {
    setValues(previewDefaultsFromFields(fields));
  }, [fields]);

  const basicFields = useMemo(() => preferenceFieldsByGroup(fields, 'basic'), [fields]);
  const moreFields = useMemo(() => preferenceFieldsByGroup(fields, 'more'), [fields]);
  const routePrivateFields = useMemo(() => preferenceFieldsForRoutePrivate(fields), [fields]);

  function onChange(fieldKey: string, value: unknown) {
    setValues((current) => ({ ...current, [fieldKey]: value }));
  }

  return (
    <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[1.75rem] border border-border bg-[#f5f2ec] shadow-sm">
      <div className="flex items-center justify-center gap-2 border-b border-border/60 bg-background px-3 py-2 text-center text-xs text-muted-foreground">
        <span>旅客偏好预览 · 390px</span>
        {unsaved ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
            未保存预览
          </span>
        ) : null}
      </div>
      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as FormPreviewMode)}
        className="gap-0"
      >
        <div className="flex justify-center border-b border-border/60 bg-background px-2 py-2">
          <TabsList>
            <TabsTrigger value="full">完整定制</TabsTrigger>
            <TabsTrigger value="routePrivate">路线私人</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="full" className="m-0 max-h-[70vh] overflow-y-auto p-3">
          <div className="admin-mobile-preview-shell">
            <div className="iosapp-page" style={{ display: 'block' }}>
              <div className="iosapp-screen">
                <header className="mb-3 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#88929C]">
                    Preferences only
                  </p>
                  <h3 className="text-[17px] font-bold text-[#122332]">Custom trip preferences</h3>
                </header>
                {basicFields.length === 0 && moreFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无已启用的完整定制字段。</p>
                ) : (
                  <CustomTripPreferenceSections
                    basicFields={basicFields}
                    moreFields={moreFields}
                    values={values}
                    errors={{}}
                    moreOpen={moreOpen}
                    onMoreOpenChange={setMoreOpen}
                    variant="mobile"
                    onChange={onChange}
                  />
                )}
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="routePrivate" className="m-0 max-h-[70vh] overflow-y-auto p-3">
          <div className="admin-mobile-preview-shell">
            <div className="iosapp-page" style={{ display: 'block' }}>
              <div className="iosapp-screen space-y-3">
                <p className="rounded-md bg-[#eef1f4] px-3 py-2 text-[12px] leading-5 text-[#5a6570]">
                  真实页还有日期 / 人数 / 联系方式；此处只预览偏好控件。
                </p>
                {routePrivateFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    暂无勾选「路线私人」且已启用的字段。
                  </p>
                ) : (
                  <div className="iosapp-pref-sections">
                    {routePrivateFields.map((field) => (
                      <PreferenceFieldControl
                        key={field.id || field.fieldKey}
                        field={field}
                        value={values[field.fieldKey]}
                        variant="mobile"
                        onChange={(next) => onChange(field.fieldKey, next)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function FormConfigMobilePreview({
  fields,
  unsaved = false,
  defaultMode = 'full',
  embedded = false,
}: FormConfigMobilePreviewProps) {
  const [open, setOpen] = useState(false);

  if (embedded) {
    return (
      <div className="sticky top-4">
        <PreviewPhone fields={fields} unsaved={unsaved} defaultMode={defaultMode} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen((value) => !value)}>
        {open ? '收起旅客预览' : '查看旅客预览'}
      </Button>
      {open ? <PreviewPhone fields={fields} unsaved={unsaved} defaultMode={defaultMode} /> : null}
    </div>
  );
}
