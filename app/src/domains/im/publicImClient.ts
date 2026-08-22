import { io, type Socket } from 'socket.io-client';

export type PublicImSource = 'portal_web' | 'portal_mobile';

export const PUBLIC_IM_OPEN_EVENT = 'xtch:open-public-im';

export type PublicImConversation = {
  id: string;
  status: string;
  last_message_seq: number;
  last_message_at: string | null;
  updated_at: string;
};

export type PublicImMessage = {
  id: string;
  conversation_id: string;
  seq: number;
  client_message_id: string;
  sender_type: 'visitor' | 'staff' | 'system' | string;
  sender_id: string;
  content_type: 'text' | string;
  body: string;
  metadata?: unknown;
  created_at: string;
};

type PublicImSession = {
  visitor: { id: string; email: string | null; authenticatedUserId: string | null };
  conversations: PublicImConversation[];
};

type PublicImPayload<T> = { ok: true } & T;

const configuredBase = (import.meta.env.VITE_IM_API_BASE_URL ?? '').trim().replace(/\/$/, '');
const apiBase = configuredBase || '';

function apiUrl(path: string): string {
  return `${apiBase}${path}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...options,
    credentials: 'include',
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'Messaging service unavailable.');
  }
  return payload as T;
}

export async function establishPublicImSession(): Promise<PublicImSession> {
  return request<PublicImPayload<PublicImSession>>('/api/im/public/session', { method: 'POST' });
}

export async function createPublicImConversation(source: PublicImSource): Promise<PublicImConversation> {
  const result = await request<PublicImPayload<{ conversation: PublicImConversation }>>(
    '/api/im/public/conversations',
    { method: 'POST', body: JSON.stringify({ source }) },
  );
  return result.conversation;
}

export async function listPublicImMessages(
  conversationId: string,
  afterSeq = 0,
): Promise<PublicImMessage[]> {
  const query = new URLSearchParams({ after_seq: String(Math.max(0, afterSeq)), limit: '200' });
  const result = await request<PublicImPayload<{ items: PublicImMessage[] }>>(
    `/api/im/public/conversations/${encodeURIComponent(conversationId)}/messages?${query.toString()}`,
  );
  return result.items;
}

export async function sendPublicImMessage(
  conversationId: string,
  body: string,
  idempotencyKey?: string,
): Promise<PublicImMessage> {
  const result = await request<PublicImPayload<{ message: PublicImMessage }>>(
    `/api/im/public/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: 'POST',
      headers: { 'idempotency-key': idempotencyKey ?? crypto.randomUUID() },
      body: JSON.stringify({ body, contentType: 'text' }),
    },
  );
  return result.message;
}

export function connectPublicImSocket(
  onMessage: (message: PublicImMessage) => void,
): { socket: Socket; subscribe: (conversationId: string) => void } | null {
  if (typeof window === 'undefined') return null;
  const origin = configuredBase || window.location.origin;
  const socket = io(`${origin}/im`, {
    path: '/socket.io/',
    withCredentials: true,
    autoConnect: false,
    transports: ['websocket', 'polling'],
  });
  socket.on('message.created', (payload: unknown) => {
    if (!isRecord(payload) || !isRecord(payload.message)) return;
    const message = payload.message as Partial<PublicImMessage>;
    if (typeof message.id !== 'string' || typeof message.conversation_id !== 'string' || typeof message.seq !== 'number') return;
    if (typeof message.body !== 'string' || typeof message.sender_type !== 'string') return;
    onMessage(message as PublicImMessage);
  });
  return {
    socket,
    subscribe: (conversationId) => {
      socket.emit('conversation:subscribe', { conversationId });
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
