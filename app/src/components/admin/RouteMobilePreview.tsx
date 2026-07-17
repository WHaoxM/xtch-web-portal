import { useState } from 'react';
import { MobileRouteListCard } from '@/components/mobile/MobileRouteListCard';
import { MobileRouteDetailFacade } from '@/components/mobile/MobileRouteDetailFacade';
import { draftToRouteTour, type RouteEditDraft } from '@/lib/routeDraft';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import '@/components/chinaTripsMobile.css';

type RouteMobilePreviewProps = {
  draft: RouteEditDraft;
  categories: { key: string; label: string }[];
  destinationNames: string[];
  /** When true, render as a fixed right column; when false, show a toggle button. */
  embedded?: boolean;
};

function PreviewPhone({
  draft,
  categories,
  destinationNames,
}: {
  draft: RouteEditDraft;
  categories: { key: string; label: string }[];
  destinationNames: string[];
}) {
  const tour = draftToRouteTour(draft, categories);
  const meta = [tour.category, tour.duration, tour.groupSize].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[1.75rem] border border-border bg-[#f5f2ec] shadow-sm">
      <div className="border-b border-border/60 bg-background px-3 py-2 text-center text-xs text-muted-foreground">
        移动端预览 · 390px
      </div>
      <Tabs defaultValue="card" className="gap-0">
        <div className="flex justify-center border-b border-border/60 bg-background px-2 py-2">
          <TabsList>
            <TabsTrigger value="card">列表卡</TabsTrigger>
            <TabsTrigger value="detail">详情门面</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="card" className="m-0 max-h-[70vh] overflow-y-auto p-3">
          <div className="iosapp-card-list pointer-events-none">
            <MobileRouteListCard image={tour.image} title={tour.title} meta={meta} />
          </div>
        </TabsContent>
        <TabsContent value="detail" className="m-0 max-h-[70vh] overflow-y-auto">
          <div className="admin-mobile-preview-shell pointer-events-none scale-[0.98] origin-top">
            <MobileRouteDetailFacade tour={tour} destinationNames={destinationNames} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function RouteMobilePreview({
  draft,
  categories,
  destinationNames,
  embedded = false,
}: RouteMobilePreviewProps) {
  const [open, setOpen] = useState(false);

  if (embedded) {
    return (
      <div className="sticky top-4">
        <PreviewPhone draft={draft} categories={categories} destinationNames={destinationNames} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen((value) => !value)}>
        {open ? '收起移动预览' : '查看移动预览'}
      </Button>
      {open ? (
        <PreviewPhone draft={draft} categories={categories} destinationNames={destinationNames} />
      ) : null}
    </div>
  );
}
