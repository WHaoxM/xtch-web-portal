import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer, type Namespace } from 'socket.io';
import { sql } from '../api/platform/db';
import { parseCookies } from '../api/domains/im/httpTypes';
import { hashToken } from '../api/domains/im/imAuth';

export type MessagingSocketPrincipal = {
  subject: string;
  role: string;
  tenantId: string | null;
  tenantIds?: string[];
  scopes: string[];
};

export type MessagingSocketAuthenticator = (
  bearerToken: string,
) => Promise<MessagingSocketPrincipal | null>;
export type MessagingVisitorAuthenticator = (sessionToken: string) => Promise<MessagingSocketPrincipal | null>;

export type MessagingSocketOptions = {
  authenticate: MessagingSocketAuthenticator;
  authenticateVisitor?: MessagingVisitorAuthenticator;
  allowedOrigins: string[];
  allowedRoles?: string[];
  path?: string;
  namespace?: string;
  maxHttpBufferSize?: number;
};

export type MessagingSocketServer = {
  io: SocketIOServer;
  namespace: Namespace;
};

/**
 * Attach the IM namespace to the existing Node HTTP server.
 *
 * The authenticator is deliberately injected: xtch-server must not share
 * XT_MVP's JWT signing secret. The next phase will provide the token-exchange
 * backed authenticator; until then, production keeps this integration disabled.
 */
export function createMessagingSocketServer(
  httpServer: HttpServer,
  options: MessagingSocketOptions,
): MessagingSocketServer {
  if (options.allowedOrigins.length === 0) {
    throw new Error('MESSAGING_SOCKET_ALLOWED_ORIGINS must contain at least one origin');
  }
  if (options.allowedOrigins.includes('*')) {
    throw new Error('MESSAGING_SOCKET_ALLOWED_ORIGINS cannot use wildcard origin');
  }

  const io = new SocketIOServer(httpServer, {
    path: options.path ?? '/socket.io/',
    cors: {
      origin: options.allowedOrigins,
      credentials: true,
    },
    maxHttpBufferSize: options.maxHttpBufferSize ?? 64 * 1024,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: false,
    },
  });

  const namespace = io.of(options.namespace ?? '/im');
  const allowedRoles = new Set(
    options.allowedRoles ?? ['platform_admin', 'tenant_admin', 'tenant_staff', 'visitor'],
  );

  namespace.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const cookieToken = parseCookies(socket.handshake.headers.cookie)['__Host-im_visitor'];
    if (typeof token !== 'string' && (!cookieToken || !options.authenticateVisitor)) {
      next(new Error('Authentication required'));
      return;
    }

    try {
      const principal = typeof token === 'string' && token.trim() !== ''
        ? await options.authenticate(token)
        : await options.authenticateVisitor!(cookieToken!);
      if (!principal) {
        next(new Error('Invalid authentication token'));
        return;
      }
      if (!allowedRoles.has(principal.role)) {
        next(new Error('Messaging access denied'));
        return;
      }
      socket.data.principal = principal;
      next();
    } catch {
      // Do not leak upstream auth errors or bearer tokens to the client/logs.
      next(new Error('Authentication service unavailable'));
    }
  });

  namespace.on('connection', (socket) => {
    const principal = socket.data.principal as MessagingSocketPrincipal;
    socket.join(`${principal.role === 'visitor' ? 'visitor' : 'staff'}:${principal.subject}`);
    if (principal.tenantId) socket.join(`tenant:${principal.tenantId}`);
    socket.on('conversation:subscribe', async (payload: unknown, acknowledge?: (result: unknown) => void) => {
      try {
        const conversationId = isRecord(payload) && typeof payload.conversationId === 'string'
          ? payload.conversationId
          : '';
        if (!/^[0-9a-f-]{36}$/i.test(conversationId)) {
          acknowledge?.({ ok: false, error: 'Invalid conversation id.' });
          return;
        }
        const result = principal.role === 'visitor'
          ? await sql<{ id: string }>`
              SELECT c.id
              FROM im_conversations c
              JOIN im_conversation_identities i ON i.conversation_id = c.id
                AND i.identity_type = 'visitor_session'
                AND i.identity_subject = ${principal.subject}
                AND i.revoked_at IS NULL
              WHERE c.id = ${conversationId}::uuid
            `
          : principal.role === 'platform_admin'
            ? await sql<{ id: string }>`
                SELECT c.id
                FROM im_conversations c
                WHERE c.id = ${conversationId}::uuid
              `
            : await sql<{ id: string }>`
              SELECT c.id
              FROM im_conversations c
              WHERE c.id = ${conversationId}::uuid
                AND (
                  EXISTS (
                    SELECT 1 FROM im_conversation_members m
                    WHERE m.conversation_id = c.id
                      AND m.principal_type = 'staff'
                      AND m.principal_id = ${principal.subject}
                      AND m.left_at IS NULL
                  )
                  OR (
                    c.tenant_id = ANY(${principal.tenantIds ?? (principal.tenantId ? [principal.tenantId] : [])}::uuid[])
                    AND 'im:conversation:read' = ANY(${principal.scopes}::text[])
                  )
                )
            `;
        if (!result.rows[0]) {
          acknowledge?.({ ok: false, error: 'Conversation access denied.' });
          return;
        }
        socket.join(`im:conversation:${conversationId}`);
        acknowledge?.({ ok: true, conversationId });
      } catch {
        acknowledge?.({ ok: false, error: 'Conversation subscription unavailable.' });
      }
    });
  });

  return { io, namespace };
}

export async function authenticateVisitorSession(sessionToken: string): Promise<MessagingSocketPrincipal | null> {
  const result = await sql<{ id: string }>`
    SELECT id
    FROM im_visitor_sessions
    WHERE session_token_hash = ${hashToken(sessionToken)}
      AND revoked_at IS NULL
      AND expires_at > NOW()
  `;
  const session = result.rows[0];
  return session
    ? { subject: session.id, role: 'visitor', tenantId: null, scopes: ['im:visitor'] }
    : null;
}

export function parseMessagingSocketOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Authenticate an xtch access token through a private introspection endpoint.
 * The endpoint is intentionally configured separately from XT_MVP: the mobile
 * app will hold an xtch token after token exchange, while XT_MVP remains the
 * source of B-side identity and roles.
 */
export function createRemoteMessagingAuthenticator(
  introspectionUrl: string,
  timeoutMs = 3_000,
): MessagingSocketAuthenticator {
  const url = new URL(introspectionUrl);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('MESSAGING_SOCKET_AUTH_URL must use HTTPS (or localhost during development)');
  }

  return async (bearerToken) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${bearerToken}`,
          'content-type': 'application/json',
          ...(process.env.MESSAGING_SOCKET_AUTH_SECRET
            ? { 'x-im-introspection-secret': process.env.MESSAGING_SOCKET_AUTH_SECRET }
            : {}),
        },
        body: '{}',
        signal: controller.signal,
      });
      if (!response.ok) return null;

      const payload: unknown = await response.json();
      const envelope = isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
      if (!isRecord(envelope)) return null;

      const subject = typeof envelope.subject === 'string'
        ? envelope.subject
        : typeof envelope.id === 'string'
          ? envelope.id
          : null;
      const role = typeof envelope.role === 'string' ? envelope.role : null;
      if (!subject || !role) return null;

      const tenantValue = envelope.tenantId ?? envelope.tenant_id;
      const rawTenantIds = envelope.tenantIds ?? envelope.tenant_ids;
      const tenantIds = Array.isArray(rawTenantIds)
        ? rawTenantIds.filter((tenant): tenant is string => typeof tenant === 'string')
        : typeof tenantValue === 'string' ? [tenantValue] : [];
      return {
        subject,
        role,
        tenantId: typeof tenantValue === 'string' ? tenantValue : null,
        tenantIds,
        scopes: Array.isArray(envelope.scopes)
          ? envelope.scopes.filter((scope): scope is string => typeof scope === 'string')
          : [],
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
