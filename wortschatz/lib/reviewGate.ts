// 복습 대상(오늘 복습할 차례가 된, 분류를 마친 항목)을 세는 로직 — 순수 함수.
// 복습 대상이 남아 있으면 다른 퀴즈를 시작할 수 없다.
import { isDue } from "./srs";

export function countDue<T extends { sorted_at: string | null; next_review_at: string | null }>(
  items: T[],
  now = Date.now()
): number {
  return items.filter((x) => x.sorted_at !== null && isDue(x.next_review_at, now)).length;
}

// "단어 3개 · 패턴 2개" 형태. 0개인 쪽은 생략한다.
export function dueSummary(words: number, patterns: number): string {
  const parts: string[] = [];
  if (words > 0) parts.push(`단어 ${words}개`);
  if (patterns > 0) parts.push(`패턴 ${patterns}개`);
  return parts.join(" · ");
}
