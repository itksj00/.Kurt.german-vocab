"use client";

import { useSyncExternalStore } from "react";
import { readGate, writeGate } from "@/lib/sentenceGate";

const EVENT = "wortschatz-sentence-gate-change";
let memory = false; // 저장소를 쓸 수 없을 때를 위한 대체 (현재 방문 동안만 유지)

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function snapshot(): boolean {
  let stored = false;
  try {
    stored = readGate(window.localStorage);
  } catch {
    stored = false;
  }
  return stored || memory;
}

// 3단계(내 문장 만들기)를 마쳤는지. true면 1·2단계 복습을 시작할 수 있다.
export function useSentenceGate(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

export function setSentenceGate(open: boolean) {
  memory = open;
  try {
    writeGate(window.localStorage, open);
  } catch {
    // 무시
  }
  window.dispatchEvent(new Event(EVENT));
}
