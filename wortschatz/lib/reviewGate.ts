// 복습 대상(오늘 복습할 차례가 된, 분류를 마친 항목)을 세는 로직 — 순수 함수.
// 복습 대상이 남아 있으면 다른 퀴즈를 시작할 수 없다.
import { isDue } from "./srs";
import type { StorageLike } from "./sentenceGate";

// 한 회차에 복습하는 최대 개수. 가장 오래 밀린 것부터 이 개수만큼 먼저 한다.
export const REVIEW_BATCH_SIZE = 30;

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

// 복습 대상 중 가장 오래 밀린 것부터 limit개 (일정이 없는 항목이 가장 먼저)
export function pickReviewBatch<T extends { sorted_at: string | null; next_review_at: string | null }>(
  items: T[],
  limit = REVIEW_BATCH_SIZE,
  now = Date.now()
): T[] {
  const ts = (x: T) => (x.next_review_at ? new Date(x.next_review_at).getTime() : -Infinity);
  return items
    .filter((x) => x.sorted_at !== null && isDue(x.next_review_at, now))
    .sort((a, b) => ts(a) - ts(b))
    .slice(0, limit);
}

// ── "오늘 복습 회차를 마쳤는지" 표시 (단어/패턴 따로, 현지 날짜 기준) ──
// 복습 대상이 한 회차 분량보다 많이 남아 있어도, 오늘 회차를 마쳤으면 다른 퀴즈를 막지 않는다.
export type ReviewKind = "words" | "patterns";
const doneKey = (kind: ReviewKind) => `wortschatz-review-done-${kind}`;

export function localDay(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function readReviewDone(storage: StorageLike | null | undefined, kind: ReviewKind, now = Date.now()): boolean {
  try {
    return storage?.getItem(doneKey(kind)) === localDay(now);
  } catch {
    return false;
  }
}

export function writeReviewDone(storage: StorageLike | null | undefined, kind: ReviewKind, now = Date.now()): void {
  try {
    storage?.setItem(doneKey(kind), localDay(now));
  } catch {
    // 저장소를 쓸 수 없으면 무시
  }
}
