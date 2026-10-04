"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Difficulty, Pattern, Word } from "@/lib/types";
import { isDue, nextSchedule } from "@/lib/srs";
import {
  buildQuestion,
  hasExamples,
  isCorrect,
  shuffle,
  type ExampleMap,
  type Question,
} from "@/lib/quizGen";
import { withArticle } from "@/lib/wordDisplay";
import { buildPatternQuestion } from "@/lib/patternQuiz";
import { patternText } from "@/lib/patterns";

type Scope = "due" | "all" | "recent" | "difficulty";

const UMLAUTS = ["ä", "ö", "ü", "ß"];

const DIFFICULTIES: Difficulty[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const RECENT_COUNT = 20;

export type Stage = "setup" | "playing" | "result";

// 퀴즈 대상: 단어 또는 패턴 (SRS 필드는 공통)
type Item = Word | Pattern;
type Answered = { word: Item; wrong: boolean };

const WORD_COLS: string =
  "id, word, meaning, part_of_speech, pronunciation, difficulty, gender, plural, perfekt_aux, partizip2, wrong_count, review_stage, next_review_at, last_studied_at, created_at, sorted_at, sort_result";
const PATTERN_COLS: string =
  "id, verb, reflexive, preposition, pattern_case, meaning, wrong_count, review_stage, next_review_at, last_studied_at, created_at";

function itemLabel(i: Item): string {
  return "verb" in i ? patternText(i) : withArticle(i);
}

type Props = {
  // 출제 대상: 단어(기본) 또는 패턴
  mode?: "word" | "pattern";
  // 지정하면 출제 범위 선택을 숨기고 해당 범위로 고정한다 (복습 페이지용).
  lockedScope?: Scope;
  onStageChange?: (stage: Stage) => void;
};

export default function QuizRunner({ lockedScope, onStageChange, mode = "word" }: Props) {
  const isPattern = mode === "pattern";
  const table = isPattern ? "patterns" : "words";
  const noun = isPattern ? "패턴" : "단어";
  const [allWords, setAllWords] = useState<Item[]>([]);
  const [examplesByWord, setExamplesByWord] = useState<ExampleMap>({});
  const [loading, setLoading] = useState(true);

  const [scope, setScope] = useState<Scope>(lockedScope ?? "due");
  const [difficulty, setDifficulty] = useState<Difficulty>("A1");

  const [stage, setStage] = useState<Stage>("setup");
  const [reloadKey, setReloadKey] = useState(0);
  const [queue, setQueue] = useState<Item[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [answered, setAnswered] = useState<Answered[]>([]);
  // 틀린 문제 다시 풀기(연습) 라운드 여부 — 복습 일정/통계에는 반영하지 않는다.
  const [retry, setRetry] = useState(false);

  // 현재 문제와 응답 상태 (유형 공통)
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<string | null>(null); // choice
  const [typeInput, setTypeInput] = useState(""); // input
  const [placed, setPlaced] = useState<number[]>([]); // reorder: tokens 인덱스
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const finalizedRef = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const fk = isPattern ? "pattern_id" : "word_id";
      const { data, error } = await supabase
<<<<<<< HEAD
        .from(table)
        .select(isPattern ? PATTERN_COLS : WORD_COLS)
=======
        .from("words")
        .select(
          "id, word, meaning, part_of_speech, pronunciation, difficulty, gender, plural, perfekt_aux, partizip2, wrong_count, review_stage, next_review_at, last_studied_at, created_at, sorted_at, sort_result"
        )
>>>>>>> a1364d085e51867aea4ab029f08b4c968ab9650e
        .order("created_at", { ascending: false });
      if (!active) return;
      const { data: exData } = await supabase
        .from(isPattern ? "pattern_examples" : "examples")
        .select(`${fk}, sentence, translation`);
      if (!active) return;
      if (!error) setAllWords((data ?? []) as unknown as Item[]);
      const map: ExampleMap = {};
      ((exData ?? []) as unknown as Record<string, unknown>[]).forEach((e) => {
        (map[e[fk] as number] ??= []).push({
          sentence: e.sentence as string,
          translation: (e.translation as string | null) ?? null,
        });
      });
      setExamplesByWord(map);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [reloadKey, isPattern, table]);

  // 분류(알아요/몰라요)를 마치지 않은 새 단어는 퀴즈에서 제외하고, 하나라도 남아 있으면 시작할 수 없다. (패턴은 분류 없음)
  const pendingCount = useMemo(
    () => (isPattern ? 0 : allWords.filter((w) => (w as Word).sorted_at === null).length),
    [allWords, isPattern]
  );

  // 분류(알아요/몰라요)를 마치지 않은 새 단어는 퀴즈에서 제외하고, 하나라도 남아 있으면 시작할 수 없다.
  const pendingCount = useMemo(
    () => allWords.filter((w) => w.sorted_at === null).length,
    [allWords]
  );

  const scopedPool = useMemo(() => {
<<<<<<< HEAD
    const sorted = isPattern ? allWords : allWords.filter((w) => (w as Word).sorted_at !== null);
    if (scope === "due") return sorted.filter((w) => isDue(w.next_review_at));
    if (scope === "all") return sorted;
    if (scope === "recent") return sorted.slice(0, RECENT_COUNT);
    return sorted.filter((w) => (w as Word).difficulty === difficulty);
  }, [allWords, scope, difficulty, isPattern]);
=======
    const sorted = allWords.filter((w) => w.sorted_at !== null);
    if (scope === "due") return sorted.filter((w) => isDue(w.next_review_at));
    if (scope === "all") return sorted;
    if (scope === "recent") return sorted.slice(0, RECENT_COUNT);
    return sorted.filter((w) => w.difficulty === difficulty);
  }, [allWords, scope, difficulty]);
>>>>>>> a1364d085e51867aea4ab029f08b4c968ab9650e

  function changeStage(next: Stage) {
    setStage(next);
    // 설정 화면으로 돌아오면 방금 갱신된 복습 일정을 다시 불러온다.
    if (next === "setup") setReloadKey((k) => k + 1);
    onStageChange?.(next);
  }

  // 단어 1개당 문제 1개를 새로 만들고 응답 상태를 초기화한다 (이벤트 핸들러에서만 호출).
  function setupQuestion(word: Item) {
    setQuestion(
      isPattern
        ? buildPatternQuestion(word as Pattern, allWords as Pattern[], examplesByWord)
        : buildQuestion(word as Word, allWords as Word[], examplesByWord)
    );
    setSelected(null);
    setTypeInput("");
    setPlaced([]);
    setChecked(false);
    setCorrect(false);
  }

  function startQuiz() {
    if (scopedPool.length === 0 || pendingCount > 0) return;
    const q = shuffle(scopedPool);
    setQueue(q);
    setQIndex(0);
    setAnswered([]);
    setRetry(false);
    finalizedRef.current = false;
    setupQuestion(q[0]);
    changeStage("playing");
  }

  // 방금 틀린 단어만 다시 출제한다. 첫 라운드에서 이미 일정이 반영됐으므로 DB에는 쓰지 않는다.
  function startRetry() {
    const wrongWords = answered.filter((a) => a.wrong).map((a) => a.word);
    if (wrongWords.length === 0) return;
    const q = shuffle(wrongWords);
    setQueue(q);
    setQIndex(0);
    setAnswered([]);
    setRetry(true);
    finalizedRef.current = true;
    setupQuestion(q[0]);
    changeStage("playing");
  }

  function goNext() {
    const nextAnswered = [...answered, { word: queue[qIndex], wrong: !correct }];
    setAnswered(nextAnswered);
    const nextIndex = qIndex + 1;
    if (nextIndex >= queue.length) {
      changeStage("result");
    } else {
      setQIndex(nextIndex);
      setupQuestion(queue[nextIndex]);
    }
  }

  function check(given: string) {
    if (!question || checked) return;
    setChecked(true);
    setCorrect(isCorrect(question, given));
  }

  function handleChoice(opt: string) {
    if (checked) return;
    setSelected(opt);
    check(opt);
  }

  function togglePlaced(i: number) {
    if (checked || !question?.tokens) return;
    setPlaced((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  }

  function checkReorder() {
    if (!question?.tokens) return;
    check(placed.map((i) => question.tokens![i]).join(" "));
  }

  function insertChar(ch: string) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? typeInput.length;
    const end = el?.selectionEnd ?? start;
    setTypeInput(typeInput.slice(0, start) + ch + typeInput.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + 1, start + 1);
    });
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
          return supabase.from(table).update(update).eq("id", a.word.id);
        })
      );
    }
    finalize();
  }, [stage, answered, table]);

  if (loading) {
    return (
      <div>
        <p className="muted">불러오는 중... Lädt...</p>
      </div>
    );
  }

  if (stage === "setup") {
    const withEx = scopedPool.filter((w) => hasExamples(w, examplesByWord)).length;
    const allScopes: { key: Scope; ko: string; de: string }[] = [
      { key: "due", ko: "복습 대상", de: "Heute fällig" },
      { key: "all", ko: `전체 ${noun}`, de: isPattern ? "Alle Muster" : "Alle Wörter" },
      { key: "recent", ko: "최근 추가", de: "Zuletzt hinzugefügt" },
      { key: "difficulty", ko: "난이도별", de: "Nach Niveau" },
    ];
    // 패턴에는 난이도가 없다.
    const scopes = allScopes.filter((s) => !isPattern || s.key !== "difficulty");
    return (
      <div>
        <div className="card">
          {!lockedScope && (
            <>
              <div className="section-title">출제 범위 Umfang</div>
              <div className="stepper">
                {scopes.map((s) => (
                  <div
                    key={s.key}
                    className={`step-opt ${scope === s.key ? "sel" : ""}`}
                    onClick={() => setScope(s.key)}
                  >
                    {s.ko}
                    <small>{s.de}</small>
                  </div>
                ))}
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

          <p className="muted" style={{ marginBottom: 10 }}>
            대상 {noun} {scopedPool.length}개 / 예문 있는 {noun} {withEx}개
          </p>

          {pendingCount > 0 && (
            <p style={{ marginBottom: 10, color: "var(--danger)" }}>
              분류하지 않은 새 단어가 {pendingCount}개 있습니다. 먼저 분류해야 퀴즈를 시작할 수 있어요.{" "}
              <Link href="/sort" style={{ color: "var(--accent)" }}>
                분류하기 Sortieren
              </Link>
            </p>
          )}

          <button
            className="btn"
            onClick={startQuiz}
            disabled={scopedPool.length === 0 || pendingCount > 0}
          >
            퀴즈 시작 Quiz starten
          </button>
        </div>
      </div>
    );
  }

  if (stage === "playing" && question) {
    const q = question;
    const status = checked
      ? correct
        ? { text: "정답! Richtig!", color: "var(--accent)" }
        : { text: `오답 Falsch — 정답 Lösung: ${q.answer}`, color: "var(--danger)" }
      : null;

    return (
      <div>
        <div className="card quiz-card">
          <div className="muted">
            {qIndex + 1} / {queue.length} · {q.label}
          </div>

          <div
            className="quiz-word"
            style={q.kind === "reorder" || q.kind.endsWith("Cloze") ? { fontSize: "1.3rem" } : undefined}
          >
            {q.prompt}
          </div>
          {q.sub && (
            <p className="muted" style={{ marginBottom: 10 }}>
              {q.sub}
            </p>
          )}

          {q.format === "choice" &&
            q.options?.map((opt) => {
              let cls = "opt-btn";
              if (checked) {
                if (opt === q.answer) cls += " correct";
                else if (opt === selected) cls += " wrong";
              }
              return (
                <button
                  key={opt}
                  className={cls}
                  onClick={() => handleChoice(opt)}
                  disabled={checked}
                >
                  {opt}
                </button>
              );
            })}

          {q.format === "input" && (
            <>
              <input
                ref={inputRef}
                value={typeInput}
                onChange={(e) => setTypeInput(e.target.value)}
                placeholder="Antwort"
                disabled={checked}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !checked) check(typeInput);
                }}
              />
              {!checked && q.umlaut && (
                <div className="row" style={{ marginTop: 8, gap: 6 }}>
                  {UMLAUTS.map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      className="btn"
                      style={{ flex: "0 0 auto", padding: "6px 14px" }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertChar(ch)}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {q.format === "reorder" && q.tokens && (
            <>
              <div className="chip-area">
                {placed.length === 0 && (
                  <span className="muted">여기에 순서대로 놓기 Hier ablegen</span>
                )}
                {placed.map((i) => (
                  <button
                    key={i}
                    type="button"
                    className="chip placed"
                    disabled={checked}
                    onClick={() => togglePlaced(i)}
                  >
                    {q.tokens![i]}
                  </button>
                ))}
              </div>
              <div className="chip-bank">
                {q.tokens.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    className="chip"
                    disabled={checked || placed.includes(i)}
                    onClick={() => togglePlaced(i)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}

          {status && (
            <p className="muted" style={{ marginTop: 10, color: status.color }}>
              {status.text}
            </p>
          )}
          {checked && (
            <p className="muted" style={{ marginTop: 6, whiteSpace: "pre-line" }}>
              {q.reveal}
            </p>
          )}

          <div style={{ marginTop: 14 }}>
            {checked ? (
              <button className="btn" onClick={goNext}>
                다음 Weiter
              </button>
            ) : q.format === "input" ? (
              <button className="btn" onClick={() => check(typeInput)}>
                확인 Prüfen
              </button>
            ) : q.format === "reorder" ? (
              <button
                className="btn"
                onClick={checkReorder}
                disabled={placed.length !== q.tokens?.length}
              >
                확인 Prüfen
              </button>
            ) : null}
          </div>
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
          <>
            {retry ? (
              <p className="muted" style={{ marginTop: 8 }}>
                연습 라운드라서 복습 일정에는 반영되지 않습니다 Übungsrunde — Zeitplan bleibt unverändert
              </p>
            ) : (
              <p className="muted" style={{ marginTop: 8 }}>
                틀린 {wrongCount}개 {noun}{isPattern ? "은" : "는"} 1일 단계로 돌아가 내일 다시 복습됩니다
                {!lockedScope && (
                  <>
                    {" "}·{" "}
                    <Link href="/review" style={{ color: "var(--accent)" }}>
                      복습 일정 보기 Zum Zeitplan
                    </Link>
                  </>
                )}
              </p>
            )}
            <div className="section-title" style={{ marginTop: 14 }}>
              틀린 {noun} Fehlerliste
            </div>
            <ul className="muted" style={{ margin: "0 0 4px", paddingLeft: 18 }}>
              {answered
                .filter((a) => a.wrong)
                .map((a) => (
                  <li key={a.word.id}>
                    {itemLabel(a.word)} — {a.word.meaning}
                  </li>
                ))}
            </ul>
          </>
        ) : (
          <p className="muted" style={{ marginTop: 8 }}>
            전부 맞혔습니다 🎉
          </p>
        )}
        <div className="row" style={{ marginTop: 14 }}>
          {wrongCount > 0 && (
            <button className="btn" onClick={startRetry}>
              틀린 {wrongCount}개 다시 풀기 Fehler wiederholen
            </button>
          )}
          <button
            className={wrongCount > 0 ? "btn ghost" : "btn"}
            onClick={() => changeStage("setup")}
          >
            다시 설정하기 Neu einstellen
          </button>
        </div>
      </div>
    </div>
  );
}
