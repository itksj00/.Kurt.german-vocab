"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type ReviewRow = {
  id: number;
  added_at: string;
  words: {
    id: number;
    word: string;
    meaning: string;
  } | null;
};

export default function ReviewPage() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("review_items")
        .select("id, added_at, words ( id, word, meaning )")
        .eq("resolved", false)
        .order("added_at", { ascending: false });
      if (!active) return;
      if (error) {
        setErrorMsg(error.message);
      } else {
        setRows((data as unknown as ReviewRow[]) ?? []);
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  async function resolveItem(id: number) {
    const removed = rows.find((r) => r.id === id);
    setRows((prev) => prev.filter((r) => r.id !== id));
    const { error } = await supabase
      .from("review_items")
      .update({ resolved: true })
      .eq("id", id);
    if (error && removed) {
      setErrorMsg(error.message);
      setRows((prev) => [removed, ...prev]);
    }
  }

  return (
    <section>
      <div className="card">
        <div className="section-title">복습항목 Wiederholungsliste</div>
        {loading && <p className="muted">불러오는 중...</p>}
        {errorMsg && <p className="muted">오류: {errorMsg}</p>}
        {!loading && rows.length === 0 && (
          <p className="empty-state">
            복습할 단어가 없습니다. 퀴즈에서 틀린 단어가 자동으로 여기 쌓입니다.
          </p>
        )}
        {rows.map((r) =>
          r.words ? (
            <div className="word-row" key={r.id}>
              <Link href={`/words/${r.words.id}`} className="word-main">
                {r.words.word}
                <small>{r.words.meaning}</small>
              </Link>
              <button
                className="btn ghost small"
                onClick={() => resolveItem(r.id)}
              >
                해결
              </button>
            </div>
          ) : null
        )}
        {!loading && rows.length > 0 && (
          <p className="muted" style={{ marginTop: 10 }}>
            퀴즈에서 틀린 단어가 자동으로 이 목록에 쌓입니다.
          </p>
        )}
      </div>
    </section>
  );
}
