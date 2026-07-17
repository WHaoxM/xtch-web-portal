import { useEffect, useMemo, useState } from 'react';
import { MobileDestinationCard } from '@/components/mobile/MobileDestinationCard';
import { MobileDestinationDetailFacade } from '@/components/mobile/MobileDestinationDetailFacade';
import { MobileDestinationListRow } from '@/components/mobile/MobileDestinationListRow';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DestinationEditDraft } from '@/lib/destinationDraft';
import { fetchAdminRoutes, toRouteTour, type RouteRecord } from '@/lib/routesClient';
import { slugify } from '@/lib/slugify';
import '@/components/chinaTripsMobile.css';

type DestinationMobilePreviewProps = {
  token: string;
  draft: DestinationEditDraft;
  embedded?: boolean;
};

function relatedPublishedRoutes(routes: RouteRecord[], destinationSlug: string): RouteRecord[] {
  if (!destinationSlug) return [];
  return routes.filter(
    (route) =>
      route.status === 'published' && route.destinationSlugs.includes(destinationSlug),
  );
}

function PreviewPhone({
  draft,
  routes,
  routesLoading,
}: {
  draft: DestinationEditDraft;
  routes: RouteRecord[];
  routesLoading: boolean;
}) {
  const name = draft.name.trim() || 'Untitled destination';
  const description = draft.description.trim() || '简介会显示在目的地列表与详情门面。';
  const image = draft.image.trim() || '/images/route-beijing-forbidden-01.png';
  const slug = draft.slug.trim() || slugify(draft.name) || '';

  const related = useMemo(() => relatedPublishedRoutes(routes, slug), [routes, slug]);
  const relatedPreview = related.slice(0, 4).map((route) => {
    const tour = toRouteTour(route);
    return {
      slug: route.slug,
      image: tour.image,
      title: tour.title,
      meta: `${tour.category} · ${tour.duration} · ${tour.groupSize}`,
    };
  });

  return (
    <div className="space-y-3">
      {draft.featuredOnHome ? (
        <p className="text-xs text-amber-800">
          已勾选首页推荐。仅「已发布」会出现在首页热门；草稿即使勾选也不对旅客可见。
        </p>
      ) : null}

      <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[1.75rem] border border-border bg-[#f5f2ec] shadow-sm">
        <div className="border-b border-border/60 bg-background px-3 py-2 text-center text-xs text-muted-foreground">
          移动端预览 · 390px
          {routesLoading ? ' · 加载关联路线…' : null}
        </div>
        <Tabs defaultValue="popular" className="gap-0">
          <div className="flex justify-center border-b border-border/60 bg-background px-2 py-2">
            <TabsList>
              <TabsTrigger value="popular">热门卡</TabsTrigger>
              <TabsTrigger value="list">列表行</TabsTrigger>
              <TabsTrigger value="detail">详情</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="popular" className="m-0 max-h-[70vh] overflow-y-auto p-3">
            <div className="pointer-events-none">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Popular places</p>
              <div
                className="iosapp-destination-grid"
                style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
              >
                <MobileDestinationCard image={image} name={name} routeCount={related.length} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="list" className="m-0 max-h-[70vh] overflow-y-auto p-3">
            <div className="iosapp-card-list pointer-events-none">
              <MobileDestinationListRow image={image} name={name} description={description} />
            </div>
          </TabsContent>
          <TabsContent value="detail" className="m-0 max-h-[70vh] overflow-y-auto">
            <div className="admin-mobile-preview-shell pointer-events-none scale-[0.98] origin-top">
              <MobileDestinationDetailFacade
                image={image}
                name={name}
                description={description}
                slug={slug || 'destination'}
                routeCount={related.length}
                relatedRoutes={relatedPreview}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export function DestinationMobilePreview({
  token,
  draft,
  embedded = false,
}: DestinationMobilePreviewProps) {
  const [open, setOpen] = useState(false);
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [routesLoading, setRoutesLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchAdminRoutes(token)
      .then((list) => {
        if (!active) return;
        setRoutes(list);
      })
      .catch(() => {
        if (!active) return;
        setRoutes([]);
      })
      .finally(() => {
        if (active) setRoutesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  if (embedded) {
    return (
      <div className="sticky top-4">
        <PreviewPhone draft={draft} routes={routes} routesLoading={routesLoading} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen((value) => !value)}>
        {open ? '收起移动预览' : '查看移动预览'}
      </Button>
      {open ? (
        <PreviewPhone draft={draft} routes={routes} routesLoading={routesLoading} />
      ) : null}
    </div>
  );
}
