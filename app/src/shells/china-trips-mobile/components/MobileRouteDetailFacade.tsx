import { ShieldCheck, Star } from 'lucide-react';
import type { RouteTour } from '@/lib/routesClient';

type MobileRouteDetailFacadeProps = {
  tour: RouteTour;
  destinationNames?: string[];
  /** Optional overview paragraphs; defaults to structured experience / tour.desc. */
  overviewLines?: string[];
};

/**
 * Read-only route detail content facade for Mobile Admin preview.
 * Mirrors China Trips content blocks (overview / days / moments / included).
 * No booking CTAs and no Motion page shell.
 */
export function MobileRouteDetailFacade({
  tour,
  destinationNames = [],
  overviewLines,
}: MobileRouteDetailFacadeProps) {
  const structured = tour.structuredItinerary;
  const experience =
    overviewLines ??
    (structured?.experience?.length
      ? structured.experience
      : tour.desc
        ? [tour.desc]
        : []);
  const days = structured?.days ?? [];
  const moments = structured?.moments ?? [];
  const included =
    structured?.includedSupport?.length
      ? structured.includedSupport
      : tour.includedSupport;

  return (
    <div className="china-trips-mobile-page iosapp-page iosapp-detail-page">
      <header className="iosapp-detail-hero iosapp-route-detail-hero">
        <img src={tour.image} alt={tour.title} />
        <div className="iosapp-detail-shade" />
        <div className="iosapp-detail-title">
          {tour.category ? <span className="iosapp-pill">{tour.category}</span> : null}
          <h1>{tour.title}</h1>
          <p>{destinationNames.join(' · ') || tour.desc || ''}</p>
        </div>
      </header>

      <main className="iosapp-detail-body">
        <section className="iosapp-detail-stats" aria-label={`${tour.title} quick facts`}>
          <span>
            <b>{tour.duration}</b>
            duration
          </span>
          <span>
            <b>{tour.groupSize}</b>
            format
          </span>
          <span>
            <b>{tour.price || 'TBC'}</b>
            price
          </span>
        </section>

        <section className="iosapp-detail-section">
          <h2>Overview</h2>
          {experience.length > 0 ? (
            <div className="iosapp-route-copy">
              {experience.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          ) : (
            <p className="iosapp-route-copy" style={{ margin: 0, color: 'var(--ios-muted)' }}>
              暂无 Overview。请在完整编辑中填写体验要点（experience）。
            </p>
          )}
        </section>

        <section className="iosapp-detail-section">
          <h2>Day-by-day itinerary</h2>
          {days.length > 0 ? (
            <div className="iosapp-day-list">
              {days.map((day, index) => (
                <article key={`${day.title}-${index}`} className="iosapp-day-card">
                  <span className="iosapp-day-index">{index + 1}</span>
                  <div>
                    <h3>{day.title}</h3>
                    <p>{day.text}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: 'var(--ios-muted)', fontSize: 14 }}>
              暂无逐日行程。请在完整编辑中添加 Day-by-day。
            </p>
          )}
        </section>

        <section className="iosapp-detail-section">
          <h2>Signature moments</h2>
          {moments.length > 0 ? (
            <div className="iosapp-moment-grid">
              {moments.map((moment) => (
                <span key={moment} className="iosapp-moment-chip">
                  <Star size={16} />
                  {moment}
                </span>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: 'var(--ios-muted)', fontSize: 14 }}>
              暂无 Signature moments。
            </p>
          )}
        </section>

        <section className="iosapp-detail-section iosapp-grouped-card">
          <h2>Included</h2>
          {included.length > 0 ? (
            <div className="iosapp-detail-lines">
              {included.map((item) => (
                <span key={item}>
                  <ShieldCheck size={18} />
                  <b>{item.split(' ').slice(0, 3).join(' ')}</b>
                  <small>{item}</small>
                </span>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: 'var(--ios-muted)', fontSize: 14 }}>
              暂无 Included 项。
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
