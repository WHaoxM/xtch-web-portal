export type CategoryScope = 'destination' | 'route';

export type Category = {
  id: string;
  key: string;
  label: string;
  scope: CategoryScope;
  sortOrder: number;
  enabled: boolean;
};

export async function fetchCategories(scope: CategoryScope): Promise<Category[]> {
  const response = await fetch(`/api/categories?scope=${scope}`, { cache: 'no-store' });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'Unexpected categories response.',
  }))) as { ok: boolean; categories?: Category[]; error?: string };

  if (!response.ok || !result.ok || !Array.isArray(result.categories)) {
    throw new Error(result.error || 'We could not load categories.');
  }

  return result.categories;
}

export async function fetchAdminCategories(token: string): Promise<Category[]> {
  const response = await fetch('/api/admin/categories', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'Unexpected admin categories response.',
  }))) as { ok: boolean; categories?: Category[]; error?: string };

  if (!response.ok || !result.ok || !Array.isArray(result.categories)) {
    throw new Error(result.error || 'We could not load admin categories.');
  }

  return result.categories;
}

export async function postAdminCategory(
  token: string,
  body: Record<string, unknown>,
): Promise<{ categories: Category[] }> {
  const response = await fetch('/api/admin/categories', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'Unexpected admin categories response.',
  }))) as { ok: boolean; categories?: Category[]; error?: string };

  if (!response.ok || !result.ok) {
    throw new Error(result.error || 'Admin request failed.');
  }

  return { categories: result.categories ?? [] };
}
