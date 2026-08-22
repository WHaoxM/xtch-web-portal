import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { MapPin, MessageCircle, RefreshCw, Send, X } from 'lucide-react';
import {
  connectPublicImSocket,
  createPublicImConversation,
  establishPublicImSession,
  listPublicImMessages,
  sendPublicImMessage,
  PUBLIC_IM_OPEN_EVENT,
  type PublicImConversation,
  type PublicImMessage,
  type PublicImSource,
} from '@/domains/im/publicImClient';
import { brand } from '@/lib/siteData';

type PublicImBubbleProps = { source: PublicImSource; showTrigger?: boolean };
type ConnectionState = 'loading' | 'ready' | 'reconnecting' | 'offline' | 'error';
type DeliveryState = 'pending' | 'failed';
type UiMessage = PublicImMessage & { delivery?: DeliveryState; idempotencyKey?: string };

const QUICK_PROMPTS = ['我想定制一条路线', '我已有目的地和日期'];

export default function PublicImBubble({ source, showTrigger = true }: PublicImBubbleProps) {
  const [open, setOpen] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>('loading');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [conversation, setConversation] = useState<PublicImConversation | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const socketRef = useRef<ReturnType<typeof connectPublicImSocket> | null>(null);
  const lastSeqRef = useRef(0);
  const conversationIdRef = useRef<string | null>(null);
  const historyMarkerRef = useRef(false);
  const sessionAttemptRef = useRef(0);
  const wasOpenRef = useRef(false);

  const unreadHint = useMemo(
    () => !open && messages.some((message) => message.sender_type === 'staff'),
    [messages, open],
  );

  const close = useCallback(() => {
    setOpen(false);
    if (historyMarkerRef.current) {
      historyMarkerRef.current = false;
      window.history.back();
    }
  }, []);

  const openPanel = useCallback(() => {
    if (open) {
      wasOpenRef.current = true;
      composerRef.current?.focus();
      return;
    }
    window.history.pushState({ ...(window.history.state ?? {}), publicIm: true }, '', window.location.href);
    historyMarkerRef.current = true;
    wasOpenRef.current = true;
    setOpen(true);
  }, [open]);

  useEffect(() => {
    const openFromExistingEntry = () => openPanel();
    window.addEventListener(PUBLIC_IM_OPEN_EVENT, openFromExistingEntry);
    return () => window.removeEventListener(PUBLIC_IM_OPEN_EVENT, openFromExistingEntry);
  }, [openPanel]);

  useEffect(() => {
    if (!open) return;
    const onPopState = () => {
      historyMarkerRef.current = false;
      setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), a[href]'),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('popstate', onPopState);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [close, open]);

  useEffect(() => {
    if (!open || connection !== 'ready') return;
    composerRef.current?.focus();
  }, [connection, open]);

  useEffect(() => {
    if (open || !showTrigger || !wasOpenRef.current) return;
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [open, showTrigger]);

  useEffect(() => {
    const onOffline = () => setConnection('offline');
    const onOnline = () => {
      if (open && conversation) setConnection('reconnecting');
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [conversation, open]);

  useEffect(() => {
    if (!open) {
      socketRef.current?.socket.disconnect();
      socketRef.current = null;
      return;
    }

    let cancelled = false;
    const attempt = ++sessionAttemptRef.current;
    const timeout = window.setTimeout(() => {
      if (!cancelled && attempt === sessionAttemptRef.current) {
        setConnection('error');
        setError('连接客服超时，请重试。');
        setLoading(false);
      }
    }, 10000);

    async function openConversation() {
      setLoading(true);
      setConnection('loading');
      setError(null);
      try {
        const session = await establishPublicImSession();
        if (cancelled) return;
        const selected = session.conversations[0] ?? await createPublicImConversation(source);
        if (cancelled) return;
        conversationIdRef.current = selected.id;
        setConversation(selected);
        const initial = await listPublicImMessages(selected.id);
        if (cancelled) return;
        replaceMessages(initial);
        const socket = connectPublicImSocket((message) => {
          if (message.conversation_id !== conversationIdRef.current) return;
          appendMessage(message);
          setConnection('ready');
        });
        socketRef.current = socket;
        socket?.socket.on('connect', () => {
          setConnection('ready');
          socket.subscribe(selected.id);
        });
        socket?.socket.on('disconnect', () => {
          if (!navigator.onLine) setConnection('offline');
          else setConnection('reconnecting');
        });
        socket?.socket.on('connect_error', () => setConnection('reconnecting'));
        socket?.socket.connect();
        setConnection(navigator.onLine ? 'ready' : 'offline');
      } catch (cause) {
        if (!cancelled) {
          setConnection('error');
          setError(cause instanceof Error ? cause.message : '暂时无法连接客服。');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void openConversation();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      socketRef.current?.socket.disconnect();
      socketRef.current = null;
    };
  }, [open, source]);

  useEffect(() => {
    if (!open || !conversation) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await listPublicImMessages(conversation.id, lastSeqRef.current);
        next.forEach(appendMessage);
        if (next.length) setConnection('ready');
      } catch {
        if (navigator.onLine) setConnection('reconnecting');
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [conversation, open]);

  function replaceMessages(next: PublicImMessage[]) {
    const unique = uniqueMessages(next);
    setMessages(unique);
    lastSeqRef.current = unique.reduce((max, message) => Math.max(max, message.seq), 0);
  }

  function appendMessage(message: PublicImMessage) {
    if (message.sender_type === 'staff') setAnnouncement(`客服回复：${message.body}`);
    setMessages((current) => {
      const withoutLocal = current.filter(
        (item) => !(item.delivery && item.sender_type === 'visitor' && item.body === message.body),
      );
      const next = uniqueMessages([...withoutLocal, message]);
      lastSeqRef.current = Math.max(lastSeqRef.current, message.seq);
      return next;
    });
  }

  async function submitMessage(event: FormEvent, retryMessage?: UiMessage) {
    event.preventDefault();
    const body = retryMessage?.body ?? draft.trim();
    if (!body || !conversation || sendingId || connection === 'error' || connection === 'offline' || connection === 'reconnecting') return;
    const clientMessageId = retryMessage?.idempotencyKey ?? crypto.randomUUID();
    const localId = retryMessage?.id ?? `local-${clientMessageId}`;
    const pending: UiMessage = {
      id: localId,
      conversation_id: conversation.id,
      seq: lastSeqRef.current + 0.1,
      client_message_id: clientMessageId,
      sender_type: 'visitor',
      sender_id: 'visitor',
      content_type: 'text',
      body,
      created_at: new Date().toISOString(),
      delivery: 'pending',
      idempotencyKey: clientMessageId,
    };
    setSendingId(localId);
    setError(null);
    setMessages((current) => uniqueMessages([...current.filter((message) => message.id !== localId), pending]));
    try {
      const message = await sendPublicImMessage(conversation.id, body, clientMessageId);
      setMessages((current) => uniqueMessages([...current.filter((item) => item.id !== localId), message]));
      lastSeqRef.current = Math.max(lastSeqRef.current, message.seq);
      if (!retryMessage) setDraft('');
    } catch (cause) {
      setMessages((current) => current.map((item) => item.id === localId ? { ...item, delivery: 'failed' } : item));
      const failure = cause instanceof Error ? cause.message : '消息未发送，请重试。';
      setError(failure);
      setAnnouncement(`消息发送失败：${failure}`);
    } finally {
      setSendingId(null);
    }
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const status = statusCopy(connection);
  const unavailable = connection === 'error' || connection === 'offline';

  return (
    <div className={`public-im-root ${open ? 'is-open' : ''}`}>
      {open && <button type="button" className="public-im-backdrop" aria-label="关闭客服聊天" onClick={close} />}
      {open && (
        <section ref={panelRef} className="public-im-panel" role="dialog" aria-modal="true" aria-labelledby="public-im-title">
          <header className="public-im-header">
            <div className="public-im-header-main">
              <span className="public-im-route-mark" aria-hidden="true"><MapPin size={17} /></span>
              <div>
                <h2 id="public-im-title">联系客服</h2>
                <p className={`public-im-status is-${connection}`}><span /> {status}</p>
              </div>
            </div>
            <button type="button" className="public-im-close" onClick={close} aria-label="关闭客服聊天"><X size={20} /></button>
          </header>

          <div className="public-im-messages" aria-label="客服消息">
            <div className="sr-only" aria-live="polite">{announcement}</div>
            {loading && <div className="public-im-loading" aria-label="正在连接客服"><span /><span /><span /></div>}
            {!loading && messages.length === 0 && !unavailable && (
              <div className="public-im-empty-state">
                <span className="public-im-empty-marker" aria-hidden="true"><MapPin size={18} /></span>
                <p>告诉我们目的地、日期或大概想法。</p>
                <div className="public-im-prompts" aria-label="快捷问题">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button key={prompt} type="button" onClick={() => setDraft(prompt)}>{prompt}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const showAuthor = message.sender_type === 'staff' && previous?.sender_type !== 'staff';
              if (message.sender_type === 'system') {
                return <p key={message.id} className="public-im-system-row">{message.body}</p>;
              }
              return (
                <div key={message.id} className={`public-im-message ${message.sender_type === 'visitor' ? 'is-visitor' : 'is-staff'} ${message.delivery ? `is-${message.delivery}` : ''}`}>
                  {showAuthor && <span className="public-im-message-author">Syncing Travel</span>}
                  <p>{message.body}</p>
                  <time>{message.delivery === 'pending' ? '发送中…' : message.delivery === 'failed' ? '未发送' : formatMessageTime(message.created_at)}</time>
                  {message.delivery === 'failed' && <button type="button" className="public-im-retry" onClick={(event) => void submitMessage(event, message)}>重试</button>}
                </div>
              );
            })}
            {unavailable && (
              <div className="public-im-error-state" role="alert">
                <p>{error || (connection === 'offline' ? '当前处于离线状态。' : '暂时无法连接客服。')}</p>
                <div>
                  <button type="button" onClick={() => { setError(null); setOpen(false); window.setTimeout(() => setOpen(true), 0); }}><RefreshCw size={14} /> 重试连接</button>
                  <a href={brand.whatsappHref} target="_blank" rel="noreferrer">打开 WhatsApp</a>
                </div>
              </div>
            )}
          </div>

          <form className="public-im-composer" onSubmit={(event) => void submitMessage(event)}>
            {error && !unavailable && <p className="public-im-error" role="status">{error}</p>}
            <div className="public-im-input-row">
              <textarea ref={composerRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleDraftKeyDown} placeholder="输入消息，开始规划你的路线" aria-label="输入消息" rows={1} maxLength={8000} disabled={loading || !conversation || sendingId !== null || unavailable || connection === 'reconnecting'} />
              <button type="submit" aria-label="发送消息" disabled={!draft.trim() || loading || !conversation || sendingId !== null || unavailable || connection === 'reconnecting'}><Send size={17} /></button>
            </div>
            <p className="public-im-hint">按 Enter 发送 · Shift + Enter 换行{draft.length > 7500 ? ` · ${draft.length}/8000` : ''}</p>
          </form>
        </section>
      )}

      {showTrigger && (
        <button ref={triggerRef} type="button" className={`public-im-trigger ${open ? 'is-open' : ''}`} onClick={open ? close : openPanel} aria-label={open ? '关闭客服聊天' : '打开客服聊天窗口'} aria-expanded={open}>
          <span className="public-im-trigger-icon">{open ? <X size={20} /> : <MessageCircle size={20} />}</span>
          {!open && <span className="public-im-trigger-copy"><strong>联系客服</strong><small>在线为你规划旅程</small></span>}
          {!open && unreadHint && <i aria-label="有新的客服回复" />}
        </button>
      )}
    </div>
  );
}

function uniqueMessages(messages: UiMessage[]): UiMessage[] {
  const byId = new Map<string, UiMessage>();
  messages.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort((a, b) => a.seq - b.seq);
}

function statusCopy(state: ConnectionState): string {
  if (state === 'loading') return '正在连接';
  if (state === 'reconnecting') return '连接中断，正在重试';
  if (state === 'offline') return '当前离线';
  if (state === 'error') return '暂时无法连接';
  return '在线';
}

function formatMessageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
