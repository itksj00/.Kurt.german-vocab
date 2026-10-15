"use client";

import { useSyncExternalStore } from "react";
import { localDay, readReviewDone, writeReviewDone, type ReviewKind } from "@/lib/reviewGate";

const EVENT = "wortschatz-review-done-change";
const memory: Record<ReviewKind, string> = { words: "", patterns: "" }; // 저장소를 쓸 수 없을 때의 대체

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function isDone(kind: ReviewKind): boolean {
  try {
    return readReviewDone(window.localStorage, kind);
  } catch {
    return memory[kind] === localDay(); // 저장소에 접근할 수 없을 때만 메모리 값을 쓴다
  }
}

// 오늘 이 종류(단어/패턴)의 복습 회차를 마쳤는지
export function useReviewDone(kind: ReviewKind): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isDone(kind),
    () => false
  );
}

export function markReviewDone(kind: ReviewKind) {
  memory[kind] = localDay();
  try {
    writeReviewDone(window.localStorage, kind);
  } catch {
    // 무시
  }
  window.dispatchEvent(new Event(EVENT));
}
