import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, MessageCircle, Phone, Clock3 } from 'lucide-react';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import {
  fieldErrorId,
  focusFirstFieldError,
  isValidEmail,
  type FieldErrors,
} from '@/lib/formErrors';
import { submitInquiry } from '@/lib/inquiryClient';
import { brand } from '@/lib/siteData';
import { cn } from '@/lib/utils';

const contactMethods = [
  {
    icon: MessageCircle,
    title: 'WhatsApp',
    detail: brand.phone,
    note: 'Best for fast trip planning questions and real-time follow-up.',
    href: brand.whatsappHref,
  },
  {
    icon: Mail,
    title: 'Email',
    detail: brand.email,
    note: 'Best for detailed itinerary requests and documents.',
    href: `mailto:${brand.email}`,
  },
  {
    icon: Phone,
    title: 'Call',
    detail: brand.phone,
    note: 'Best for urgent communication about your trip.',
    href: brand.phoneHref,
  },
  {
    icon: MapPin,
    title: 'Company Address',
    detail: brand.address,
    note: `${brand.legalName} / ${brand.chineseLegalName}`,
    href: 'https://www.syncingtravel.com/',
  },
];

const CONTACT_FIELD_ORDER = ['name', 'email', 'turnstile'] as const;

const inputClassName =
  'w-full rounded-[10px] border border-[#D6D6D6] px-4 py-3 text-[15px] outline-none transition-all placeholder:text-[#88929C] focus:border-[#002A3A] focus:ring-1 focus:ring-[#002A3A]/10 aria-invalid:border-red-500 aria-invalid:ring-1 aria-invalid:ring-red-200';

export default function Contact() {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  useScrollAnimation('.contact-anim');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const getValue = (name: string) => String(form.get(name) ?? '').trim();
    const name = getValue('name');
    const email = getValue('email');
    const nextErrors: FieldErrors = {};

    if (!name) nextErrors.name = 'Please enter your name.';
    if (!email) nextErrors.email = 'Please enter your email.';
    else if (!isValidEmail(email)) nextErrors.email = 'Please enter a valid email address.';
    if (!turnstileToken) nextErrors.turnstile = 'Please complete the anti-spam check.';

    setFieldErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length) {
      setStatus('');
      requestAnimationFrame(() => {
        focusFirstFieldError([...CONTACT_FIELD_ORDER], nextErrors, formElement);
      });
      return;
    }

    setSubmitting(true);
    setStatus('');

    try {
      await submitInquiry({
        type: 'quick_contact',
        name,
        email,
        travelMonth: getValue('travelMonth'),
        travelers: getValue('travelers'),
        message: getValue('message'),
        sourcePath: window.location.href,
        turnstileToken,
        honeypot: getValue('companyWebsite'),
      });
      formElement.reset();
      setFieldErrors({});
      setTurnstileResetSignal((value) => value + 1);
      setStatus('Thank you. We received your inquiry and will reply within 24 hours.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'We could not submit your inquiry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <section className="relative min-h-[52vh] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/images/about-hero.jpg)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/72 via-[#002A3A]/52 to-black/78" />
        <div className="hero-copy-shadow relative z-10 px-6 pt-24 text-center text-white">
          <p className="mb-4 text-[11px] uppercase tracking-[0.25em] text-white">
            Contact Us
          </p>
          <h1 className="mb-4 font-serif text-4xl leading-[1.1] md:text-5xl lg:text-[64px]">
            Talk to a China travel expert
          </h1>
          <p className="mx-auto max-w-3xl text-[15px] leading-relaxed text-white">
            Reach out to {brand.fullName} if you want help comparing real routes, planning a custom
            China trip, or deciding which destinations fit your dates and pace.
          </p>
        </div>
      </section>

      <section className="bg-white py-16 md:py-20 section-padding">
        <div className="content-max-width">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {contactMethods.map((method, index) => {
              const Icon = method.icon;
              return (
                <a
                  key={method.title}
                  href={method.href}
                  target={method.href.startsWith('http') ? '_blank' : undefined}
                  rel={method.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="contact-anim animate-fade-up rounded-[10px] border border-[#D6D6D6] bg-[#F9F9FB] p-6 transition-colors hover:border-[#379C8A] hover:bg-white"
                  style={{ transitionDelay: `${index * 0.08}s` }}
                >
                  <Icon size={18} className="mb-4 text-[#379C8A]" />
                  <h2 className="mb-2 text-[16px] font-semibold text-[#002A3A]">{method.title}</h2>
                  <p className="mb-2 text-[15px] font-semibold text-[#002A3A]">{method.detail}</p>
                  <p className="text-[14px] leading-[1.8] text-[#5D5D5D]">{method.note}</p>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#F6FAFE] py-16 md:py-20 section-padding">
        <div className="content-max-width">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="contact-anim animate-fade-up">
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#379C8A]">
                Trip Planning Help
              </p>
              <h2 className="mb-5 font-serif text-[30px] leading-[1.2] text-[#002A3A] md:text-[38px]">
                Tell us what kind of China trip you want to take
              </h2>
              <p className="mb-8 max-w-[620px] text-[15px] leading-[1.9] text-[#5D5D5D]">
                We can help with route planning, hotel level, pacing, first-time China questions,
                transport between cities, and whether a private custom route makes more sense than
                a fixed package.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  'First-time China itineraries',
                  'Private guides and drivers',
                  'Train and domestic flight planning',
                  'Family, couple, and senior-friendly pacing',
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-[10px] border border-white bg-white px-4 py-4 text-[14px] text-[#5D5D5D]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="contact-anim animate-fade-up rounded-xl bg-white p-7 shadow-sm" style={{ transitionDelay: '0.1s' }}>
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-full bg-[#F6FAFE] p-2.5">
                  <Clock3 size={16} className="text-[#379C8A]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-[#002A3A]">Quick request</h3>
                  <p className="text-[13px] text-[#5D5D5D]">Leave the basics and we can follow up.</p>
                </div>
              </div>
              <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                <input
                  type="text"
                  name="companyWebsite"
                  tabIndex={-1}
                  autoComplete="off"
                  className="hidden"
                  aria-hidden="true"
                />
                <div data-field-error="name">
                  <label htmlFor="contact-name" className="mb-1.5 block text-[14px] font-medium text-[#002A3A]">
                    Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    placeholder="Your name"
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? fieldErrorId('name') : undefined}
                    className={inputClassName}
                  />
                  {fieldErrors.name && (
                    <p id={fieldErrorId('name')} className="mt-1.5 text-[13px] text-red-600" role="alert">
                      {fieldErrors.name}
                    </p>
                  )}
                </div>
                <div data-field-error="email">
                  <label htmlFor="contact-email" className="mb-1.5 block text-[14px] font-medium text-[#002A3A]">
                    Email <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? fieldErrorId('email') : undefined}
                    className={inputClassName}
                  />
                  {fieldErrors.email && (
                    <p id={fieldErrorId('email')} className="mt-1.5 text-[13px] text-red-600" role="alert">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[14px] font-medium text-[#002A3A]">
                      Travel month
                    </label>
                    <input
                      name="travelMonth"
                      type="text"
                      placeholder="October 2026"
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[14px] font-medium text-[#002A3A]">
                      Travelers
                    </label>
                    <input
                      name="travelers"
                      type="text"
                      placeholder="2 adults"
                      className={inputClassName}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[14px] font-medium text-[#002A3A]">
                    Trip ideas
                  </label>
                  <textarea
                    name="message"
                    rows={5}
                    placeholder="Cities, interests, pace, hotel preference, or anything else we should know."
                    className="w-full resize-none rounded-[10px] border border-[#D6D6D6] px-4 py-3 text-[15px] outline-none transition-all placeholder:text-[#88929C] focus:border-[#002A3A] focus:ring-1 focus:ring-[#002A3A]/10"
                  />
                </div>
                <div
                  data-field-error="turnstile"
                  className={cn(
                    fieldErrors.turnstile && 'rounded-[10px] border border-red-300 bg-red-50/60 p-3',
                  )}
                >
                  <TurnstileWidget
                    onTokenChange={setTurnstileToken}
                    resetSignal={turnstileResetSignal}
                  />
                  {fieldErrors.turnstile && (
                    <p id={fieldErrorId('turnstile')} className="mt-2 text-[13px] text-red-600" role="alert">
                      {fieldErrors.turnstile}
                    </p>
                  )}
                </div>
                {formError && (
                  <div className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] leading-6 text-red-700" role="alert">
                    <p>{formError}</p>
                  </div>
                )}
                {status && (
                  <p className="rounded-[10px] border border-[#CDE7E1] bg-[#F0FAF7] px-4 py-3 text-[14px] text-[#1D6F62]">
                    {status}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center rounded-[10px] bg-[#002A3A] px-5 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#093C5D] disabled:cursor-not-allowed disabled:opacity-65"
                >
                  {submitting ? 'Sending...' : 'Send Inquiry'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 section-padding">
        <div className="content-max-width">
          <div className="contact-anim animate-fade-up rounded-[10px] bg-[#002A3A] px-8 py-10 text-center text-white md:px-12">
            <h2 className="mb-3 font-serif text-[28px] md:text-[34px]">
              Ready to shape a private China route?
            </h2>
            <p className="mx-auto mb-6 max-w-[680px] text-[14px] leading-[1.8] text-white/70">
              If you already know your dates and interests, the planning form is the fastest way to
              get a custom suggestion from the team.
            </p>
            <Link
              to="/custom-trip"
              className="inline-flex items-center justify-center rounded-[10px] bg-white px-6 py-3 text-[15px] font-semibold text-[#002A3A] transition-colors hover:bg-[#F6FAFE]"
            >
              Plan My Trip
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
