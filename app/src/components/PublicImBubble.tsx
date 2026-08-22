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
  linkPublicImIdentity,
  sendPublicImMessage,
  PUBLIC_IM_OPEN_EVENT,
  type PublicImConversation,
  type PublicImMessage,
  type PublicImSource,
} from '@/domains/im/publicImClient';
import { subscribeAuthSession } from '@/domains/identity/traveler/authClient';
import { brand } from '@/lib/siteData';

type PublicImBubbleProps = { source: PublicImSource; showTrigger?: boolean };
type ConnectionState = 'loading' | 'ready' | 'reconnecting' | 'offline' | 'error';
type DeliveryState = 'pending' | 'failed';
type UiMessage = PublicImMessage & { delivery?: DeliveryState; idempotencyKey?: string };

const QUICK_PROMPTS = ['Help me plan a custom trip', 'I have destinations and dates'];
const ACTIVE_CONVERSATION_STORAGE_KEY = 'xtch_public_im_active_conversation';

function readRememberedConversationId(): string | null {
  try {
    const value = window.localStorage.getItem(ACTIVE_CONVERSATION_STORAGE_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
}

function rememberConversationId(conversationId: string) {
  try {
    window.localStorage.setItem(ACTIVE_CONVERSATION_STORAGE_KEY, conversationId);
  } catch {
    // Private browsing/storage-disabled mode still works from the server session.
  }
}

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
  const [authRevision, setAuthRevision] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const socketRef = useRef<ReturnType<typeof connectPublicImSocket> | null>(null);
  const lastSeqRef = useRef(0);
  const conversationIdRef = useRef<string | null>(null);
  const historyMarkerRef = useRef(false);
  const sessionAttemptRef = useRef(0);
  const wasOpenRef = useRef(false);

  useEffect(() => subscribeAuthSession(() => setAuthRevision((value) => value + 1)), []);

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
        setError('Chat connection timed out. Please try again.');
        setLoading(false);
      }
    }, 10000);

    async function openConversation() {
      setLoading(true);
      setConnection('loading');
      setError(null);
      try {
        let session = await establishPublicImSession();
        if (cancelled) return;
        const rememberedId = readRememberedConversationId() ?? conversationIdRef.current;
        let selected = session.conversations.find((item) => item.id === rememberedId) ?? session.conversations[0];
        if (!selected && rememberedId && session.visitor.authenticatedUserId) {
          try {
            await linkPublicImIdentity(rememberedId);
            session = await establishPublicImSession();
            selected = session.conversations.find((item) => item.id === rememberedId) ?? session.conversations[0];
          } catch {
            // A stale conversation id must not prevent a fresh support conversation.
          }
        }
        selected ??= await createPublicImConversation(source);
        if (cancelled) return;
        rememberConversationId(selected.id);
        conversationIdRef.current = selected.id;
        setConversation(selected);
        const initial = await listPublicImMessages(selected.id);
        if (cancelled) return;
        replaceMessages(initial);
        // REST history is the bootstrap path. A slow/unavailable Socket.IO
        // connection must not turn a usable chat into a false timeout.
        window.clearTimeout(timeout);
        setConnection(navigator.onLine ? 'ready' : 'offline');
        const socket = connectPublicImSocket((message) => {
          if (message.conversation_id !== conversationIdRef.current) return;
          appendMessage(message);
          setConnection('ready');
        });
        socketRef.current = socket;
        socket?.socket.on('connect', () => {
          void socket.subscribe(selected.id).then(
            () => setConnection('ready'),
            () => setConnection(navigator.onLine ? 'reconnecting' : 'offline'),
          );
        });
        socket?.socket.on('disconnect', () => {
          if (!navigator.onLine) setConnection('offline');
          else setConnection('reconnecting');
        });
        socket?.socket.on('connect_error', () => setConnection('reconnecting'));
        socket?.socket.connect();
      } catch (cause) {
        if (!cancelled) {
          setConnection('error');
          setError(cause instanceof Error ? cause.message : 'Chat is temporarily unavailable.');
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
  }, [authRevision, open, source]);

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
    if (message.sender_type === 'staff') setAnnouncement(`Support reply: ${message.body}`);
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
      const failure = cause instanceof Error ? cause.message : 'Message not sent. Please try again.';
      setError(failure);
      setAnnouncement(`Message failed to send: ${failure}`);
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
      {open && <button type="button" className="public-im-backdrop" aria-label="Close chat" onClick={close} />}
      {open && (
        <section ref={panelRef} className="public-im-panel" role="dialog" aria-modal="true" aria-labelledby="public-im-title">
          <header className="public-im-header">
            <div className="public-im-header-main">
              <span className="public-im-route-mark" aria-hidden="true"><MapPin size={17} /></span>
              <div>
                <h2 id="public-im-title">Travel support</h2>
                <p className={`public-im-status is-${connection}`}><span /> {status}</p>
              </div>
            </div>
            <button type="button" className="public-im-close" onClick={close} aria-label="Close chat"><X size={20} /></button>
          </header>

          <div className="public-im-messages" aria-label="Chat messages">
            <div className="sr-only" aria-live="polite">{announcement}</div>
            {loading && <div className="public-im-loading" aria-label="Connecting to chat"><span /><span /><span /></div>}
            {!loading && messages.length === 0 && !unavailable && (
              <div className="public-im-empty-state">
                <span className="public-im-empty-marker" aria-hidden="true"><MapPin size={18} /></span>
                <p>Tell us your destination, dates, or rough idea.</p>
                <div className="public-im-prompts" aria-label="Quick prompts">
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
                  <time>{message.delivery === 'pending' ? 'Sending…' : message.delivery === 'failed' ? 'Not sent' : formatMessageTime(message.created_at)}</time>
                  {message.delivery === 'failed' && <button type="button" className="public-im-retry" onClick={(event) => void submitMessage(event, message)}>Retry</button>}
                </div>
              );
            })}
            {unavailable && (
              <div className="public-im-error-state" role="alert">
                <p>{error || (connection === 'offline' ? 'You are offline.' : 'Chat is temporarily unavailable.')}</p>
                <div>
                  <button type="button" onClick={() => { setError(null); setOpen(false); window.setTimeout(() => setOpen(true), 0); }}><RefreshCw size={14} /> Try again</button>
                  <a href={brand.whatsappHref} target="_blank" rel="noreferrer">Open WhatsApp</a>
                </div>
              </div>
            )}
          </div>

          <form className="public-im-composer" onSubmit={(event) => void submitMessage(event)}>
            {error && !unavailable && <p className="public-im-error" role="status">{error}</p>}
            <div className="public-im-input-row">
            <textarea ref={composerRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleDraftKeyDown} placeholder="Write a message" aria-label="Write a message" rows={1} maxLength={8000} disabled={loading || !conversation || sendingId !== null || unavailable || connection === 'reconnecting'} />
              <button type="submit" aria-label="Send message" disabled={!draft.trim() || loading || !conversation || sendingId !== null || unavailable || connection === 'reconnecting'}><Send size={17} /></button>
            </div>
            <p className="public-im-hint">Enter to send · Shift + Enter for a new line{draft.length > 7500 ? ` · ${draft.length}/8000` : ''}</p>
          </form>
        </section>
      )}

      {showTrigger && (
        <button ref={triggerRef} type="button" className={`public-im-trigger ${open ? 'is-open' : ''}`} onClick={open ? close : openPanel} aria-label={open ? 'Close chat' : 'Open chat'} aria-expanded={open}>
          <span className="public-im-trigger-icon">{open ? <X size={20} /> : <MessageCircle size={20} />}</span>
          {!open && unreadHint && <i aria-label="New chat reply" />}
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
  if (state === 'loading') return 'Connecting';
  if (state === 'reconnecting') return 'Reconnecting';
  if (state === 'offline') return 'Offline';
  if (state === 'error') return 'Unavailable';
  return 'Online';
}

function formatMessageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
