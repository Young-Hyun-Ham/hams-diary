// src/lib/utils/date.ts
export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// "YYYY-MM" → { start: "YYYY-MM-01", end: "YYYY-MM+1-01" }
export function monthRange(ym: string) {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error("monthRange: invalid YYYY-MM");

  const y = Number(m[1]);
  const mo = Number(m[2]); // 1~12

  const start = `${y}-${pad2(mo)}-01`;

  // next month
  let ny = y, nmo = mo + 1;
  if (nmo === 13) { ny = y + 1; nmo = 1; }
  const end = `${ny}-${pad2(nmo)}-01`;

  return { start, end };
}
