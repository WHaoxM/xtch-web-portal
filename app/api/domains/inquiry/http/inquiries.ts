import crypto from 'node:crypto';
import { sql } from '../../../platform/db';
import {
  ensureCustomTripFormTables,
  formatPreferencesForEmail,
  listCustomTripFormFields,
  mapPreferencesToLegacyColumns,
  shouldUseMemoryFormStorage,
  validateCustomPreferences,
  type CustomPreferences,
} from '../../catalog/customTripForm';
import { ensureInquiryTable } from '../inquirySchema';

type VercelRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
};

type InquiryType = 'quick_contact' | 'custom_trip' | 'route_private' | 'group_tour_inquiry';

type InquiryPayload = {
  type?: string;
  name?: string;
  email?: string;
  phone?: string;
  travelMonth?: string;
  travelers?: string;
  tripLength?: string;
  destinations?: string[];
  otherDestination?: string;
  interests?: string[];
  hotelLevel?: string;
  travelStyle?: string;
  supportPreference?: string;
  budget?: string;
  message?: string;
  sourcePath?: string;
  requestedTour?: string;
  requestedDestination?: string;
  customPreferences?: CustomPreferences;
  turnstileToken?: string;
  honeypot?: string;
};

const RESEND_API_URL = 'https://api.resend.com/emails';
const RATE_LIMIT_WINDOW_HOURS = 1;
const RATE_LIMIT_MAX_SUBMISSIONS = 5;
const localInquiries: LocalInquiryRecord[] = [];

type LocalInquiryRecord = {
  id: string;
  email: string;
  ipHash: string;
  emailStatus: string;
  createdAt: number;
};

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  try {
    const payload = normalizePayload(req.body);

    if (payload.type === 'custom_trip' || payload.type === 'route_private') {
      if (!shouldUseMemoryFormStorage()) {
        await ensureCustomTripFormTables();
      }
      const fields = await listCustomTripFormFields({ includeDisabled: false });
      const fieldsForValidation =
        payload.type === 'route_private'
          ? fields.filter((field) => field.useOnRoutePrivate)
          : fields;
      const preferenceResult = validateCustomPreferences(fieldsForValidation, payload.customPreferences);
      if ('error' in preferenceResult) {
        res.status(400).json({ ok: false, error: preferenceResult.error });
        return;
      }
      payload.customPreferences = preferenceResult.preferences;
      const legacy = mapPreferencesToLegacyColumns(preferenceResult.preferences, fields);
      if (!payload.hotelLevel) payload.hotelLevel = legacy.hotelLevel;
      if (!payload.budget) payload.budget = legacy.budget;
    }

    const validationError = validatePayload(payload);

    if (validationError) {
      res.status(400).json({ ok: false, error: validationError });
      return;
    }

    if (payload.honeypot) {
      res.status(400).json({ ok: false, error: 'Submission rejected.' });
      return;
    }

    const turnstileOk = await verifyTurnstile(payload.turnstileToken, getClientIp(req));
    if (!turnstileOk) {
      res.status(400).json({ ok: false, error: 'Please complete the anti-spam check and try again.' });
      return;
    }

    const useMemoryStorage = shouldUseMemoryStorage();
    if (!useMemoryStorage) {
      await ensureInquiryTable();
    }

    const ipHash = hashValue(getClientIp(req) || 'unknown');
    const isRateLimited = useMemoryStorage
      ? checkMemoryRateLimit(payload.email!, ipHash)
      : await checkRateLimit(payload.email!, ipHash);
    if (isRateLimited) {
      res.status(429).json({ ok: false, error: 'Too many submissions. Please try again later.' });
      return;
    }

    const inquiry = useMemoryStorage
      ? insertMemoryInquiry(payload, ipHash, 'pending')
      : await insertInquiry(payload, req, ipHash, 'pending');
    const emailStatus = await sendInquiryEmails(payload, inquiry.id);

    if (emailStatus === 'failed') {
      await updateInquiryEmailStatus(inquiry.id, 'failed', useMemoryStorage);
      res.status(502).json({ ok: false, error: 'We could not send your inquiry email. Please try again.' });
      return;
    } else {
      await updateInquiryEmailStatus(inquiry.id, 'sent', useMemoryStorage);
    }

    res.status(200).json({ ok: true, inquiryId: inquiry.id });
  } catch (error) {
    console.error('Inquiry submission failed:', error);
    res.status(500).json({ ok: false, error: 'We could not submit your inquiry. Please try again.' });
  }
}

function normalizePayload(body: unknown): InquiryPayload {
  if (!body || typeof body !== 'object') return {};
  const raw = body as Record<string, unknown>;

  return {
    type: stringValue(raw.type),
    name: stringValue(raw.name),
    email: stringValue(raw.email).toLowerCase(),
    phone: stringValue(raw.phone),
    travelMonth: stringValue(raw.travelMonth),
    travelers: stringValue(raw.travelers),
    tripLength: stringValue(raw.tripLength),
    destinations: stringArray(raw.destinations),
    otherDestination: stringValue(raw.otherDestination),
    interests: stringArray(raw.interests),
    hotelLevel: stringValue(raw.hotelLevel),
    travelStyle: stringValue(raw.travelStyle),
    supportPreference: stringValue(raw.supportPreference),
    budget: stringValue(raw.budget),
    message: stringValue(raw.message),
    sourcePath: stringValue(raw.sourcePath),
    requestedTour: stringValue(raw.requestedTour),
    requestedDestination: stringValue(raw.requestedDestination),
    customPreferences:
      raw.customPreferences && typeof raw.customPreferences === 'object' && !Array.isArray(raw.customPreferences)
        ? (raw.customPreferences as CustomPreferences)
        : {},
    turnstileToken: stringValue(raw.turnstileToken),
    honeypot: stringValue(raw.honeypot),
  };
}

function validatePayload(payload: InquiryPayload) {
  if (!isInquiryType(payload.type)) return 'Invalid inquiry type.';
  if (!payload.name) return 'Please enter your name.';
  if (!isValidEmail(payload.email)) return 'Please enter a valid email address.';

  if (payload.type === 'custom_trip') {
    const hasDestination =
      Boolean(payload.otherDestination) ||
      Boolean(payload.requestedDestination) ||
      Boolean(payload.destinations?.length);
    const hasTravelBasics =
      Boolean(payload.travelMonth) ||
      Boolean(payload.travelers) ||
      Boolean(payload.tripLength);

    if (!hasDestination) {
      return 'Please choose or specify at least one destination.';
    }
    if (!hasTravelBasics) {
      return 'Please share at least one travel date, group size, or trip length detail.';
    }
  }

  if (payload.type === 'route_private' || payload.type === 'group_tour_inquiry') {
    if (!payload.requestedTour) {
      return 'Please choose a route for this request.';
    }
    if (!payload.travelMonth) {
      return 'Please share your travel dates.';
    }
    if (!payload.travelers) {
      return 'Please share your group size.';
    }
  }

  return '';
}

function isInquiryType(value: string | undefined): value is InquiryType {
  return (
    value === 'quick_contact' ||
    value === 'custom_trip' ||
    value === 'route_private' ||
    value === 'group_tour_inquiry'
  );
}

function inquiryEmailSubject(type: InquiryType | undefined, name: string) {
  const label =
    type === 'custom_trip'
      ? 'Custom trip request'
      : type === 'route_private'
        ? 'Route private request'
        : type === 'group_tour_inquiry'
          ? 'Group tour inquiry'
          : 'Quick contact';
  return `[Syncing Travel] ${label} - ${name}`;
}

function isValidEmail(value: string | undefined) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

async function verifyTurnstile(token: string | undefined, remoteIp: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token) return false;

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret,
      response: token,
      remoteip: remoteIp,
    }),
  });

  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}

async function checkRateLimit(email: string, ipHash: string) {
  const result = await sql<{ count: string }>`
    SELECT COUNT(*)::text AS count
    FROM inquiries
    WHERE created_at > NOW() - (${RATE_LIMIT_WINDOW_HOURS}::text || ' hours')::interval
      AND (LOWER(email) = LOWER(${email}) OR ip_hash = ${ipHash})
  `;

  return Number(result.rows[0]?.count ?? 0) >= RATE_LIMIT_MAX_SUBMISSIONS;
}

function checkMemoryRateLimit(email: string, ipHash: string) {
  const windowStart = Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000;
  return localInquiries.filter((inquiry) => (
    inquiry.createdAt > windowStart &&
    (inquiry.email.toLowerCase() === email.toLowerCase() || inquiry.ipHash === ipHash)
  )).length >= RATE_LIMIT_MAX_SUBMISSIONS;
}

function insertMemoryInquiry(payload: InquiryPayload, ipHash: string, emailStatus: string) {
  const inquiry = {
    id: crypto.randomUUID(),
    email: payload.email!,
    ipHash,
    emailStatus,
    createdAt: Date.now(),
  };

  localInquiries.push(inquiry);
  console.info('Local inquiry stored in memory:', {
    id: inquiry.id,
    type: payload.type,
    name: payload.name,
    email: payload.email,
  });

  return { id: inquiry.id };
}

async function updateInquiryEmailStatus(id: string, emailStatus: string, useMemoryStorage: boolean) {
  if (useMemoryStorage) {
    const inquiry = localInquiries.find((item) => item.id === id);
    if (inquiry) inquiry.emailStatus = emailStatus;
    return;
  }

  await sql`
    UPDATE inquiries
    SET email_status = ${emailStatus}
    WHERE id = ${id}
  `;
}

async function insertInquiry(
  payload: InquiryPayload,
  req: VercelRequestLike,
  ipHash: string,
  emailStatus: string,
) {
  const result = await sql<{ id: string }>`
    INSERT INTO inquiries (
      type,
      name,
      email,
      phone,
      travel_month,
      travelers,
      trip_length,
      budget,
      destinations,
      interests,
      hotel_level,
      travel_style,
      support_preference,
      requested_tour,
      requested_destination,
      message,
      source_path,
      user_agent,
      ip_hash,
      email_status,
      custom_preferences
    )
    VALUES (
      ${payload.type!},
      ${payload.name!},
      ${payload.email!},
      ${emptyToNull(payload.phone)},
      ${emptyToNull(payload.travelMonth)},
      ${emptyToNull(payload.travelers)},
      ${emptyToNull(payload.tripLength)},
      ${emptyToNull(payload.budget)},
      ${JSON.stringify(payload.destinations ?? [])},
      ${JSON.stringify(payload.interests ?? [])},
      ${emptyToNull(payload.hotelLevel)},
      ${emptyToNull(payload.travelStyle)},
      ${emptyToNull(payload.supportPreference)},
      ${emptyToNull(payload.requestedTour)},
      ${emptyToNull(payload.requestedDestination)},
      ${emptyToNull(payload.message)},
      ${emptyToNull(payload.sourcePath)},
      ${emptyToNull(getHeader(req, 'user-agent'))},
      ${ipHash},
      ${emailStatus},
      ${JSON.stringify(payload.customPreferences ?? {})}::jsonb
    )
    RETURNING id
  `;

  return result.rows[0];
}

async function sendInquiryEmails(payload: InquiryPayload, inquiryId: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INQUIRY_FROM_EMAIL;
  const recipients = parseRecipientList(process.env.INQUIRY_TO_EMAIL);
  const emailText = await buildInternalEmail(payload, inquiryId);

  if (shouldUseConsoleEmail()) {
    const localFrom = from || 'local-dev@syncingtravel.test';
    const localRecipients = recipients.length ? recipients : ['local-inquiries@syncingtravel.test'];
    console.info('Local inquiry email preview:', {
      company: {
        from: localFrom,
        to: localRecipients,
        subject: inquiryEmailSubject(payload.type as InquiryType, payload.name!),
        text: emailText,
      },
    });
    return 'sent';
  }

  if (!apiKey || !from || recipients.length === 0) return 'failed';

  const results = await Promise.all(recipients.map(async (recipient) => ({
    recipient,
    ok: await sendEmail({
      apiKey,
      from,
      to: recipient,
      subject: inquiryEmailSubject(payload.type as InquiryType, payload.name!),
      text: emailText,
    }),
  })));

  const successes = results.filter((result) => result.ok);
  const failures = results.filter((result) => !result.ok);

  if (failures.length) {
    console.error('Some inquiry notification emails failed:', failures.map((failure) => failure.recipient));
  }

  if (successes.length === 0) return 'failed';
  return failures.length ? 'partial' : 'sent';
}

async function sendEmail({
  apiKey,
  from,
  to,
  subject,
  text,
}: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}) {
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
    }),
  });

  if (!response.ok) {
    console.error('Resend email failed:', await response.text());
    return false;
  }

  return true;
}

async function buildInternalEmail(payload: InquiryPayload, inquiryId: string) {
  const preferenceLines =
    (payload.type === 'custom_trip' || payload.type === 'route_private') && payload.customPreferences
      ? formatPreferencesForEmail(
          payload.customPreferences,
          await listCustomTripFormFields({ includeDisabled: true }),
        )
      : [];

  const lines = [
    `Inquiry ID: ${inquiryId}`,
    `Type: ${payload.type}`,
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Phone: ${payload.phone || 'Not provided'}`,
    `Travel month: ${payload.travelMonth || 'Not provided'}`,
    `Travelers: ${payload.travelers || 'Not provided'}`,
    `Trip length: ${payload.tripLength || 'Not provided'}`,
    `Destinations: ${[...(payload.destinations ?? []), payload.otherDestination].filter(Boolean).join(', ') || 'Not provided'}`,
    `Support preference: ${payload.supportPreference || 'Not provided'}`,
    `Hotel level: ${payload.hotelLevel || 'Not provided'}`,
    `Budget: ${payload.budget || 'Not provided'}`,
    `Requested tour: ${payload.requestedTour || 'Not provided'}`,
    `Requested destination: ${payload.requestedDestination || 'Not provided'}`,
    `Source path: ${payload.sourcePath || 'Not provided'}`,
  ];

  if (preferenceLines.length) {
    lines.push('', 'Custom preferences:');
    lines.push(...preferenceLines.map((line) => `- ${line}`));
  }

  lines.push('', 'Message:', payload.message || 'Not provided');

  return lines.join('\n');
}

function getClientIp(req: VercelRequestLike) {
  return (
    getHeader(req, 'x-forwarded-for')?.split(',')[0]?.trim() ||
    getHeader(req, 'x-real-ip') ||
    ''
  );
}

function getHeader(req: VercelRequestLike, name: string) {
  const value = req.headers[name] ?? req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
}

function parseRecipientList(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(isValidEmail);
}

function emptyToNull(value: string | undefined) {
  return value?.trim() || null;
}

function hashValue(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isLocalRuntime() {
  return process.env.NODE_ENV !== 'production';
}

function shouldUseMemoryStorage() {
  return isLocalRuntime() && process.env.INQUIRY_STORAGE_MODE === 'memory';
}

function shouldUseConsoleEmail() {
  return isLocalRuntime() && process.env.INQUIRY_EMAIL_MODE === 'console';
}
