"use client";

export type Mode = "word" | "pattern";

// 단어 / 패턴 전환 탭 (퀴즈, 복습 화면 공용)
export default function ModeTabs({
  mode,
  onChange,
  quiz = false,
  counts,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
  quiz?: boolean;
  counts?: { word: number; pattern: number }; // 배지로 표시할 개수 (0이면 숨김)
}) {
  return (
    <div className="stepper" style={{ marginBottom: 12 }}>
      <div
        className={`step-opt ${mode === "word" ? "sel" : ""}`}
        onClick={() => onChange("word")}
      >
        {quiz ? "단어 퀴즈" : "단어"}
        {counts && counts.word > 0 && <span className="nav-badge">{counts.word}</span>}
        <small>{quiz ? "Wort-Quiz" : "Wörter"}</small>
      </div>
      <div
        className={`step-opt ${mode === "pattern" ? "sel" : ""}`}
        onClick={() => onChange("pattern")}
      >
        {quiz ? "패턴 퀴즈" : "패턴"}
        {counts && counts.pattern > 0 && <span className="nav-badge">{counts.pattern}</span>}
        <small>{quiz ? "Muster-Quiz" : "Muster"}</small>
      </div>
    </div>
  );
}
