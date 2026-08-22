export type ContentStatus = 'published' | 'draft' | 'archived';

export type Destination = {
  slug: string;
  name: string;
  description: string;
  image: string;
  displayOrder: number;
  status: ContentStatus;
  travelStyles: string[];
  featuredOnHome: boolean;
  featuredPriority: number;
};

export async function fetchDestinations(): Promise<Destination[]> {
  const response = await fetch('/api/destinations', { cache: 'no-store' });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'Unexpected destinations response.',
  }))) as { ok: boolean; destinations?: Destination[]; error?: string };

  if (!response.ok || !result.ok || !Array.isArray(result.destinations)) {
    throw new Error(result.error || 'We could not load destinations.');
  }

  return result.destinations;
}

export async function fetchAdminDestinations(token: string): Promise<Destination[]> {
  const response = await fetch('/api/admin/destinations', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'Unexpected admin destinations response.',
  }))) as { ok: boolean; destinations?: Destination[]; error?: string };

  if (!response.ok || !result.ok || !Array.isArray(result.destinations)) {
    throw new Error(result.error || 'We could not load admin destinations.');
  }

  return result.destinations;
}

export async function postAdminDestination(
  token: string,
  body: Record<string, unknown>,
): Promise<{ destinations: Destination[] }> {
  const response = await fetch('/api/admin/destinations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'Unexpected admin destinations response.',
  }))) as { ok: boolean; destinations?: Destination[]; error?: string };

  if (!response.ok || !result.ok) {
    throw new Error(result.error || 'Admin request failed.');
  }

  return { destinations: result.destinations ?? [] };
}
