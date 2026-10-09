// 퀴즈에서 Enter = 화면의 주 버튼(확인 → 다음 → 결과 보기)을 누른 것처럼 동작시키기 위한 판정 로직.

export type EnterEventLike = {
  key: string;
  repeat: boolean;
  isComposing: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
};

export type EnterTargetLike = {
  tagName?: string;
  disabled?: boolean;
} | null;

// true면 이 Enter는 퀴즈가 처리하지 않고 브라우저 기본 동작에 맡긴다.
export function shouldIgnoreEnter(e: EnterEventLike, target: EnterTargetLike): boolean {
  if (e.key !== "Enter") return true;
  if (e.repeat) return true; // 길게 눌러 문제가 연달아 넘어가는 것 방지
  if (e.isComposing) return true; // 한글 등 조합 입력 확정용 Enter
  if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return true; // Shift+Enter는 줄바꿈 등 기본 동작 유지
  const tag = (target?.tagName ?? "").toUpperCase();
  if (tag === "A" || tag === "SELECT" || tag === "SUMMARY") return true;
  // 포커스된 버튼(확인/다음, 보기, 조각, 메뉴, 테마 토글 등)은 브라우저가 직접 누르게 둔다.
  // 단, 눌러서 비활성화된 버튼에 남은 포커스는 body와 같게 본다.
  if (tag === "BUTTON") return !target?.disabled;
  return false;
}
