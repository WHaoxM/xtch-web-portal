type VercelRequestLike = {
  headers: Record<string, string | string[] | undefined>;
};

type AuthUser = {
  id: string;
  email: string;
};

export type UserAuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; user: null };

export async function getUserFromRequest(req: VercelRequestLike): Promise<UserAuthResult> {
  const bypassEmail = process.env.DEV_AUTH_BYPASS_EMAIL;
  const authHeader = headerValue(req.headers.authorization);

  if (bypassEmail && authHeader === 'Bearer dev-bypass-token') {
    return { ok: true, user: { id: 'dev-bypass-user-id', email: bypassEmail } };
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, user: null };
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return { ok: false, user: null };
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, '');
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, user: null };
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
    });

    if (!response.ok) {
      return { ok: false, user: null };
    }

    const user = (await response.json()) as { id?: string; email?: string };
    if (!user.id || !user.email) {
      return { ok: false, user: null };
    }

    return { ok: true, user: { id: user.id, email: user.email } };
  } catch (error) {
    console.error('User auth verification failed:', error);
    return { ok: false, user: null };
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
