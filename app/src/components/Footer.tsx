import { Link } from 'react-router-dom';
import { Facebook, Instagram, Mail, MessageCircle, Play, Youtube } from 'lucide-react';
import { brand } from '@/lib/siteData';
import { destinationMeta } from '@/lib/contentStore';

export default function Footer() {
  const destinationItems = [
    ...destinationMeta.slice(0, 5).map((destination) => ({
      label: destination.name,
      to: `/destinations/${destination.slug}`,
    })),
    { label: 'All Destinations', to: '/destinations' },
  ];
  const supportItems = [
    { label: 'Contact', to: '/contact' },
    { label: 'Plan My Trip', to: '/custom-trip' },
    { label: 'Search Tours', to: '/search' },
    { label: 'Travel Guide', to: '/travel-guide' },
    { label: 'China Private Tour Cost', to: '/china-private-tour-cost' },
  ];
  const aboutItems = [
    { label: 'About Us', to: '/about' },
    { label: 'Why Travel With Us', to: '/about' },
    { label: 'Privacy Policy', to: '/privacy-policy' },
  ];

  return (
    <footer className="topographic-pattern relative overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-black/78" />
      <div className="relative z-10 section-padding">
        <div className="content-max-width">
          <div className="grid grid-cols-1 gap-8 border-b border-white/10 py-14 md:grid-cols-[1fr_auto] md:items-center md:py-18">
            <div className="text-center md:text-left">
              <img
                src={brand.logoMarkSrc}
                alt={brand.fullName}
                className="mx-auto h-16 w-auto object-contain md:mx-0 md:h-20"
              />
              <h2 className="mt-3 font-sans text-[26px] font-semibold tracking-tight text-white">
                {brand.name}
              </h2>
              <p className="mt-4 text-[14px] font-semibold tracking-[0.02em] text-white">
                Tailor-Made Private Tours Across China
              </p>
            </div>

            <div className="text-center md:text-left">
              <p className="mb-4 text-[12px] font-bold text-white">Follow us</p>
              <div className="flex justify-center gap-3 md:justify-start">
                {[
                  { label: 'Facebook', Icon: Facebook, href: 'https://www.facebook.com/profile.php?id=61569741602830' },
                  { label: 'YouTube', Icon: Youtube, href: 'https://youtube.com/@xunting-dake' },
                  { label: 'Instagram', Icon: Instagram, href: 'https://www.instagram.com/xunting_dake' },
                  { label: 'TikTok', Icon: Play, href: 'http://www.tiktok.com/@xuntingtrip' },
                ].map(({ label, Icon, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-[#21B0B7] hover:text-white"
                  >
                    <Icon size={17} />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-10 py-16 md:grid-cols-2 lg:grid-cols-[0.9fr_0.8fr_0.9fr_1.25fr] lg:gap-14">
            <FooterList title={`About ${brand.name}`} items={aboutItems} />
            <FooterList
              title="Destinations"
              items={destinationItems}
            />
            <FooterList title="Support" items={supportItems} />

            <div>
              <h3 className="mb-5 font-sans text-[17px] font-semibold text-white">
                Plan Your China Trip
              </h3>
              <p className="max-w-[420px] text-[14px] leading-8 text-white/60">
                Start planning your private China journey with {brand.name}. Tell us your travel
                ideas, and we will help you build a trip that fits your pace, interests, and budget.
              </p>
              <div className="mt-7 space-y-3 text-[14px] font-semibold text-white">
                <a
                  href={brand.whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 transition-colors hover:text-[#21B0B7]"
                >
                  <MessageCircle size={20} />
                  WhatsApp: {brand.phone}
                </a>
                <a
                  href={`mailto:${brand.email}`}
                  className="flex items-center gap-3 transition-colors hover:text-[#21B0B7]"
                >
                  <Mail size={20} />
                  Email: {brand.email}
                </a>
              </div>
              <p className="mt-5 text-[12px] leading-6 text-white/42">
                {brand.legalName}
                <br />
                {brand.chineseLegalName}
                <br />
                Address: {brand.address}
              </p>
              <div className="mt-8 space-y-4">
                <Link
                  to="/custom-trip"
                  className="block rounded-[6px] bg-white px-7 py-3.5 text-center text-[17px] font-medium text-[#002A3A] transition-colors hover:bg-[#F6FAFE]"
                >
                  Request A Quote
                </Link>
                <Link
                  to="/contact"
                  className="block text-center text-[17px] font-semibold text-white transition-colors hover:text-[#21B0B7]"
                >
                  Contact Us
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 border-t border-white/10 py-10 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="mb-4 text-[14px] font-semibold text-white/48">
                Secure Payment Options
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-white">
                <span>Alipay</span>
                <span className="h-5 w-px bg-white/25" />
                <span>WeChat Pay</span>
                <span className="h-5 w-px bg-white/25" />
                <span>Bank Transfer</span>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                {['VISA', 'Mastercard', 'AMEX', 'UnionPay', 'Discover', 'PayPal'].map((item) => (
                  <span
                    key={item}
                    className="rounded-[4px] border border-white/14 bg-white/8 px-3 py-2 text-[13px] font-bold text-white/82"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <p className="max-w-[420px] text-[13px] leading-7 text-white/40">
              © 2026 {brand.legalName}. All rights reserved. Private China Tours & Tailor-Made
              Travel.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; to: string }>;
}) {
  return (
    <div>
      <h3 className="mb-7 font-sans text-[15px] font-bold uppercase text-white">{title}</h3>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              to={item.to}
              className="text-[15px] leading-7 text-white/58 transition-colors hover:text-white"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
