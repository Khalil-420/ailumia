export function parseFrom(raw) {
  if (!raw) return { name: '', addr: '' };
  const match = raw.match(/^"?([^"<]*)"?\s*<([^>]+)>/);
  if (match) {
    return { name: match[1].trim() || match[2].trim(), addr: match[2].trim() };
  }
  const emailMatch = raw.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) return { name: emailMatch[0], addr: emailMatch[0] };
  return { name: raw.trim(), addr: '' };
}
