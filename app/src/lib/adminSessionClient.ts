export type AdminRole = 'ops' | 'tech';

export type AdminMe = {
  email: string;
  role: AdminRole;
};

export async function fetchAdminMe(token: string): Promise<AdminMe> {
  const response = await fetch('/api/admin/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    email?: string;
    role?: AdminRole;
    error?: string;
  } | null;

  if (!response.ok || !payload?.ok || !payload.email || !payload.role) {
    throw new Error(payload?.error || 'Failed to load admin session.');
  }

  return { email: payload.email, role: payload.role };
}

export function adminRoleLabel(role: AdminRole): string {
  return role === 'tech' ? '技术' : '运营';
}
