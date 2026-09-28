"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { REVIEW_INTERVALS_DAYS, isDue } from "@/lib/srs";

type Row = {
  id: number;
  word: string;
  meaning: string;
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

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase
        .from("words")
        .select("id, word, meaning, review_stage, next_review_at")
        .order("next_review_at", { ascending: true });
      if (!active) return;
      if (error) setErrorMsg(error.message);
      else {
        setNowMs(Date.now());
        setRows(data ?? []);
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const due = rows.filter((r) => isDue(r.next_review_at, nowMs));
  const upcoming = rows.filter((r) => !isDue(r.next_review_at, nowMs));

  return (
    <main className="site-main narrow">
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
            오늘 복습 <b>{due.length}</b>개
          </div>
        )}
      </div>

      {loading && <p className="muted">불러오는 중...</p>}
      {errorMsg && <p className="muted">오류: {errorMsg}</p>}

      {!loading && !errorMsg && (
        <>
          <div className="card">
            <div className="section-title" style={{ marginTop: 0 }}>
              오늘 복습할 단어 Heute fällig
            </div>
            {due.length === 0 ? (
              <p className="empty-state">오늘 복습할 단어가 없습니다.</p>
            ) : (
              <>
                {due.map((r) => (
                  <div className="word-row" key={r.id}>
                    <Link
                      href={`/words/${r.id}`}
                      className="word-main"
                      style={{ flex: 1 }}
                    >
                      {r.word}
                      <small>{r.meaning}</small>
                    </Link>
                    <span className="tag">
                      {r.review_stage + 1}단계
                    </span>
                  </div>
                ))}
                <div style={{ marginTop: 14 }}>
                  <Link href="/quiz" className="btn">
                    복습 시작 Wiederholen
                  </Link>
                </div>
              </>
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
                    href={`/words/${r.id}`}
                    className="word-main"
                    style={{ flex: 1 }}
                  >
                    {r.word}
                    <small>{r.meaning}</small>
                  </Link>
                  <span className="tag">
                    {formatDate(r.next_review_at)} · {r.review_stage + 1}단계
                  </span>
                </div>
              ))}
              {upcoming.length > 30 && (
                <p className="muted" style={{ marginTop: 8 }}>
                  외 {upcoming.length - 30}개
                </p>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
