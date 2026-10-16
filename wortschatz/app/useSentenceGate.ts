"use client";

import { useSyncExternalStore } from "react";
import { readGate, writeGate } from "@/lib/sentenceGate";
import { localDay } from "@/lib/reviewGate";

const EVENT = "wortschatz-sentence-gate-change";
let memory = ""; // 저장소를 쓸 수 없을 때를 위한 대체 (열린 날짜, 현재 방문 동안만 유지)

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function snapshot(): boolean {
  try {
    return readGate(window.localStorage);
  } catch {
    return memory === localDay(); // 저장소에 접근할 수 없을 때만 메모리 값을 쓴다
  }
}

// 3단계(내 문장 만들기)를 마쳤는지. true면 1·2단계 복습을 시작할 수 있다.
export function useSentenceGate(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

export function setSentenceGate(open: boolean) {
  memory = open ? localDay() : "";
  try {
    writeGate(window.localStorage, open);
  } catch {
    // 무시
  }
  window.dispatchEvent(new Event(EVENT));
}
