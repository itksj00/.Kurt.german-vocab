"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { PatternCase } from "@/lib/types";
import { CASE_OPTIONS, COMMON_PREPS, caseLabel, patternText } from "@/lib/patterns";

export default function PatternForm({ patternId }: { patternId?: number }) {
  const router = useRouter();
  const isEdit = typeof patternId === "number";

  const [verb, setVerb] = useState("");
  const [reflexive, setReflexive] = useState(false);
  const [preposition, setPreposition] = useState("");
  const [patternCase, setPatternCase] = useState<PatternCase>("Akk");
  const [meaning, setMeaning] = useState("");
  const [examples, setExamples] = useState<{ sentence: string; translation: string }[]>([
    { sentence: "", translation: "" },
  ]);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    let active = true;
    async function load() {
      const { data: row, error } = await supabase
        .from("patterns")
        .select("*")
        .eq("id", patternId)
        .single();
      if (!active) return;
      if (error || !row) {
        setErrorMsg(error?.message ?? "패턴을 찾을 수 없습니다.");
        setLoading(false);
        return;
      }
      const { data: exRows } = await supabase
        .from("pattern_examples")
        .select("sentence, translation")
        .eq("pattern_id", patternId);
      setVerb(row.verb);
      setReflexive(!!row.reflexive);
      setPreposition(row.preposition);
      setPatternCase(row.pattern_case as PatternCase);
      setMeaning(row.meaning);
      const loaded = (exRows ?? []).map((r) => ({
        sentence: r.sentence as string,
        translation: (r.translation as string | null) ?? "",
      }));
      setExamples(loaded.length > 0 ? loaded : [{ sentence: "", translation: "" }]);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [isEdit, patternId]);

  function updateExample(i: number, field: "sentence" | "translation", value: string) {
    setExamples((prev) => prev.map((ex, idx) => (idx === i ? { ...ex, [field]: value } : ex)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    // "sich freuen"처럼 sich를 함께 입력하면 재귀동사로 인식하고 동사에서 뗀다.
    let cleanVerb = verb.trim();
    let isReflexive = reflexive;
    if (/^sich\s+/i.test(cleanVerb)) {
      cleanVerb = cleanVerb.replace(/^sich\s+/i, "");
      isReflexive = true;
    }
    const cleanPrep = preposition.trim();

    if (!cleanVerb || !cleanPrep || !meaning.trim()) {
      setErrorMsg("동사, 전치사, 뜻은 필수입니다.");
      return;
    }

    setSaving(true);
    const cleanExamples = examples
      .map((ex) => ({ sentence: ex.sentence.trim(), translation: ex.translation.trim() }))
      .filter((ex) => ex.sentence);
    const payload = {
      verb: cleanVerb,
      reflexive: isReflexive,
      preposition: cleanPrep,
      pattern_case: patternCase,
      meaning: meaning.trim(),
    };

    try {
      let targetId = patternId;
      if (isEdit && targetId) {
        const { error } = await supabase.from("patterns").update(payload).eq("id", targetId);
        if (error) throw error;
        await supabase.from("pattern_examples").delete().eq("pattern_id", targetId);
      } else {
        const { data, error } = await supabase
          .from("patterns")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        targetId = data.id;
      }
      if (cleanExamples.length > 0 && targetId) {
        const rows = cleanExamples.map((ex) => ({
          pattern_id: targetId,
          sentence: ex.sentence,
          translation: ex.translation || null,
        }));
        const { error: exErr } = await supabase.from("pattern_examples").insert(rows);
        if (exErr) throw exErr;
      }
      router.push("/patterns");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!patternId) return;
    if (!confirm("이 패턴을 삭제할까요? 예문도 함께 삭제됩니다.")) return;
    setDeleting(true);
    const { error } = await supabase.from("patterns").delete().eq("id", patternId);
    setDeleting(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    router.push("/patterns");
  }

  if (loading) return <p className="muted">불러오는 중... Lädt...</p>;

  const previewReady = verb.trim() && preposition.trim();
  const preview = previewReady
    ? patternText({
        verb: verb.trim().replace(/^sich\s+/i, ""),
        reflexive: reflexive || /^sich\s+/i.test(verb.trim()),
        preposition: preposition.trim(),
        pattern_case: patternCase,
      })
    : null;

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="section-title">패턴 정보 Musterdaten</div>

      <div className="row">
        <div className="field">
          <label>동사 (원형) Verb</label>
          <input
            value={verb}
            onChange={(e) => setVerb(e.target.value)}
            placeholder="예: freuen, teilnehmen"
          />
        </div>
        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={reflexive}
              onChange={(e) => setReflexive(e.target.checked)}
              style={{ width: "auto", marginRight: 6 }}
            />
            재귀동사 sich
          </label>
        </div>
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        <div className="field">
          <label>전치사 Präposition</label>
          <input
            value={preposition}
            onChange={(e) => setPreposition(e.target.value)}
            placeholder="예: auf"
            list="prep-list"
          />
          <datalist id="prep-list">
            {COMMON_PREPS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label>격 Kasus</label>
          <select
            value={patternCase}
            onChange={(e) => setPatternCase(e.target.value as PatternCase)}
          >
            {CASE_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {caseLabel(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field" style={{ marginTop: 8 }}>
        <label>뜻 Bedeutung</label>
        <input
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          placeholder="예: ~을 기대하다"
        />
      </div>

      {preview && (
        <p className="muted" style={{ marginTop: 10 }}>
          미리보기 Vorschau: <b>{preview}</b>
        </p>
      )}

      <div className="section-title">예문 (여러 개 추가 가능) Beispielsätze</div>
      {examples.map((ex, i) => (
        <div className="ex-item" key={i} style={{ alignItems: "flex-start" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <input
              value={ex.sentence}
              onChange={(e) => updateExample(i, "sentence", e.target.value)}
              placeholder={`예문 ${i + 1} (독일어) Beispielsatz`}
            />
            <input
              value={ex.translation}
              onChange={(e) => updateExample(i, "translation", e.target.value)}
              placeholder="예문 뜻 (한국어) Übersetzung"
            />
          </div>
          {examples.length > 1 && (
            <button
              type="button"
              className="btn ghost small"
              onClick={() => setExamples((prev) => prev.filter((_, idx) => idx !== i))}
            >
              삭제 Löschen
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="btn ghost small"
        onClick={() => setExamples((prev) => [...prev, { sentence: "", translation: "" }])}
      >
        + 예문 추가 Beispiel hinzufügen
      </button>

      {errorMsg && (
        <p className="muted" style={{ color: "var(--danger)", marginTop: 10 }}>
          {errorMsg}
        </p>
      )}

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "저장 중... Speichert..." : "저장 Speichern"}
        </button>
        {isEdit && (
          <button
            type="button"
            className="btn danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "삭제 중... Löscht..." : "패턴 삭제 Muster löschen"}
          </button>
        )}
      </div>
    </form>
  );
}
