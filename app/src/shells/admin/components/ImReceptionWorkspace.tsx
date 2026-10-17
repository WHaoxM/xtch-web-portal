import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Inbox,
  Image as ImageIcon,
  KeyRound,
  Languages,
  Loader2,
  LogIn,
  Mail,
  MessageCircle,
  Paperclip,
  Phone,
  RefreshCw,
  Send,
  Sparkles,
  UserRound,
  UsersRound,
  X,
  Zap,
} from 'lucide-react';
import {
  StaffImClient,
  StaffImError,
  type ImConversationScope,
  type ImConversationStatus,
  type ChatAttachmentKind,
  type StaffAssignment,
  type StaffConversation,
  type StaffConversationDetailResponse,
  type StaffMessage,
} from '@/domains/im/staffImClient';
import { cn } from '@/lib/utils';

type LocalMessage = StaffMessage & { delivery?: 'sending' | 'failed' };

type ImReceptionWorkspaceProps = {
  adminToken: string;
  operatorEmail: string;
  onExit: () => void;
  onSignOut: () => void;
};

const SCOPE_TABS: Array<{ value: ImConversationScope; label: string }> = [
  { value: 'queue', label: '待接待' },
  { value: 'mine', label: '我的会话' },
  { value: 'all', label: '全部会话' },
];

const STATUS_FILTERS: Array<{ value: ImConversationStatus | ''; label: string }> = [
  { value: '', label: '未关闭' },
  { value: 'open', label: '进行中' },
  { value: 'pending', label: '待跟进' },
  { value: 'closed', label: '已结束' },
];

const STATUS_COPY: Record<ImConversationStatus, string> = {
  open: '进行中',
  pending: '待跟进',
  closed: '已结束',
};

function sourceLabel(source: string): string {
  const normalized = source.trim().toLowerCase();
  if (normalized === 'wenshuzhilv' || normalized === 'wenshu') return '文数智旅官网';
  if (normalized === 'xuntingtravel' || normalized === 'portal') return '寻亭旅行官网';
  return source.trim() || '官网访客';
}

function visitorName(conversation: Pick<StaffConversation, 'visitor_display_name' | 'visitor_email'>): string {
  return conversation.visitor_display_name?.trim() || conversation.visitor_email?.trim() || '未命名访客';
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '刚刚';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '刚刚';
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function mergeMessages(previous: LocalMessage[], incoming: StaffMessage[]): LocalMessage[] {
  if (!incoming.length) return previous;
  const next = [...previous];
  for (const item of incoming) {
    const byClientId = item.client_message_id
      ? next.findIndex((message) => message.client_message_id === item.client_message_id)
      : -1;
    const byId = next.findIndex((message) => message.id === item.id);
    const index = byClientId >= 0 ? byClientId : byId;
    if (index >= 0) next[index] = item;
    else next.push(item);
  }
  return next.sort((a, b) => a.seq - b.seq);
}

function statusTone(status: ImConversationStatus): string {
  if (status === 'pending') return 'border-amber-300/30 bg-amber-300/10 text-amber-200';
  if (status === 'closed') return 'border-white/15 bg-white/5 text-slate-300';
  return 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200';
}

function avatarInitial(name: string): string {
  return Array.from(name.trim())[0] || '客';
}

function activeAssignment(assignments: StaffAssignment[]): StaffAssignment | null {
  return assignments.find((assignment) => assignment.assignment_role === 'primary' && assignment.status === 'active') || null;
}

const CHAT_ATTACHMENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

function inspectStaffAttachment(file: File, kind: ChatAttachmentKind): string {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const contentType = CHAT_ATTACHMENT_TYPES[extension];
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension);
  if (!contentType || (kind === 'image' ? !isImage : isImage)) {
    throw new Error('不支持此文件类型。图片支持 JPG、PNG、WEBP、GIF；文件支持 PDF、TXT、CSV、DOCX、XLSX、PPTX。');
  }
  const maxBytes = kind === 'image' ? 8 * 1024 * 1024 : 15 * 1024 * 1024;
  if (!file.size || file.size > maxBytes) throw new Error(kind === 'image' ? '图片大小不能超过 8 MB。' : '文件大小不能超过 15 MB。');
  return contentType;
}

function formatAttachmentSize(value: unknown): string {
  const bytes = Number(value) || 0;
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ImReceptionWorkspace({ adminToken, operatorEmail, onExit, onSignOut }: ImReceptionWorkspaceProps) {
  const clientRef = useRef<StaffImClient | null>(null);
  const messageSeqRef = useRef(0);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentFileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingAttachmentFilesRef = useRef(new Map<string, File>());
  const attachmentUrlRefreshAtRef = useRef(new Map<string, number>());
  const [operatorId, setOperatorId] = useState('');
  const [operatorAccountType, setOperatorAccountType] = useState('staff');
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const [operatorName, setOperatorName] = useState('客服同事');
  const [scope, setScope] = useState<ImConversationScope>('queue');
  const [statusFilter, setStatusFilter] = useState<ImConversationStatus | ''>('');
  const [conversations, setConversations] = useState<StaffConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;
  const [detail, setDetail] = useState<StaffConversationDetailResponse | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [attachmentLinkFailures, setAttachmentLinkFailures] = useState<Record<string, boolean>>({});
  const [attachmentRefreshTick, setAttachmentRefreshTick] = useState(0);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [queueLoading, setQueueLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [staffLoginOpen, setStaffLoginOpen] = useState(false);
  const [staffLoginBusy, setStaffLoginBusy] = useState(false);
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [queueOpen, setQueueOpen] = useState(false);
  const [error, setError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [realtimeState, setRealtimeState] = useState<'connecting' | 'connected' | 'polling'>('connecting');

  const authenticateClient = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return false;
    try {
      const profile = await client.authenticate();
      setOperatorId(profile.id);
      setOperatorAccountType(profile.accountType);
      setOperatorName(profile.displayName);
      setRealtimeState('connecting');
      setReady(true);
      setError('');
      return true;
    } catch (err) {
      setReady(false);
      setStaffLoginOpen(true);
      setError(err instanceof Error ? err.message : '客服身份验证失败。');
      return false;
    }
  }, []);

  const loginLocalStaff = useCallback(async () => {
    const client = clientRef.current;
    const username = staffUsername.trim();
    if (!client || !username || !staffPassword) return false;
    setStaffLoginBusy(true);
    try {
      const profile = await client.loginLocal(username, staffPassword);
      setOperatorId(profile.id);
      setOperatorAccountType(profile.accountType);
      setOperatorName(profile.displayName);
      setRealtimeState('connecting');
      setReady(true);
      setStaffLoginOpen(false);
      setStaffPassword('');
      setError('');
      return true;
    } catch (err) {
      setReady(false);
      setError(err instanceof Error ? err.message : '客服账号登录失败。');
      return false;
    } finally {
      setStaffLoginBusy(false);
    }
  }, [staffPassword, staffUsername]);

  const loadConversations = useCallback(async (showLoading = false) => {
    const client = clientRef.current;
    if (!client) return;
    if (showLoading) setQueueLoading(true);
    try {
      const result = await client.listConversations({ scope, status: statusFilter, limit: 80 });
      setConversations(result.items);
      setLastSyncedAt(new Date().toISOString());
      setError('');
      setSelectedId((current) => {
        if (current && result.items.some((item) => item.id === current)) return current;
        return result.items[0]?.id || null;
      });
    } catch (err) {
      if (showLoading || !(err instanceof StaffImError && err.status === 401)) {
        setError(err instanceof Error ? err.message : '会话列表加载失败。');
      }
    } finally {
      if (showLoading) setQueueLoading(false);
    }
  }, [scope, statusFilter]);

  useEffect(() => {
    const client = new StaffImClient(adminToken);
    clientRef.current = client;
    let cancelled = false;
    void authenticateClient().then(() => {
      if (cancelled) setReady(false);
    });
    return () => { cancelled = true; clientRef.current = null; };
  }, [adminToken, authenticateClient]);

  useEffect(() => {
    if (!ready) return;
    void loadConversations(true);
    const timer = window.setInterval(() => void loadConversations(false), 4_000);
    return () => window.clearInterval(timer);
  }, [loadConversations, ready]);

  useEffect(() => {
    if (!ready || !clientRef.current || !selectedId) return;
    setRealtimeState('connecting');
    let cancelled = false;
    let dispose: (() => void) | undefined;
    void clientRef.current.connectRealtime((message) => {
      if (cancelled) return;
      if (message.conversation_id === selectedId) {
        setMessages((current) => mergeMessages(current, [message]));
        messageSeqRef.current = Math.max(messageSeqRef.current, message.seq);
      }
      void loadConversations(false);
    }, selectedId).then((cleanup) => {
      if (cancelled) cleanup();
      else { dispose = cleanup; setRealtimeState('connected'); }
    }).catch(() => { if (!cancelled) setRealtimeState('polling'); });
    return () => { cancelled = true; dispose?.(); };
  }, [loadConversations, ready, selectedId]);

  useEffect(() => {
    setDetail(null);
    setMessages([]);
    setAttachmentUrls({});
    setAttachmentLinkFailures({});
    attachmentUrlRefreshAtRef.current.clear();
    messageSeqRef.current = 0;
    if (!selectedId || !ready) return;
    const client = clientRef.current;
    if (!client) return;
    let cancelled = false;
    setThreadLoading(true);

    const loadThread = async (initial: boolean) => {
      try {
        if (initial) {
          const [nextDetail, history] = await Promise.all([
            client.getConversation(selectedId), client.listMessages(selectedId, 0, 200),
          ]);
          if (cancelled) return;
          setDetail(nextDetail);
          setMessages(history.items);
          messageSeqRef.current = history.nextAfterSeq;
          if (history.nextAfterSeq > 0) void client.markRead(selectedId, history.nextAfterSeq).catch(() => undefined);
        } else {
          const history = await client.listMessages(selectedId, messageSeqRef.current, 200);
          if (cancelled) return;
          if (history.items.length) {
            setMessages((current) => mergeMessages(current, history.items));
            messageSeqRef.current = Math.max(messageSeqRef.current, history.nextAfterSeq);
            void client.markRead(selectedId, messageSeqRef.current).catch(() => undefined);
          }
          const nextDetail = await client.getConversation(selectedId);
          if (!cancelled) setDetail(nextDetail);
        }
        if (!cancelled) { setLastSyncedAt(new Date().toISOString()); setError(''); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '会话消息加载失败。');
      } finally {
        if (!cancelled && initial) setThreadLoading(false);
      }
    };

    void loadThread(true);
    const timer = window.setInterval(() => void loadThread(false), 2_500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [ready, selectedId]);

  useEffect(() => {
    if (!ready || !selectedId || !messages.length) return;
    const attachmentIds = [...new Set(messages
      .map((message) => message.metadata?.attachmentId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0))];
    if (!attachmentIds.length) return;
    // Message polls update `messages` repeatedly. Track each URL's refresh
    // cooldown separately: new attachment IDs should load immediately, while
    // missing results must not re-enter this effect in a tight loop.
    const now = Date.now();
    const idsToRefresh = attachmentIds.filter((id) => now - (attachmentUrlRefreshAtRef.current.get(id) || 0) >= 4 * 60 * 1000);
    if (!idsToRefresh.length) return;
    const client = clientRef.current;
    if (!client) return;
    idsToRefresh.forEach((id) => attachmentUrlRefreshAtRef.current.set(id, now));
    void client.listAttachmentUrls(selectedId, idsToRefresh).then((urls) => {
      if (selectedIdRef.current === selectedId) {
        setAttachmentUrls((current) => ({ ...current, ...urls }));
        setAttachmentLinkFailures((current) => {
          const next = { ...current };
          idsToRefresh.forEach((id) => {
            if (urls[id]) delete next[id];
            else next[id] = true;
          });
          return next;
        });
      }
    }).catch((err) => {
      if (selectedIdRef.current === selectedId) {
        setAttachmentLinkFailures((current) => ({ ...current, ...Object.fromEntries(idsToRefresh.map((id) => [id, true])) }));
        setError(err instanceof Error ? err.message : '附件暂时无法加载，请稍后重试。');
      }
    });
  }, [attachmentRefreshTick, messages, ready, selectedId]);

  const retryAttachmentLink = async (attachmentId: string) => {
    const client = clientRef.current;
    if (!client || !selectedId) return;
    attachmentUrlRefreshAtRef.current.set(attachmentId, Date.now());
    setAttachmentLinkFailures((current) => ({ ...current, [attachmentId]: false }));
    try {
      const urls = await client.listAttachmentUrls(selectedId, [attachmentId]);
      if (urls[attachmentId]) {
        setAttachmentUrls((current) => ({ ...current, ...urls }));
        setAttachmentLinkFailures((current) => { const next = { ...current }; delete next[attachmentId]; return next; });
      } else {
        setAttachmentLinkFailures((current) => ({ ...current, [attachmentId]: true }));
      }
    } catch {
      setAttachmentLinkFailures((current) => ({ ...current, [attachmentId]: true }));
    }
  };

  useEffect(() => {
    if (!ready || !selectedId) return;
    const timer = window.setInterval(() => setAttachmentRefreshTick((value) => value + 1), 4 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [ready, selectedId]);

  useEffect(() => {
    if (messages.length) messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const visibleConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) => [
      visitorName(conversation), conversation.visitor_email || '', conversation.last_message_body || '', sourceLabel(conversation.source),
    ].join(' ').toLowerCase().includes(query));
  }, [conversations, search]);

  const selectedConversation = selectedId
    ? conversations.find((conversation) => conversation.id === selectedId) || detail?.conversation || null
    : null;
  const assignment = detail ? activeAssignment(detail.assignments) : null;
  const isClosed = detail?.conversation.status === 'closed';
  const canReply = Boolean(detail && !isClosed && (operatorAccountType === 'super_admin' || assignment?.staff_id === operatorId));
  const connectionLabel = !ready ? (error ? '连接异常' : '连接中') : realtimeState === 'connected' ? '实时连接' : '自动刷新';

  const sendMessage = async () => {
    const text = draft.trim();
    const conversationId = detail?.conversation.id;
    const client = clientRef.current;
    if (!text || !conversationId || !client || !canReply || actionBusy || attachmentBusy) return;
    const clientMessageId = globalThis.crypto?.randomUUID?.() || `staff-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimistic: LocalMessage = {
      id: `local-${clientMessageId}`, conversation_id: conversationId, seq: messageSeqRef.current + 1,
      client_message_id: clientMessageId, sender_type: 'staff', sender_id: null, content_type: 'text', body: text,
      metadata: null, created_at: new Date().toISOString(), delivery: 'sending',
    };
    setMessages((current) => [...current, optimistic]);
    setDraft('');
    try {
      const sent = await client.sendMessage(conversationId, text, clientMessageId);
      setMessages((current) => mergeMessages(current.filter((item) => item.id !== optimistic.id), [sent]));
      messageSeqRef.current = Math.max(messageSeqRef.current, sent.seq);
      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      setMessages((current) => current.map((item) => item.id === optimistic.id ? { ...item, delivery: 'failed' } : item));
      setError(err instanceof Error ? err.message : '消息发送失败，可点击重试。');
    }
  };

  const sendAttachment = async (file: File, kind: ChatAttachmentKind) => {
    const conversationId = detail?.conversation.id;
    const client = clientRef.current;
    if (!conversationId || !client || !canReply || actionBusy || attachmentBusy) return;
    let contentType: string;
    try { contentType = inspectStaffAttachment(file, kind); }
    catch (err) { setError(err instanceof Error ? err.message : '附件类型或大小不支持。'); return; }
    const clientMessageId = globalThis.crypto?.randomUUID?.() || `staff-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimistic: LocalMessage = {
      id: `local-${clientMessageId}`, conversation_id: conversationId, seq: messageSeqRef.current + 1,
      client_message_id: clientMessageId, sender_type: 'staff', sender_id: operatorId || null,
      content_type: kind, body: file.name,
      metadata: { filename: file.name, contentType, byteSize: file.size, kind },
      created_at: new Date().toISOString(), delivery: 'sending',
    };
    pendingAttachmentFilesRef.current.set(clientMessageId, file);
    setMessages((current) => [...current, optimistic]);
    setAttachmentBusy(true);
    setError('');
    try {
      const sent = await client.uploadAttachment(conversationId, file, clientMessageId, clientMessageId, contentType, kind);
      setMessages((current) => mergeMessages(current.filter((item) => item.id !== optimistic.id), [sent]));
      pendingAttachmentFilesRef.current.delete(clientMessageId);
      messageSeqRef.current = Math.max(messageSeqRef.current, sent.seq);
      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      setMessages((current) => current.map((item) => item.id === optimistic.id ? { ...item, delivery: 'failed' } : item));
      setError(err instanceof Error ? err.message : '附件发送失败，可点击重试。');
    } finally { setAttachmentBusy(false); }
  };

  const retryMessage = async (message: LocalMessage) => {
    if (!detail || !clientRef.current || message.delivery !== 'failed') return;
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, delivery: 'sending' } : item));
    try {
      let sent: StaffMessage;
      if (message.content_type === 'image' || message.content_type === 'file') {
        const clientMessageId = message.client_message_id || message.id;
        const file = pendingAttachmentFilesRef.current.get(clientMessageId);
        const contentType = typeof message.metadata?.contentType === 'string' ? message.metadata.contentType : '';
        if (!file) throw new Error('附件文件不在当前页面缓存中，请重新选择后发送。');
        setAttachmentBusy(true);
        sent = await clientRef.current.uploadAttachment(detail.conversation.id, file, clientMessageId,
          clientMessageId, contentType, message.content_type);
        pendingAttachmentFilesRef.current.delete(clientMessageId);
      } else {
        sent = await clientRef.current.sendMessage(detail.conversation.id, message.body, message.client_message_id || message.id);
      }
      setMessages((current) => mergeMessages(current.filter((item) => item.id !== message.id), [sent]));
      setError('');
    } catch (err) {
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, delivery: 'failed' } : item));
      setError(err instanceof Error ? err.message : '消息重试失败。');
    } finally { setAttachmentBusy(false); }
  };

  const claimConversation = async () => {
    if (!selectedId || !clientRef.current || actionBusy || isClosed) return;
    setActionBusy(true);
    try {
      await clientRef.current.assign(selectedId, 'claim');
      await loadConversations(false);
      setDetail(await clientRef.current.getConversation(selectedId));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '接待分配失败。');
    } finally { setActionBusy(false); }
  };

  const updateStatus = async (nextStatus: ImConversationStatus) => {
    if (!detail || !clientRef.current || actionBusy) return;
    setActionBusy(true);
    try {
      const updated = await clientRef.current.updateStatus(detail.conversation.id, nextStatus, detail.conversation.version);
      setDetail((current) => current ? { ...current, conversation: { ...current.conversation, ...updated } } : current);
      await loadConversations(false);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '会话状态更新失败。');
    } finally { setActionBusy(false); }
  };

  if (!ready && staffLoginOpen) {
    return (
      <StaffLoginGate
        operatorEmail={operatorEmail}
        username={staffUsername}
        password={staffPassword}
        error={error}
        busy={staffLoginBusy}
        onUsernameChange={setStaffUsername}
        onPasswordChange={setStaffPassword}
        onSubmit={() => void loginLocalStaff()}
        onRetryExchange={() => { setStaffLoginOpen(false); setError(''); void authenticateClient(); }}
        onExit={onExit}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex min-h-0 flex-col overflow-hidden bg-[#071a2e] text-slate-100">
      <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/10 bg-[#0a2340] px-4 md:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onExit} className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-300 transition hover:border-cyan-300/40 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" aria-label="返回业务工作台"><ArrowLeft className="size-5" /></button>
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-blue-500 text-[#071a2e] shadow-[0_8px_30px_rgba(45,212,191,.22)]"><MessageCircle className="size-5" /></div>
          <div className="min-w-0"><div className="flex items-center gap-2"><h1 className="truncate text-base font-semibold tracking-wide text-white md:text-lg">智能接待</h1><span className={cn('hidden items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-flex', !ready || error ? error ? 'border-rose-300/25 bg-rose-300/10 text-rose-200' : 'border-amber-300/25 bg-amber-300/10 text-amber-100' : realtimeState === 'connected' ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200' : 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100')}><span className={cn('size-1.5 rounded-full', !ready || error ? error ? 'bg-rose-300' : 'bg-amber-300' : realtimeState === 'connected' ? 'bg-emerald-300' : 'bg-cyan-300')} />{connectionLabel}</span></div><p className="truncate text-xs text-slate-400">实时会话 · 人工接管 · 多语原文保留</p></div>
        </div>
        <div className="flex items-center gap-2 md:gap-4"><div className="hidden text-right sm:block"><p className="text-sm font-medium text-slate-200">{operatorName}</p><p className="max-w-[180px] truncate text-[11px] text-slate-500">{operatorEmail}</p></div><button type="button" onClick={onSignOut} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">退出</button></div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className={cn('absolute inset-y-[72px] left-0 z-30 flex w-[min(360px,92vw)] -translate-x-full flex-col border-r border-white/10 bg-[#0b2745] shadow-2xl transition-transform duration-200 lg:relative lg:inset-y-0 lg:z-auto lg:w-[330px] lg:translate-x-0 lg:shadow-none', queueOpen && 'translate-x-0')}>
          <div className="border-b border-white/10 p-4"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-200/70">实时队列</p><p className="mt-1 text-lg font-semibold text-white">会话队列</p></div><button type="button" className="grid size-9 place-items-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/10 lg:hidden" onClick={() => setQueueOpen(false)} aria-label="关闭会话队列"><X className="size-4" /></button></div><label className="relative block"><span className="sr-only">搜索会话</span><Inbox className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索访客、邮箱或消息" className="h-10 w-full rounded-xl border border-white/10 bg-[#071a2e] pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10" /></label></div>
          <div className="border-b border-white/10 px-3 pt-3"><div className="grid grid-cols-3 gap-1 rounded-xl bg-[#071a2e] p-1">{SCOPE_TABS.map((tab) => <button key={tab.value} type="button" onClick={() => setScope(tab.value)} className={cn('rounded-lg px-2 py-2 text-xs font-medium transition', scope === tab.value ? 'bg-cyan-300 text-[#071a2e]' : 'text-slate-400 hover:bg-white/10 hover:text-white')}>{tab.label}</button>)}</div><div className="flex items-center gap-2 overflow-x-auto py-3">{STATUS_FILTERS.map((filter) => <button key={filter.value || 'active'} type="button" onClick={() => setStatusFilter(filter.value)} className={cn('whitespace-nowrap rounded-full border px-3 py-1 text-[11px] transition', statusFilter === filter.value ? 'border-cyan-300/50 bg-cyan-300/10 text-cyan-100' : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white')}>{filter.label}</button>)}</div></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">{queueLoading ? <div className="flex h-40 items-center justify-center text-slate-400"><Loader2 className="size-5 animate-spin" /></div> : visibleConversations.length === 0 ? <div className="mx-2 mt-8 rounded-2xl border border-dashed border-white/15 p-5 text-center"><UsersRound className="mx-auto size-6 text-slate-500" /><p className="mt-3 text-sm font-medium text-slate-300">暂无匹配会话</p><p className="mt-1 text-xs leading-5 text-slate-500">新访客消息会自动进入这里，只展示真实官网会话。</p></div> : visibleConversations.map((conversation) => { const isSelected = conversation.id === selectedId; return <button key={conversation.id} type="button" onClick={() => { setSelectedId(conversation.id); setQueueOpen(false); }} className={cn('group mb-1 w-full rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300', isSelected ? 'border-cyan-300/40 bg-cyan-300/10' : 'border-transparent hover:border-white/10 hover:bg-white/5')}><div className="flex items-start gap-3"><span className={cn('grid size-9 shrink-0 place-items-center rounded-xl text-sm font-semibold', isSelected ? 'bg-cyan-300 text-[#071a2e]' : 'bg-white/10 text-slate-200')}>{avatarInitial(visitorName(conversation))}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium text-slate-100">{visitorName(conversation)}</span><span className="shrink-0 text-[10px] text-slate-500">{formatTime(conversation.last_message_at || conversation.updated_at)}</span></span><span className="mt-1 block truncate text-xs text-slate-400">{conversation.last_message_body || '等待访客发送消息'}</span><span className="mt-2 flex items-center gap-2 text-[10px] text-slate-500"><span className="truncate">{sourceLabel(conversation.source)}</span><span className={cn('rounded-full border px-1.5 py-0.5', statusTone(conversation.status))}>{STATUS_COPY[conversation.status]}</span></span></span></div></button>; })}</div>
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-[10px] text-slate-500"><span>{lastSyncedAt ? `同步于 ${formatTime(lastSyncedAt)}` : '等待同步'}</span><button type="button" onClick={() => void loadConversations(true)} className="inline-flex items-center gap-1 text-slate-400 hover:text-cyan-200" aria-label="刷新会话队列"><RefreshCw className="size-3.5" />刷新</button></div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-[#f4f7fb] text-[#15243b]">
          <div className="flex h-[66px] shrink-0 items-center justify-between border-b border-[#dce3ed] bg-white px-4 md:px-6"><div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => setQueueOpen(true)} className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#dce3ed] text-[#5d6b80] hover:bg-[#f4f7fb] lg:hidden" aria-label="打开会话队列"><Inbox className="size-4" /></button>{selectedConversation ? <><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#dceeff] text-[#0b63ce] font-semibold">{avatarInitial(visitorName(selectedConversation))}</span><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate text-base font-semibold text-[#15243b]">{visitorName(selectedConversation)}</h2>{detail ? <span className={cn('rounded-full border px-2 py-0.5 text-[10px]', detail.conversation.status === 'closed' ? 'border-slate-300 bg-slate-100 text-slate-500' : detail.conversation.status === 'pending' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}>{STATUS_COPY[detail.conversation.status]}</span> : null}</div><p className="truncate text-xs text-[#8a96a8]">{sourceLabel(selectedConversation.source)} · {selectedConversation.visitor_email || '未填写邮箱'}</p></div></> : <div><h2 className="text-base font-semibold text-[#15243b]">选择一个会话</h2><p className="text-xs text-[#8a96a8]">从左侧队列开始接待</p></div>}</div>{detail ? <div className="flex items-center gap-2">{!assignment && !isClosed ? <button type="button" onClick={() => void claimConversation()} disabled={actionBusy} className="hidden items-center gap-1.5 rounded-lg bg-[#0b63ce] px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-[#084f9f] disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"><Zap className="size-3.5" />接待</button> : null}<button type="button" onClick={() => void loadConversations(true)} className="grid size-9 place-items-center rounded-lg border border-[#dce3ed] text-[#5d6b80] hover:bg-[#f4f7fb]" aria-label="刷新当前会话"><RefreshCw className="size-4" /></button></div> : null}</div>
          {error ? <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-xl border border-[#f2b8b1] bg-[#fff5f3] px-3 py-2 text-xs text-[#a23f34] md:mx-6"><span className="min-w-0 truncate">{error}</span><button type="button" onClick={() => { setError(''); void authenticateClient(); }} className="shrink-0 font-medium underline">重试</button></div> : null}
          {!selectedId ? <div className="flex min-h-0 flex-1 items-center justify-center p-6"><div className="max-w-sm text-center"><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#e7f0fb] text-[#0b63ce]"><MessageCircle className="size-7" /></div><h3 className="mt-5 text-xl font-semibold text-[#15243b]">开始接待访客</h3><p className="mt-2 text-sm leading-6 text-[#5d6b80]">新会话会从真实官网实时进入队列。选择会话后，可查看完整历史、接待、回复和结束会话。</p></div></div> : threadLoading && !detail ? <div className="flex min-h-0 flex-1 items-center justify-center"><Loader2 className="size-6 animate-spin text-[#0b63ce]" /></div> : <><div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6"><div className="mx-auto flex max-w-3xl flex-col gap-3"><div className="mx-auto flex items-center gap-2 rounded-full bg-[#e9eef5] px-3 py-1 text-[10px] text-[#6e7b8e]"><Circle className="size-2.5 fill-current" />会话开始于 {formatDateTime(detail?.conversation.created_at)}</div>{messages.map((message) => { const fromStaff = message.sender_type === 'staff'; const system = message.sender_type === 'system'; if (system) return <div key={message.id} className="py-2 text-center text-[11px] text-[#8a96a8]">{message.body}</div>; const isAttachment = message.content_type === 'image' || message.content_type === 'file'; const attachmentId = typeof message.metadata?.attachmentId === 'string' ? message.metadata.attachmentId : ''; const attachmentUrl = attachmentId ? attachmentUrls[attachmentId] : ''; const filename = typeof message.metadata?.filename === 'string' ? message.metadata.filename : message.body; const isImage = message.content_type === 'image'; return <div key={message.id} className={cn('flex gap-2.5', fromStaff ? 'justify-end' : 'justify-start')}>{!fromStaff ? <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-[#dceeff] text-xs font-semibold text-[#0b63ce]">{avatarInitial(visitorName(selectedConversation || { visitor_display_name: null, visitor_email: null }))}</span> : null}<div className={cn('max-w-[min(78%,640px)]', fromStaff ? 'items-end' : 'items-start')}><div className={cn('mb-1 flex items-center gap-2 text-[10px] text-[#8a96a8]', fromStaff ? 'justify-end' : 'justify-start')}><span>{fromStaff ? '我' : visitorName(selectedConversation || { visitor_display_name: null, visitor_email: null })}</span><time>{formatTime(message.created_at)}</time></div><div className={cn('rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm', fromStaff ? 'rounded-tr-md bg-[#0b63ce] text-white' : 'rounded-tl-md border border-[#dce3ed] bg-white text-[#15243b]')}>{isAttachment ? attachmentUrl ? isImage ? <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label="打开图片预览"><img src={attachmentUrl} alt={filename} referrerPolicy="no-referrer" loading="lazy" className="max-h-64 max-w-full rounded-lg object-contain" /><span className="mt-1 block text-xs">{filename}</span></a> : <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="flex items-center gap-2 break-all text-sm font-medium underline"><Paperclip className="size-4 shrink-0" />{filename}<span className="text-[10px] font-normal opacity-75">{formatAttachmentSize(message.metadata?.byteSize)}</span></a> : attachmentId && attachmentLinkFailures[attachmentId] ? <button type="button" role="status" onClick={() => void retryAttachmentLink(attachmentId)} className="text-xs underline">附件暂不可用，点击重试</button> : <span role="status" className="text-xs opacity-70">附件加载中…</span> : <p className="whitespace-pre-wrap break-words">{message.body}</p>}</div>{fromStaff && message.delivery === 'sending' ? <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#8a96a8]"><Loader2 className="size-3 animate-spin" />发送中</span> : null}{fromStaff && message.delivery === 'failed' ? <button type="button" onClick={() => void retryMessage(message)} className="mt-1 flex items-center justify-end gap-1 text-[10px] font-medium text-[#b43f2f] underline"><RefreshCw className="size-3" />发送失败，重试</button> : null}{fromStaff && !message.delivery ? <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#8a96a8]"><Check className="size-3" />已发送</span> : null}</div>{fromStaff ? <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-[#173d67] text-xs font-semibold text-cyan-100">我</span> : null}</div>; })}<div ref={messageEndRef} /></div></div><div className="border-t border-[#dce3ed] bg-white px-4 py-3 md:px-6"><div className="mx-auto max-w-3xl">{isClosed ? <div className="mb-3 rounded-xl bg-[#f4f7fb] px-3 py-2 text-center text-xs text-[#6e7b8e]">会话已结束。若访客再次发送消息，系统会自动重开并回到队列。</div> : null}{!assignment && !isClosed ? <div className="mb-3 flex items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50/70 px-3 py-2 text-xs text-cyan-800"><Sparkles className="size-3.5 shrink-0" />当前会话尚未分配给客服，先点击“接待”再回复。</div> : null}<div className="mb-2 flex items-center gap-2"><button type="button" onClick={() => imageFileInputRef.current?.click()} disabled={!canReply || actionBusy || attachmentBusy} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dce3ed] px-3 text-xs text-[#5d6b80] hover:bg-[#f4f7fb] disabled:cursor-not-allowed disabled:opacity-50" aria-label="发送图片"><ImageIcon className="size-4" />图片</button><button type="button" onClick={() => attachmentFileInputRef.current?.click()} disabled={!canReply || actionBusy || attachmentBusy} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dce3ed] px-3 text-xs text-[#5d6b80] hover:bg-[#f4f7fb] disabled:cursor-not-allowed disabled:opacity-50" aria-label="发送文件"><Paperclip className="size-4" />文件</button><span className="text-[10px] text-[#a4afbf]">图片≤8 MB；文件≤15 MB（PDF、TXT、CSV、DOCX、XLSX、PPTX）</span></div><input ref={imageFileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif" className="sr-only" aria-label="选择图片上传" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void sendAttachment(file, 'image'); }} /><input ref={attachmentFileInputRef} type="file" accept="application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pdf,.txt,.csv,.docx,.xlsx,.pptx" className="sr-only" aria-label="选择文件上传" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void sendAttachment(file, 'file'); }} /><div className="flex items-end gap-3"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} disabled={!canReply || actionBusy || attachmentBusy} rows={2} placeholder={isClosed ? '会话已结束' : canReply ? '输入回复，Enter 发送，Shift + Enter 换行' : assignment ? `当前由 ${assignment.staff_name || '其他客服'} 接待` : '接待后才能回复访客'} className="min-h-[76px] flex-1 resize-none rounded-2xl border border-[#dce3ed] bg-[#fafcff] px-4 py-3 text-sm leading-6 text-[#15243b] outline-none transition placeholder:text-[#a4afbf] focus:border-[#0b63ce] focus:ring-4 focus:ring-[#0b63ce]/10 disabled:cursor-not-allowed disabled:bg-[#f4f7fb]" /><button type="button" onClick={() => void sendMessage()} disabled={!draft.trim() || !canReply || actionBusy || attachmentBusy} className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#0b63ce] text-white shadow-[0_8px_22px_rgba(11,99,206,.22)] transition hover:bg-[#084f9f] disabled:cursor-not-allowed disabled:opacity-40" aria-label="发送回复"><Send className="size-5" /></button></div><p className="mt-2 text-[10px] text-[#a4afbf]">消息会写入官网访客会话，并按 client message id 防止重复发送。</p></div></div></>}</main>

        <aside className="hidden w-[290px] shrink-0 flex-col border-l border-[#dce3ed] bg-white lg:flex">{detail ? <><div className="border-b border-[#dce3ed] p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a96a8]">访客信息</p><div className="mt-4 flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-[#dceeff] text-lg font-semibold text-[#0b63ce]">{avatarInitial(visitorName(detail.conversation))}</span><div className="min-w-0"><p className="truncate font-semibold text-[#15243b]">{visitorName(detail.conversation)}</p><p className="mt-0.5 truncate text-xs text-[#8a96a8]">{sourceLabel(detail.conversation.source)}</p></div></div></div><div className="flex-1 overflow-y-auto p-5"><div className="space-y-4"><ContextRow icon={<Mail className="size-4" />} label="邮箱" value={detail.conversation.visitor_email || '未填写'} /><ContextRow icon={<Phone className="size-4" />} label="电话" value={detail.conversation.visitor_phone ? <a href={`tel:${detail.conversation.visitor_phone}`} className="font-medium text-[#0b63ce] underline decoration-[#b8d6f4] underline-offset-2">{detail.conversation.visitor_phone}</a> : '未填写'} /><ContextRow icon={<Languages className="size-4" />} label="消息语言" value="保留访客原文" /><ContextRow icon={<Clock3 className="size-4" />} label="创建时间" value={formatDateTime(detail.conversation.created_at)} /></div><div className="mt-8 border-t border-[#edf0f4] pt-5"><p className="text-xs font-semibold text-[#15243b]">接待状态</p><div className="mt-3 rounded-xl border border-[#edf0f4] bg-[#fafcff] p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs text-[#6e7b8e]">当前状态</span><span className={cn('rounded-full border px-2 py-0.5 text-[10px]', detail.conversation.status === 'closed' ? 'border-slate-200 bg-slate-100 text-slate-500' : detail.conversation.status === 'pending' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}>{STATUS_COPY[detail.conversation.status]}</span></div><div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs text-[#6e7b8e]">接待人员</span><span className="truncate text-xs font-medium text-[#15243b]">{assignment?.staff_name || '未分配'}</span></div></div><div className="mt-3 grid grid-cols-2 gap-2">{!assignment && !isClosed ? <button type="button" onClick={() => void claimConversation()} disabled={actionBusy} className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0b63ce] px-3 py-2 text-xs font-medium text-white hover:bg-[#084f9f] disabled:opacity-50"><Zap className="size-3.5" />接待会话</button> : null}{detail.conversation.status === 'open' ? <button type="button" onClick={() => void updateStatus('pending')} disabled={actionBusy} className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#dce3ed] px-2 py-2 text-xs text-[#5d6b80] hover:bg-[#f4f7fb]"><Clock3 className="size-3.5" />待跟进</button> : null}{detail.conversation.status === 'pending' ? <button type="button" onClick={() => void updateStatus('open')} disabled={actionBusy} className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#dce3ed] px-2 py-2 text-xs text-[#5d6b80] hover:bg-[#f4f7fb]"><CheckCircle2 className="size-3.5" />继续接待</button> : null}{detail.conversation.status !== 'closed' ? <button type="button" onClick={() => void updateStatus('closed')} disabled={actionBusy} className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#f2d1cd] px-2 py-2 text-xs text-[#a23f34] hover:bg-[#fff5f3]"><CheckCircle2 className="size-3.5" />结束会话</button> : null}{detail.conversation.status === 'closed' ? <button type="button" onClick={() => void updateStatus('open')} disabled={actionBusy} className="col-span-2 inline-flex items-center justify-center gap-1 rounded-lg border border-[#dce3ed] px-2 py-2 text-xs text-[#5d6b80] hover:bg-[#f4f7fb]"><RefreshCw className="size-3.5" />重新打开</button> : null}</div></div><div className="mt-8 border-t border-[#edf0f4] pt-5"><p className="text-xs font-semibold text-[#15243b]">工作流状态</p><div className="mt-3 space-y-2 text-xs text-[#6e7b8e]"><WorkflowItem label="官网消息已接收" done /><WorkflowItem label="消息原文已保留" done /><WorkflowItem label={assignment ? '人工客服已接管' : '等待人工接管'} done={Boolean(assignment)} /></div></div></div></> : <div className="flex flex-1 items-center justify-center p-8 text-center"><div><UserRound className="mx-auto size-7 text-[#b1bccb]" /><p className="mt-3 text-sm font-medium text-[#5d6b80]">访客信息</p><p className="mt-1 text-xs leading-5 text-[#a4afbf]">选择会话后显示联系人和接待状态</p></div></div>}</aside>
      </div>
      {queueOpen ? <button type="button" aria-label="关闭会话队列" className="absolute inset-0 z-20 bg-[#071a2e]/60 lg:hidden" onClick={() => setQueueOpen(false)} /> : null}
    </div>
  );
}

function ContextRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return <div className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f4f7fb] text-[#7c8da4]">{icon}</span><div className="min-w-0"><p className="text-[10px] text-[#a4afbf]">{label}</p><p className="mt-0.5 break-words text-xs text-[#15243b]">{value}</p></div></div>;
}

function WorkflowItem({ label, done }: { label: string; done: boolean }) {
  return <div className="flex items-center gap-2"><span className={cn('grid size-4 place-items-center rounded-full', done ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400')}>{done ? <Check className="size-2.5" /> : <span className="size-1.5 rounded-full bg-current" />}</span><span>{label}</span></div>;
}

function StaffLoginGate({
  operatorEmail,
  username,
  password,
  error,
  busy,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  onRetryExchange,
  onExit,
}: {
  operatorEmail: string;
  username: string;
  password: string;
  error: string;
  busy: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onRetryExchange: () => void;
  onExit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex min-h-screen items-center justify-center overflow-y-auto bg-[#071a2e] px-4 py-8 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(45,212,191,.18),transparent_32%),radial-gradient(circle_at_88%_90%,rgba(37,99,235,.28),transparent_34%)]" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0b2745]/95 p-6 shadow-[0_30px_80px_rgba(2,12,27,.5)] backdrop-blur md:p-8">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-blue-500 text-[#071a2e]"><KeyRound className="size-5" /></div>
          <div><p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-200/70">智能接待</p><h1 className="mt-1 text-xl font-semibold text-white">登录客服工作台</h1></div>
        </div>
        <p className="mt-6 text-sm leading-6 text-slate-300">当前管理账号暂未完成客服身份交换。请使用已开通 IM 权限的客服账号登录，进入真实官网会话队列。</p>
        <p className="mt-2 truncate text-xs text-slate-500">管理账号：{operatorEmail}</p>
        {error ? <div role="alert" aria-live="polite" className="mt-5 rounded-xl border border-rose-300/25 bg-rose-300/10 px-3 py-2.5 text-xs leading-5 text-rose-100">{error}</div> : null}
        <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
          <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-300">客服账号</span><input value={username} onChange={(event) => onUsernameChange(event.target.value)} autoComplete="username" required disabled={busy} className="h-11 w-full rounded-xl border border-white/10 bg-[#071a2e] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10 disabled:opacity-60" placeholder="输入客服账号" /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-300">密码</span><input type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} autoComplete="current-password" required disabled={busy} className="h-11 w-full rounded-xl border border-white/10 bg-[#071a2e] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10 disabled:opacity-60" placeholder="输入密码" /></label>
          <button type="submit" disabled={busy || !username.trim() || !password} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-[#071a2e] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}进入工作台</button>
        </form>
        <div className="mt-5 flex items-center justify-between gap-3 text-xs"><button type="button" onClick={onRetryExchange} disabled={busy} className="text-slate-400 underline decoration-slate-600 underline-offset-4 transition hover:text-cyan-200 disabled:opacity-50">重新连接管理账号</button><button type="button" onClick={onExit} disabled={busy} className="text-slate-400 transition hover:text-white disabled:opacity-50">返回业务工作台</button></div>
        <p className="mt-6 border-t border-white/10 pt-4 text-[11px] leading-5 text-slate-500">客服账号由管理员在 IM 权限中开通。登录后仅能查看和处理授权范围内的会话。</p>
      </div>
    </div>
  );
}

