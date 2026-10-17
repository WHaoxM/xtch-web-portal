import { useCallback, useEffect, useState } from 'react';
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
};

type LeadDetail = LeadSummary & {
  phone: string;
  company_address: string;
  business_type: string;
  page_url: string;
  message: string;
  email: string;
  notification_last_error: string;
};

function dateTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN');
}

function noticeLabel(lead: LeadSummary) {
  if (lead.notification_sent_at) return '邮件平台已接收';
  if (lead.notification_attempted_at) return '邮件未确认，请人工跟进';
  return '未发送（历史记录）';
}

async function readResponse<T>(response: Response): Promise<T> {
  const result = await response.json() as T & { ok?: boolean; error?: string };
  if (!response.ok || result.ok !== true) throw new Error(result.error || '无法读取线索。');
  return result;
}

export function WenshuLeadsPanel({ token }: { token: string }) {
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<LeadDetail | null>(null);
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

  async function openLead(id: string) {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/admin/wenshu-leads?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      const result = await readResponse<{ ok: true; lead: LeadDetail }>(response);
      setSelected(result.lead);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '无法打开线索。');
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
      <Button type="button" variant="outline" onClick={() => setSelected(null)}>← 返回线索列表</Button>
      <Card><CardContent className="space-y-3 p-5">
        <h3 className="text-lg font-semibold">{selected.name || '未填写称呼'} · 文数智旅线索</h3>
        <p className="text-sm text-muted-foreground">提交时间：{dateTime(selected.created_at)} · {noticeLabel(selected)}</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!selected.notification_sent_at && <Button type="button" variant="outline" disabled={loading}
          onClick={() => void retryNotification(selected.id)}>{loading ? '处理中…' : '重试邮件通知'}</Button>}
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">联系电话</dt><dd className="break-all">{selected.phone}</dd></div>
          <div><dt className="text-muted-foreground">邮箱</dt><dd className="break-all">{selected.email || '未填写'}</dd></div>
          <div><dt className="text-muted-foreground">公司</dt><dd>{selected.company || '未填写'}</dd></div>
          <div><dt className="text-muted-foreground">业务类型</dt><dd>{selected.business_type || '未填写'}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted-foreground">公司地址</dt><dd className="whitespace-pre-wrap">{selected.company_address}</dd></div>
          <div><dt className="text-muted-foreground">来源</dt><dd>{selected.entry || '未填写'}</dd></div>
          <div><dt className="text-muted-foreground">提交页面</dt><dd className="break-all">{selected.page_url || '未填写'}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted-foreground">留言</dt><dd className="whitespace-pre-wrap">{selected.message || '未填写'}</dd></div>
        </dl>
        <p className="text-xs text-muted-foreground">回执编号：{selected.id}</p>
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
          <TableHead>入口</TableHead><TableHead>邮件状态</TableHead>
        </TableRow></TableHeader><TableBody>
          {leads.map((lead) => <TableRow key={lead.id} className="cursor-pointer" onClick={() => void openLead(lead.id)}>
            <TableCell className="whitespace-nowrap">{dateTime(lead.created_at)}</TableCell>
            <TableCell>{lead.name || '未填写'}</TableCell><TableCell>{lead.company || '未填写'}</TableCell>
            <TableCell>{lead.entry || '未填写'}</TableCell><TableCell>{noticeLabel(lead)}</TableCell>
          </TableRow>)}
          {!loading && leads.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">暂无线索</TableCell></TableRow>}
        </TableBody></Table>
      </CardContent></Card>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>上一页</Button>
        <Button type="button" variant="outline" disabled={loading || leads.length < 50} onClick={() => setOffset(offset + 50)}>下一页</Button>
      </div>
    </div>
  );
}
