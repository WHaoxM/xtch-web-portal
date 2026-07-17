import { CtaBand, PageHero, SectionIntro } from '@/components/SiteSections';
import { brand } from '@/lib/siteData';

const policySections = [
  {
    title: 'Information we collect',
    text: 'When you submit an inquiry, we may collect your name, email, phone or WhatsApp number, travel month, group size, destination interests, hotel preference, budget notes, and message content.',
  },
  {
    title: 'How we use inquiry details',
    text: 'We use this information to respond to your request, prepare route suggestions, coordinate quote details, prevent spam, and keep communication related to your China trip planning.',
  },
  {
    title: 'Route and document handling',
    text: 'Route PDFs and itinerary files are used to help travelers compare products and plan private arrangements. We do not ask you to provide sensitive identity documents through the public website form.',
  },
  {
    title: 'Third-party services',
    text: 'The website may use hosting, email, form-processing, anti-spam, analytics, or payment communication tools. Those services process information according to their own terms and privacy practices.',
  },
  {
    title: 'Data retention',
    text: 'We keep inquiry details only as long as needed for trip planning, customer support, business records, legal compliance, and reasonable follow-up communication.',
  },
  {
    title: 'Contact',
    text: `For privacy questions, contact ${brand.name} at ${brand.email}.`,
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="bg-white">
      <PageHero
        eyebrow="Privacy Policy"
        title="How Syncing Travel handles trip inquiry information"
        text={`${brand.name} uses traveler information to reply to inquiries, shape private China routes, and coordinate practical planning details.`}
        image="/images/ref-banner-misty-river.jpg"
        align="left"
      />

      <section className="section-padding bg-white py-16 md:py-20">
        <div className="tocn-wide grid grid-cols-1 gap-10 lg:grid-cols-[0.34fr_0.66fr]">
          <aside>
            <SectionIntro eyebrow="Policy" title="Plain-language privacy notes" align="left" />
            <p className="mt-6 text-[14px] leading-8 text-[#5D5D5D]">
              This page is written for website inquiries and trip-planning communication. It does
              not replace any signed travel service agreement.
            </p>
          </aside>
          <div className="space-y-5">
            {policySections.map((section, index) => (
              <article key={section.title} className="tocn-card bg-[#F9F9FB] p-7">
                <p className="font-condensed text-[30px] leading-none tracking-[0.06em] text-[#379C8A]">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <h2 className="mt-4 text-[22px] font-semibold text-[#002A3A]">{section.title}</h2>
                <p className="mt-3 text-[15px] leading-8 text-[#5D5D5D]">{section.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        eyebrow="Questions"
        title="Contact the Syncing Travel team"
        text={`For trip planning or privacy questions, use ${brand.email} or the contact form.`}
        primaryTo="/contact"
        primaryLabel="Contact Us"
        secondaryTo="/custom-trip"
        secondaryLabel="Plan a Trip"
      />
    </div>
  );
}
