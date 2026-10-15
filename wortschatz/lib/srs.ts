// 에빙하우스 망각곡선 기반 고정 복습 주기 (일 단위).
// stage 0 = 막 외운 상태 → 1일 뒤 첫 복습, 이후 맞힐 때마다 한 단계씩 올라감.
export const REVIEW_INTERVALS_DAYS = [1, 2, 4, 7, 15, 30] as const;
const MAX_STAGE = REVIEW_INTERVALS_DAYS.length - 1;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isDue(nextReviewAt: string | null, now = Date.now()): boolean {
  return !nextReviewAt || new Date(nextReviewAt).getTime() <= now;
}

export type SrsUpdate = { review_stage: number; next_review_at: string };

// 복습 예정일보다 이 배수 이상 늦게 풀었으면(예: 1일 단계인데 3일 넘게 지남) 맞혀도 단계를 올리지 않는다.
export const OVERDUE_FACTOR = 2;

// 복습 결과에 따른 다음 단계/일정.
// - 틀림: 잊어버린 것으로 보고 처음(1일)으로 리셋
// - 맞힘: 한 단계 상승 (마지막 단계는 30일 간격 유지)
//   단, dueAt(원래 복습 예정일)을 주면 그 단계 간격의 OVERDUE_FACTOR배보다 더 밀린 경우 단계를 올리지 않고 유지한다.
export function nextSchedule(
  currentStage: number,
  correct: boolean,
  now = Date.now(),
  dueAt?: string | null
): SrsUpdate {
  const overdueMs = dueAt ? now - new Date(dueAt).getTime() : 0;
  const tooLate = overdueMs > OVERDUE_FACTOR * REVIEW_INTERVALS_DAYS[Math.min(currentStage, MAX_STAGE)] * DAY_MS;
  const stage = correct ? (tooLate ? Math.min(currentStage, MAX_STAGE) : Math.min(currentStage + 1, MAX_STAGE)) : 0;
  const days = REVIEW_INTERVALS_DAYS[stage];
  return {
    review_stage: stage,
    next_review_at: new Date(now + days * DAY_MS).toISOString(),
  };
}
