import { resolveRequestOrigin } from '../../../platform/publicOrigin';
import { ChatAttachmentError, createChatAttachmentTicket, listChatAttachmentDownloadUrls } from '../imChatAttachments';
import { canAccessConversation } from '../conversationAccess';
import { authenticateStaffRequest } from '../imAuth';
import type { ImRequest, ImResponse } from '../httpTypes';

/** Staff attachment transport. Storage URLs are issued only after IM ACL checks. */
export default async function handler(req: ImRequest, res: ImResponse) {
  res.setHeader?.('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }
  const auth = await authenticateStaffRequest(req);
  if (auth.ok === false) {
    res.status(auth.status).json({ ok: false, error: auth.error });
    return;
  }

  const body = isRecord(req.body) ? req.body : {};
  const action = stringValue(body.action);
  const conversationId = stringValue(body.conversationId);
  if (!isUuid(conversationId) || (action !== 'upload' && action !== 'links')) {
    res.status(400).json({ ok: false, error: 'Invalid attachment request.' });
    return;
  }
  const mode = action === 'upload' ? 'write' : 'read';
  if (!(await canAccessConversation(auth.principal, conversationId, mode))) {
    res.status(403).json({ ok: false, error: 'Conversation access denied.' });
    return;
  }

  try {
    const requestOrigin = resolveRequestOrigin(req);
    if (action === 'upload') {
      const ticket = await createChatAttachmentTicket({
        conversationId,
        actor: { type: 'staff', id: auth.principal.staffId },
        clientUploadId: stringValue(body.clientUploadId),
        file: body.file,
        requestOrigin,
      });
      res.status(200).json({ ok: true, ticket });
      return;
    }
    const ids = Array.isArray(body.attachmentIds)
      ? body.attachmentIds.filter((value): value is string => typeof value === 'string').slice(0, 50)
      : [];
    if (!ids.length || ids.some((id) => !isUuid(id))) {
      res.status(400).json({ ok: false, error: 'Select valid attachments.' });
      return;
    }
    const urls = await listChatAttachmentDownloadUrls({ conversationId, attachmentIds: ids, requestOrigin });
    res.status(200).json({ ok: true, urls });
  } catch (error) {
    if (error instanceof ChatAttachmentError) {
      res.status(error.status).json({ ok: false, error: error.message });
      return;
    }
    console.error('IM staff attachment request failed:', error instanceof Error ? error.message : error);
    res.status(503).json({ ok: false, error: 'Attachment service is temporarily unavailable.' });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}
