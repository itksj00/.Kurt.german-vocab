// 복습 1단계(카드를 좌우로 넘겨 알아요/몰라요만 표시) 진행 상태 — 순수 함수
//
// - 첫 라운드에서 몰라요로 넘긴 카드가 복습 일정에 반영되는 결과(틀림)다.
// - 몰라요로 넘긴 카드는 라운드가 끝나면 다시 나오고, 모두 알아요가 될 때까지 반복한다.
//   (두 번째 라운드부터는 연습이라 결과에 영향이 없다)

export type SwipeState = {
  queue: number[]; // 이번 라운드에 남은 카드 id (맨 앞이 현재 카드)
  retry: number[]; // 이번 라운드에서 몰라요로 넘겨 다음 라운드에 다시 볼 카드
  firstWrong: number[]; // 첫 라운드에서 몰라요로 넘긴 카드
  total: number;
  round: number; // 1부터
};

export function initSwipe(ids: number[]): SwipeState {
  return { queue: [...ids], retry: [], firstWrong: [], total: ids.length, round: 1 };
}

export function currentId(s: SwipeState): number | null {
  return s.queue.length > 0 ? s.queue[0] : null;
}

export function isFinished(s: SwipeState): boolean {
  return s.queue.length === 0 && s.retry.length === 0;
}

// 현재 카드를 알아요(known=true)/몰라요(false)로 넘긴 다음 상태. shuffle은 다음 라운드 순서를 섞는 함수.
export function swipeCard(s: SwipeState, known: boolean, shuffle: (ids: number[]) => number[]): SwipeState {
  if (s.queue.length === 0) return s;
  const id = s.queue[0];
  let queue = s.queue.slice(1);
  let retry = known ? s.retry : [...s.retry, id];
  const firstWrong = !known && s.round === 1 ? [...s.firstWrong, id] : s.firstWrong;
  let round = s.round;
  if (queue.length === 0 && retry.length > 0) {
    queue = shuffle(retry);
    retry = [];
    round += 1;
  }
  return { queue, retry, firstWrong, total: s.total, round };
}
