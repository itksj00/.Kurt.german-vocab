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

// 현지 시간 기준 내일 0시
export function startOfTomorrow(now = Date.now()): string {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
}

// 알아요/몰라요 모두 1일 단계로 시작하되, 오늘 추가한 단어의 첫 복습은 내일부터다.
// (날짜 선택·전체 범위 퀴즈로는 분류 직후부터 풀 수 있다)
export function sortPatch(result: SortResult, now = Date.now()) {
  return {
    sorted_at: new Date(now).toISOString(),
    sort_result: result,
    review_stage: 0,
    next_review_at: startOfTomorrow(now),
  };
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
