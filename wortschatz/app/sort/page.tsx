"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Word } from "@/lib/types";
import { posLabel, withArticle } from "@/lib/wordDisplay";
import {
  SWIPE_THRESHOLD,
  sortPatch,
  swipeDecision,
  undoPatch,
  type SortResult,
} from "@/lib/sort";

type Done = { word: Word; result: SortResult };

export default function SortPage() {
  const [queue, setQueue] = useState<Word[]>([]);
  const [history, setHistory] = useState<Done[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<SortResult | null>(null);

  const startX = useRef(0);
  const moved = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase
        .from("words")
        .select(
          "id, word, meaning, part_of_speech, pronunciation, difficulty, gender, plural, perfekt_aux, partizip2, wrong_count, review_stage, next_review_at, last_studied_at, created_at, sorted_at, sort_result"
        )
        .is("sorted_at", null)
        .order("created_at", { ascending: true });
      if (!active) return;
      if (error) setError(error.message);
      else setQueue(data ?? []);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  function notify() {
    window.dispatchEvent(new Event("wortschatz:sort-changed"));
  }

  // 카드를 날려 보낸 뒤 다음 카드로. DB 저장은 화면 전환과 별개로 진행하고, 실패하면 되돌린다.
  function commit(result: SortResult) {
    const w = queue[0];
    if (!w || leaving) return;
    setError(null);
    setLeaving(result);
    window.setTimeout(async () => {
      setQueue((q) => q.slice(1));
      setHistory((h) => [...h, { word: w, result }]);
      setFlipped(false);
      setDragX(0);
      setLeaving(null);
      const { error } = await supabase
        .from("words")
        .update(sortPatch(result))
        .eq("id", w.id);
      if (error) {
        setQueue((q) => [w, ...q]);
        setHistory((h) => h.filter((x) => x.word.id !== w.id));
        setError(`저장하지 못했습니다 Speichern fehlgeschlagen: ${error.message}`);
      } else {
        notify();
      }
    }, 170);
  }

  async function undo() {
    const last = history[history.length - 1];
    if (!last || leaving) return;
    setError(null);
    setHistory((h) => h.slice(0, -1));
    setQueue((q) => [last.word, ...q]);
    setFlipped(false);
    const { error } = await supabase
      .from("words")
      .update(undoPatch())
      .eq("id", last.word.id);
    if (error) {
      setQueue((q) => q.filter((x) => x.id !== last.word.id));
      setHistory((h) => [...h, last]);
      setError(`되돌리지 못했습니다 Rückgängig fehlgeschlagen: ${error.message}`);
    } else {
      notify();
    }
  }

  // 키보드: ← 몰라요, → 알아요, Z 되돌리기. 최신 핸들러를 ref로 참조한다.
  const handlersRef = useRef({ commit, undo });
  useEffect(() => {
    handlersRef.current = { commit, undo };
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") handlersRef.current.commit("known");
      else if (e.key === "ArrowLeft") handlersRef.current.commit("unknown");
      else if (e.key === "z" || e.key === "Z") handlersRef.current.undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (leaving) return;
    startX.current = e.clientX;
    moved.current = false;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 6) moved.current = true;
    setDragX(dx);
  }

  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (!moved.current) {
      setDragX(0);
      setFlipped((f) => !f); // 탭 = 뜻 보기/숨기기
      return;
    }
    const decision = swipeDecision(dragX);
    if (decision) commit(decision);
    else setDragX(0);
  }

  if (loading) {
    return (
      <main className="site-main narrow">
        <p className="muted">불러오는 중... Lädt...</p>
      </main>
    );
  }

  const w = queue[0];
  const x = leaving ? (leaving === "known" ? 420 : -420) : dragX;
  const lean = Math.max(-1, Math.min(1, x / SWIPE_THRESHOLD));
  const tint =
    lean > 0
      ? `color-mix(in srgb, var(--accent) ${Math.round(lean * 40)}%, var(--panel))`
      : `color-mix(in srgb, var(--danger) ${Math.round(-lean * 40)}%, var(--panel))`;

  return (
    <main className="site-main narrow">
      <div className="page-hero">
        <h1>새 단어 분류 Sortieren</h1>
        <p className="muted">
          뜻을 아는 단어는 오른쪽, 모르는 단어는 왼쪽으로 밀어 주세요. 모두 분류해야 퀴즈를 시작할 수 있습니다.
        </p>
      </div>

      {error && (
        <p className="muted" style={{ color: "var(--danger)", marginBottom: 10 }}>
          {error}
        </p>
      )}

      {w ? (
        <div className="card">
          <p className="muted" style={{ marginBottom: 8 }}>
            남은 단어 {queue.length}개 Noch {queue.length}
          </p>

          <div className="sort-stage">
            <div
              className="sort-card"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{
                transform: `translateX(${x}px) rotate(${x / 30}deg)`,
                transition: dragging ? "none" : "transform 0.17s ease-out",
                background: tint,
                opacity: leaving ? 0.4 : 1,
              }}
            >
              <span
                className="sort-badge left"
                style={{ opacity: lean < 0 ? -lean : 0 }}
              >
                몰라요 Weiß nicht
              </span>
              <span
                className="sort-badge right"
                style={{ opacity: lean > 0 ? lean : 0 }}
              >
                알아요 Weiß ich
              </span>
              <div className="muted" style={{ fontSize: "0.8rem" }}>
                {w.part_of_speech ? posLabel(w.part_of_speech) : ""}
              </div>
              <div className="quiz-word" style={{ margin: "6px 0" }}>
                {withArticle(w)}
              </div>
              {flipped ? (
                <div style={{ fontSize: "1.05rem" }}>{w.meaning}</div>
              ) : (
                <div className="muted" style={{ fontSize: "0.82rem" }}>
                  탭하면 뜻 보기 Tippen für Bedeutung
                </div>
              )}
            </div>
          </div>

          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <button className="btn" onClick={() => commit("unknown")} disabled={!!leaving}>
              ← 몰라요 Weiß nicht
            </button>
            <button className="btn" onClick={() => commit("known")} disabled={!!leaving}>
              알아요 Weiß ich →
            </button>
          </div>
          <div style={{ marginTop: 8 }}>
            <button
              className="btn ghost"
              onClick={undo}
              disabled={history.length === 0 || !!leaving}
            >
              되돌리기 Rückgängig
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <p style={{ marginBottom: 12 }}>
            {history.length > 0
              ? `분류를 마쳤습니다. 방금 ${history.length}개를 분류했어요 🎉`
              : "분류할 새 단어가 없습니다. Keine neuen Wörter."}
          </p>
          <div className="row" style={{ gap: 8 }}>
            <Link href="/quiz" className="btn">
              퀴즈 시작 Quiz
            </Link>
            <Link href="/words/add" className="btn ghost">
              단어 추가 Hinzufügen
            </Link>
          </div>
          {history.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <button className="btn ghost" onClick={undo}>
                되돌리기 Rückgängig
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
