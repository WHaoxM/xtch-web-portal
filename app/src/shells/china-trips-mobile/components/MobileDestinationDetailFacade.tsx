import { CalendarDays, MapPin, ShieldCheck } from 'lucide-react';
import { MobileRouteListCard } from '@/components/mobile/MobileRouteListCard';
import {
  getPlaceBestFor,
  getPlacePace,
  getPlacePlanningNote,
  getPlaceSeason,
  getPlaceTiming,
  getPlaceWhy,
} from '@/lib/placeDetailCopy';

export type DestinationRelatedRoutePreview = {
  slug: string;
  image: string;
  title: string;
  meta: string;
};

type MobileDestinationDetailFacadeProps = {
  image: string;
  name: string;
  description: string;
  slug: string;
  routeCount?: number;
  relatedRoutes?: DestinationRelatedRoutePreview[];
};

/**
 * Read-only place detail facade (hero + stats + related routes + copy).
 * No booking CTAs / Motion shell — shared by Admin preview.
 */
export function MobileDestinationDetailFacade({
  image,
  name,
  description,
  slug,
  routeCount = 0,
  relatedRoutes = [],
}: MobileDestinationDetailFacadeProps) {
  const bestFor = getPlaceBestFor(slug);
  const previewRoutes = relatedRoutes.slice(0, 4);

  return (
    <div className="china-trips-mobile-page iosapp-page iosapp-detail-page">
      <header className="iosapp-detail-hero">
        <img src={image} alt={name} />
        <div className="iosapp-detail-shade" />
        <div className="iosapp-detail-title">
          <span className="iosapp-pill">{bestFor}</span>
          <h1>{name}</h1>
          <p>{description}</p>
        </div>
      </header>

      <main className="iosapp-detail-body">
        <section className="iosapp-detail-stats" aria-label={`${name} travel summary`}>
          <span>
            <b>{routeCount}</b>
            routes
          </span>
          <span>
            <b>{getPlacePace(slug)}</b>
            pace
          </span>
          <span>
            <b>{getPlaceSeason(slug)}</b>
            season
          </span>
        </section>

        <section className="iosapp-detail-section">
          <h2>Why travelers choose it</h2>
          <p>{getPlaceWhy(slug)}</p>
        </section>

        <section className="iosapp-detail-section">
          <div className="iosapp-section-head">
            <h2>Routes from {name}</h2>
          </div>
          {previewRoutes.length > 0 ? (
            <div className="iosapp-card-list">
              {previewRoutes.map((tour) => (
                <MobileRouteListCard
                  key={tour.slug}
                  image={tour.image}
                  title={tour.title}
                  meta={tour.meta}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" style={{ margin: 0, padding: '0 2px' }}>
              暂无关联路线。请到「路线」编辑里勾选此目的地（由路线 ↔ 目的地关联决定）。
            </p>
          )}
        </section>

        <section className="iosapp-detail-section iosapp-grouped-card">
          <h2>Good to know</h2>
          <div className="iosapp-detail-lines">
            <span>
              <MapPin size={18} />
              <b>Best for</b>
              <small>{bestFor}</small>
            </span>
            <span>
              <CalendarDays size={18} />
              <b>Timing</b>
              <small>{getPlaceTiming(slug)}</small>
            </span>
            <span>
              <ShieldCheck size={18} />
              <b>Planning note</b>
              <small>{getPlacePlanningNote(slug)}</small>
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}
