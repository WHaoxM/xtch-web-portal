export type InquiryStatus = 'new' | 'in_progress' | 'closed';
export type InquiryType = 'quick_contact' | 'custom_trip' | 'route_private' | 'group_tour_inquiry';

export type AdminInquiryListItem = {
  id: string;
  type: string;
  status: string;
  name: string;
  email: string;
  requested_tour: string | null;
  requested_destination: string | null;
  source_path: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminInquiry = AdminInquiryListItem & {
  phone: string | null;
  travel_month: string | null;
  travelers: string | null;
  trip_length: string | null;
  budget: string | null;
  destinations: unknown;
  interests: unknown;
  hotel_level: string | null;
  travel_style: string | null;
  support_preference: string | null;
  message: string | null;
  user_agent: string | null;
  email_status: string;
  custom_preferences: unknown;
  internal_notes: string;
};

export type AdminInquiryListFilters = {
  status?: string;
  type?: string;
  search?: string;
  limit?: number;
};

async function parseJson(response: Response) {
  return response.json().catch(() => ({
    ok: false,
    error: 'Unexpected admin inquiries response.',
  })) as Promise<{
    ok: boolean;
    inquiries?: AdminInquiryListItem[];
    inquiry?: AdminInquiry;
    error?: string;
  }>;
}

export async function fetchAdminInquiries(
  token: string,
  filters: AdminInquiryListFilters = {},
): Promise<AdminInquiryListItem[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.type) params.set('type', filters.type);
  if (filters.search) params.set('search', filters.search);
  if (filters.limit) params.set('limit', String(filters.limit));

  const response = await fetch(`/api/admin/inquiries?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await parseJson(response);

  if (!response.ok || !result.ok || !Array.isArray(result.inquiries)) {
    throw new Error(result.error || '无法加载询盘列表。');
  }

  return result.inquiries;
}

export async function fetchAdminInquiry(token: string, id: string): Promise<AdminInquiry> {
  const response = await fetch(`/api/admin/inquiries?id=${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await parseJson(response);

  if (!response.ok || !result.ok || !result.inquiry) {
    throw new Error(result.error || '无法加载询盘详情。');
  }

  return result.inquiry;
}

export async function updateAdminInquiryStatus(
  token: string,
  id: string,
  status: InquiryStatus,
): Promise<AdminInquiry> {
  const response = await fetch(
    `/api/admin/inquiries?id=${encodeURIComponent(id)}&action=update-status`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status }),
    },
  );
  const result = await parseJson(response);

  if (!response.ok || !result.ok || !result.inquiry) {
    throw new Error(result.error || '无法更新询盘状态。');
  }

  return result.inquiry;
}

export async function updateAdminInquiryNotes(
  token: string,
  id: string,
  notes: string,
): Promise<AdminInquiry> {
  const response = await fetch(
    `/api/admin/inquiries?id=${encodeURIComponent(id)}&action=internal-notes`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ notes }),
    },
  );
  const result = await parseJson(response);

  if (!response.ok || !result.ok || !result.inquiry) {
    throw new Error(result.error || '无法保存内部备注。');
  }

  return result.inquiry;
}
