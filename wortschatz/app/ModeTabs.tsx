"use client";

export type Mode = "word" | "pattern";

// 단어 / 패턴 전환 탭 (퀴즈, 복습 화면 공용)
export default function ModeTabs({
  mode,
  onChange,
  quiz = false,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
  quiz?: boolean;
}) {
  return (
    <div className="stepper" style={{ marginBottom: 12 }}>
      <div
        className={`step-opt ${mode === "word" ? "sel" : ""}`}
        onClick={() => onChange("word")}
      >
        {quiz ? "단어 퀴즈" : "단어"}
        <small>{quiz ? "Wort-Quiz" : "Wörter"}</small>
      </div>
      <div
        className={`step-opt ${mode === "pattern" ? "sel" : ""}`}
        onClick={() => onChange("pattern")}
      >
        {quiz ? "패턴 퀴즈" : "패턴"}
        <small>{quiz ? "Muster-Quiz" : "Muster"}</small>
      </div>
    </div>
  );
}
