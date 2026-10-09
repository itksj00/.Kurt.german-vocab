"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchAllRows } from "@/lib/supabaseFetch";
import { REVIEW_INTERVALS_DAYS, isDue } from "@/lib/srs";
import { withArticle } from "@/lib/wordDisplay";
import type { Gender, Pattern } from "@/lib/types";
import { PATTERN_SELECT, patternText } from "@/lib/patterns";
import QuizRunner, { type Stage } from "../QuizRunner";
import ModeTabs, { type Mode } from "../ModeTabs";

type Row = {
  id: number;
  label: string; // 화면에 보여줄 이름 (관사 포함 단어 또는 패턴 표기)
  meaning: string;
  review_stage: number;
  next_review_at: string | null;
};

type WordRow = {
  id: number;
  word: string;
  meaning: string;
  gender: Gender | null;
  review_stage: number;
  next_review_at: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function ReviewPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const [stage, setStage] = useState<Stage>("setup");
  const [reloadKey, setReloadKey] = useState(0);
  const [mode, setMode] = useState<Mode>("word");
  const isPattern = mode === "pattern";
  const noun = isPattern ? "패턴" : "단어";
  const base = isPattern ? "/patterns" : "/words";

  useEffect(() => {
    let active = true;
    async function load() {
      let data: Row[] | null = null;
      let errMsg: string | null = null;
      if (mode === "pattern") {
        let list: Pattern[] = [];
        try {
          list = await fetchAllRows<Pattern>("patterns", PATTERN_SELECT, {
            sorted: "done",
            order: { column: "next_review_at" },
          });
        } catch (e) {
          errMsg = e instanceof Error ? e.message : String(e);
        }
        data = list.map((p) => ({
          id: p.id,
          label: patternText(p),
          meaning: p.meaning,
          review_stage: p.review_stage,
          next_review_at: p.next_review_at,
        }));
      } else {
        let list: WordRow[] = [];
        try {
          list = await fetchAllRows<WordRow>(
            "words",
            "id, word, meaning, gender, review_stage, next_review_at",
            { sorted: "done", order: { column: "next_review_at" } }
          );
        } catch (e) {
          errMsg = e instanceof Error ? e.message : String(e);
        }
        data = list.map((w) => ({
          id: w.id,
          label: withArticle(w),
          meaning: w.meaning,
          review_stage: w.review_stage,
          next_review_at: w.next_review_at,
        }));
      }
      if (!active) return;
      if (errMsg) setErrorMsg(errMsg);
      else {
        setErrorMsg(null);
        setNowMs(Date.now());
        setRows(data ?? []);
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [reloadKey, mode]);

  function changeMode(next: Mode) {
    setMode(next);
    setRows([]);
    setLoading(true);
  }

  function handleStageChange(next: Stage) {
    setStage(next);
    // 복습 퀴즈가 끝나고 돌아오면 갱신된 일정으로 목록을 다시 불러온다.
    if (next === "setup") setReloadKey((k) => k + 1);
  }

  const due = rows.filter((r) => isDue(r.next_review_at, nowMs));
  const upcoming = rows.filter((r) => !isDue(r.next_review_at, nowMs));
  const showLists = stage === "setup";

  return (
    <main className="site-main narrow">
      {showLists && <ModeTabs mode={mode} onChange={changeMode} />}

      {showLists && (
        <div className="page-hero">
          <div>
            <h1>
              복습<small>Wiederholung</small>
            </h1>
            <p>
              에빙하우스 망각곡선 주기({REVIEW_INTERVALS_DAYS.join("→")}일)로
              복습합니다.
            </p>
          </div>
          {!loading && (
            <div className="stat">
              오늘 복습 <b>{due.length}</b>개 Heute fällig
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <p className="muted">오류 Fehler: {errorMsg}</p>
      )}

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>
          복습 퀴즈 Wiederholungs-Quiz
        </div>
        <QuizRunner key={mode} mode={mode} lockedScope="due" onStageChange={handleStageChange} />
      </div>

      {showLists && loading && (
        <p className="muted">불러오는 중... Lädt...</p>
      )}

      {showLists && !loading && !errorMsg && (
        <>
          <div className="card">
            <div className="section-title" style={{ marginTop: 0 }}>
              오늘 복습할 {noun} Heute fällig
            </div>
            {due.length === 0 ? (
              <p className="empty-state">
                오늘 복습할 {isPattern ? "패턴이" : "단어가"} 없습니다. Heute nichts zu wiederholen.
              </p>
            ) : (
              due.map((r) => (
                <div className="word-row" key={r.id}>
                  <Link
                    href={`${base}/${r.id}`}
                    className="word-main"
                    style={{ flex: 1 }}
                  >
                    {r.label}
                    <small>{r.meaning}</small>
                  </Link>
                  <span className="tag">{r.review_stage + 1}단계 Stufe</span>
                </div>
              ))
            )}
          </div>

          {upcoming.length > 0 && (
            <div className="card">
              <div className="section-title" style={{ marginTop: 0 }}>
                예정된 복습 Demnächst
              </div>
              {upcoming.slice(0, 30).map((r) => (
                <div className="word-row" key={r.id}>
                  <Link
                    href={`${base}/${r.id}`}
                    className="word-main"
                    style={{ flex: 1 }}
                  >
                    {r.label}
                    <small>{r.meaning}</small>
                  </Link>
                  <span className="tag">
                    {formatDate(r.next_review_at)} · {r.review_stage + 1}단계
                  </span>
                </div>
              ))}
              {upcoming.length > 30 && (
                <p className="muted" style={{ marginTop: 8 }}>
                  외 {upcoming.length - 30}개 weitere
                </p>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
