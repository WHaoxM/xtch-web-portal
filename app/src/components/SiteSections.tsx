import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function PageHero({
  eyebrow,
  title,
  text,
  image,
  align = 'center',
  children,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  image: string;
  align?: 'left' | 'center';
  children?: ReactNode;
}) {
  return (
    <section className="section-padding relative min-h-[72vh] overflow-hidden bg-[#061417]">
      <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,12,15,0.9)_0%,rgba(0,42,58,0.62)_48%,rgba(0,0,0,0.28)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white to-transparent" />
      <div
        className={`content-max-width relative z-10 flex min-h-[72vh] items-center pt-28 ${
          align === 'center' ? 'justify-center text-center' : ''
        }`}
      >
        <div className="hero-copy-shadow max-w-5xl py-14 text-white">
          {eyebrow && (
            <p className="mb-4 text-[12px] font-bold uppercase tracking-[0.22em] text-[#6FD1D7]">
              {eyebrow}
            </p>
          )}
          <h1 className="tocn-hero-title text-white">{title}</h1>
          {text && (
            <p className="mx-auto mt-6 max-w-3xl text-[16px] leading-8 text-white/88">{text}</p>
          )}
          {children && <div className="mt-9">{children}</div>}
        </div>
      </div>
    </section>
  );
}

export function SectionIntro({
  eyebrow,
  title,
  text,
  inverted = false,
  align = 'center',
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  inverted?: boolean;
  align?: 'left' | 'center';
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-4xl text-center' : 'max-w-3xl'}>
      {eyebrow && (
        <p
          className={`mb-3 text-[12px] font-bold uppercase tracking-[0.18em] ${
            inverted ? 'text-[#6FD1D7]' : 'text-[#379C8A]'
          }`}
        >
          {eyebrow}
        </p>
      )}
      <h2 className={`tocn-section-title ${inverted ? 'text-white' : 'text-[#002A3A]'}`}>
        {title}
      </h2>
      {text && (
        <p className={`mt-5 text-[15px] leading-8 ${inverted ? 'text-white/76' : 'text-[#5D5D5D]'}`}>
          {text}
        </p>
      )}
    </div>
  );
}

export function CtaBand({
  eyebrow,
  title,
  text,
  image = '/images/ref-banner-misty-river.jpg',
  primaryLabel = 'Start Planning',
  primaryTo = '/custom-trip',
  secondaryLabel,
  secondaryTo = '/contact',
}: {
  eyebrow?: string;
  title: string;
  text: string;
  image?: string;
  primaryLabel?: string;
  primaryTo?: string;
  secondaryLabel?: string;
  secondaryTo?: string;
}) {
  return (
    <section className="section-padding relative overflow-hidden bg-[#061417] py-16 md:py-20">
      <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,12,15,0.96),rgba(0,42,58,0.78),rgba(0,0,0,0.3))]" />
      <div className="content-max-width relative z-10 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="max-w-4xl">
          {eyebrow && (
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.18em] text-[#6FD1D7]">
              {eyebrow}
            </p>
          )}
          <h2 className="tocn-section-title text-white">{title}</h2>
          <p className="mt-5 max-w-3xl text-[15px] leading-8 text-white/78">{text}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <Link
            to={primaryTo}
            className="inline-flex min-h-[52px] items-center justify-center gap-3 rounded-[6px] bg-white px-7 text-[15px] font-semibold text-[#002A3A] transition-colors hover:bg-[#F6FAFE]"
          >
            {primaryLabel}
            <ArrowRight size={17} />
          </Link>
          {secondaryLabel && (
            <Link
              to={secondaryTo}
              className="inline-flex min-h-[52px] items-center justify-center rounded-[6px] border border-white/45 px-7 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

export function FaqBlock({
  items,
  inverted = false,
}: {
  items: Array<{ question: string; answer: string }>;
  inverted?: boolean;
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {items.map((faq, index) => (
        <details
          key={faq.question}
          className={`overflow-hidden rounded-[8px] border ${
            inverted
              ? 'border-white/12 bg-white/[0.075] text-white'
              : 'border-[#D6D6D6] bg-[#F9F9FB] text-[#002A3A]'
          }`}
          style={{ transitionDelay: `${index * 0.05}s` }}
        >
          <summary className="cursor-pointer list-none px-6 py-5 text-left text-[16px] font-semibold marker:hidden">
            {faq.question}
          </summary>
          <div
            className={`border-t px-6 py-5 text-[15px] leading-8 ${
              inverted ? 'border-white/12 text-white/72' : 'border-[#D6D6D6] text-[#5D5D5D]'
            }`}
          >
            {faq.answer}
          </div>
        </details>
      ))}
    </div>
  );
}
