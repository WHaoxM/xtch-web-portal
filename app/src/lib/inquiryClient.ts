export type InquiryType = 'quick_contact' | 'custom_trip' | 'route_private';

export type InquirySubmission = {
  type: InquiryType;
  name: string;
  email: string;
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
  customPreferences?: Record<string, unknown>;
  turnstileToken: string;
  honeypot?: string;
};

export type InquiryResponse = {
  ok: boolean;
  inquiryId?: string;
  error?: string;
};

export async function submitInquiry(payload: InquirySubmission) {
  const response = await fetch('/api/inquiries', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'Unexpected server response.',
  }))) as InquiryResponse;

  if (!response.ok || !result.ok) {
    throw new Error(result.error || 'We could not submit your inquiry. Please try again.');
  }

  return result;
}
