// 복습 카드 키보드 매핑: ← 몰라요, → 알아요, ↑/↓ 앞/뒷면 뒤집기, Z 되돌리기.

export type ReviewKeyEventLike = {
  key: string;
  repeat: boolean;
  isComposing: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  targetTag?: string; // 이벤트 대상 요소의 tagName (대문자)
};

export type ReviewKeyAction = "known" | "unknown" | "undo" | "flip" | null;

const TEXT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function reviewKeyAction(e: ReviewKeyEventLike): ReviewKeyAction {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return null;
  if (e.targetTag && TEXT_TAGS.has(e.targetTag)) return null;
  if (e.key === "ArrowRight") return "known";
  if (e.key === "ArrowLeft") return "unknown";
  if (e.key === "z" || e.key === "Z") return "undo";
  // 위/아래는 키를 꾹 눌러도 한 번만 뒤집는다
  if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !e.repeat) return "flip";
  return null;
}
