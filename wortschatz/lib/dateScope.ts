// 퀴즈 출제 범위 "날짜 선택": 추가한 날짜(브라우저 현지 날짜 기준)별로 묶기·거르기 — 순수 함수

// "2026-10-09T15:30:00Z" → 현지 시간대의 "YYYY-MM-DD". 해석할 수 없으면 빈 문자열.
export function localDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// 날짜별 개수. 최신 날짜가 먼저 온다.
export function groupByDate<T extends { created_at: string }>(items: T[]): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    const k = localDateKey(it.created_at);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// 해당 날짜에 추가한 항목만. date가 비어 있으면 빈 목록.
export function filterByDate<T extends { created_at: string }>(items: T[], date: string): T[] {
  if (!date) return [];
  return items.filter((it) => localDateKey(it.created_at) === date);
}
