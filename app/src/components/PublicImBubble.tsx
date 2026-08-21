import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import {
  connectPublicImSocket,
  createPublicImConversation,
  establishPublicImSession,
  listPublicImMessages,
  sendPublicImMessage,
  type PublicImConversation,
  type PublicImMessage,
  type PublicImSource,
} from '@/domains/im/publicImClient';

type PublicImBubbleProps = { source: PublicImSource };

export default function PublicImBubble({ source }: PublicImBubbleProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [conversation, setConversation] = useState<PublicImConversation | null>(null);
  const [messages, setMessages] = useState<PublicImMessage[]>([]);
  const socketRef = useRef<ReturnType<typeof connectPublicImSocket> | null>(null);
  const lastSeqRef = useRef(0);
  const conversationIdRef = useRef<string | null>(null);

  const unreadHint = useMemo(
    () => messages.some((message) => message.sender_type === 'staff'),
    [messages],
  );

  useEffect(() => {
    if (!open) {
      socketRef.current?.socket.disconnect();
      socketRef.current = null;
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function openConversation() {
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
        });
        socketRef.current = socket;
        socket?.socket.on('connect', () => socket.subscribe(selected.id));
        socket?.socket.connect();
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Messaging is temporarily unavailable.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    openConversation();
    return () => {
      cancelled = true;
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
      } catch {
        // Socket reconnect or the next poll will recover transient failures.
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [conversation, open]);

  function replaceMessages(next: PublicImMessage[]) {
    const unique = uniqueMessages(next);
    setMessages(unique);
    lastSeqRef.current = unique.at(-1)?.seq ?? 0;
  }

  function appendMessage(message: PublicImMessage) {
    setMessages((current) => {
      const next = uniqueMessages([...current, message]);
      lastSeqRef.current = next.at(-1)?.seq ?? lastSeqRef.current;
      return next;
    });
  }

  async function submitMessage(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !conversation || sending) return;
    setSending(true);
    setError(null);
    try {
      const message = await sendPublicImMessage(conversation.id, body);
      appendMessage(message);
      setDraft('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className="public-im-root">
      {open && (
        <section className="public-im-panel" role="dialog" aria-label="Chat with Syncing Travel">
          <header className="public-im-header">
            <div>
              <p className="public-im-eyebrow">SYNCING TRAVEL</p>
              <h2>Chat with our team</h2>
              <p className="public-im-status"><span /> Usually replies within a few minutes</p>
            </div>
            <button type="button" className="public-im-close" onClick={() => setOpen(false)} aria-label="Close chat">
              <X size={18} />
            </button>
          </header>

          <div className="public-im-messages" aria-live="polite">
            {loading && <p className="public-im-empty">Starting a secure chat…</p>}
            {!loading && messages.length === 0 && (
              <div className="public-im-welcome">
                <span className="public-im-welcome-mark"><MessageCircle size={18} /></span>
                <p>Tell us what you are planning. A China travel specialist will be here shortly.</p>
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={`public-im-message ${message.sender_type === 'visitor' ? 'is-visitor' : 'is-staff'}`}>
                <p>{message.body}</p>
                <time>{formatMessageTime(message.created_at)}</time>
              </div>
            ))}
          </div>

          <form className="public-im-composer" onSubmit={submitMessage}>
            {error && <p className="public-im-error" role="status">{error}</p>}
            <div className="public-im-input-row">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleDraftKeyDown}
                placeholder="Write a message…"
                aria-label="Message"
                rows={1}
                maxLength={8000}
                disabled={loading || !conversation || sending}
              />
              <button type="submit" aria-label="Send message" disabled={!draft.trim() || loading || !conversation || sending}>
                <Send size={17} />
              </button>
            </div>
            <p className="public-im-hint">Enter to send · Shift + Enter for a new line</p>
          </form>
        </section>
      )}

      <button
        type="button"
        className={`public-im-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close chat' : 'Open chat with Syncing Travel'}
        aria-expanded={open}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && <span className="public-im-trigger-label">Chat with us</span>}
        {!open && unreadHint && <i aria-label="New reply" />}
      </button>
    </div>
  );
}

function uniqueMessages(messages: PublicImMessage[]): PublicImMessage[] {
  const byId = new Map<string, PublicImMessage>();
  messages.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort((a, b) => a.seq - b.seq);
}

function formatMessageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
