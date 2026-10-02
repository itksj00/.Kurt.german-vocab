// 새 단어 분류(알아요/몰라요) 로직 — 순수 함수

export type SortResult = "known" | "unknown";

export const SWIPE_THRESHOLD = 90; // px. 이 이상 밀면 분류 확정
const DAY_MS = 24 * 60 * 60 * 1000;

// 오른쪽 = 알아요, 왼쪽 = 몰라요, 그 사이 = 아직 확정 아님
export function swipeDecision(dx: number, threshold = SWIPE_THRESHOLD): SortResult | null {
  if (dx >= threshold) return "known";
  if (dx <= -threshold) return "unknown";
  return null;
}

// 알아요/몰라요 모두 오늘부터 퀴즈·복습 대상(1단계)으로 시작한다.
export function sortPatch(result: SortResult, now = Date.now()) {
  const iso = new Date(now).toISOString();
  return { sorted_at: iso, sort_result: result, review_stage: 0, next_review_at: iso };
}

// 되돌리기: 다시 분류 대기 상태로
export function undoPatch(now = Date.now()) {
  return {
    sorted_at: null,
    sort_result: null,
    review_stage: 0,
    next_review_at: new Date(now + DAY_MS).toISOString(),
  };
}

export function isPending(w: { sorted_at: string | null }): boolean {
  return w.sorted_at === null;
}
