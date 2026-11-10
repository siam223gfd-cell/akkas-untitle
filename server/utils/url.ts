export function isValidDestinationUrl(raw?: unknown): boolean {
  if (raw === undefined || raw === null || raw === '') return true;
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (/^\/(?!\/)/.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidImageUrl(raw?: unknown): boolean {
  if (raw === undefined || raw === null || raw === '') return true;
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (/^\/(?!\/)/.test(trimmed)) return true;
  if (/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseOptionalDate(val: unknown): { date: Date | null; invalid: boolean } {
  if (val === undefined || val === null || val === '') {
    return { date: null, invalid: false };
  }
  const d = new Date(String(val));
  if (Number.isNaN(d.getTime())) {
    return { date: null, invalid: true };
  }
  return { date: d, invalid: false };
}
