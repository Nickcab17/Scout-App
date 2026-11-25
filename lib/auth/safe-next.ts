/** Accept only same-origin path references for post-authentication redirects. */
export function safeNextPath(value: string | null, origin: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return "/";

  // Browsers and URL parsers can treat encoded or repeatedly encoded backslashes
  // as path separators. Reject those forms before resolving the destination.
  let decoded = value;
  for (let index = 0; index < 8; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return "/";
    }
  }
  if (/[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.startsWith("//")) return "/";

  try {
    const base = new URL(origin);
    const target = new URL(value, base);
    if (target.origin !== base.origin || target.username || target.password) return "/";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}
