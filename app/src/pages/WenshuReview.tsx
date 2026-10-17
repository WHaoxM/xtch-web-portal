import { useEffect, useState } from 'react';

type ReviewLead = { id: string; name: string; company: string; businessType: string;
  intent: string; message: string; email: string };
type ReviewData = { lead: ReviewLead; draft: { subject: string; body: string }; draftLocked: boolean };
const intentLabels: Record<string, string> = {
  growth_plan: '获取方案', product_demo: '预约体验', custom_consultation: '定制化咨询',
  resource_request: '资料获取', offline_message: '客服留言',
};

async function responseData(response: Response): Promise<Record<string, unknown>> {
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || data.ok !== true) throw new Error(String(data.error || '服务暂不可用，请稍后重试。'));
  return data;
}

/** The link itself grants only this one review; opening it never sends customer mail. */
export default function WenshuReview() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('review') || '');
  const [review, setReview] = useState<ReviewData | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [locked, setLocked] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (window.location.hash.startsWith('#review=')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    if (!token) { setError('审核链接无效。请从最新的客服通知邮件重新打开。'); return; }
    const controller = new AbortController();
    void fetch('/api/wenshu-review', { method: 'GET', cache: 'no-store',
      headers: { 'X-Wenshu-Review-Token': token }, signal: controller.signal })
      .then(responseData)
      .then(data => {
        const result = data as unknown as ReviewData;
        setReview(result);
        setSubject(result.draft.subject);
        setBody(result.draft.body);
        setLocked(result.draftLocked);
      })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '审核链接不可用。'); });
    return () => controller.abort();
  }, [token]);

  async function send() {
    if (!review || sending || sent || !subject.trim() || !body.trim()) return;
    setSending(true); setLocked(true); setError('');
    try {
      await responseData(await fetch('/api/wenshu-review', { method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-Wenshu-Review-Token': token },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim() }) }));
      setSent(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '发送未确认，请保持原内容重试。');
    } finally { setSending(false); }
  }

  return <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <p className="text-sm font-semibold tracking-wide text-blue-800">文数智旅 · 客服审核</p>
      <h1 className="mt-2 text-2xl font-bold">审核后发送客户跟进邮件</h1>
      <p className="mt-2 text-sm text-slate-600">打开此页面不会发送邮件。核对客户邮箱和内容后，点击页面底部的按钮才会发送。本链接仅用于这一条线索，30 天内有效，用后失效，请勿转发。</p>
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!review && !error && <p className="mt-6 text-sm text-slate-600">正在读取线索…</p>}
      {review && (sent ? <div className="mt-6 rounded-xl bg-green-50 p-5 text-green-900">
        <h2 className="font-semibold">正式跟进邮件已提交发送</h2>
        <p className="mt-1 text-sm">收件人：{review.lead.email}。如需再次跟进，请使用已登录的管理后台。</p>
      </div> : <div className="mt-6 space-y-5">
        <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">申请类型</dt><dd className="font-medium">{intentLabels[review.lead.intent] || review.lead.intent}</dd></div>
          <div><dt className="text-slate-500">业务类型</dt><dd className="font-medium">{review.lead.businessType || '未填写'}</dd></div>
          <div><dt className="text-slate-500">客户／公司</dt><dd className="font-medium">{review.lead.name || '未填写'} · {review.lead.company || '未填写'}</dd></div>
          <div><dt className="text-slate-500">客户收件邮箱</dt><dd className="break-all font-semibold text-blue-900">{review.lead.email}</dd></div>
          <div className="sm:col-span-2"><dt className="text-slate-500">客户需求</dt><dd className="whitespace-pre-wrap">{review.lead.message || '未填写'}</dd></div>
        </dl>
        <label className="block text-sm font-medium">邮件主题
          <input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" value={subject} maxLength={160}
            disabled={locked || sending} onChange={event => setSubject(event.target.value)} />
        </label>
        <label className="block text-sm font-medium">邮件正文
          <textarea className="mt-2 min-h-64 w-full rounded-lg border border-slate-300 px-3 py-2" value={body} maxLength={5000}
            disabled={locked || sending} onChange={event => setBody(event.target.value)} />
        </label>
        {locked && <p className="text-sm text-amber-800">此邮件已尝试发送。结果未确认时，请勿修改内容；再次点击会重试同一封邮件。</p>}
        <button type="button" className="w-full rounded-lg bg-blue-800 px-4 py-3 font-semibold text-white disabled:opacity-50"
          disabled={sending || !review.lead.email || !subject.trim() || !body.trim()} onClick={() => void send()}>
          {sending ? '发送中…' : locked ? '重试同一封邮件' : `确认发送至 ${review.lead.email}`}
        </button>
      </div>)}
    </div>
  </div>;
}
