"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "wortschatz-theme";

// localStorage/matchMedia처럼 리액트 바깥에 있는 값을 안전하게 구독하기 위한
// 아주 작은 pub-sub. 같은 탭에서 값을 바꿔도 리렌더가 트리거되도록 직접 알려준다.
type Listener = () => void;
let listeners: Listener[] = [];
function notify() {
  listeners.forEach((l) => l());
}
function subscribe(cb: Listener) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function getSnapshot(): boolean {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "dark") return true;
  if (saved === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export default function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = isDark ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.setAttribute("data-theme", next);
    notify();
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label="다크모드 전환 Dunkelmodus umschalten"
      title="다크모드 전환 Dunkelmodus umschalten"
    >
      {isDark ? "\u2600\uFE0E" : "\u263E"}
    </button>
  );
}
