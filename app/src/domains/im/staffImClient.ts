import { io, type Socket } from 'socket.io-client';

const configuredBase = (import.meta.env?.VITE_IM_API_BASE_URL ?? '').trim().replace(/\/$/, '');

function apiUrl(path: string): string {
  return `${configuredBase}${path}`;
}

export type ImConversationStatus = 'open' | 'pending' | 'closed';
export type ImConversationScope = 'queue' | 'mine' | 'all';

export type StaffConversation = {
  id: string;
  status: ImConversationStatus;
  priority: string;
  source: string;
  tenant_id: string | null;
  version: number;
  last_message_seq: number;
  last_message_at: string | null;
  updated_at: string;
  visitor_id: string | null;
  visitor_display_name: string | null;
  visitor_email: string | null;
  primary_staff_id: string | null;
  primary_staff_name: string | null;
  last_message_body: string | null;
  last_message_sender_type: 'visitor' | 'staff' | 'system' | null;
};

export type StaffConversationDetail = StaffConversation & {
  visitor_phone: string | null;
  created_at: string;
};

export type StaffConversationMember = {
  principal_type: 'visitor' | 'staff';
  principal_id: string;
  identity_assurance: string;
  member_role: string;
  joined_at: string;
  left_at: string | null;
  display_name: string | null;
  username: string | null;
};

export type StaffAssignment = {
  staff_id: string;
  assignment_role: string;
  status: string;
  assigned_by: string | null;
  reason: string | null;
  started_at: string;
  ended_at: string | null;
  staff_name: string | null;
};

export type StaffMessage = {
  id: string;
  conversation_id: string;
  seq: number;
  client_message_id: string | null;
  sender_type: 'visitor' | 'staff' | 'system';
  sender_id: string | null;
  content_type: string;
  body: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type ChatAttachmentKind = 'image' | 'file';

export type ChatAttachmentTicket = {
  attachmentId: string;
  filename: string;
  contentType: string;
  byteSize: number;
  kind: ChatAttachmentKind;
  uploadUrl: string;
  expiresInSeconds: number;
};

export type StaffConversationList = {
  items: StaffConversation[];
  nextCursor: string | null;
};

export type StaffConversationDetailResponse = {
  conversation: StaffConversationDetail;
  members: StaffConversationMember[];
  assignments: StaffAssignment[];
  readCursor: { last_read_seq: number; updated_at: string | null };
};

export class StaffImError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'StaffImError';
    this.status = status;
  }
}

type ExchangeResponse = {
  ok?: boolean;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  staff?: {
    id: string;
    username: string;
    display_name: string;
    account_type: string;
    permissions: string[];
    tenant_ids: string[];
  };
  error?: string;
};

type LocalLoginResponse = ExchangeResponse;

/**
 * Browser-side adapter for the staff IM API. The admin session remains the
 * source of identity; this adapter exchanges it for the short-lived IM token
 * and retries once after a token expiry. The adapter never creates synthetic
 * conversations or messages.
 */
export class StaffImClient {
  private readonly adminAccessToken: string;
  private imAccessToken: string | null = null;
  private imRefreshToken: string | null = null;
  private authMode: 'exchange' | 'local' = 'exchange';
  private exchangePromise: Promise<string> | null = null;
  private refreshPromise: Promise<string> | null = null;
  private staffProfile: ExchangeResponse['staff'] | null = null;

  constructor(adminAccessToken: string) {
    this.adminAccessToken = adminAccessToken;
  }

  async authenticate(): Promise<{ id: string; displayName: string; permissions: string[]; accountType: string }> {
    await this.exchange();
    return this.profile();
  }

  /**
   * Authenticate a local IM staff account. This is intentionally separate
   * from the portal/Supabase admin session: the backend validates the staff
   * account, password and IM permissions before issuing an xtch token.
   * Passwords are sent only for this request and are never retained here.
   */
  async loginLocal(username: string, password: string): Promise<{
    id: string;
    displayName: string;
    permissions: string[];
    accountType: string;
  }> {
    const response = await fetch(apiUrl('/api/im/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ username, password }),
      cache: 'no-store',
      credentials: 'include',
    });
    const payload = (await response.json().catch(() => null)) as LocalLoginResponse | null;
    if (!response.ok || !payload?.ok || !payload.access_token) {
      throw new StaffImError(payload?.error || '客服账号登录失败。', response.status);
    }
    this.authMode = 'local';
    this.imAccessToken = payload.access_token;
    this.imRefreshToken = payload.refresh_token || null;
    this.staffProfile = payload.staff || null;
    return this.profile();
  }

  async listConversations(options: {
    scope: ImConversationScope;
    status?: ImConversationStatus | '';
    limit?: number;
    cursor?: string | null;
  }): Promise<StaffConversationList> {
    const query = new URLSearchParams({
      scope: options.scope,
      limit: String(options.limit ?? 60),
    });
    if (options.status) query.set('status', options.status);
    if (options.cursor) query.set('cursor', options.cursor);
    return this.request<StaffConversationList>(apiUrl(`/api/im/conversations?${query.toString()}`));
  }

  async getConversation(conversationId: string): Promise<StaffConversationDetailResponse> {
    return this.request<StaffConversationDetailResponse>(apiUrl(`/api/im/conversations/${encodeURIComponent(conversationId)}`));
  }

  async listMessages(conversationId: string, afterSeq = 0, limit = 200): Promise<{ items: StaffMessage[]; nextAfterSeq: number }> {
    const query = new URLSearchParams({ after_seq: String(afterSeq), limit: String(limit) });
    return this.request<{ items: StaffMessage[]; nextAfterSeq: number }>(
      apiUrl(`/api/im/conversations/${encodeURIComponent(conversationId)}/messages?${query.toString()}`),
    );
  }

  async sendMessage(conversationId: string, body: string, clientMessageId: string,
    contentType: string = 'text', metadata: Record<string, unknown> = {}): Promise<StaffMessage> {
    const payload = await this.request<{ message: StaffMessage }>(
      apiUrl(`/api/im/conversations/${encodeURIComponent(conversationId)}/messages`),
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': clientMessageId,
        },
        body: JSON.stringify({ body, clientMessageId, contentType, metadata }),
      },
    );
    return payload.message;
  }

  async createAttachmentTicket(conversationId: string, clientUploadId: string, file: {
    filename: string; contentType: string; byteSize: number; kind: ChatAttachmentKind;
  }): Promise<ChatAttachmentTicket> {
    const payload = await this.request<{ ticket: ChatAttachmentTicket }>(apiUrl('/api/im/staff-media'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': clientUploadId },
      body: JSON.stringify({ action: 'upload', conversationId, clientUploadId, file }),
    });
    return payload.ticket;
  }

  async uploadAttachment(conversationId: string, file: File, clientUploadId: string, clientMessageId: string,
    contentType: string, kind: ChatAttachmentKind): Promise<StaffMessage> {
    const fileInfo = { filename: file.name, contentType, byteSize: file.size, kind };
    let ticket = await this.createAttachmentTicket(conversationId, clientUploadId, fileInfo);
    if (ticket.uploadUrl) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 90_000);
      let response: Response;
      try {
        response = await fetch(ticket.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': ticket.contentType, 'if-none-match': '*' },
          body: file,
          cache: 'no-store',
          credentials: 'omit',
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeout);
      }
      if (response.status === 412) {
        ticket = await this.createAttachmentTicket(conversationId, clientUploadId, fileInfo);
        if (ticket.uploadUrl) throw new StaffImError('附件正在处理中，请稍后重试。');
      } else if (!response.ok) {
        throw new StaffImError('附件上传失败，请重试。');
      }
    }
    return this.sendMessage(conversationId, ticket.filename, clientMessageId, kind, { attachmentId: ticket.attachmentId });
  }

  async listAttachmentUrls(conversationId: string, attachmentIds: string[]): Promise<Record<string, string>> {
    const payload = await this.request<{ urls: Record<string, string> }>(apiUrl('/api/im/staff-media'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'links', conversationId, attachmentIds }),
    });
    return payload.urls || {};
  }

  async updateStatus(conversationId: string, status: ImConversationStatus, expectedVersion?: number): Promise<StaffConversation> {
    const payload = await this.request<{ conversation: StaffConversation }>(
      apiUrl(`/api/im/conversations/${encodeURIComponent(conversationId)}/status`),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status, ...(expectedVersion === undefined ? {} : { expectedVersion }) }),
      },
    );
    return payload.conversation;
  }

  async assign(conversationId: string, action: 'claim' | 'takeover' | 'transfer' = 'claim', targetStaffId?: string): Promise<void> {
    await this.request<{ assignment: unknown }>(apiUrl('/api/im/conversations/assign'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversationId, action, ...(targetStaffId ? { targetStaffId } : {}) }),
    });
  }

  async markRead(conversationId: string, lastReadSeq: number): Promise<void> {
    await this.request<{ lastReadSeq: number }>(
      apiUrl(`/api/im/conversations/${encodeURIComponent(conversationId)}/read`),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lastReadSeq }),
      },
    );
  }

  async connectRealtime(onMessage: (message: StaffMessage) => void, conversationId?: string): Promise<() => void> {
    const token = await this.exchange();
    const origin = configuredBase || window.location.origin;
    const socket: Socket = io(`${origin}/im`, {
      path: '/socket.io/',
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    socket.on('message.created', (payload: unknown) => {
      if (!isRecord(payload) || !isRecord(payload.message)) return;
      const message = payload.message as Partial<StaffMessage>;
      if (typeof message.id !== 'string' || typeof message.conversation_id !== 'string' || typeof message.seq !== 'number') return;
      if (typeof message.body !== 'string' || typeof message.sender_type !== 'string') return;
      onMessage({
        id: message.id,
        conversation_id: message.conversation_id,
        seq: message.seq,
        client_message_id: typeof message.client_message_id === 'string' ? message.client_message_id : null,
        sender_type: message.sender_type as StaffMessage['sender_type'],
        sender_id: typeof message.sender_id === 'string' ? message.sender_id : null,
        content_type: typeof message.content_type === 'string' ? message.content_type : 'text',
        body: message.body,
        metadata: isRecord(message.metadata) ? message.metadata : null,
        created_at: typeof message.created_at === 'string' ? message.created_at : new Date().toISOString(),
      });
    });
    await new Promise<void>((resolve, reject) => {
      if (socket.connected) {
        resolve();
        return;
      }
      const onConnect = () => { socket.off('connect_error', onError); resolve(); };
      const onError = () => { socket.off('connect', onConnect); socket.disconnect(); reject(new StaffImError('实时连接暂不可用，将继续使用自动刷新。')); };
      socket.once('connect', onConnect);
      socket.once('connect_error', onError);
    });
    if (conversationId && socket.connected) {
      await new Promise<void>((resolve, reject) => {
        socket.timeout(5_000).emit('conversation:subscribe', { conversationId }, (timeoutError: Error | null, result: unknown) => {
          if (timeoutError) { socket.disconnect(); reject(new StaffImError('实时订阅超时，将继续使用自动刷新。')); return; }
          if (!isRecord(result) || result.ok !== true) { socket.disconnect(); reject(new StaffImError(isRecord(result) && typeof result.error === 'string' ? result.error : '实时订阅失败，将继续使用自动刷新。')); return; }
          resolve();
        });
      });
    }
    return () => socket.disconnect();
  }

  private async exchange(): Promise<string> {
    if (this.imAccessToken) return this.imAccessToken;
    if (this.authMode === 'local') return this.refreshLocal();
    if (this.exchangePromise) return this.exchangePromise;
    this.exchangePromise = (async () => {
      const response = await fetch(apiUrl('/api/im/auth/exchange'), {
        method: 'POST',
        headers: { authorization: `Bearer ${this.adminAccessToken}`, accept: 'application/json' },
        cache: 'no-store',
        credentials: 'include',
      });
      const payload = (await response.json().catch(() => null)) as ExchangeResponse | null;
      if (!response.ok || !payload?.ok || !payload.access_token) {
        throw new StaffImError(payload?.error || '客服工作台身份交换失败。', response.status);
      }
      this.authMode = 'exchange';
      this.imAccessToken = payload.access_token;
      this.imRefreshToken = payload.refresh_token || null;
      this.staffProfile = payload.staff || null;
      return payload.access_token;
    })().finally(() => {
      this.exchangePromise = null;
    });
    return this.exchangePromise;
  }

  private async refreshLocal(): Promise<string> {
    if (this.imAccessToken) return this.imAccessToken;
    if (!this.imRefreshToken) throw new StaffImError('客服登录已过期，请重新登录。', 401);
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      const response = await fetch(apiUrl('/api/im/auth/refresh'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ refresh_token: this.imRefreshToken }),
        cache: 'no-store',
        credentials: 'include',
      });
      const payload = (await response.json().catch(() => null)) as LocalLoginResponse | null;
      if (!response.ok || !payload?.ok || !payload.access_token) {
        this.imAccessToken = null;
        this.imRefreshToken = null;
        this.staffProfile = null;
        throw new StaffImError(payload?.error || '客服登录已过期，请重新登录。', response.status);
      }
      this.imAccessToken = payload.access_token;
      this.imRefreshToken = payload.refresh_token || this.imRefreshToken;
      if (payload.staff) this.staffProfile = { ...this.staffProfile, ...payload.staff };
      return payload.access_token;
    })().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
    const token = await this.exchange();
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${token}`);
    headers.set('accept', 'application/json');
    const response = await fetch(path, { ...init, headers, cache: 'no-store', credentials: 'include' });
    const payload = (await response.json().catch(() => null)) as ({ ok?: boolean; error?: string } & T) | null;
    if (response.status === 401 && !retried) {
      this.imAccessToken = null;
      if (this.authMode === 'local' && this.imRefreshToken) {
        await this.refreshLocal();
        return this.request<T>(path, init, true);
      }
      return this.request<T>(path, init, true);
    }
    if (!response.ok || !payload?.ok) {
      throw new StaffImError(payload?.error || `客服接口请求失败（${response.status}）。`, response.status);
    }
    return payload as T;
  }

  private profile(): { id: string; displayName: string; permissions: string[]; accountType: string } {
    return {
      id: this.staffProfile?.id || '',
      displayName: this.staffProfile?.display_name || '客服同事',
      permissions: this.staffProfile?.permissions || [],
      accountType: this.staffProfile?.account_type || 'staff',
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
