export type InquiryField = {
  label: string;
  value?: string | string[];
};

export function buildMailtoHref({
  to,
  subject,
  fields,
}: {
  to: string;
  subject: string;
  fields: InquiryField[];
}) {
  const body = fields
    .map(({ label, value }) => {
      const normalized = Array.isArray(value) ? value.filter(Boolean).join(', ') : value;
      return `${label}: ${normalized?.trim() || 'Not provided'}`;
    })
    .join('\n');

  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
