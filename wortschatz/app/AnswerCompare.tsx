import { diffSentences } from "../lib/memo";

// 틀렸을 때 "내가 쓴 문장 / 정답 문장"을 줄바꿈으로 전부 보여 준다.
// 내가 쓴 쪽은 틀리거나 남은 단어를 빨갛게, 정답 쪽은 빠뜨리거나 틀리게 쓴 단어를 강조한다.
export default function AnswerCompare({ given, answer }: { given: string; answer: string }) {
  const d = diffSentences(answer, given);
  const isSentence = answer.trim().split(/\s+/).length >= 3;
  const mineLabel = isSentence ? "내가 쓴 문장 Deine Eingabe" : "내가 쓴 답 Deine Eingabe";
  const answerLabel = isSentence ? "정답 문장 Lösung" : "정답 Lösung";
  const box = { marginTop: 8, lineHeight: 1.7, overflowWrap: "anywhere" as const, whiteSpace: "pre-wrap" as const };
  return (
    <div style={{ marginTop: 6 }}>
      <div style={box}>
        <div className="muted" style={{ fontSize: "0.85em" }}>
          {mineLabel}
        </div>
        {given.trim() === "" ? (
          <span className="muted">(입력 없음 keine Eingabe)</span>
        ) : (
          d.given.map((w, i) => (
            <span key={i} style={w.ok ? undefined : { color: "var(--danger)", fontWeight: 700 }}>
              {w.word}{" "}
            </span>
          ))
        )}
      </div>
      <div style={box}>
        <div className="muted" style={{ fontSize: "0.85em" }}>
          {answerLabel}
        </div>
        {d.answer.map((w, i) => (
          <span key={i} style={w.ok ? undefined : { color: "var(--accent)", fontWeight: 700 }}>
            {w.word}{" "}
          </span>
        ))}
      </div>
    </div>
  );
}
