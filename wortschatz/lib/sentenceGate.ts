// "복습 3단계(내 문장 만들기)를 먼저 마쳤는지" 표시를 저장소(localStorage)에 읽고 쓰는 로직.
// 3단계는 하루에 한 번, 그날 첫 복습 전에만 하면 된다. 마치면 그날은 계속 열려 있고, 날짜가 바뀌면 다시 3단계부터.
import { localDay } from "./reviewGate";

export const SENTENCE_GATE_KEY = "wortschatz-sentence-gate";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function readGate(storage: StorageLike | null | undefined, now = Date.now()): boolean {
  try {
    return storage?.getItem(SENTENCE_GATE_KEY) === localDay(now);
  } catch {
    return false;
  }
}

export function writeGate(storage: StorageLike | null | undefined, open: boolean, now = Date.now()): void {
  try {
    if (!storage) return;
    if (open) storage.setItem(SENTENCE_GATE_KEY, localDay(now));
    else storage.removeItem(SENTENCE_GATE_KEY);
  } catch {
    // 저장소를 쓸 수 없으면 무시 (대신 현재 방문 동안만 메모리에 유지)
  }
}
