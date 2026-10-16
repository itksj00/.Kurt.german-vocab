"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { fetchAllRows } from "@/lib/supabaseFetch";
import { useEnterAdvance } from "./useEnterAdvance";
import AnswerCompare from "./AnswerCompare";
import DateScopeSelect from "./DateScopeSelect";
import ReviewSwipe from "./ReviewSwipe";
import SentenceMaker from "./SentenceMaker";
import { setSentenceGate, useSentenceGate } from "./useSentenceGate";
import { markReviewDone, useReviewDone } from "./useReviewDone";
import { countDue, dueSummary, pickReviewBatch } from "@/lib/reviewGate";
import { filterByDate, groupByDate } from "@/lib/dateScope";
import type { Difficulty, Pattern, Word } from "@/lib/types";
import { isDue, nextSchedule } from "@/lib/srs";
import {
  buildQuestion,
  hasExamples,
  isCapsMistake,
  isCorrect,
  shuffle,
  type ExampleMap,
  type Question,
} from "@/lib/quizGen";
import { withArticle } from "@/lib/wordDisplay";
import { buildPatternQuestion } from "@/lib/patternQuiz";
import { PATTERN_SELECT, patternText } from "@/lib/patterns";

type Scope = "due" | "all" | "date" | "difficulty";

const UMLAUTS = ["ä", "ö", "ü", "ß"];

const DIFFICULTIES: Difficulty[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export type Stage = "setup" | "playing" | "result";

// 퀴즈 대상: 단어 또는 패턴 (SRS 필드는 공통)
type Item = Word | Pattern;
type Answered = { word: Item; wrong: boolean };

const WORD_COLS: string =
  "id, word, meaning, part_of_speech, pronunciation, difficulty, gender, plural, perfekt_aux, partizip2, wrong_count, review_stage, next_review_at, last_studied_at, created_at, sorted_at, sort_result";
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
  const [dateKey, setDateKey] = useState(""); // 날짜 선택 범위: 추가한 날짜 (YYYY-MM-DD, 현지 기준)
  const [level, setLevel] = useState<1 | 2 | 3>(1); // 복습 대상 범위의 단계: 1 = 카드 스와이프, 2 = 여러 형식 문제, 3 = 내 문장 만들기
  const [makeMode, setMakeMode] = useState(false); // 지금 3단계(내 문장 만들기) 진행 중인지
  const [makeWords, setMakeWords] = useState<Word[]>([]); // 3단계에서 문장을 만들 무작위 단어 5개
  const sentenceOpen = useSentenceGate(); // 3단계를 마쳐서 1·2단계 복습이 열려 있는지
  const [swipeMode, setSwipeMode] = useState(false); // 지금 진행 중인(또는 방금 끝난) 퀴즈가 1단계 카드 복습인지
  const [otherDue, setOtherDue] = useState(0); // 다른 쪽(단어↔패턴)의 복습 대상 개수

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
  const [capsHint, setCapsHint] = useState(false); // 철자는 맞고 명사 대문자만 빠뜨려 틀림
  const [givenText, setGivenText] = useState(""); // 채점한 내 답 (틀렸을 때 정답과 나란히 보여 주기 위함)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const finalizedRef = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const fk = isPattern ? "pattern_id" : "word_id";
      let data: Item[] | null = null;
      let exData: Record<string, unknown>[] = [];
      try {
        data = await fetchAllRows<Item>(table, isPattern ? PATTERN_SELECT : WORD_COLS, {
          order: { column: "created_at", ascending: false },
        });
        exData = await fetchAllRows<Record<string, unknown>>(
          isPattern ? "pattern_examples" : "examples",
          `${fk}, sentence, translation`
        );
      } catch {
        // 불러오기에 실패하면 이전과 같이 목록을 비운 채로 둔다. (예문만 실패해도 문제 생성은 예문 없이 진행)
      }
      // 다른 쪽(단어↔패턴)의 복습 대상 개수 — 복습이 남아 있으면 다른 퀴즈를 막기 위해 필요하다
      let otherCount = 0;
      try {
        const nowIso = new Date().toISOString();
        const res = await supabase
          .from(isPattern ? "words" : "patterns")
          .select("id", { count: "exact", head: true })
          .not("sorted_at", "is", null)
          .or(`next_review_at.is.null,next_review_at.lte.${nowIso}`);
        otherCount = res.count ?? 0;
      } catch {
        // 개수를 못 가져오면 막지 않는다
      }
      if (!active) return;
      setOtherDue(otherCount);
      if (data) setAllWords(data);
      const map: ExampleMap = {};
      exData.forEach((e) => {
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

  // 분류(알아요/몰라요)를 마치지 않은 새 단어/패턴은 퀴즈에서 제외하고, 하나라도 남아 있으면 시작할 수 없다.
  const pendingCount = useMemo(
    () => allWords.filter((w) => w.sorted_at === null).length,
    [allWords]
  );

  const sortedPool = useMemo(() => allWords.filter((w) => w.sorted_at !== null), [allWords]);
  // 날짜 드롭다운: 분류를 마친 항목이 있는 날짜와 개수 (최신순)
  const dateOptions = useMemo(() => groupByDate(sortedPool), [sortedPool]);

  // 복습 대상(단어+패턴)이 남아 있으면 복습 대상 범위 외의 퀴즈는 시작할 수 없다.
  const ownDue = useMemo(() => countDue(sortedPool), [sortedPool]);
  // 오늘 복습 회차를 마친 쪽(단어/패턴)은 남은 복습이 있어도 다른 퀴즈를 막지 않는다.
  const ownDone = useReviewDone(isPattern ? "patterns" : "words");
  const otherDone = useReviewDone(isPattern ? "words" : "patterns");
  const pendOwn = ownDone ? 0 : ownDue;
  const pendOther = otherDone ? 0 : otherDue;
  const blocked = scope !== "due" && pendOwn + pendOther > 0;
  // 복습 단어 퀴즈는 3단계(내 문장 만들기)를 먼저 해야 1·2단계를 시작할 수 있다. (복습할 단어가 없으면 해당 없음)
  const needsSentences = !isPattern && scope === "due" && ownDue > 0 && !sentenceOpen;
  const lv = needsSentences ? 3 : level; // 실제로 적용되는 단계

  const scopedPool = useMemo(() => {
    // 복습 대상은 가장 오래 밀린 것부터 한 회차 분량(50개)만
    if (scope === "due") return pickReviewBatch(sortedPool);
    if (scope === "all") return sortedPool;
    if (scope === "date") return filterByDate(sortedPool, dateKey);
    return sortedPool.filter((w) => (w as Word).difficulty === difficulty);
  }, [sortedPool, scope, difficulty, dateKey]);

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
    setCapsHint(false);
    setGivenText("");
  }

  function startQuiz(pool: Item[] = scopedPool) {
    if (pool.length === 0 || pendingCount > 0 || blocked) return;
    if (scope === "due" && !isPattern && lv === 3) {
      // 3단계: 복습 대상 단어 중 무작위 5개로 내 문장 만들기 (저장하지 않음)
      setMakeWords(shuffle(pool).slice(0, 5) as Word[]);
      setMakeMode(true);
      setSwipeMode(false);
      changeStage("playing");
      return;
    }
    if (needsSentences) return; // 3단계를 먼저 해야 한다
    const q = shuffle(pool);
    setQueue(q);
    setQIndex(0);
    setAnswered([]);
    setRetry(false);
    finalizedRef.current = false;
    if (scope === "due" && lv === 1) {
      // 1단계: 문제를 만들지 않고 카드 스와이프로 진행한다 (끝나면 결과를 받아 복습 일정에 반영)
      setSwipeMode(true);
      changeStage("playing");
      return;
    }
    setSwipeMode(false);
    setupQuestion(q[0]);
    changeStage("playing");
  }

  // 3단계 요약 화면에서 돌아오기 (3단계를 마친 시점에 이미 1·2단계가 열려 있다)
  function finishMaking() {
    setMakeMode(false);
    setLevel(1);
    changeStage("setup");
  }

  // 1단계 카드 복습이 끝났을 때: 첫 라운드 결과(몰라요 = 틀림)를 일정에 반영하고 결과 화면으로
  function finishSwipe(results: { word: Item; wrong: boolean }[]) {
    setAnswered(results);
    changeStage("result");
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
    setSwipeMode(false);
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
    setCapsHint(isCapsMistake(question, given));
    setGivenText(given);
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

  // Enter = 화면의 주 버튼: 확인 → 다음 (객관식은 보기를 누르면 바로 채점되므로 채점 후 Enter로 다음)
  useEnterAdvance(stage === "playing" && !swipeMode && !makeMode && !!question, () => {
    if (!question) return;
    if (checked) goNext();
    else if (question.format === "input") check(typeInput);
    else if (question.format === "reorder" && placed.length === question.tokens?.length) checkReorder();
  });

  // 결과 화면 진입 시 wrong_count / last_studied_at / 복습 일정 반영 (1회만).
  useEffect(() => {
    if (stage !== "result" || finalizedRef.current) return;
    finalizedRef.current = true;
    // 복습 단어 퀴즈(1·2단계)를 마쳤으니, 다음 복습은 다시 3단계부터
    // 복습할 항목을 모두 마쳤을 때만 다시 잠근다. 남은 게 있으면 이어서 다음 회차를 3단계 없이 할 수 있다.
    if (scope === "due" && !isPattern && ownDue - answered.length <= 0) setSentenceGate(false);
    if (scope === "due") markReviewDone(isPattern ? "patterns" : "words");

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
            Object.assign(update, nextSchedule(a.word.review_stage, true, nowMs, a.word.next_review_at));
          }
          return supabase.from(table).update(update).eq("id", a.word.id);
        })
      );
    }
    finalize();
  }, [stage, answered, table, scope, isPattern, ownDue]);

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
      { key: "date", ko: "날짜 선택", de: "Nach Datum" },
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
              {scope === "date" && (
                <DateScopeSelect
                  options={dateOptions}
                  value={dateKey}
                  noun={noun}
                  onPick={(v) => {
                    setDateKey(v);
                    // 날짜(개수)를 고르면 그날 추가한 항목으로 바로 퀴즈를 시작한다
                    if (v) startQuiz(filterByDate(sortedPool, v));
                  }}
                />
              )}
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

          {scope === "due" && (
            <>
              <div className="section-title">단계 Stufe</div>
              <div className="stepper">
                <div
                  className={`step-opt ${lv === 1 ? "sel" : ""}`}
                  style={needsSentences ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
                  onClick={() => !needsSentences && setLevel(1)}
                >
                  1단계 아는지 확인
                  <small>Wissen prüfen</small>
                </div>
                <div
                  className={`step-opt ${lv === 2 ? "sel" : ""}`}
                  style={needsSentences ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
                  onClick={() => !needsSentences && setLevel(2)}
                >
                  2단계 문제 풀기
                  <small>Quiz</small>
                </div>
                {!isPattern && (
                  <div className={`step-opt ${lv === 3 ? "sel" : ""}`} onClick={() => setLevel(3)}>
                    3단계 문장 만들기
                    <small>Eigene Sätze</small>
                  </div>
                )}
              </div>
              <p className="muted" style={{ marginBottom: 10 }}>
                {lv === 1 &&
                  `카드를 좌우로 넘겨 알아요/몰라요만 표시합니다. 몰라요로 넘긴 ${noun}은(는) 모두 알아요가 될 때까지 마지막에 다시 나옵니다.`}
                {lv === 2 && "문장 배열, 빈칸, 관사 등 여러 형식의 문제를 풉니다."}
                {lv === 3 && "복습 대상 단어 중 무작위 5개로 나만의 문장을 만듭니다. 예문을 참고할 수 있고 저장되지는 않습니다."}{" "}
                {needsSentences
                  ? "복습(1·2단계)을 하려면 먼저 3단계를 마쳐야 합니다. Erst eigene Sätze bilden."
                  : !isPattern
                    ? "3단계를 마쳤어요. 복습할 항목을 모두 마칠 때까지는 3단계 없이 이어서 할 수 있고, 다음 날부터는 다시 3단계부터 시작합니다."
                    : "1단계와 2단계 중 하나만 끝내도 복습을 마친 것으로 처리됩니다."}
              </p>
            </>
          )}

          {scope === "due" && ownDue > scopedPool.length && (
            <p className="muted" style={{ marginBottom: 6 }}>
              복습 대상 {ownDue}개 중 가장 오래 밀린 {scopedPool.length}개를 먼저 합니다. 끝나면 이어서 다음 회차를 할 수 있어요.
            </p>
          )}
          <p className="muted" style={{ marginBottom: 10 }}>
            대상 {noun} {scopedPool.length}개 / 예문 있는 {noun} {withEx}개
          </p>

          {blocked && (
            <p style={{ marginBottom: 10, color: "var(--danger)" }}>
              복습 대상({dueSummary(isPattern ? pendOther : pendOwn, isPattern ? pendOwn : pendOther)})이 남아 있습니다. 복습을 먼저 끝내야 다른 퀴즈를 할 수 있어요. Erst die fälligen Wiederholungen erledigen.{" "}
              <Link href="/review" style={{ color: "var(--accent)" }}>
                복습하러 가기 Zur Wiederholung
              </Link>
            </p>
          )}

          {pendingCount > 0 && (
            <p style={{ marginBottom: 10, color: "var(--danger)" }}>
              분류하지 않은 새 {noun} {pendingCount}개가 있습니다. 먼저 분류해야 퀴즈를 시작할 수 있어요.{" "}
              <Link href={`/sort#${mode}`} style={{ color: "var(--accent)" }}>
                분류하기 Sortieren
              </Link>
            </p>
          )}

          <button
            className="btn"
            onClick={() => startQuiz()}
            disabled={scopedPool.length === 0 || pendingCount > 0 || blocked}
          >
            {scope === "due" && lv === 3 && !isPattern
              ? "문장 만들기 시작 Sätze bilden"
              : scope === "due" && lv === 1
                ? "복습 시작 Wiederholung starten"
                : "퀴즈 시작 Quiz starten"}
          </button>
        </div>
      </div>
    );
  }

  if (stage === "playing" && makeMode) {
    return (
      <div>
        <SentenceMaker
          words={makeWords}
          examples={examplesByWord}
          onComplete={() => setSentenceGate(true)}
          onDone={finishMaking}
        />
      </div>
    );
  }

  if (stage === "playing" && swipeMode) {
    return (
      <div>
        <ReviewSwipe items={queue} examples={examplesByWord} onFinish={finishSwipe} />
      </div>
    );
  }

  if (stage === "playing" && question) {
    const q = question;
    // 입력·배열 문제를 틀리면 "내가 쓴 답 / 정답"을 나란히 보여 주므로 상태 줄에는 정답을 따로 쓰지 않는다
    const showCompare = checked && !correct && q.format !== "choice";
    const capsLine = capsHint ? "\n명사는 첫 글자를 대문자로 써야 해요 Nomen großschreiben" : "";
    const status = checked
      ? correct
        ? { text: "정답! Richtig!", color: "var(--accent)" }
        : {
            text: showCompare ? `오답 Falsch${capsLine}` : `오답 Falsch — 정답 Lösung: ${q.answer}${capsLine}`,
            color: "var(--danger)",
          }
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
              {q.answer.trim().split(/\s+/).length >= 4 ? (
                <textarea
                  ref={(el) => {
                    inputRef.current = el;
                  }}
                  rows={3}
                  value={typeInput}
                  onChange={(e) => setTypeInput(e.target.value)}
                  placeholder="Antwort"
                  disabled={checked}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              ) : (
                <input
                  ref={(el) => {
                    inputRef.current = el;
                  }}
                  value={typeInput}
                  onChange={(e) => setTypeInput(e.target.value)}
                  placeholder="Antwort"
                  disabled={checked}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              )}
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
            <p className="muted" style={{ marginTop: 10, color: status.color, whiteSpace: "pre-line" }}>
              {status.text}
            </p>
          )}
          {showCompare && <AnswerCompare given={givenText} answer={q.answer} />}
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
          {swipeMode
            ? `첫 확인에서 알아요 ${correctCount}개 · 몰라요 ${wrongCount}개 (총 ${total}개)`
            : `정답률 ${rate}% (${total}문항 중 ${correctCount}개 정답)`}
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
              {swipeMode ? `몰라요 ${wrongCount}개 문제로 연습 Üben` : `틀린 ${wrongCount}개 다시 풀기 Fehler wiederholen`}
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
