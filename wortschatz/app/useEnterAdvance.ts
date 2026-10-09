"use client";

import { useEffect, useRef } from "react";
import { shouldIgnoreEnter } from "../lib/enterKey";

// 퀴즈 진행 화면에서 Enter를 누르면 onEnter(확인/다음 버튼과 같은 동작)를 실행한다.
// 입력 칸에 포커스가 없어도(문제 확인 후 입력 칸이 잠긴 경우 등) 동작한다.
export function useEnterAdvance(enabled: boolean, onEnter: () => void) {
  const latest = useRef(onEnter);
  useEffect(() => {
    latest.current = onEnter;
  });

  useEffect(() => {
    if (!enabled) return;
    function handler(e: KeyboardEvent) {
      if (shouldIgnoreEnter(e, e.target as HTMLElement | null)) return;
      e.preventDefault();
      latest.current();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}
