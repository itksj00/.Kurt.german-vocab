"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { MemoSentence } from "@/lib/memo";

type Props = { rows: MemoSentence[]; today: string; onChanged: () => void };

export default function MemoManage({ rows, today, onChanged }: Props) {
  const [sentence, setSentence] = useState("");
  const [translation, setTranslation] = useState("");
  const [date, setDate] = useState(""); // 비우면 오늘
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function reset() {
    setSentence("");
    setTranslation("");
    setDate("");
    setEditingId(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!sentence.trim()) {
      setErrorMsg("독일어 문장을 입력하세요.");
      return;
    }
    setSaving(true);
    const payload = {
      sentence: sentence.trim().replace(/\s+/g, " "),
      translation: translation.trim() || null,
      memo_date: date || today,
    };
    const { error } =
      editingId === null
        ? await supabase.from("memo_sentences").insert(payload)
        : await supabase.from("memo_sentences").update(payload).eq("id", editingId);
    setSaving(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    reset();
    onChanged();
  }

  function startEdit(r: MemoSentence) {
    setEditingId(r.id);
    setSentence(r.sentence);
    setTranslation(r.translation ?? "");
    setDate(r.memo_date);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(r: MemoSentence) {
    if (!confirm("이 문장을 삭제할까요?")) return;
    const { error } = await supabase.from("memo_sentences").delete().eq("id", r.id);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    if (editingId === r.id) reset();
    onChanged();
  }

  // 날짜별 묶음 (rows는 이미 날짜 내림차순). 오늘 묶음은 비어 있어도 항상 맨 위에 둔다.
  const groups: { date: string; items: MemoSentence[] }[] = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last && last.date === r.memo_date) last.items.push(r);
    else groups.push({ date: r.memo_date, items: [r] });
  }
  if (!groups.some((g) => g.date === today)) groups.unshift({ date: today, items: [] });

  return (
    <>
      <form className="card" onSubmit={save}>
        <div className="section-title" style={{ marginTop: 0 }}>
          {editingId === null ? "문장 추가 Satz hinzufügen" : "문장 수정 Satz bearbeiten"}
        </div>
        <div className="field">
          <label>독일어 문장 Deutscher Satz</label>
          <textarea
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            rows={2}
            placeholder="예: Als ich in Deutschland war, konnte ich mein Deutsch verbessern."
          />
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <label>뜻 (한국어) Übersetzung — 2단계(직접 입력)의 문제로 쓰입니다</label>
          <input
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
            placeholder="예: 독일에 있을 때 나는 독일어를 향상시킬 수 있었다."
          />
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <label>외우는 날짜 Datum (비우면 오늘)</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {errorMsg && (
          <p className="muted" style={{ color: "var(--danger)", marginTop: 8 }}>
            {errorMsg}
          </p>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "저장 중... Speichert..." : editingId === null ? "추가 Hinzufügen" : "저장 Speichern"}
          </button>
          {editingId !== null && (
            <button className="btn ghost" type="button" onClick={reset}>
              취소 Abbrechen
            </button>
          )}
        </div>
      </form>

      {groups.map((g) => (
        <div className="card" key={g.date}>
          <div className="section-title" style={{ marginTop: 0 }}>
            {g.date === today ? `오늘 Heute (${g.date})` : g.date} · {g.items.length}문장
          </div>
          {g.items.length === 0 ? (
            <p className="muted">오늘 외울 문장을 추가해 보세요. 하루 4문장 정도를 권합니다.</p>
          ) : (
            g.items.map((r) => (
              <div className="word-row" key={r.id} style={{ alignItems: "flex-start" }}>
                <div className="word-main" style={{ flex: 1 }}>
                  {r.sentence}
                  {r.translation && <small>{r.translation}</small>}
                </div>
                <div className="row" style={{ flex: "0 0 auto", gap: 6 }}>
                  <button className="btn ghost small" type="button" onClick={() => startEdit(r)}>
                    수정
                  </button>
                  <button className="btn danger small" type="button" onClick={() => remove(r)}>
                    삭제
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ))}
    </>
  );
}
