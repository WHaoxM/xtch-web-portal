import { ensureFreshSession } from '../traveler/authClient';

export type AdminRole = 'ops' | 'tech';

export type AdminMe = {
  email: string;
  role: AdminRole;
};

export async function fetchAdminMe(token: string): Promise<AdminMe> {
  const attempt = async (accessToken: string) => {
    const response = await fetch('/api/admin/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      email?: string;
      role?: AdminRole;
      error?: string;
    } | null;

    return { response, payload };
  };

  let { response, payload } = await attempt(token);

  if (response.status === 401) {
    const fresh = await ensureFreshSession();
    if (fresh?.accessToken) {
      ({ response, payload } = await attempt(fresh.accessToken));
    }
  }

  if (!response.ok || !payload?.ok || !payload.email || !payload.role) {
    throw new Error(payload?.error || 'Failed to load admin session.');
  }

  return { email: payload.email, role: payload.role };
}

export function adminRoleLabel(role: AdminRole): string {
  return role === 'tech' ? '技术' : '运营';
}
