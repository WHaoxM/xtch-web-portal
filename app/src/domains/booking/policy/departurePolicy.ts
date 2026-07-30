export function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

export function formatCancellationPolicy(value: unknown): string[] {
  if (!value) return [];

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  if (Array.isArray(value)) {
    return asStringList(value);
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const lines: string[] = [];

    if (typeof record.full_refund_until === 'string') {
      lines.push(`Full refund until ${record.full_refund_until}.`);
    }
    if (typeof record.partial_refund_until === 'string') {
      lines.push(`Partial refund until ${record.partial_refund_until}.`);
    }
    if (typeof record.non_refundable_after === 'string') {
      lines.push(`Non-refundable after ${record.non_refundable_after}.`);
    }
    if (typeof record.summary === 'string' && record.summary.trim()) {
      lines.push(record.summary.trim());
    }
    if (typeof record.text === 'string' && record.text.trim()) {
      lines.push(record.text.trim());
    }

    return lines;
  }

  return [];
}
