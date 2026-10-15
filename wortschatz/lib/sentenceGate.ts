// "복습 3단계(내 문장 만들기)를 먼저 마쳤는지" 표시를 저장소(localStorage)에 읽고 쓰는 로직.
// 3단계를 마치면 열리고(1·2단계 복습 가능), 1·2단계 복습을 마치면 다시 잠긴다.

export const SENTENCE_GATE_KEY = "wortschatz-sentence-gate";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function readGate(storage: StorageLike | null | undefined): boolean {
  try {
    return storage?.getItem(SENTENCE_GATE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeGate(storage: StorageLike | null | undefined, open: boolean): void {
  try {
    if (!storage) return;
    if (open) storage.setItem(SENTENCE_GATE_KEY, "1");
    else storage.removeItem(SENTENCE_GATE_KEY);
  } catch {
    // 저장소를 쓸 수 없으면 무시 (대신 현재 방문 동안만 메모리에 유지)
  }
}
