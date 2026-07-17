export type MediaAssetType = 'image' | 'video';
export type MediaAssetStatus = 'review' | 'published' | 'rejected' | 'archived';

export type MediaAsset = {
  id: string;
  status: MediaAssetStatus;
  type: MediaAssetType;
  publicUrl: string;
  title: string;
  altText: string;
  destinationSlugs: string[];
  routeSlugs: string[];
  tags: string[];
};

export async function fetchAdminMedia(
  token: string,
  options?: {
    status?: string;
    search?: string;
    routeSlug?: string;
    destinationSlug?: string;
  },
): Promise<MediaAsset[]> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.search) params.set('search', options.search);
  if (options?.routeSlug) params.set('routeSlug', options.routeSlug);
  if (options?.destinationSlug) params.set('destinationSlug', options.destinationSlug);
  const qs = params.toString();
  const response = await fetch(`/api/admin/media${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'Unexpected admin media response.',
  }))) as { ok: boolean; media?: MediaAsset[]; error?: string };

  if (!response.ok || !result.ok || !Array.isArray(result.media)) {
    throw new Error(result.error || 'We could not load media assets.');
  }

  return result.media;
}

export async function postAdminMedia(
  token: string,
  body: Record<string, unknown>,
): Promise<{ media: MediaAsset[] }> {
  const response = await fetch('/api/admin/media', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'Unexpected admin media response.',
  }))) as { ok: boolean; media?: MediaAsset[]; error?: string };

  if (!response.ok || !result.ok) {
    throw new Error(result.error || 'Admin request failed.');
  }

  return { media: result.media ?? [] };
}

export type PresignedUpload = {
  objectKey: string;
  uploadUrl: string;
  publicUrl: string;
  contentType: string;
};

export async function presignMediaUpload(
  token: string,
  input: { filename: string; contentType: string },
): Promise<PresignedUpload> {
  const response = await fetch('/api/admin/media-presign', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'Unexpected presign response.',
  }))) as PresignedUpload & { ok: boolean; error?: string };

  if (!response.ok || !result.ok || !result.uploadUrl || !result.publicUrl) {
    throw new Error(result.error || 'We could not prepare the upload.');
  }

  return {
    objectKey: result.objectKey,
    uploadUrl: result.uploadUrl,
    publicUrl: result.publicUrl,
    contentType: result.contentType,
  };
}

export async function uploadFileToPresignedUrl(uploadUrl: string, file: File, contentType: string): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload failed (${response.status}).`);
  }
}
