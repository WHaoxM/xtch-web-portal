/**
 * Turns a structured itinerary day (city/attractions/meals/accommodation/
 * transport/notes) into the connected "one day, one paragraph" narrative
 * text that RouteDetail.tsx and ChinaTripsMobile.tsx already render for the
 * legacy `routePdfDetails.ts` days. Shared by both pages via
 * `routesClient.ts` (`toRouteTour()` calls this once per day when a route
 * has structured itinerary data).
 */
export type AssembleDayInput = {
  city?: string | null;
  attractions?: string[] | null;
  meals?: string | null;
  accommodation?: string | null;
  transport?: string | null;
  notes?: string[] | null;
};

export function assembleDayText(day: AssembleDayInput): string {
  const city = clean(day.city);
  const attractions = cleanList(day.attractions);
  const meals = clean(day.meals);
  const accommodation = clean(day.accommodation);
  const transport = clean(day.transport);
  const notes = cleanList(day.notes);

  const sentences: string[] = [];

  if (attractions.length > 0) {
    const narrative = joinAttractionsNarrative(attractions);
    sentences.push(city ? `In ${city}, visit ${narrative}.` : `Visit ${narrative}.`);
  } else if (city) {
    sentences.push(`Spend the day around ${city}.`);
  }

  const supportClauses: string[] = [];
  if (transport) supportClauses.push(decapitalize(transport));
  if (meals) supportClauses.push(`meals include ${decapitalize(meals)}`);
  if (accommodation) supportClauses.push(`overnight at ${accommodation}`);
  if (supportClauses.length > 0) {
    sentences.push(`${capitalize(joinWithAnd(supportClauses))}.`);
  }

  notes.forEach((note) => sentences.push(ensureFullStop(note)));

  if (sentences.length === 0) {
    return 'Details for this day will be confirmed with your travel consultant.';
  }

  return sentences.join(' ').trim();
}

function joinAttractionsNarrative(attractions: string[]): string {
  if (attractions.length === 1) return attractions[0];
  if (attractions.length === 2) return `${attractions[0]}, then ${attractions[1]}`;
  const last = attractions[attractions.length - 1];
  const middle = attractions.slice(1, -1);
  const middleText = middle.map((item) => `continue to ${item}`).join(', ');
  return `${attractions[0]}, ${middleText}, then ${last}`;
}

function joinWithAnd(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function clean(value?: string | null): string {
  return (value ?? '').trim();
}

function cleanList(values?: string[] | null): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((value) => (value ?? '').trim()).filter(Boolean);
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function decapitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function ensureFullStop(value: string): string {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}
