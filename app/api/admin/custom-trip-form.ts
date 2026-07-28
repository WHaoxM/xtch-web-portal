import { requireAdminAuth, hashIp } from '../lib/adminAuth';
import { writeAuditLog } from '../lib/auditLog';
import {
  ensureCustomTripFormTables,
  listCustomTripFormFields,
  reorderCustomTripFields,
  setCustomTripFieldEnabled,
  setCustomTripFieldRequired,
  shouldUseMemoryFormStorage,
  upsertCustomTripField,
  type FormControlType,
  type FormGroup,
} from '../lib/customTripForm';

type VercelRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  url?: string;
  body?: unknown;
};

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
};

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  const admin = await requireAdminAuth(req);
  if (!admin.ok) {
    res.status(admin.status).json({ ok: false, error: admin.error });
    return;
  }

  try {
    if (!shouldUseMemoryFormStorage()) {
      await ensureCustomTripFormTables();
    }

    if (req.method === 'GET') {
      const fields = await listCustomTripFormFields({ includeDisabled: true });
      res.status(200).json({ ok: true, fields });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method not allowed.' });
      return;
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const action = String(body.action || '');

    if (action === 'save-field') {
      const result = await upsertCustomTripField({
        id: stringOrUndefined(body.id),
        fieldKey: String(body.fieldKey || ''),
        label: String(body.label || ''),
        description: String(body.description || ''),
        controlType: body.controlType as FormControlType,
        required: Boolean(body.required),
        defaultValue: body.defaultValue,
        formGroup: body.formGroup as FormGroup,
        sortOrder: Number(body.sortOrder) || 0,
        enabled: body.enabled !== false,
        useOnRoutePrivate: Boolean(body.useOnRoutePrivate),
        options: Array.isArray(body.options)
          ? body.options.map((item) => {
              const option = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
              return {
                id: stringOrUndefined(option.id),
                optionKey: String(option.optionKey || ''),
                label: String(option.label || ''),
                sortOrder: Number(option.sortOrder) || 0,
                enabled: option.enabled !== false,
              };
            })
          : [],
      });

      if (result.error || !result.field) {
        res.status(400).json({ ok: false, error: result.error || 'Could not save field.' });
        return;
      }

      await writeAuditLog({
        actorType: 'admin',
        actorEmail: admin.email,
        action: body.id ? 'admin_custom_form_field_update' : 'admin_custom_form_field_create',
        targetType: 'custom_trip_form_field',
        targetId: result.field.id,
        ipHash: hashIp(getClientIp(req)),
        userAgent: headerValue(req.headers['user-agent']),
        metadata: { fieldKey: result.field.fieldKey },
      });

      res.status(200).json({ ok: true, field: result.field });
      return;
    }

    if (action === 'set-enabled') {
      const id = String(body.id || '');
      const enabled = Boolean(body.enabled);
      const result = await setCustomTripFieldEnabled(id, enabled);
      if (result.error || !result.field) {
        res.status(400).json({ ok: false, error: result.error || 'Could not update field.' });
        return;
      }

      await writeAuditLog({
        actorType: 'admin',
        actorEmail: admin.email,
        action: enabled ? 'admin_custom_form_field_enable' : 'admin_custom_form_field_disable',
        targetType: 'custom_trip_form_field',
        targetId: id,
        ipHash: hashIp(getClientIp(req)),
        userAgent: headerValue(req.headers['user-agent']),
      });

      res.status(200).json({ ok: true, field: result.field });
      return;
    }

    if (action === 'set-required') {
      const id = String(body.id || '');
      const required = Boolean(body.required);
      const result = await setCustomTripFieldRequired(id, required);
      if (result.error || !result.field) {
        res.status(400).json({ ok: false, error: result.error || 'Could not update field.' });
        return;
      }

      await writeAuditLog({
        actorType: 'admin',
        actorEmail: admin.email,
        action: required ? 'admin_custom_form_field_require' : 'admin_custom_form_field_optional',
        targetType: 'custom_trip_form_field',
        targetId: id,
        ipHash: hashIp(getClientIp(req)),
        userAgent: headerValue(req.headers['user-agent']),
      });

      res.status(200).json({ ok: true, field: result.field });
      return;
    }

    if (action === 'reorder') {
      const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.map(String) : [];
      await reorderCustomTripFields(orderedIds);
      const fields = await listCustomTripFormFields({ includeDisabled: true });
      res.status(200).json({ ok: true, fields });
      return;
    }

    res.status(400).json({ ok: false, error: 'Unknown action.' });
  } catch (error) {
    console.error('Admin custom trip form API failed:', error);
    res.status(500).json({ ok: false, error: 'Admin request failed.' });
  }
}

function stringOrUndefined(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getClientIp(req: VercelRequestLike) {
  const forwarded = headerValue(req.headers['x-forwarded-for']);
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return headerValue(req.headers['x-real-ip']) || 'unknown';
}
