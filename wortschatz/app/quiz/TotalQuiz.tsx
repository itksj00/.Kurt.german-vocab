"use client";

import { useEffect, useRef, useState } from "react";
import { fetchAllRows } from "@/lib/supabaseFetch";
import { isCorrect, type ExampleMap } from "@/lib/quizGen";
import { buildTotalQuiz, SOURCE_LABEL, TOTAL_COUNT, type TotalInput, type TotalQuestion, type TotalSource } from "@/lib/totalQuiz";
import type { MemoSentence } from "@/lib/memo";
import type { Pattern, Word } from "@/lib/types";
import type { Stage } from "../QuizRunner";

const UMLAUTS = ["ä", "ö", "ü", "ß"];

type Result = { q: TotalQuestion; ok: boolean };
type ExRow = { sentence: string; translation: string | null } & Record<string, unknown>;

function toExampleMap(rows: ExRow[], fk: string): ExampleMap {
  const map: ExampleMap = {};
  for (const r of rows) {
    (map[r[fk] as number] ??= []).push({ sentence: r.sentence, translation: r.translation ?? null });
  }
  return map;
}

// 일부 테이블(예: 아직 SQL을 실행하지 않은 패턴)을 못 읽어도 나머지로 진행한다.
async function safe<T>(name: string, fn: () => Promise<T[]>, failed: string[]): Promise<T[]> {
  try {
    return await fn();
  } catch {
    failed.push(name);
    return [];
  }
}

export default function TotalQuiz({ onStageChange }: { onStageChange?: (s: Stage) => void }) {
  const [data, setData] = useState<TotalInput | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [stage, setStage] = useState<Stage>("setup");

  const [qs, setQs] = useState<TotalQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [typeInput, setTypeInput] = useState("");
  const [placed, setPlaced] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [practice, setPractice] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const bad: string[] = [];
      const [words, patterns, memos, wex, pex] = await Promise.all([
        safe("단어", () => fetchAllRows<Word>("words", "*"), bad),
        safe("패턴", () => fetchAllRows<Pattern>("patterns", "*"), bad),
        safe("독독독", () => fetchAllRows<MemoSentence>("memo_sentences", "*"), bad),
        safe("단어 예문", () => fetchAllRows<ExRow>("examples", "word_id, sentence, translation"), bad),
        safe("패턴 예문", () => fetchAllRows<ExRow>("pattern_examples", "pattern_id, sentence, translation"), bad),
      ]);
      if (!active) return;
      setData({
        // 분류(알아요/몰라요)를 마친 것만 출제한다.
        words: words.filter((w) => w.sorted_at !== null),
        patterns: patterns.filter((p) => p.sorted_at !== null),
        memos,
        wordEx: toExampleMap(wex, "word_id"),
        patternEx: toExampleMap(pex, "pattern_id"),
      });
      setFailed(bad);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  function changeStage(next: Stage) {
    setStage(next);
    onStageChange?.(next);
  }

  function resetAnswer() {
    setSelected(null);
    setTypeInput("");
    setPlaced([]);
    setChecked(false);
    setCorrect(false);
  }

  function begin(list: TotalQuestion[], isPractice: boolean) {
    if (list.length === 0) return;
    setQs(list);
    setIdx(0);
    setResults([]);
    setPractice(isPractice);
    resetAnswer();
    changeStage("playing");
  }

  function startNew() {
    if (data) begin(buildTotalQuiz(data, TOTAL_COUNT), false);
  }

  function retryWrong() {
    if (!data) return;
    const only = new Set(results.filter((r) => !r.ok).map((r) => r.q.refKey));
    begin(buildTotalQuiz(data, 999, Math.random, only), true);
  }

  function check(given: string) {
    const q = qs[idx];
    if (!q || checked) return;
    setChecked(true);
    setCorrect(isCorrect(q, given));
  }

  function goNext() {
    setResults((r) => [...r, { q: qs[idx], ok: correct }]);
    if (idx + 1 >= qs.length) {
      changeStage("result");
    } else {
      setIdx(idx + 1);
      resetAnswer();
    }
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

  if (!data) return <p className="muted">불러오는 중... Lädt...</p>;

  const counts: Record<TotalSource, number> = {
    word: data.words.length,
    pattern: data.patterns.length,
    memo: data.memos.length,
  };
  const available = counts.word + counts.pattern + counts.memo;

  if (stage === "setup") {
    return (
      <div className="card">
        <p style={{ marginBottom: 6 }}>
          단어 <b>{counts.word}</b>개 · 패턴 <b>{counts.pattern}</b>개 · 독독독 문장 <b>{counts.memo}</b>개
        </p>
        <p className="muted" style={{ marginBottom: 10 }}>
          단어, 패턴, 독독독 문장을 섞어서 매번 무작위로 {TOTAL_COUNT}문제를 냅니다. 문제 유형도 모두 섞이고,
          복습 일정이나 틀린 횟수에는 반영되지 않는 연습입니다. 분류를 마친 단어·패턴만 나옵니다.
          {available < TOTAL_COUNT && available > 0 && ` 지금은 ${available}개뿐이라 ${available}문제가 출제됩니다.`}
        </p>
        {failed.length > 0 && (
          <p className="muted" style={{ marginBottom: 10, color: "var(--danger)" }}>
            불러오지 못해 제외한 항목: {failed.join(", ")}
          </p>
        )}
        <button className="btn" onClick={startNew} disabled={available === 0}>
          {available === 0 ? "출제할 항목이 없습니다 Keine Einträge" : "토탈 테스트 시작 Gesamttest starten"}
        </button>
      </div>
    );
  }

  if (stage === "result") {
    const wrong = results.filter((r) => !r.ok);
    const good = results.length - wrong.length;
    const sources = (Object.keys(SOURCE_LABEL) as TotalSource[]).filter((s) =>
      results.some((r) => r.q.source === s)
    );
    return (
      <div className="card quiz-card">
        <div className="quiz-word">
          {good} / {results.length}
        </div>
        <p className="muted">
          {sources
            .map((s) => {
              const r = results.filter((x) => x.q.source === s);
              return `${SOURCE_LABEL[s]} ${r.filter((x) => x.ok).length}/${r.length}`;
            })
            .join(" · ")}
        </p>
        {practice && (
          <p className="muted" style={{ marginTop: 6 }}>
            다시 풀기 연습 라운드 Übungsrunde
          </p>
        )}
        {wrong.length === 0 ? (
          <p className="muted" style={{ marginTop: 8 }}>
            전부 맞혔습니다 🎉
          </p>
        ) : (
          <>
            <div className="section-title">틀린 문제 Fehlerliste</div>
            <ul className="muted" style={{ margin: "0 0 4px", paddingLeft: 18 }}>
              {wrong.map((r) => (
                <li key={r.q.refKey} style={{ marginBottom: 4 }}>
                  [{SOURCE_LABEL[r.q.source]}] {r.q.title}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="row" style={{ marginTop: 14 }}>
          {wrong.length > 0 && (
            <button className="btn" onClick={retryWrong}>
              틀린 {wrong.length}개 다시 풀기 Fehler wiederholen
            </button>
          )}
          <button className={wrong.length > 0 ? "btn ghost" : "btn"} onClick={startNew}>
            새 {TOTAL_COUNT}문제 Neue Runde
          </button>
          <button className="btn ghost" onClick={() => changeStage("setup")}>
            처음으로 Zurück
          </button>
        </div>
      </div>
    );
  }

  const q = qs[idx];
  const status = checked
    ? correct
      ? { text: "정답! Richtig!", color: "var(--accent)" }
      : { text: `오답 Falsch — 정답 Lösung: ${q.answer}`, color: "var(--danger)" }
    : null;

  return (
    <div className="card quiz-card">
      <div className="muted">
        {idx + 1} / {qs.length} · {SOURCE_LABEL[q.source]} · {q.label}
      </div>

      <div
        className="quiz-word"
        style={q.format !== "choice" && q.prompt.length > 24 ? { fontSize: "1.3rem" } : undefined}
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
              onClick={() => {
                if (checked) return;
                setSelected(opt);
                check(opt);
              }}
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
            {placed.length === 0 && <span className="muted">여기에 순서대로 놓기 Hier ablegen</span>}
            {placed.map((i) => (
              <button
                key={i}
                type="button"
                className="chip placed"
                disabled={checked}
                onClick={() => setPlaced((p) => p.filter((x) => x !== i))}
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
                onClick={() => setPlaced((p) => [...p, i])}
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
            {idx + 1 >= qs.length ? "결과 보기 Ergebnis" : "다음 Weiter"}
          </button>
        ) : q.format === "input" ? (
          <button className="btn" onClick={() => check(typeInput)}>
            확인 Prüfen
          </button>
        ) : q.format === "reorder" ? (
          <button
            className="btn"
            onClick={() => check(placed.map((i) => q.tokens![i]).join(" "))}
            disabled={placed.length !== q.tokens?.length}
          >
            확인 Prüfen
          </button>
        ) : null}
      </div>
    </div>
  );
}
