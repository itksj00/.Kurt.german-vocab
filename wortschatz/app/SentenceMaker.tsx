"use client";

import { useRef, useState } from "react";
import type { Word } from "@/lib/types";
import { posLabel, withArticle } from "@/lib/wordDisplay";
import { checkOwnSentence, MIN_SENTENCE_WORDS } from "@/lib/sentenceCheck";
import type { ExampleMap } from "@/lib/quizGen";
import { useEnterAdvance } from "./useEnterAdvance";

// 복습 3단계: 복습 대상 단어(무작위 5개) 각각으로 나만의 문장을 만든다. 저장하지 않으며, 만들어야 다음으로 넘어갈 수 있다.
export default function SentenceMaker({
  words,
  examples,
  onComplete,
  onDone,
}: {
  words: Word[];
  examples: ExampleMap;
  onComplete: () => void; // 마지막 문장을 만든 순간 (복습이 열리는 시점)
  onDone: () => void; // 요약 화면에서 돌아갈 때
}) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [canOverride, setCanOverride] = useState(false);
  const [mine, setMine] = useState<{ word: Word; sentence: string }[]>([]);
  const [finished, setFinished] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const w = words[idx];

  function submit(force = false) {
    if (!w) return;
    const r = checkOwnSentence(w, text);
    if (r.reason === "short") {
      setError(`${MIN_SENTENCE_WORDS}단어 이상으로 문장을 만들어 주세요. Mindestens ${MIN_SENTENCE_WORDS} Wörter.`);
      return;
    }
    if (r.reason === "missing" && !force) {
      setError(`문장에 "${w.word}"(또는 그 변화형)이 들어가야 해요. Das Wort muss im Satz vorkommen.`);
      setCanOverride(true);
      return;
    }
    const next = [...mine, { word: w, sentence: text.trim() }];
    setMine(next);
    setText("");
    setError(null);
    setCanOverride(false);
    if (idx + 1 >= words.length) {
      setFinished(true);
      onComplete();
    } else setIdx(idx + 1);
  }

  function insertChar(ch: string) {
    const el = areaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? start;
    setText(text.slice(0, start) + ch + text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + 1, start + 1);
    });
  }

  // Enter = 화면의 주 버튼 (확인 / 복습 열기). Shift+Enter는 줄바꿈.
  useEnterAdvance(true, () => (finished ? onDone() : submit()));

  if (finished) {
    return (
      <div className="card">
        <div className="section-title">복습 3단계 완료 Fertig</div>
        <p className="muted" style={{ marginBottom: 10 }}>
          내가 만든 문장이에요. 저장되지는 않습니다. 이제 1단계·2단계 복습을 할 수 있어요.
        </p>
        {mine.map((m, i) => (
          <div key={i} style={{ marginBottom: 10, overflowWrap: "anywhere" }}>
            <div className="muted" style={{ fontSize: "0.85em" }}>
              {withArticle(m.word)} · {m.word.meaning}
            </div>
            <div>{m.sentence}</div>
          </div>
        ))}
        <button className="btn" onClick={onDone}>
          복습으로 Weiter
        </button>
      </div>
    );
  }

  if (!w) return null;
  const exs = (examples[w.id] ?? []).slice(0, 3);

  return (
    <div className="card">
      <div className="section-title">복습 3단계 문장 만들기 Eigene Sätze</div>
      <p className="muted" style={{ marginBottom: 8 }}>
        {idx + 1} / {words.length} · 단어를 넣어 나만의 문장을 만드세요. 저장되지는 않지만, 만들어야 다음으로 넘어갈 수 있어요.
      </p>

      <div className="quiz-card" style={{ marginBottom: 10 }}>
        <div className="muted" style={{ fontSize: "0.8rem" }}>
          {w.part_of_speech ? posLabel(w.part_of_speech) : ""}
        </div>
        <div className="quiz-word">{withArticle(w)}</div>
        <div>{w.meaning}</div>
        {w.mnemonic && (
          <div className="muted" style={{ fontSize: "0.85rem", marginTop: 4 }}>
            💡 {w.mnemonic}
          </div>
        )}
        {exs.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="muted" style={{ fontSize: "0.8rem" }}>
              예문 참고 Beispiele
            </div>
            {exs.map((e, i) => (
              <div key={i} style={{ marginTop: 4, overflowWrap: "anywhere" }}>
                {e.sentence}
                {e.translation && (
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    {e.translation}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <textarea
        ref={areaRef}
        rows={3}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        placeholder="나만의 문장 Dein Satz"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <div className="row" style={{ gap: 6, marginTop: 6 }}>
        {["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"].map((ch) => (
          <button key={ch} type="button" className="btn ghost small" onMouseDown={(e) => e.preventDefault()} onClick={() => insertChar(ch)}>
            {ch}
          </button>
        ))}
      </div>

      {error && <p style={{ marginTop: 8, color: "var(--danger)" }}>{error}</p>}

      <div className="row" style={{ marginTop: 10, gap: 8 }}>
        <button className="btn" onClick={() => submit()}>
          확인 Prüfen
        </button>
        {canOverride && (
          <button className="btn ghost" onClick={() => submit(true)}>
            변화형이라 인식이 안 돼요 Trotzdem abgeben
          </button>
        )}
      </div>
    </div>
  );
}
