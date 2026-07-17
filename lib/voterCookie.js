export function getVoterCookie() {
  const match = document.cookie.match(/(?:^|; )omtb_voter=([^;]+)/);
  if (match) return match[1];

  const id =
    crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `omtb_voter=${id}; path=/; max-age=${oneYear}; samesite=lax`;
  return id;
}
