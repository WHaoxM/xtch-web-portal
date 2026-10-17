import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type LeadSummary = {
  id: string;
  name: string;
  company: string;
  entry: string;
  status: string;
  created_at: string;
  notification_sent_at: string | null;
  notification_attempted_at: string | null;
  notification_provider: string;
  intent: string;
  business_type: string;
  customer_confirmation_enabled: boolean;
  customer_confirmation_sent_at: string | null;
  followup_sent_at: string | null;
};

type LeadDetail = LeadSummary & {
  phone: string;
  company_address: string;
  business_type: string;
  page_url: string;
  message: string;
  email: string;
  notification_last_error: string;
  customer_confirmation_attempted_at: string | null;
  customer_confirmation_provider: string;
  customer_confirmation_last_error: string;
};

type Followup = { id: string; recipient_email: string; subject: string; requested_by: string;
  created_at: string; sent_at: string | null; attempted_at: string | null; provider: string; last_error: string };

const intentLabel: Record<string, string> = {
  growth_plan: '获取方案', product_demo: '预约体验', custom_consultation: '定制化咨询',
  resource_request: '资料获取', offline_message: '人工客服留言',
};

function dateTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN');
}

function noticeLabel(lead: LeadSummary) {
  if (lead.notification_sent_at) return `邮件平台已接收${lead.notification_provider === 'qq-smtp' ? '（QQ SMTP）' : lead.notification_provider === 'resend' ? '（Resend）' : ''}`;
  if (lead.notification_attempted_at) return '邮件未确认，请人工跟进';
  return '未发送（历史记录）';
}

async function readResponse<T>(response: Response): Promise<T> {
  const result = await response.json() as T & { ok?: boolean; error?: string };
  if (!response.ok || result.ok !== true) throw new Error(result.error || '无法读取线索。');
  return result;
}

export function WenshuLeadsPanel({ token, initialLeadId = '' }: { token: string; initialLeadId?: string }) {
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<LeadDetail | null>(null);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [sendKey, setSendKey] = useState<string | null>(null);
  const sendKeyRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/admin/wenshu-leads?limit=50&offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      const result = await readResponse<{ ok: true; leads: LeadSummary[] }>(response);
      setLeads(result.leads);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '无法加载线索。');
    } finally { setLoading(false); }
  }, [token, offset]);

  useEffect(() => { void load(); }, [load]);

  const openLead = useCallback(async (id: string) => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/admin/wenshu-leads?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      const result = await readResponse<{ ok: true; lead: LeadDetail; followups: Followup[];
        followupDraft: { subject: string; body: string } }>(response);
      setSelected(result.lead);
      setFollowups(result.followups);
      setDraftSubject(result.followupDraft.subject);
      setDraftBody(result.followupDraft.body);
      setSendKey(null);
      sendKeyRef.current = null;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '无法打开线索。');
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    if (/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(initialLeadId)) void openLead(initialLeadId);
  }, [initialLeadId, openLead]);

  async function sendCustomerFollowup(lead: LeadDetail) {
    if (!lead.email || !draftSubject.trim() || !draftBody.trim()) {
      setError('请确认客户邮箱、邮件主题和正文。'); return;
    }
    if (!window.confirm(`请确认已审核邮件内容。此邮件将发送至客户邮箱 ${lead.email}，不是内部跟进邮箱。`)) return;
    const requestId = sendKeyRef.current || crypto.randomUUID();
    sendKeyRef.current = requestId;
    setSendKey(requestId);
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/admin/wenshu-leads?id=${encodeURIComponent(lead.id)}&action=send-follow-up`, {
        method: 'POST', cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': requestId },
        body: JSON.stringify({ subject: draftSubject.trim(), body: draftBody.trim() }),
      });
      if (response.status === 400) { setSendKey(null); sendKeyRef.current = null; }
      await readResponse<{ ok: true; id: string }>(response);
      await openLead(lead.id);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '发送未确认，请使用同一封邮件重试。');
    } finally { setLoading(false); }
  }

  async function retryNotification(id: string) {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/admin/wenshu-leads?id=${encodeURIComponent(id)}&action=retry-notification`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      await readResponse<{ ok: true }>(response);
      await openLead(id);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '邮件重试失败，请稍后再试。');
    } finally { setLoading(false); }
  }

  if (selected) return (
    <div className="space-y-4">
      <Button type="button" variant="outline" onClick={() => { setSelected(null); setSendKey(null); sendKeyRef.current = null; }}>← 返回线索列表</Button>
      <Card><CardContent className="space-y-3 p-5">
        <h3 className="text-lg font-semibold">{selected.name || '未填写称呼'} · 文数智旅线索</h3>
        <p className="text-sm text-muted-foreground">提交时间：{dateTime(selected.created_at)} · {noticeLabel(selected)}</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!selected.notification_sent_at && <Button type="button" variant="outline" disabled={loading}
          onClick={() => void retryNotification(selected.id)}>{loading ? '处理中…' : '重试邮件通知'}</Button>}
        <p className="text-sm text-muted-foreground">客户确认邮件：{selected.customer_confirmation_sent_at ? `邮件平台已接收（${selected.customer_confirmation_provider || '未知渠道'}）` : selected.customer_confirmation_enabled ? '尚未确认发送' : '历史线索未启用'}</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">联系电话</dt><dd className="break-all">{selected.phone}</dd></div>
          <div><dt className="text-muted-foreground">邮箱</dt><dd className="break-all">{selected.email || '未填写'}</dd></div>
          <div><dt className="text-muted-foreground">公司</dt><dd>{selected.company || '未填写'}</dd></div>
          <div><dt className="text-muted-foreground">业务类型</dt><dd>{selected.business_type || '未填写'}</dd></div>
          <div><dt className="text-muted-foreground">申请类型</dt><dd>{intentLabel[selected.intent] || selected.intent || '未分类'}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted-foreground">公司地址</dt><dd className="whitespace-pre-wrap">{selected.company_address}</dd></div>
          <div><dt className="text-muted-foreground">来源</dt><dd>{selected.entry || '未填写'}</dd></div>
          <div><dt className="text-muted-foreground">提交页面</dt><dd className="break-all">{selected.page_url || '未填写'}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted-foreground">留言</dt><dd className="whitespace-pre-wrap">{selected.message || '未填写'}</dd></div>
        </dl>
        <p className="text-xs text-muted-foreground">回执编号：{selected.id}</p>
        <div className="space-y-3 border-t pt-4">
          <h4 className="font-semibold">审核后向客户邮箱跟进</h4>
          <p className="text-sm text-muted-foreground">下方是按申请类型和业务类型生成的草稿。请审核、补充具体答复后发送；收件人固定为客户邮箱 {selected.email || '（未填写）'}，客户回复将发往内部跟进邮箱。</p>
          <label className="block text-sm">邮件主题
            <input className="mt-1 w-full rounded-md border px-3 py-2" value={draftSubject} maxLength={160}
              disabled={loading || Boolean(sendKey)} onChange={(event) => setDraftSubject(event.target.value)} />
          </label>
          <label className="block text-sm">邮件正文
            <textarea className="mt-1 min-h-56 w-full rounded-md border px-3 py-2" value={draftBody} maxLength={5000}
              disabled={loading || Boolean(sendKey)} onChange={(event) => setDraftBody(event.target.value)} />
          </label>
          {sendKey && <p className="text-sm text-amber-700">发送结果尚未确认时请勿编辑内容，点击下方按钮使用同一编号安全重试。</p>}
          <Button type="button" disabled={loading || !selected.email || !draftSubject.trim() || !draftBody.trim()}
            onClick={() => void sendCustomerFollowup(selected)}>{loading ? '发送中…' : sendKey ? '重试同一封邮件' : '审核确认并发送给客户'}</Button>
        </div>
        <div className="space-y-2 border-t pt-4">
          <h4 className="font-semibold">跟进邮件记录</h4>
          {followups.length === 0 && <p className="text-sm text-muted-foreground">尚未发送正式跟进邮件。</p>}
          {followups.map((item) => <p key={item.id} className="text-sm">
            {dateTime(item.created_at)} · {item.subject} · {item.recipient_email} · {item.sent_at ? `邮件平台已接收（${item.provider || '未知渠道'}）` : item.attempted_at ? '发送未确认' : '待发送'}
          </p>)}
        </div>
      </CardContent></Card>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">官网表单及离线留言在这里留档；邮件状态仅表示邮件平台接收，不代表邮箱最终投递。</p>
        <Button type="button" variant="outline" disabled={loading} onClick={() => void load()}>{loading ? '加载中…' : '刷新'}</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Card><CardContent className="overflow-x-auto p-0">
        <Table><TableHeader><TableRow>
          <TableHead>提交时间</TableHead><TableHead>称呼</TableHead><TableHead>公司</TableHead>
          <TableHead>申请类型</TableHead><TableHead>内部通知</TableHead><TableHead>客户跟进</TableHead>
        </TableRow></TableHeader><TableBody>
          {leads.map((lead) => <TableRow key={lead.id} className="cursor-pointer" onClick={() => void openLead(lead.id)}>
            <TableCell className="whitespace-nowrap">{dateTime(lead.created_at)}</TableCell>
            <TableCell>{lead.name || '未填写'}</TableCell><TableCell>{lead.company || '未填写'}</TableCell>
            <TableCell>{intentLabel[lead.intent] || lead.entry || '未分类'}</TableCell><TableCell>{noticeLabel(lead)}</TableCell>
            <TableCell>{lead.followup_sent_at ? `已发送 · ${dateTime(lead.followup_sent_at)}` : '待审核跟进'}</TableCell>
          </TableRow>)}
          {!loading && leads.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">暂无线索</TableCell></TableRow>}
        </TableBody></Table>
      </CardContent></Card>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>上一页</Button>
        <Button type="button" variant="outline" disabled={loading || leads.length < 50} onClick={() => setOffset(offset + 50)}>下一页</Button>
      </div>
    </div>
  );
}
