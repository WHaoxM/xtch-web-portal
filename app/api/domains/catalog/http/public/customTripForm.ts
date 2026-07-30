import {
  buildDefaultPreferences,
  ensureCustomTripFormTables,
  listCustomTripFormFields,
  shouldUseMemoryFormStorage,
} from '../../customTripForm';

type VercelRequestLike = {
  method?: string;
};

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
};

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  try {
    if (!shouldUseMemoryFormStorage()) {
      await ensureCustomTripFormTables();
    }

    const fields = await listCustomTripFormFields({ includeDisabled: false });
    res.status(200).json({
      ok: true,
      fields,
      defaults: buildDefaultPreferences(fields),
    });
  } catch (error) {
    console.error('Custom trip form config failed:', error);
    res.status(500).json({ ok: false, error: 'Could not load custom trip form configuration.' });
  }
}
