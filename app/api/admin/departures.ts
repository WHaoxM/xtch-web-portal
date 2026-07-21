import { randomBytes } from 'node:crypto';
import { URL } from 'node:url';
import { ensureBookingTables, type DepartureStatus } from '../lib/bookingSchema';
import { requireAdminAuth, hashIp } from '../lib/adminAuth';
import { writeAuditLog } from '../lib/auditLog';
import { listAdminDepartures } from '../lib/availability';
import { sql, type SqlClient } from '../lib/db';

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

type StatusAction = 'lock' | 'close' | 'cancel';

const KNOWN_STATUSES: DepartureStatus[] = [
  'draft',
  'sellable',
  'locked',
  'closed',
  'sold_out',
  'cancelled',
];

const DEFAULT_POLICY = {
  full_refund_until_days_before: 30,
  partial_refund_until_days_before: 14,
};

const DEFAULT_CONFIRMATION_RULE =
  'Minimum travelers may apply. If the minimum is not met, you will be offered a full refund or a date change.';

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  const admin = await requireAdminAuth(req);
  if (!admin.ok) {
    res.status(admin.status).json({ ok: false, error: admin.error });
    return;
  }

  try {
    await ensureBookingTables();

    if (req.method === 'GET') {
      const departures = await listAdminDepartures();
      res.status(200).json({ ok: true, departures });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method not allowed.' });
      return;
    }

    const query = parseQuery(req.url);
    const queryAction = query.get('action') || '';
    const queryPublicId = query.get('publicId') || '';

    // Legacy status actions via query string
    if (isStatusAction(queryAction)) {
      if (!queryPublicId) {
        res.status(400).json({ ok: false, error: 'Departure public ID is required.' });
        return;
      }
      const updated = await updateDepartureStatus(queryPublicId, queryAction);
      if (!updated) {
        res.status(404).json({ ok: false, error: 'Departure not found.' });
        return;
      }
      await writeAuditLog({
        actorType: 'admin',
        actorEmail: admin.email,
        action: `admin_departure_${queryAction}`,
        targetType: 'departure',
        targetId: queryPublicId,
        ipHash: hashIp(getClientIp(req)),
        userAgent: getHeaderValue(req.headers['user-agent']),
      });
      res.status(200).json({ ok: true });
      return;
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const action = String(body.action || '');

    if (action === 'create' || action === 'update') {
      const parsed = parseDepartureInput(body, action === 'create');
      if ('error' in parsed) {
        res.status(400).json({ ok: false, error: parsed.error });
        return;
      }

      const result =
        action === 'create'
          ? await createDeparture(parsed.data)
          : await updateDeparture(parsed.data);

      if ('error' in result) {
        res.status(result.status).json({ ok: false, error: result.error });
        return;
      }

      await writeAuditLog({
        actorType: 'admin',
        actorEmail: admin.email,
        action: action === 'create' ? 'admin_departure_create' : 'admin_departure_update',
        targetType: 'departure',
        targetId: result.public_id,
        ipHash: hashIp(getClientIp(req)),
        userAgent: getHeaderValue(req.headers['user-agent']),
        metadata: {
          route_slug: parsed.data.route_slug,
          featured_on_home: parsed.data.featured_on_home,
          featured_priority: parsed.data.featured_priority,
          status: parsed.data.status,
          refill_chain_key: parsed.data.refill_chain_key,
          refill_sequence: parsed.data.refill_sequence,
          refill_enabled: parsed.data.refill_enabled,
          refill_max_auto_activations: parsed.data.refill_max_auto_activations,
        },
      });

      const departures = await listAdminDepartures();
      res.status(200).json({
        ok: true,
        public_id: result.public_id,
        departures,
      });
      return;
    }

    if (action === 'set-featured') {
      const publicId = String(body.publicId || '').trim();
      if (!publicId) {
        res.status(400).json({ ok: false, error: 'Departure public ID is required.' });
        return;
      }
      const featuredOnHome = Boolean(body.featuredOnHome);
      const featuredPriority = Number(body.featuredPriority);
      if (!Number.isFinite(featuredPriority) || featuredPriority < 0 || featuredPriority > 9999) {
        res.status(400).json({ ok: false, error: 'Featured priority must be between 0 and 9999.' });
        return;
      }

      const result = await sql`
        UPDATE departures
        SET
          featured_on_home = ${featuredOnHome},
          featured_priority = ${Math.floor(featuredPriority)},
          updated_at = NOW()
        WHERE public_id = ${publicId}
        RETURNING public_id
      `;

      if (!result.rows.length) {
        res.status(404).json({ ok: false, error: 'Departure not found.' });
        return;
      }

      await writeAuditLog({
        actorType: 'admin',
        actorEmail: admin.email,
        action: 'admin_departure_set_featured',
        targetType: 'departure',
        targetId: publicId,
        ipHash: hashIp(getClientIp(req)),
        userAgent: getHeaderValue(req.headers['user-agent']),
        metadata: { featured_on_home: featuredOnHome, featured_priority: Math.floor(featuredPriority) },
      });

      const departures = await listAdminDepartures();
      res.status(200).json({ ok: true, departures });
      return;
    }

    if (isStatusAction(action)) {
      const publicId = String(body.publicId || queryPublicId || '').trim();
      if (!publicId) {
        res.status(400).json({ ok: false, error: 'Departure public ID is required.' });
        return;
      }
      const updated = await updateDepartureStatus(publicId, action);
      if (!updated) {
        res.status(404).json({ ok: false, error: 'Departure not found.' });
        return;
      }
      await writeAuditLog({
        actorType: 'admin',
        actorEmail: admin.email,
        action: `admin_departure_${action}`,
        targetType: 'departure',
        targetId: publicId,
        ipHash: hashIp(getClientIp(req)),
        userAgent: getHeaderValue(req.headers['user-agent']),
      });
      const departures = await listAdminDepartures();
      res.status(200).json({ ok: true, departures });
      return;
    }

    res.status(400).json({
      ok: false,
      error: 'Action must be create, update, set-featured, lock, close, or cancel.',
    });
  } catch (error) {
    console.error('Admin departures API failed:', error);
    res.status(500).json({ ok: false, error: 'Admin request failed.' });
  }
}

type DepartureInput = {
  public_id: string;
  route_slug: string;
  route_title: string;
  destination_slug: string | null;
  departure_city: string;
  start_date: string;
  end_date: string;
  status: DepartureStatus;
  guaranteed: boolean;
  adult_unit_price_cents: number;
  capacity: number;
  featured_on_home: boolean;
  featured_priority: number;
  included_core_items: unknown[];
  excluded_core_items: unknown[];
  important_notes: unknown[];
  cancellation_policy_snapshot: unknown;
  policy_version: string;
  confirmation_rule: string;
  refill_chain_key: string | null;
  refill_sequence: number | null;
  refill_enabled: boolean;
  refill_max_auto_activations: number | null;
};

function parseDepartureInput(
  body: Record<string, unknown>,
  isCreate: boolean,
): { data: DepartureInput } | { error: string } {
  const routeSlug = String(body.routeSlug || body.route_slug || '').trim();
  const routeTitle = String(body.routeTitle || body.route_title || '').trim();
  const departureCity = String(body.departureCity || body.departure_city || '').trim();
  const startDate = String(body.startDate || body.start_date || '').trim();
  const endDate = String(body.endDate || body.end_date || '').trim();
  const statusRaw = String(body.status || 'draft').trim() as DepartureStatus;
  const destinationSlugRaw = String(body.destinationSlug || body.destination_slug || '').trim();
  const publicIdRaw = String(body.publicId || body.public_id || '').trim();
  const refillChainKey = String(body.refillChainKey || body.refill_chain_key || '').trim();

  if (!routeSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(routeSlug)) {
    return { error: 'A valid route slug is required.' };
  }
  if (!routeTitle) return { error: 'Route title is required.' };
  if (!departureCity) return { error: 'Departure city is required.' };
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    return { error: 'Start and end dates must be YYYY-MM-DD.' };
  }
  if (endDate < startDate) return { error: 'End date must be on or after start date.' };
  if (!KNOWN_STATUSES.includes(statusRaw)) {
    return { error: 'Status is not valid.' };
  }

  const priceCents = Number(body.adultUnitPriceCents ?? body.adult_unit_price_cents);
  if (!Number.isFinite(priceCents) || priceCents <= 0 || priceCents > 50_000_000) {
    return { error: 'Adult price (USD cents) must be a positive amount.' };
  }

  const capacity = Number(body.capacity);
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 200) {
    return { error: 'Capacity must be between 1 and 200.' };
  }

  const featuredPriority = Number(body.featuredPriority ?? body.featured_priority ?? 0);
  if (!Number.isFinite(featuredPriority) || featuredPriority < 0 || featuredPriority > 9999) {
    return { error: 'Featured priority must be between 0 and 9999.' };
  }

  let publicId = publicIdRaw;
  if (isCreate && !publicId) {
    publicId = `dep-${startDate}-${randomBytes(3).toString('hex')}`;
  }
  if (!publicId || publicId.length > 80) {
    return { error: 'Public ID is required and must be at most 80 characters.' };
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(publicId)) {
    return { error: 'Public ID format is invalid.' };
  }

  let refillSequence: number | null = null;
  let refillMaxAutoActivations: number | null = null;
  if (refillChainKey) {
    if (
      refillChainKey.length > 80 ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(refillChainKey)
    ) {
      return { error: 'Refill chain key format is invalid.' };
    }
    refillSequence = Number(body.refillSequence ?? body.refill_sequence);
    if (!Number.isInteger(refillSequence) || refillSequence < 1 || refillSequence > 1000) {
      return { error: 'Refill sequence must be an integer between 1 and 1000.' };
    }
    refillMaxAutoActivations = Number(
      body.refillMaxAutoActivations ?? body.refill_max_auto_activations,
    );
    if (
      !Number.isInteger(refillMaxAutoActivations) ||
      refillMaxAutoActivations < 1 ||
      refillMaxAutoActivations > 1000
    ) {
      return { error: 'Maximum auto activations must be an integer between 1 and 1000.' };
    }
  }

  const included = asStringArray(body.includedCoreItems ?? body.included_core_items);
  const excluded = asStringArray(body.excludedCoreItems ?? body.excluded_core_items);
  const notes = asStringArray(body.importantNotes ?? body.important_notes);

  return {
    data: {
      public_id: publicId,
      route_slug: routeSlug,
      route_title: routeTitle,
      destination_slug: destinationSlugRaw || null,
      departure_city: departureCity,
      start_date: startDate,
      end_date: endDate,
      status: statusRaw,
      guaranteed: Boolean(body.guaranteed),
      adult_unit_price_cents: Math.floor(priceCents),
      capacity: Math.floor(capacity),
      featured_on_home: Boolean(body.featuredOnHome ?? body.featured_on_home),
      featured_priority: Math.floor(featuredPriority),
      included_core_items: included,
      excluded_core_items: excluded,
      important_notes: notes,
      cancellation_policy_snapshot:
        body.cancellationPolicySnapshot ?? body.cancellation_policy_snapshot ?? DEFAULT_POLICY,
      policy_version: String(body.policyVersion || body.policy_version || 'v2026-01').trim() || 'v2026-01',
      confirmation_rule:
        String(body.confirmationRule || body.confirmation_rule || DEFAULT_CONFIRMATION_RULE).trim() ||
        DEFAULT_CONFIRMATION_RULE,
      refill_chain_key: refillChainKey || null,
      refill_sequence: refillSequence,
      refill_enabled: refillChainKey
        ? Boolean(body.refillEnabled ?? body.refill_enabled)
        : false,
      refill_max_auto_activations: refillMaxAutoActivations,
    },
  };
}

async function createDeparture(
  data: DepartureInput,
): Promise<{ public_id: string } | { error: string; status: number }> {
  try {
    await sql.begin(async (tx) => {
      const inserted = await tx<{ id: string }>`
        INSERT INTO departures (
          public_id, route_slug, route_title, destination_slug, departure_city,
          start_date, end_date, status, guaranteed, adult_unit_price_cents, currency,
          capacity, featured_on_home, featured_priority,
          included_core_items, excluded_core_items, important_notes,
          cancellation_policy_snapshot, policy_version, confirmation_rule
        ) VALUES (
          ${data.public_id}, ${data.route_slug}, ${data.route_title}, ${data.destination_slug},
          ${data.departure_city}, ${data.start_date}, ${data.end_date}, ${data.status},
          ${data.guaranteed}, ${data.adult_unit_price_cents}, 'usd', ${data.capacity},
          ${data.featured_on_home}, ${data.featured_priority},
          ${JSON.stringify(data.included_core_items)}::jsonb,
          ${JSON.stringify(data.excluded_core_items)}::jsonb,
          ${JSON.stringify(data.important_notes)}::jsonb,
          ${JSON.stringify(data.cancellation_policy_snapshot)}::jsonb,
          ${data.policy_version}, ${data.confirmation_rule}
        )
        RETURNING id
      `;
      await saveRefillConfig(tx, inserted.rows[0].id, data);
    });
    return { public_id: data.public_id };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('REFILL_VALIDATION:')) {
      return { error: message.slice('REFILL_VALIDATION:'.length), status: 400 };
    }
    if (message.toLowerCase().includes('unique') || message.includes('23505')) {
      return { error: 'Public ID, refill chain sequence, or chain key already exists.', status: 409 };
    }
    throw error;
  }
}

async function updateDeparture(
  data: DepartureInput,
): Promise<{ public_id: string } | { error: string; status: number }> {
  try {
    const found = await sql.begin(async (tx) => {
      const result = await tx<{ id: string }>`
        UPDATE departures
        SET
          route_slug = ${data.route_slug},
          route_title = ${data.route_title},
          destination_slug = ${data.destination_slug},
          departure_city = ${data.departure_city},
          start_date = ${data.start_date},
          end_date = ${data.end_date},
          status = ${data.status},
          guaranteed = ${data.guaranteed},
          adult_unit_price_cents = ${data.adult_unit_price_cents},
          capacity = ${data.capacity},
          featured_on_home = ${data.featured_on_home},
          featured_priority = ${data.featured_priority},
          included_core_items = ${JSON.stringify(data.included_core_items)}::jsonb,
          excluded_core_items = ${JSON.stringify(data.excluded_core_items)}::jsonb,
          important_notes = ${JSON.stringify(data.important_notes)}::jsonb,
          cancellation_policy_snapshot = ${JSON.stringify(data.cancellation_policy_snapshot)}::jsonb,
          policy_version = ${data.policy_version},
          confirmation_rule = ${data.confirmation_rule},
          updated_at = NOW()
        WHERE public_id = ${data.public_id}
        RETURNING id
      `;
      const departure = result.rows[0];
      if (!departure) return false;
      await saveRefillConfig(tx, departure.id, data);
      return true;
    });
    if (!found) return { error: 'Departure not found.', status: 404 };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('REFILL_VALIDATION:')) {
      return { error: message.slice('REFILL_VALIDATION:'.length), status: 400 };
    }
    if (message.toLowerCase().includes('unique') || message.includes('23505')) {
      return { error: 'That refill chain sequence is already in use.', status: 409 };
    }
    throw error;
  }
  return { public_id: data.public_id };
}

async function saveRefillConfig(
  tx: SqlClient,
  departureId: string,
  data: DepartureInput,
): Promise<void> {
  const previous = await tx<{ chain_id: string }>`
    DELETE FROM departure_refill_chain_members
    WHERE departure_id = ${departureId}
    RETURNING chain_id
  `;

  if (!data.refill_chain_key) {
    if (previous.rows[0]) {
      await tx`
        DELETE FROM departure_refill_chains c
        WHERE c.id = ${previous.rows[0].chain_id}
          AND NOT EXISTS (
            SELECT 1 FROM departure_refill_chain_members m WHERE m.chain_id = c.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM departure_refill_events e WHERE e.chain_id = c.id
          )
      `;
    }
    return;
  }

  const existing = await tx<{ id: string; route_slug: string }>`
    SELECT id, route_slug
    FROM departure_refill_chains
    WHERE chain_key = ${data.refill_chain_key}
    FOR UPDATE
  `;
  const existingChain = existing.rows[0];
  if (existingChain && existingChain.route_slug !== data.route_slug) {
    throw new Error('REFILL_VALIDATION:All departures in a refill chain must use the same route.');
  }

  const chain = existingChain
    ? await tx<{ id: string }>`
        UPDATE departure_refill_chains
        SET enabled = ${data.refill_enabled},
            max_auto_activations = ${data.refill_max_auto_activations},
            updated_at = NOW()
        WHERE id = ${existingChain.id}
        RETURNING id
      `
    : await tx<{ id: string }>`
        INSERT INTO departure_refill_chains (
          chain_key, route_slug, enabled, max_auto_activations
        ) VALUES (
          ${data.refill_chain_key}, ${data.route_slug}, ${data.refill_enabled},
          ${data.refill_max_auto_activations}
        )
        RETURNING id
      `;
  const chainId = chain.rows[0].id;

  await tx`
    INSERT INTO departure_refill_chain_members (chain_id, departure_id, sequence)
    VALUES (${chainId}, ${departureId}, ${data.refill_sequence})
  `;

  if ((data.refill_sequence ?? 0) > 1 && data.status !== 'draft') {
    const wasAutoActivated = await tx<{ activated: boolean }>`
      SELECT EXISTS (
        SELECT 1
        FROM departure_refill_events
        WHERE activated_departure_id = ${departureId}
          AND outcome = 'activated'
      ) AS activated
    `;
    if (!wasAutoActivated.rows[0]?.activated) {
      throw new Error(
        'REFILL_VALIDATION:A preconfigured later refill departure must remain draft until activated.',
      );
    }
  }

  if (previous.rows[0] && previous.rows[0].chain_id !== chainId) {
    await tx`
      DELETE FROM departure_refill_chains c
      WHERE c.id = ${previous.rows[0].chain_id}
        AND NOT EXISTS (
          SELECT 1 FROM departure_refill_chain_members m WHERE m.chain_id = c.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM departure_refill_events e WHERE e.chain_id = c.id
        )
    `;
  }

  if (!data.refill_enabled) return;

  const readiness = await tx<{
    member_count: string;
    invalid_later_count: string;
    min_sequence: string | null;
    max_sequence: string | null;
  }>`
    SELECT
      COUNT(*)::text AS member_count,
      MIN(m.sequence)::text AS min_sequence,
      MAX(m.sequence)::text AS max_sequence,
      COUNT(*) FILTER (
        WHERE m.sequence > 1
          AND d.status <> 'draft'
          AND NOT EXISTS (
            SELECT 1
            FROM departure_refill_events e
            WHERE e.activated_departure_id = d.id
              AND e.outcome = 'activated'
          )
      )::text AS invalid_later_count
    FROM departure_refill_chain_members m
    JOIN departures d ON d.id = m.departure_id
    WHERE m.chain_id = ${chainId}
  `;
  const memberCount = Number(readiness.rows[0]?.member_count ?? 0);
  const invalidLaterCount = Number(readiness.rows[0]?.invalid_later_count ?? 0);
  const minSequence = Number(readiness.rows[0]?.min_sequence ?? 0);
  const maxSequence = Number(readiness.rows[0]?.max_sequence ?? 0);
  if (memberCount < 2) {
    throw new Error('REFILL_VALIDATION:Enable refill only after at least two departures are configured.');
  }
  if (minSequence !== 1 || maxSequence !== memberCount) {
    throw new Error('REFILL_VALIDATION:Refill sequence must be contiguous starting at 1.');
  }
  if ((data.refill_max_auto_activations ?? 0) > memberCount - 1) {
    throw new Error(
      'REFILL_VALIDATION:Maximum auto activations cannot exceed the configured later departures.',
    );
  }
  if (invalidLaterCount > 0) {
    throw new Error(
      'REFILL_VALIDATION:Every not-yet-activated later departure must be a complete draft.',
    );
  }
}

async function updateDepartureStatus(publicId: string, action: StatusAction): Promise<boolean> {
  if (action === 'lock') {
    const result = await sql`
      UPDATE departures
      SET status = 'locked', locked_at = NOW(), updated_at = NOW()
      WHERE public_id = ${publicId}
      RETURNING id
    `;
    return result.rows.length > 0;
  }

  if (action === 'close') {
    const result = await sql`
      UPDATE departures
      SET status = 'closed', closed_at = NOW(), updated_at = NOW()
      WHERE public_id = ${publicId}
      RETURNING id
    `;
    return result.rows.length > 0;
  }

  const result = await sql`
    UPDATE departures
    SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
    WHERE public_id = ${publicId}
    RETURNING id
  `;
  return result.rows.length > 0;
}

function isStatusAction(action: string): action is StatusAction {
  return action === 'lock' || action === 'close' || action === 'cancel';
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

function parseQuery(url: string | undefined): URLSearchParams {
  if (!url) return new URLSearchParams();
  const parsed = new URL(url, 'http://localhost');
  return parsed.searchParams;
}

function getClientIp(req: VercelRequestLike): string {
  const forwarded = getHeaderValue(req.headers['x-forwarded-for']);
  if (forwarded) return forwarded.split(',')[0].trim();
  return getHeaderValue(req.headers['x-real-ip']) || 'unknown';
}

function getHeaderValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : value || '';
}
