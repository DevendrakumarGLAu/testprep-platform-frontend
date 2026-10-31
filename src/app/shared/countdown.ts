/** 93784 -> "1d 02:03:04", 3725 -> "1:02:05", 75 -> "01:15". Never negative. */
export function countdown(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d) return `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}`;
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
