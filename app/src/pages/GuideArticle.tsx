import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { CtaBand, PageHero, SectionIntro } from '@/components/SiteSections';
import { getGuideArticleBySlug, guideArticles } from '@/lib/siteData';

export default function GuideArticle() {
  const { slug = '' } = useParams();
  const article = getGuideArticleBySlug(slug);

  if (!article) {
    return (
      <div className="section-padding bg-white py-32">
        <div className="content-max-width max-w-3xl">
          <Link to="/travel-guide" className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#002A3A]">
            <ArrowLeft size={16} />
            Back to travel guide
          </Link>
          <h1 className="mt-8 font-serif text-[42px] leading-tight text-[#002A3A]">
            Guide article not found
          </h1>
        </div>
      </div>
    );
  }

  const relatedArticles = guideArticles.filter((item) => item.slug !== article.slug);

  return (
    <div className="bg-white">
      <PageHero
        eyebrow={article.eyebrow}
        title={article.title}
        text={article.summary}
        image={article.image}
        align="left"
      />

      <section className="section-padding bg-white py-16 md:py-20">
        <div className="tocn-wide grid grid-cols-1 gap-10 lg:grid-cols-[0.34fr_0.66fr]">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <Link to="/travel-guide" className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#379C8A]">
              <ArrowLeft size={15} />
              Travel guide
            </Link>
            <h2 className="mt-6 font-serif text-[34px] leading-tight text-[#002A3A]">
              Practical notes before planning
            </h2>
            <p className="mt-5 text-[15px] leading-8 text-[#5D5D5D]">
              Use this article as a planning starting point, then confirm the details against your
              route, season, nationality, and travel dates.
            </p>
          </aside>
          <article className="space-y-6">
            {article.sections.map((section, index) => (
              <section key={section.title} className="tocn-card bg-[#F9F9FB] p-7 md:p-9">
                <p className="font-condensed text-[32px] leading-none tracking-[0.06em] text-[#379C8A]">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <h2 className="mt-5 font-serif text-[30px] leading-tight text-[#002A3A]">
                  {section.title}
                </h2>
                <p className="mt-4 text-[16px] leading-9 text-[#5D5D5D]">{section.text}</p>
              </section>
            ))}
          </article>
        </div>
      </section>

      <section className="section-padding bg-[#F9F9F9] py-16 md:py-20">
        <div className="tocn-wide">
          <SectionIntro eyebrow="More Guide Notes" title="Continue planning your China trip" />
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
            {relatedArticles.map((item) => (
              <Link key={item.slug} to={`/travel-guide/${item.slug}`} className="group grid grid-cols-[120px_1fr] gap-5 rounded-[8px] bg-white p-4 shadow-sm md:grid-cols-[180px_1fr]">
                <img src={item.image} alt="" className="h-full min-h-[150px] w-full rounded-[6px] object-cover" />
                <div className="py-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#379C8A]">{item.eyebrow}</p>
                  <h3 className="mt-2 font-serif text-[24px] leading-tight text-[#002A3A]">{item.title}</h3>
                  <p className="mt-3 line-clamp-2 text-[14px] leading-7 text-[#5D5D5D]">{item.summary}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-[#002A3A]">
                    Read guide
                    <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        eyebrow="Route Help"
        title="Need this advice applied to your itinerary?"
        text="Share your dates, group size, cities, and travel style so the team can shape practical route suggestions."
      />
    </div>
  );
}
