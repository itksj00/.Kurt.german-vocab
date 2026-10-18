"use client";

import { useEffect, useRef, useState } from "react";
import type { Pattern, Word } from "@/lib/types";
import { posLabel, withArticle } from "@/lib/wordDisplay";
import { patternText } from "@/lib/patterns";
import { SWIPE_THRESHOLD, swipeDecision, type SortResult } from "@/lib/sort";
import { currentId, initSwipe, isFinished, swipeCard, type SwipeState } from "@/lib/reviewSwipe";
import { shuffle, type ExampleMap } from "@/lib/quizGen";

type Item = Word | Pattern;

// 복습 1단계: 카드를 오른쪽(알아요)/왼쪽(몰라요)으로 넘긴다. 몰라요 카드는 모두 알아요가 될 때까지 다시 나온다.
// 모두 끝나면 onFinish에 카드별 결과(첫 라운드에서 몰라요였으면 wrong=true)를 넘긴다.
export default function ReviewSwipe({
  items,
  examples,
  onFinish,
}: {
  items: Item[];
  examples: ExampleMap;
  onFinish: (results: { word: Item; wrong: boolean }[]) => void;
}) {
  const [state, setState] = useState<SwipeState>(() => initSwipe(items.map((x) => x.id)));
  const [history, setHistory] = useState<SwipeState[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<SortResult | null>(null);

  const startX = useRef(0);
  const moved = useRef(false);

  const byId = new Map(items.map((x) => [x.id, x]));
  const id = currentId(state);
  const w = id === null ? null : byId.get(id) ?? null;

  // 카드를 날려 보낸 뒤 다음 카드로
  function commit(result: SortResult) {
    if (!w || leaving) return;
    setLeaving(result);
    window.setTimeout(() => {
      const next = swipeCard(state, result === "known", shuffle);
      setHistory((h) => [...h, state]);
      setState(next);
      setFlipped(false);
      setDragX(0);
      setLeaving(null);
      if (isFinished(next)) {
        onFinish(items.map((x) => ({ word: x, wrong: next.firstWrong.includes(x.id) })));
      }
    }, 170);
  }

  function undo() {
    if (leaving) return;
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setState(prev);
    setFlipped(false);
    setDragX(0);
  }

  // 키보드: ← 몰라요, → 알아요, Z 되돌리기. 최신 핸들러를 ref로 참조한다.
  const handlersRef = useRef({ commit, undo });
  useEffect(() => {
    handlersRef.current = { commit, undo };
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
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
    e.currentTarget.setPointerCapture?.(e.pointerId);
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

  if (!w) return null;

  const x = leaving ? (leaving === "known" ? 420 : -420) : dragX;
  const lean = Math.max(-1, Math.min(1, x / SWIPE_THRESHOLD));
  const tint =
    lean > 0
      ? `color-mix(in srgb, var(--accent) ${Math.round(lean * 40)}%, var(--panel))`
      : `color-mix(in srgb, var(--danger) ${Math.round(-lean * 40)}%, var(--panel))`;
  const isPattern = "verb" in w;
  const pos = isPattern ? null : (w as Word).part_of_speech;
  // 카드 뒷면: 메모(패턴) 또는 암기 팁(단어), 예문
  const note = isPattern ? (w as Pattern).note : (w as Word).mnemonic;
  const exs = (examples[w.id] ?? []).slice(0, 3);

  return (
    <div className="card">
      <div className="section-title">복습 1단계 Wiederholung</div>
      <p className="muted" style={{ marginBottom: 8 }}>
        남은 카드 {state.queue.length}개 Noch {state.queue.length}
        {state.round > 1 && ` · ${state.round}번째 라운드: 몰라요로 넘긴 카드를 다시 보여 줍니다`}
      </p>

      {/* 예문·메모가 들어가도 잘리지 않도록 높이를 내용에 맞추고 카드를 넓게 쓴다 */}
      <div className="sort-stage" style={{ height: "auto", minHeight: 260, overflowX: "hidden", overflowY: "visible", padding: "8px 0" }}>
        <div
          className="sort-card"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            maxWidth: 720,
            height: "auto",
            minHeight: 220,
            padding: "28px 20px",
            transform: `translateX(${x}px) rotate(${x / 30}deg)`,
            transition: dragging ? "none" : "transform 0.17s ease-out",
            background: tint,
            opacity: leaving ? 0.4 : 1,
          }}
        >
          <span className="sort-badge left" style={{ opacity: lean < 0 ? -lean : 0 }}>
            몰라요 Weiß nicht
          </span>
          <span className="sort-badge right" style={{ opacity: lean > 0 ? lean : 0 }}>
            알아요 Weiß ich
          </span>
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            {isPattern ? "패턴 Muster" : pos ? posLabel(pos) : ""}
          </div>
          <div className="quiz-word" style={{ margin: "6px 0" }}>
            {isPattern ? patternText(w as Pattern) : withArticle(w as Word)}
          </div>
          {flipped ? (
            <div style={{ fontSize: "1.05rem", width: "100%" }}>
              {w.meaning}
              {note && (
                <div className="muted" style={{ fontSize: "0.85rem", marginTop: 6, overflowWrap: "anywhere" }}>
                  {isPattern ? "📝" : "💡"} {note}
                </div>
              )}
              {exs.length > 0 && (
                <div style={{ marginTop: 12, textAlign: "left", maxWidth: 560, marginInline: "auto" }}>
                  <div className="muted" style={{ fontSize: "0.78rem" }}>
                    예문 Beispiele
                  </div>
                  {exs.map((e, i) => (
                    <div key={i} style={{ fontSize: "0.92rem", marginTop: 6, overflowWrap: "anywhere" }}>
                      {e.sentence}
                      {e.translation && (
                        <div className="muted" style={{ fontSize: "0.82rem" }}>
                          {e.translation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: "0.82rem" }}>
              탭하면 뜻·예문 보기 Tippen für Bedeutung
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
        <button className="btn ghost" onClick={undo} disabled={history.length === 0 || !!leaving}>
          되돌리기 Rückgängig
        </button>
      </div>
    </div>
  );
}
