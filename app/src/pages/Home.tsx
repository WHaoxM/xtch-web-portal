import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Camera,
  Crown,
  Gem,
  Headphones,
  Leaf,
  MapPin,
  Mountain,
  Send,
  ShieldCheck,
  Star,
  UsersRound,
} from 'lucide-react';

const curatedJourneys = [
  {
    title: '5-Day Beijing Classic Trip',
    subtitle: 'Imperial history, Great Wall & first China moments',
    image: '/images/route-beijing-greatwall-01.png',
    days: '5 Days',
    places: ['Beijing', 'Great Wall', 'Forbidden City'],
    featured: true,
    wide: true,
  },
  {
    title: '5-Day Chengdu & Jiuzhaigou',
    subtitle: 'Pandas, soft city life & colorful mountain lakes',
    image: '/images/route-jiuzhaigou-lake-01.png',
    days: '5 Days',
    places: ['Chengdu', 'Jiuzhaigou', 'Huanglong'],
  },
  {
    title: '8-Day Qinghai & Gansu Loop',
    subtitle: 'Salt lakes, Silk Road color & northwest horizons',
    image: '/images/route-qinghai-mingsha-01.jpg',
    days: '8 Days',
    places: ['Qinghai', 'Dunhuang', 'Danxia'],
  },
];

const curatedTrustItems = [
  {
    Icon: Gem,
    title: 'Expert Local Insight',
    text: 'Curated by travel specialists',
  },
  {
    Icon: ShieldCheck,
    title: 'Trusted & Secure',
    text: 'Clear, reliable arrangements',
  },
  {
    Icon: Headphones,
    title: 'On-Trip Support',
    text: 'Here to help, anytime',
  },
  {
    Icon: Star,
    title: 'Flexible & Private',
    text: 'Travel your way',
  },
];

const iconicMomentCards = [
  {
    image: '/images/syncing-real-place-great-wall-group.png',
    title: 'Great Wall',
    place: 'Beijing',
  },
  {
    image: '/images/syncing-real-place-forbidden-city-group.jpg',
    title: 'Forbidden City',
    place: 'Beijing',
  },
  {
    image: '/images/syncing-real-place-jiuzhaigou-lake.jpg',
    title: 'Jiuzhaigou Valley',
    place: 'Sichuan',
  },
  {
    image: '/images/syncing-real-place-xian-city-wall-bikes.jpg',
    title: "Xi'an City Wall",
    place: "Xi'an",
  },
  {
    image: '/images/syncing-real-place-leshan-buddha.jpg',
    title: 'Leshan Buddha',
    place: 'Sichuan',
  },
  {
    image: '/images/syncing-real-place-guilin-river.png',
    title: 'Li River',
    place: 'Guilin',
  },
];

const travelerMomentCards = [
  {
    image: '/images/syncing-real-traveler-shanghai-skyline.jpg',
    title: 'Shanghai Skyline',
  },
  {
    image: '/images/syncing-real-traveler-chongqing-night.jpg',
    title: 'Chongqing Night Walk',
  },
  {
    image: '/images/syncing-real-traveler-xian-pagoda.jpg',
    title: "Xi'an Pagoda Visit",
  },
  {
    image: '/images/syncing-real-traveler-mountain-stream.png',
    title: 'Mountain Stream Stop',
  },
  {
    image: '/images/syncing-real-traveler-group-dinner.jpg',
    title: 'Group Dinner',
  },
  {
    image: '/images/syncing-real-traveler-bund-friends.jpg',
    title: 'Bund Evening',
  },
  {
    image: '/images/syncing-real-traveler-highland-rest.png',
    title: 'Highland Rest Stop',
  },
];

const travelerStories = [
  {
    title: 'A Quiet Morning in Zhangjiajie',
    author: 'Emma & Daniel',
    country: 'United Kingdom',
    avatar: '/images/real-moment-3.jpg',
    mainImage: '/images/real-moment-3.jpg',
    polaroidImage: '/images/ref-tour-zhangjiajie.jpg',
    location: 'Zhangjiajie National Forest Park',
    polaroidCaption: "Morning views we'll never forget.",
    paragraphs: [
      'We woke up early to soft mist drifting between the sandstone peaks. The world was still, with only birdsong and the sound of our footsteps on the mountain path.',
      'Our guide led us to a quieter trail most visitors miss. We paused often, just to take it all in. Every view felt like a painting.',
      'It was one of those rare days that stays with you long after the journey ends.',
    ],
    quote: 'Peaceful, breathtaking, and so well looked after.',
    quoteSecondLine: 'It felt like China revealed its most gentle side to us.',
    tags: ['Zhangjiajie', 'Private Guide', 'Spring Travel', 'Photography'],
  },
  {
    title: 'Golden Light on the Li River',
    author: 'Maya & Chris',
    country: 'Australia',
    avatar: '/images/real-moment-2.jpg',
    mainImage: '/images/ref-tour-li-river.jpg',
    polaroidImage: '/images/route-guilin-bamboo-raft-01.jpg',
    location: 'Li River, Guilin',
    polaroidCaption: 'Slow water, soft mountains.',
    paragraphs: [
      'The river moved slowly past karst peaks and quiet villages. Our day never felt rushed, which made every stop feel personal and easy.',
      'We had time for photos, a village walk, and a simple lunch by the water. The landscape felt familiar from postcards, but much calmer in person.',
      'By sunset, the whole valley turned gold and we understood why people remember Guilin for years.',
    ],
    quote: 'The pace was exactly right.',
    quoteSecondLine: 'We saw the famous views without feeling pushed through them.',
    tags: ['Guilin', 'River Views', 'Slow Travel', 'Photo Time'],
  },
  {
    title: 'First Steps on the Great Wall',
    author: 'Laura & Michael',
    country: 'Canada',
    avatar: '/images/tour-greatwall.jpg',
    mainImage: '/images/tour-greatwall.jpg',
    polaroidImage: '/images/route-beijing-greatwall-01.png',
    location: 'Mutianyu Great Wall',
    polaroidCaption: 'A clear morning above Beijing.',
    paragraphs: [
      'We started before the busy hours and reached a quieter stretch just as the light opened over the hills.',
      'Our guide kept the story clear and never overloaded us with facts. There was room to walk, breathe, and simply enjoy being there.',
      'It became the moment that made China feel real, not just a long-planned destination.',
    ],
    quote: 'It felt grand, but never stressful.',
    quoteSecondLine: 'The planning gave us space to enjoy the day.',
    tags: ['Beijing', 'Great Wall', 'First Visit', 'Family Trip'],
  },
];

export default function Home() {
  return (
    <div className="bg-white text-[#002A3A]">
      <section className="home-reference-hero">
        <img
          src="/images/forbidden-city-beijing-palace-1.jpg"
          alt="Private China travel planned by Syncing Travel"
          className="home-reference-hero-image"
        />
        <div className="home-reference-hero-shade" />
        <div className="home-reference-hero-content">
          <div className="home-reference-hero-copy">
              <h1 className="home-reference-hero-title">
                PLAN YOUR PRIVATE
                <br />
                CHINA JOURNEY
              </h1>
              <div className="home-reference-hero-actions">
                <Link
                  to="/custom-trip"
                  className="home-reference-button home-reference-button-primary"
                >
                  Plan My Trip
                  <ArrowRight size={34} strokeWidth={1.35} />
                </Link>
                <Link
                  to="/china-trips"
                  className="home-reference-button home-reference-button-outline"
                >
                  <ArrowRight size={34} strokeWidth={1.35} />
                  Explore China Trips
                </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="home-reference-intro">
        <div className="home-reference-intro-inner">
          <h2 className="home-reference-intro-title">
            PRIVATE CHINA TRIPS,
            <br />
            PLANNED AROUND YOU
          </h2>
          <div className="home-reference-divider" aria-hidden="true">
            <span />
            <i />
            <span />
          </div>
          <p className="home-reference-intro-copy">
            We help overseas travelers turn China travel ideas into clear private routes,
            trusted local arrangements, and flexible days on the road. From destinations and
            hotels to guides, drivers, tickets, and on-trip support, your journey is shaped
            around your pace and interests.
          </p>
        </div>
      </section>

      <section className="recognition-section" aria-label="Featured in and recognized by">
        <div className="recognition-heading">
          <h2>Featured In &amp; Recognized By</h2>
          <div className="recognition-mark" aria-hidden="true">
            <span />
            <i />
            <span />
          </div>
        </div>
        <div className="recognition-panel">
          <img
            src="/images/recognition-media-logos.png"
            alt="CNN Travel, BBC Travel, USA Today, Outdoor, Lonely Planet, Tripadvisor, World Travel Awards, and ASTA"
            className="recognition-logo-strip"
          />
        </div>
      </section>

      <section className="curated-journeys-section">
        <div className="curated-journeys-inner">
          <div className="curated-journeys-kicker">
            <span />
            <p>Curated Journeys</p>
            <span />
          </div>
          <h2 className="curated-journeys-title">Explore China, Beautifully Curated</h2>
          <p className="curated-journeys-subtitle">
            Handpicked routes designed for first-time visitors, repeat explorers, and private
            custom travel.
          </p>

          <div className="curated-journeys-grid">
            {curatedJourneys.map((journey) => (
              <article
                key={journey.title}
                className={`curated-card ${journey.wide ? 'curated-card-wide' : ''}`}
              >
                <img src={journey.image} alt={journey.title} />
                <div className="curated-card-shade" />
                <div className="curated-card-top">
                  {journey.featured ? (
                    <span className="curated-pill curated-pill-gold">
                      <Star size={14} fill="currentColor" />
                      Most Popular
                    </span>
                  ) : (
                    <span className="curated-pill">
                      <CalendarDays size={14} />
                      {journey.days}
                    </span>
                  )}
                  {!journey.featured && (
                    <span className="curated-price">
                      <small>From</small>
                      <strong>On request</strong>
                    </span>
                  )}
                </div>
                <div className="curated-card-content">
                  <h3>{journey.title}</h3>
                  <p>{journey.subtitle}</p>
                  <div className="curated-tags">
                    {journey.places.map((place) => (
                      <span key={place}>
                        <MapPin size={14} fill="currentColor" />
                        {place}
                      </span>
                    ))}
                  </div>
                  <div className="curated-card-bottom">
                    {journey.featured && (
                      <p className="curated-from">
                        From <strong>On request</strong>
                      </p>
                    )}
                    <Link to="/china-trips" className="curated-button">
                      View Itinerary
                      <ArrowRight size={18} />
                    </Link>
                  </div>
                </div>
              </article>
            ))}

            <Link to="/custom-trip" className="curated-banner">
              <img src="/images/route-guilin-bamboo-raft-01.jpg" alt="Tailor-made private China tours" />
              <div className="curated-card-shade" />
              <div className="curated-banner-content">
                <span className="curated-banner-icon">
                  <Crown size={28} />
                </span>
                <div>
                  <h3>Tailor-Made Tours</h3>
                  <p>Private trips built around you.</p>
                  <span className="curated-button curated-button-compact">
                    Plan Your Trip
                    <ArrowRight size={17} />
                  </span>
                </div>
              </div>
            </Link>

            <Link to="/china-trips" className="curated-banner">
              <img src="/images/ref-tour-zhangjiajie.jpg" alt="More China tour routes" />
              <div className="curated-card-shade" />
              <div className="curated-banner-content">
                <span className="curated-banner-icon">
                  <Send size={26} />
                </span>
                <div>
                  <h3>More China Tours</h3>
                  <p>Explore more routes across China.</p>
                  <span className="curated-button curated-button-compact">
                    Browse All Tours
                    <ArrowRight size={17} />
                  </span>
                </div>
              </div>
            </Link>
          </div>

          <div className="curated-trust-bar">
            {curatedTrustItems.map(({ Icon, title, text }) => (
              <div key={title} className="curated-trust-item">
                <Icon size={36} strokeWidth={1.7} />
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-white py-18 section-padding md:py-24">
        <div className="real-moments-section">
          <div className="real-moments-header">
            <span className="real-moments-emblem">亭</span>
            <h2>REAL MOMENTS</h2>
            <p className="real-moments-script">From Our Private China Tours</p>
            <p className="real-moments-copy">
              Authentic experiences. Local connections. Unforgettable memories.
              <br />
              Discover the real China through the eyes of our travelers.
            </p>
          </div>

          <div className="real-moment-row">
            <div className="real-moment-row-head">
              <div className="real-moment-row-title">
                <Mountain size={44} strokeWidth={1.4} />
                <div>
                  <h3>Iconic Places, Timeless Beauty</h3>
                  <p>Curated destinations, beyond the guidebooks.</p>
                </div>
              </div>
              <div className="real-moment-arrows" aria-hidden="true">
                <button type="button">
                  <ArrowLeft size={24} />
                </button>
                <button type="button">
                  <ArrowRight size={24} />
                </button>
              </div>
            </div>

            <div className="real-moment-marquee">
              <div className="real-moment-track">
                {[...iconicMomentCards, ...iconicMomentCards].map((card, index) => (
                  <article key={`${card.title}-${index}`} className="real-place-card">
                    <img src={card.image} alt={card.title} />
                    <div className="real-place-card-shade" />
                    <div className="real-place-card-caption">
                      <MapPin size={24} />
                      <div>
                        <h4>{card.title}</h4>
                        <p>{card.place}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="real-moment-row real-moment-row-second">
            <div className="real-moment-row-head">
              <div className="real-moment-row-title">
                <UsersRound size={44} strokeWidth={1.4} />
                <div>
                  <h3>Real Travelers, Real Moments</h3>
                  <p>Genuine smiles. Meaningful connections.</p>
                </div>
              </div>
              <div className="real-moment-arrows" aria-hidden="true">
                <button type="button">
                  <ArrowLeft size={24} />
                </button>
                <button type="button">
                  <ArrowRight size={24} />
                </button>
              </div>
            </div>

            <div className="real-moment-marquee real-moment-marquee-reverse">
              <div className="real-moment-track">
                {[...travelerMomentCards, ...travelerMomentCards].map((card, index) => (
                  <article key={`${card.title}-${index}`} className="real-traveler-card">
                    <img src={card.image} alt={card.title} />
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="real-story-carousel">
            <div className="real-story-track">
              {travelerStories.map((story) => (
                <div key={story.title} className="real-story-feature">
                  <article className="real-story-card">
                    <div className="real-story-kicker">
                      <BookOpen size={29} strokeWidth={1.5} />
                      <span>Traveler Story</span>
                    </div>
                    <h3>{story.title}</h3>
                    <div className="real-story-byline">
                      <span className="real-story-avatar">
                        <img src={story.avatar} alt="" />
                      </span>
                      <span>By {story.author}</span>
                      <i />
                      <span>{story.country}</span>
                    </div>
                    {story.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                    <blockquote>
                      {story.quote}
                      <br />
                      {story.quoteSecondLine}
                    </blockquote>
                    <div className="real-story-tags">
                      {story.tags.map((tag, index) => {
                        const Icon = [MapPin, UsersRound, Leaf, Camera][index] ?? MapPin;
                        return (
                          <span key={tag}>
                            <Icon size={14} />
                            {tag}
                          </span>
                        );
                      })}
                    </div>
                    <Link to="/china-trips" className="real-story-link">
                      Read full story
                      <ArrowRight size={18} />
                    </Link>
                  </article>

                  <div className="real-story-visual">
                    <img
                      src={story.mainImage}
                      alt={story.location}
                      className="real-story-main-image"
                    />
                    <div className="real-story-location">
                      <MapPin size={20} />
                      {story.location}
                    </div>
                    <figure className="real-story-polaroid">
                      <img src={story.polaroidImage} alt={story.polaroidCaption} />
                      <figcaption>{story.polaroidCaption}</figcaption>
                    </figure>
                  </div>
                </div>
              ))}
            </div>
            <div className="real-story-dots" aria-hidden="true">
              {travelerStories.map((story, index) => (
                <span key={story.title} className={index === 0 ? 'active' : ''} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="home-final-cta">
        <img
          src="/images/route-beijing-greatwall-01.png"
          alt="Great Wall private China trip"
          className="home-final-cta-image"
        />
        <div className="home-final-cta-shade" />
        <div className="home-final-cta-inner">
          <div className="home-final-cta-copy">
            <h2>
              READY TO PLAN YOUR
              <br />
              PRIVATE CHINA TOUR?
            </h2>
            <p>
              Tell us your travel dates, interests, group size, and budget - we'll design
              <br />
              a fully customized itinerary just for you.
              <br />
              Perfect for families, group travelers, and first-time visitors.
            </p>
            <Link to="/custom-trip" className="home-final-cta-button">
              Start Your Custom Trip
              <ArrowRight size={31} strokeWidth={1.45} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
