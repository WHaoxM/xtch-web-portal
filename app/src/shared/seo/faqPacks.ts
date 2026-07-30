export type FaqItem = {
  question: string;
  answer: string;
};

/** Shared with TourCost visible FAQ + FAQPage schema (pre-existing page UI). */
export const tourCostFaqs: FaqItem[] = [
  {
    question: 'Why is there no fixed public price?',
    answer:
      'Private China tour cost depends on dates, cities, hotel level, group size, vehicle type, guide needs, flights or trains, and attraction tickets.',
  },
  {
    question: 'Can I control the budget?',
    answer:
      'Yes. The quickest levers are hotel level, route length, number of cities, guide days, and whether transfers use flights, trains, or private vehicles.',
  },
  {
    question: 'What should I send for a quote?',
    answer:
      'Share travel month, number of travelers, target cities, trip length, hotel level, and any route PDF or destination page you like.',
  },
];

/** Shared with RouteDetail visible FAQ + FAQPage schema (pre-existing page UI). */
export const routeGenericFaqs: FaqItem[] = [
  {
    question: 'Is this route good for first-time visitors to China?',
    answer:
      'Yes. It can be shaped into an easy first China journey with private pacing, clear transfers, and local guide support.',
  },
  {
    question: 'Can the itinerary be adjusted?',
    answer:
      'Yes. Dates, hotel level, route order, guide needs, and extra cities can be refined after you share your travel details.',
  },
  {
    question: 'Will the trip feel rushed?',
    answer:
      'The route is planned around realistic daily timing. If you prefer a slower pace, the same route can be extended or simplified.',
  },
  {
    question: 'How do I get an exact quote?',
    answer:
      'Send your travel month, group size, preferred hotel level, and must-see places through the custom trip form.',
  },
];

/** Only pages that already had visible FAQs before content-GEO work. */
export function faqsForPathname(pathname: string): FaqItem[] | null {
  if (pathname === '/china-private-tour-cost') return tourCostFaqs;
  if (pathname.startsWith('/tours/')) return routeGenericFaqs;
  return null;
}
