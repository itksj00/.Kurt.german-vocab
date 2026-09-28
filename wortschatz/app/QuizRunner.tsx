"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Difficulty, Word } from "@/lib/types";
import { isDue, nextSchedule } from "@/lib/srs";
import { withArticle } from "@/lib/wordDisplay";

type Scope = "due" | "all" | "recent" | "difficulty";
type Mode = "mc" | "type" | "flash";

const DIFFICULTIES: Difficulty[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const RECENT_COUNT = 20;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type Stage = "setup" | "playing" | "result";

type Answered = { word: Word; wrong: boolean };

type Props = {
  // 지정하면 출제 범위 선택을 숨기고 해당 범위로 고정한다 (복습 페이지용).
  lockedScope?: Scope;
  onStageChange?: (stage: Stage) => void;
};

export default function QuizRunner({ lockedScope, onStageChange }: Props) {
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);

  const [scope, setScope] = useState<Scope>(lockedScope ?? "due");
  const [difficulty, setDifficulty] = useState<Difficulty>("A1");
  const [mode, setMode] = useState<Mode>("mc");

  const [stage, setStage] = useState<Stage>("setup");
  const [reloadKey, setReloadKey] = useState(0);
  const [queue, setQueue] = useState<Word[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [answered, setAnswered] = useState<Answered[]>([]);

  // 객관식 상태
  const [mcOptions, setMcOptions] = useState<string[]>([]);
  const [mcSelected, setMcSelected] = useState<string | null>(null);

  // 뜻 입력 상태
  const [typeInput, setTypeInput] = useState("");
  const [typeChecked, setTypeChecked] = useState(false);
  const [typeCorrect, setTypeCorrect] = useState(false);

  // 플래시카드 상태
  const [flipped, setFlipped] = useState(false);

  const finalizedRef = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase
        .from("words")
        .select(
          "id, word, meaning, part_of_speech, pronunciation, difficulty, gender, plural, wrong_count, review_stage, next_review_at, last_studied_at, created_at"
        )
        .order("created_at", { ascending: false });
      if (!active) return;
      if (!error) setAllWords(data ?? []);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const scopedPool = useMemo(() => {
    if (scope === "due") return allWords.filter((w) => isDue(w.next_review_at));
    if (scope === "all") return allWords;
    if (scope === "recent") return allWords.slice(0, RECENT_COUNT);
    return allWords.filter((w) => w.difficulty === difficulty);
  }, [allWords, scope, difficulty]);

  function changeStage(next: Stage) {
    setStage(next);
    // 설정 화면으로 돌아오면 방금 갱신된 복습 일정을 다시 불러온다.
    if (next === "setup") setReloadKey((k) => k + 1);
    onStageChange?.(next);
  }

  function setupQuestion(word: Word, pool: Word[]) {
    if (mode === "mc") {
      const distractorPool = pool.filter(
        (w) => w.id !== word.id && w.meaning !== word.meaning
      );
      const distractors = shuffle(distractorPool)
        .slice(0, 3)
        .map((w) => w.meaning);
      const options = shuffle([word.meaning, ...distractors]);
      setMcOptions(options);
      setMcSelected(null);
    } else if (mode === "type") {
      setTypeInput("");
      setTypeChecked(false);
      setTypeCorrect(false);
    } else {
      setFlipped(false);
    }
  }

  function startQuiz() {
    const pool = scopedPool;
    if (pool.length === 0) return;
    const q = shuffle(pool);
    setQueue(q);
    setQIndex(0);
    setAnswered([]);
    finalizedRef.current = false;
    setupQuestion(q[0], allWords);
    changeStage("playing");
  }

  function goNext(current: Answered) {
    const nextAnswered = [...answered, current];
    setAnswered(nextAnswered);
    const nextIndex = qIndex + 1;
    if (nextIndex >= queue.length) {
      changeStage("result");
    } else {
      setQIndex(nextIndex);
      setupQuestion(queue[nextIndex], allWords);
    }
  }

  function handleMcSelect(opt: string) {
    if (mcSelected) return;
    setMcSelected(opt);
    const word = queue[qIndex];
    const wasWrong = opt !== word.meaning;
    setTimeout(() => goNext({ word, wrong: wasWrong }), 700);
  }

  function handleTypeCheck() {
    const word = queue[qIndex];
    const ok =
      typeInput.trim().toLowerCase() === word.meaning.trim().toLowerCase();
    setTypeChecked(true);
    setTypeCorrect(ok);
  }

  function handleTypeNext() {
    const word = queue[qIndex];
    goNext({ word, wrong: !typeCorrect });
  }

  function handleFlashGrade(knew: boolean) {
    const word = queue[qIndex];
    goNext({ word, wrong: !knew });
  }

  // 결과 화면 진입 시 wrong_count / last_studied_at / 복습 일정 반영 (1회만).
  useEffect(() => {
    if (stage !== "result" || finalizedRef.current) return;
    finalizedRef.current = true;

    async function finalize() {
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      await Promise.all(
        answered.map((a) => {
          const update: Record<string, unknown> = {
            last_studied_at: nowIso,
            wrong_count: a.wrong ? a.word.wrong_count + 1 : a.word.wrong_count,
          };
          if (a.wrong) {
            // 틀림 = 잊어버림 → 처음(1일)으로 리셋
            Object.assign(update, nextSchedule(a.word.review_stage, false, nowMs));
          } else if (isDue(a.word.next_review_at, nowMs)) {
            // 복습 시점에 맞힘 → 한 단계 상승 (연습으로 미리 푼 경우는 일정 유지)
            Object.assign(update, nextSchedule(a.word.review_stage, true, nowMs));
          }
          return supabase.from("words").update(update).eq("id", a.word.id);
        })
      );
    }
    finalize();
  }, [stage, answered]);

  if (loading) {
    return (
      <div>
        <p className="muted">불러오는 중... Lädt...</p>
      </div>
    );
  }

  if (stage === "setup") {
    return (
      <div>
        <div className="card">
          {!lockedScope && (
            <>
<div className="section-title">1. 출제 범위 Umfang</div>
          <div className="stepper">
            <div
              className={`step-opt ${scope === "due" ? "sel" : ""}`}
              onClick={() => setScope("due")}
            >
              복습 대상
              <small>Heute fällig</small>
            </div>
            <div
              className={`step-opt ${scope === "all" ? "sel" : ""}`}
              onClick={() => setScope("all")}
            >
              전체 단어
              <small>Alle Wörter</small>
            </div>
            <div
              className={`step-opt ${scope === "recent" ? "sel" : ""}`}
              onClick={() => setScope("recent")}
            >
              최근 추가
              <small>Zuletzt hinzugefügt</small>
            </div>
            <div
              className={`step-opt ${scope === "difficulty" ? "sel" : ""}`}
              onClick={() => setScope("difficulty")}
            >
              난이도별
              <small>Nach Niveau</small>
            </div>
          </div>
          {scope === "difficulty" && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label>난이도 Niveau</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

                      </>
          )}

          <div className="section-title">
            {lockedScope ? "1." : "2."} 방식 Modus
          </div>
          <div className="stepper">
            <div
              className={`step-opt ${mode === "mc" ? "sel" : ""}`}
              onClick={() => setMode("mc")}
            >
              객관식
              <small>Multiple Choice</small>
            </div>
            <div
              className={`step-opt ${mode === "type" ? "sel" : ""}`}
              onClick={() => setMode("type")}
            >
              뜻 입력
              <small>Bedeutung eingeben</small>
            </div>
            <div
              className={`step-opt ${mode === "flash" ? "sel" : ""}`}
              onClick={() => setMode("flash")}
            >
              플래시카드
              <small>Karteikarten</small>
            </div>
          </div>

          <p className="muted" style={{ marginBottom: 10 }}>
            대상 단어 {scopedPool.length}개
            {mode === "mc" && allWords.length < 4
              ? " (객관식은 오답 보기를 위해 전체 단어가 최소 4개 필요합니다)"
              : ""}
          </p>

          <button
            className="btn"
            onClick={startQuiz}
            disabled={
              scopedPool.length === 0 || (mode === "mc" && allWords.length < 4)
            }
          >
            퀴즈 시작 Quiz starten
          </button>
        </div>
      </div>
    );
  }

  if (stage === "playing") {
    const word = queue[qIndex];
    return (
      <div>
        <div className="card quiz-card">
          <div className="muted">
            {qIndex + 1} / {queue.length}
          </div>

          {mode === "mc" && (
            <>
              <div className="quiz-word">{withArticle(word)}</div>
              {mcOptions.map((opt) => {
                let cls = "opt-btn";
                if (mcSelected) {
                  if (opt === word.meaning) cls += " correct";
                  else if (opt === mcSelected) cls += " wrong";
                }
                return (
                  <button
                    key={opt}
                    className={cls}
                    onClick={() => handleMcSelect(opt)}
                    disabled={!!mcSelected}
                  >
                    {opt}
                  </button>
                );
              })}
            </>
          )}

          {mode === "type" && (
            <>
              <div className="quiz-word">{withArticle(word)}</div>
              <input
                value={typeInput}
                onChange={(e) => setTypeInput(e.target.value)}
                placeholder="뜻을 입력하세요"
                disabled={typeChecked}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !typeChecked) handleTypeCheck();
                }}
              />
              {typeChecked && (
                <p
                  className="muted"
                  style={{
                    marginTop: 10,
                    color: typeCorrect ? "var(--accent)" : "var(--danger)",
                  }}
                >
                  {typeCorrect ? "정답!" : `오답 — 정답: ${word.meaning}`}
                </p>
              )}
              <div style={{ marginTop: 14 }}>
                {!typeChecked ? (
                  <button className="btn" onClick={handleTypeCheck}>
                    확인 Prüfen
                  </button>
                ) : (
                  <button className="btn" onClick={handleTypeNext}>
                    다음 Weiter
                  </button>
                )}
              </div>
            </>
          )}

          {mode === "flash" && (
            <>
              <div
                className="flash-card"
                onClick={() => setFlipped((f) => !f)}
              >
                {!flipped ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <span>{withArticle(word)}</span>
                  </div>
                ) : (
                  word.meaning
                )}
              </div>
              <p className="muted" style={{ marginTop: 8 }}>
                카드를 눌러 뒤집어보세요 Zum Umdrehen tippen
              </p>
              {flipped && (
                <div className="row" style={{ marginTop: 14 }}>
                  <button
                    className="btn danger"
                    onClick={() => handleFlashGrade(false)}
                  >
                    몰랐어요 Wusste ich nicht
                  </button>
                  <button className="btn" onClick={() => handleFlashGrade(true)}>
                    알았어요 Wusste ich
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // result
  const total = answered.length;
  const wrongCount = answered.filter((a) => a.wrong).length;
  const correctCount = total - wrongCount;
  const rate = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  return (
    <div>
      <div className="card">
        <div className="section-title">결과 Ergebnis</div>
        <p className="muted">
          정답률 {rate}% ({total}문항 중 {correctCount}개 정답)
        </p>
        <div className="result-bar">
          <div className="result-fill" style={{ width: `${rate}%` }} />
        </div>
        {wrongCount > 0 ? (
          <p className="muted" style={{ marginTop: 8 }}>
            틀린 {wrongCount}개 단어는 1일 단계로 돌아가 내일 다시 복습됩니다
            {!lockedScope && (
              <>
                {" "}·{" "}
                <Link href="/review" style={{ color: "var(--accent)" }}>
                  복습 일정 보기 Zum Zeitplan
                </Link>
              </>
            )}
          </p>
        ) : (
          <p className="muted" style={{ marginTop: 8 }}>
            전부 맞혔습니다 🎉
          </p>
        )}
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => changeStage("setup")}>
            다시 설정하기 Neu einstellen
          </button>
        </div>
      </div>
    </div>
  );
}
